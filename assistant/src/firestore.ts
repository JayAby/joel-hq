// Minimal Firestore REST client using a service account.
// The service account bypasses security rules, so every write here is
// targeted (field paths + optional update-time precondition). Nothing ever
// replaces joelhq/state as a whole document.

export interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

type FsValue = Record<string, unknown>

export interface DocMeta {
  data: Record<string, unknown>
  updateTime: string
}

/** One field change. path ['habitLog','abc'] means habitLog.abc only. */
export interface Edit {
  path: string[]
  value: unknown
}

export class ConflictError extends Error {}

/** What the rest of the code depends on, so it can be tested with a fake. */
export interface Db {
  getDoc(path: string): Promise<DocMeta | null>
  update(path: string, edits: Edit[], opts?: { ifUpdateTime?: string }): Promise<void>
  set(path: string, data: Record<string, unknown>): Promise<void>
  remove(path: string): Promise<void>
  list(collection: string): Promise<{ id: string; data: Record<string, unknown> }[]>
}

const DATASTORE_SCOPE = 'https://www.googleapis.com/auth/datastore'
const cached = new Map<string, { token: string; exp: number }>()

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

export function parseServiceAccount(raw: string): ServiceAccount {
  const sa = JSON.parse(raw) as ServiceAccount
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email or private_key')
  }
  return sa
}

export async function accessToken(sa: ServiceAccount, scope: string = DATASTORE_SCOPE): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const hit = cached.get(scope)
  if (hit && hit.exp - 60 > now) return hit.token

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const unsigned = `${header}.${claim}`
  const key = await importKey(sa.private_key)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cached.set(scope, { token: data.access_token, exp: now + data.expires_in })
  return data.access_token
}

// ---- value conversion --------------------------------------------------

export function fromFs(v: FsValue): unknown {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) {
    const vals = ((v.arrayValue as { values?: FsValue[] }).values ?? []) as FsValue[]
    return vals.map(fromFs)
  }
  if ('mapValue' in v) {
    const fields = ((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {}) as Record<string, FsValue>
    return fromFsFields(fields)
  }
  return null
}

export function fromFsFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) out[k] = fromFs(v)
  return out
}

export function toFs(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } }
  if (typeof v === 'object') {
    const fields: Record<string, FsValue> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val !== undefined) fields[k] = toFs(val)
    }
    return { mapValue: { fields } }
  }
  throw new Error(`Cannot convert ${typeof v} to a Firestore value`)
}

function quoteSegment(seg: string): string {
  return '`' + seg.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`'
}

/** Builds the nested `fields` body for a set of path edits. */
export function nestEdits(edits: Edit[]): Record<string, FsValue> {
  const root: Record<string, FsValue> = {}
  for (const e of edits) {
    let cur = root
    for (let i = 0; i < e.path.length - 1; i++) {
      const k = e.path[i]
      let node = cur[k] as { mapValue: { fields: Record<string, FsValue> } } | undefined
      if (!node) {
        node = { mapValue: { fields: {} } }
        cur[k] = node
      }
      cur = node.mapValue.fields
    }
    cur[e.path[e.path.length - 1]] = toFs(e.value)
  }
  return root
}

// ---- client ------------------------------------------------------------

export class Firestore implements Db {
  constructor(private sa: ServiceAccount) {}

  private url(path: string): string {
    return `https://firestore.googleapis.com/v1/projects/${this.sa.project_id}/databases/(default)/documents/${path}`
  }

  private async call(method: string, url: string, body?: unknown): Promise<Response> {
    const token = await accessToken(this.sa)
    return fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  async getDoc(path: string): Promise<DocMeta | null> {
    const res = await this.call('GET', this.url(path))
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Firestore get ${path} failed: ${res.status} ${await res.text()}`)
    const doc = (await res.json()) as { fields?: Record<string, FsValue>; updateTime: string }
    return { data: fromFsFields(doc.fields ?? {}), updateTime: doc.updateTime }
  }

  async update(path: string, edits: Edit[], opts?: { ifUpdateTime?: string }): Promise<void> {
    if (edits.length === 0) return
    const params = edits.map((e) => `updateMask.fieldPaths=${encodeURIComponent(e.path.map(quoteSegment).join('.'))}`)
    if (opts?.ifUpdateTime) params.push(`currentDocument.updateTime=${encodeURIComponent(opts.ifUpdateTime)}`)
    const res = await this.call('PATCH', `${this.url(path)}?${params.join('&')}`, { fields: nestEdits(edits) })
    if (!res.ok) {
      const text = await res.text()
      if (opts?.ifUpdateTime && [400, 409, 412].includes(res.status) && /FAILED_PRECONDITION|ABORTED|updateTime/i.test(text)) {
        throw new ConflictError(`Document ${path} changed while writing`)
      }
      throw new Error(`Firestore update ${path} failed: ${res.status} ${text}`)
    }
  }

  async set(path: string, data: Record<string, unknown>): Promise<void> {
    await this.update(
      path,
      Object.entries(data)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => ({ path: [k], value: v })),
    )
  }

  async remove(path: string): Promise<void> {
    const res = await this.call('DELETE', this.url(path))
    if (!res.ok && res.status !== 404) throw new Error(`Firestore delete ${path} failed: ${res.status} ${await res.text()}`)
  }

  async list(collection: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
    const res = await this.call('GET', `${this.url(collection)}?pageSize=300`)
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`Firestore list ${collection} failed: ${res.status} ${await res.text()}`)
    const body = (await res.json()) as { documents?: { name: string; fields?: Record<string, FsValue> }[] }
    return (body.documents ?? []).map((d) => ({
      id: d.name.split('/').pop() as string,
      data: fromFsFields(d.fields ?? {}),
    }))
  }
}
