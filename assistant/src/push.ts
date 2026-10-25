// Phone notifications through Firebase Cloud Messaging (free).
// The app saves its phone's token in Firestore (events/pushToken_...). When the
// assistant sends a briefing, reminder or check-in, it also pushes a short
// notification to every saved token. The text is deliberately plain:
// personal-looking titles are replaced, because notifications pass through
// Google's servers and show on the lock screen.

import { redact, PRIVATE_PLACEHOLDER } from './privacy'
import type { Db } from './firestore'

export interface PushText {
  title: string
  body: string
}

const firstLine = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean)[0] ?? ''
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 3)}...` : s)

export function pushText(kind: string, text: string): PushText {
  if (kind === 'morning') {
    const today = text.split('\n').find((l) => l.startsWith('Today: '))
    const line = today ? redact(today.slice(7)) : ''
    return {
      title: 'Morning briefing',
      body: line && line !== PRIVATE_PLACEHOLDER ? clip(line, 120) : 'Your plan for today is ready.',
    }
  }
  if (kind === 'reminder') {
    // "Gym is in 10 minutes (17:00)."  ->  title "Gym", body "In 10 minutes (17:00)"
    const m = firstLine(text).match(/^(.*) is (now|in \d+ minutes?)( \(\d{2}:\d{2}\))?\.?$/)
    const name = m ? redact(m[1]) : PRIVATE_PLACEHOLDER
    const when = m ? `${m[2] === 'now' ? 'Now' : `In ${m[2].slice(3)}`}${m[3] ?? ''}` : 'Coming up'
    return { title: name === PRIVATE_PLACEHOLDER ? 'Reminder' : clip(name, 60), body: when }
  }
  if (kind === 'weekly') return { title: 'Your week ahead', body: 'Tap to see the plan and add sessions.' }
  if (kind === 'checkin') {
    const q = redact(firstLine(text))
    return { title: 'Quick check', body: q && q !== PRIVATE_PLACEHOLDER ? clip(q, 100) : 'Tap to answer.' }
  }
  if (kind === 'evening') return { title: 'Evening check-in', body: 'Tap to log what you did today.' }
  return { title: 'Assistant', body: 'You have a new message.' }
}

export const PUSH_COLLECTION = 'events'
const isTokenDoc = (d: { data: Record<string, unknown> }) => d.data.kind === 'push-token' && typeof d.data.token === 'string'

export interface SenderDeps {
  db: Db
  projectId: string
  getAccessToken: () => Promise<string>
  call?: (url: string, init: RequestInit) => Promise<Response>
}

/** Sends one notification to every saved phone. Dead tokens are removed. Never throws. */
export async function sendPush(deps: SenderDeps, message: PushText & { kind: string }): Promise<{ sent: number; removed: number }> {
  const result = { sent: 0, removed: 0 }
  try {
    const docs = (await deps.db.list(PUSH_COLLECTION)).filter(isTokenDoc)
    if (docs.length === 0) return result
    const accessToken = await deps.getAccessToken()
    const call = deps.call ?? ((url, init) => fetch(url, init))
    const url = `https://fcm.googleapis.com/v1/projects/${deps.projectId}/messages:send`
    for (const d of docs) {
      const res = await call(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: d.data.token,
            notification: { title: message.title, body: message.body },
            data: { kind: message.kind },
            android: { priority: 'HIGH', notification: { channel_id: 'assistant' } },
          },
        }),
      })
      if (res.ok) {
        result.sent++
        continue
      }
      const text = await res.text().catch(() => '')
      if (res.status === 404 || /UNREGISTERED|NOT_FOUND|registration-token-not-registered/i.test(text)) {
        await deps.db.remove(`${PUSH_COLLECTION}/${d.id}`)
        result.removed++
      } else {
        console.error('push failed', res.status, text.slice(0, 200))
      }
    }
  } catch (e) {
    console.error('push error', e)
  }
  return result
}
