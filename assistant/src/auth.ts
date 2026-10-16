// Verifies a Firebase login token (ID token) so the website can talk to the
// assistant without any secret in the page. Checks signature, issuer,
// audience, expiry and that the email is Joel's.

export interface Jwk {
  kid: string
  kty: string
  n: string
  e: string
  alg?: string
}

export type LoadKeys = () => Promise<Jwk[]>

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

let keyCache: { keys: Jwk[]; exp: number } | null = null

async function loadGoogleKeys(): Promise<Jwk[]> {
  const now = Date.now()
  if (keyCache && keyCache.exp > now) return keyCache.keys
  const res = await fetch(JWKS_URL)
  if (!res.ok) throw new Error(`Could not load Firebase signing keys: ${res.status}`)
  const body = (await res.json()) as { keys: Jwk[] }
  keyCache = { keys: body.keys, exp: now + 3600_000 }
  return body.keys
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function decodeJson(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part))) as Record<string, unknown>
}

export type VerifyResult = { ok: true; email: string } | { ok: false; reason: string }

export async function verifyFirebaseIdToken(
  token: string,
  opts: { projectId: string; allowedEmail: string; nowSeconds?: number; loadKeys?: LoadKeys },
): Promise<VerifyResult> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return { ok: false, reason: 'malformed' }
    const header = decodeJson(parts[0])
    const payload = decodeJson(parts[1])
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return { ok: false, reason: 'bad header' }

    const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
    if (payload.aud !== opts.projectId) return { ok: false, reason: 'wrong audience' }
    if (payload.iss !== `https://securetoken.google.com/${opts.projectId}`) return { ok: false, reason: 'wrong issuer' }
    if (typeof payload.exp !== 'number' || payload.exp <= now) return { ok: false, reason: 'expired' }
    if (typeof payload.iat !== 'number' || payload.iat > now + 60) return { ok: false, reason: 'issued in the future' }
    if (typeof payload.sub !== 'string' || !payload.sub) return { ok: false, reason: 'no subject' }

    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : ''
    if (!email || email !== opts.allowedEmail.toLowerCase()) return { ok: false, reason: 'not allowed' }

    const keys = await (opts.loadKeys ?? loadGoogleKeys)()
    const jwk = keys.find((k) => k.kid === header.kid)
    if (!jwk) return { ok: false, reason: 'unknown key' }

    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    )
    return valid ? { ok: true, email } : { ok: false, reason: 'bad signature' }
  } catch (e) {
    return { ok: false, reason: `error: ${String(e)}` }
  }
}
