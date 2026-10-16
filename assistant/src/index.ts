import { approve, handleMessage, HttpError, reject, saveExchange, undo } from './assistant'
import { verifyFirebaseIdToken } from './auth'
import { makeRunAi, type AiEnv } from './ai'
import { Firestore, parseServiceAccount, type Db } from './firestore'
import { londonDateKey, londonMondayOf, londonResetDayKey, londonTime } from './london'

interface Env extends AiEnv {
  /** Whole service-account JSON, stored with `wrangler secret put`. */
  FIREBASE_SERVICE_ACCOUNT: string
  /** Long random string you choose. Lets you test from Terminal with curl. */
  ADMIN_TOKEN: string
  /** The only login email allowed to use the assistant from the website. */
  ALLOWED_EMAIL: string
  /** Comma-separated list of website addresses allowed to call this API. */
  ALLOWED_ORIGINS: string
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin')
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  if (!origin || !allowed.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })
}

function db(env: Env): Db {
  return new Firestore(parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT))
}

/** Constant-time string comparison. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function adminOk(req: Request, env: Env): boolean {
  const header = req.headers.get('Authorization') ?? ''
  const expected = `Bearer ${env.ADMIN_TOKEN}`
  if (!env.ADMIN_TOKEN || header.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

/** Either the admin token (curl) or a valid Firebase login for Joel's email (website, app). */
async function authorised(req: Request, env: Env): Promise<boolean> {
  if (adminOk(req, env)) return true
  const header = req.headers.get('Authorization') ?? ''
  if (!header.startsWith('Bearer ') || !env.ALLOWED_EMAIL) return false
  const token = header.slice(7)
  if (token.split('.').length !== 3) return false
  const sa = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT)
  const result = await verifyFirebaseIdToken(token, { projectId: sa.project_id, allowedEmail: env.ALLOWED_EMAIL })
  return result.ok
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    return ((await req.json()) ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const res = await route(req, env)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  },

  // Every 5 minutes. For now it only records a heartbeat. Briefings and
  // reminders arrive in the next phase.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const now = new Date()
    try {
      await db(env).update('assistant/heartbeat', [
        { path: ['lastTickIso'], value: now.toISOString() },
        { path: ['londonDate'], value: londonDateKey(now) },
        { path: ['londonTime'], value: londonTime(now) },
      ])
    } catch (e) {
      console.error('heartbeat failed', e)
    }
  },
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const now = new Date()

  // Open to anyone, reveals nothing private.
  if (url.pathname === '/health') {
    return json({
      ok: true,
      londonDate: londonDateKey(now),
      londonTime: londonTime(now),
      logicalDay: londonResetDayKey(now),
      logicalWeekMonday: londonMondayOf(now),
    })
  }

  // Everything below needs the admin token or Joel's Firebase login.
  if (!(await authorised(req, env))) return json({ error: 'unauthorized' }, 401)

  try {
    if (url.pathname === '/debug' && req.method === 'GET') {
      const d = db(env)
      const state = await d.getDoc('joelhq/state')
      const heartbeat = await d.getDoc('assistant/heartbeat')
      return json({
        stateFound: state !== null,
        stateFieldNames: state ? Object.keys(state.data) : [],
        heartbeat: heartbeat?.data ?? null,
      })
    }

    if (req.method === 'POST') {
      const b = await body(req)
      if (url.pathname === '/ask') {
        if (typeof b.message !== 'string') return json({ error: 'message is required' }, 400)
        const d = db(env)
        const result = await handleMessage(d, makeRunAi(env), b.message, now)
        await saveExchange(d, b.message, result, now)
        return json(result)
      }
      if (url.pathname === '/approve') {
        if (typeof b.id !== 'string') return json({ error: 'id is required' }, 400)
        return json(await approve(db(env), b.id, now))
      }
      if (url.pathname === '/reject') {
        if (typeof b.id !== 'string') return json({ error: 'id is required' }, 400)
        return json(await reject(db(env), b.id, now))
      }
      if (url.pathname === '/undo') {
        if (typeof b.id !== 'string') return json({ error: 'id is required' }, 400)
        return json(await undo(db(env), b.id, now))
      }
    }
    return json({ error: 'not found' }, 404)
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: 'Something went wrong on the server.' }, 500)
  }
}
