// Phone notifications: wording, privacy, sending, dead-token cleanup, and the hook.
import assert from 'node:assert/strict'
import { pushText, sendPush } from '../src/push'
import { runProactive } from '../src/proactive'
import { FakeDb } from './fakes'

async function main() {
  // wording
  assert.deepEqual(pushText('evening', 'x'), { title: 'Evening check-in', body: 'Tap to log what you did today.' })
  assert.deepEqual(pushText('reminder', 'Gym is in 10 minutes (17:00).'), { title: 'Gym', body: 'In 10 minutes (17:00)' })
  assert.deepEqual(pushText('reminder', 'Work - St Matthews is now (14:45).'), { title: 'Work - St Matthews', body: 'Now (14:45)' })
  assert.equal(pushText('morning', 'Good morning, Joel.\n\nToday: 14:45 Work - St Matthews').body, '14:45 Work - St Matthews')
  assert.equal(pushText('morning', 'Good morning, Joel.\n\nNothing fixed in your day yet.').body, 'Your plan for today is ready.')

  // privacy: personal-looking items never reach the lock screen
  assert.deepEqual(pushText('reminder', 'Dentist is in 10 minutes (09:00).'), { title: 'Reminder', body: 'In 10 minutes (09:00)' })
  assert.equal(pushText('morning', 'Good morning, Joel.\n\nToday: 09:00 Doctor · 14:45 Work').body, 'Your plan for today is ready.')

  // sending: one request per saved phone, correct shape, dead token removed
  const db = new FakeDb()
  db.docs.set('events/pushToken_a', { updateTime: 't', data: { kind: 'push-token', token: 'TOKEN_A' } })
  db.docs.set('events/pushToken_b', { updateTime: 't', data: { kind: 'push-token', token: 'TOKEN_B_DEAD' } })
  db.docs.set('events/other', { updateTime: 't', data: { kind: 'something-else', token: 'IGNORED' } })
  const calls: { url: string; auth: string; body: { message: Record<string, unknown> } }[] = []
  const call = async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    calls.push({ url, auth: String((init.headers as Record<string, string>).Authorization), body })
    return body.message.token === 'TOKEN_B_DEAD'
      ? new Response('{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}', { status: 404 })
      : new Response('{}', { status: 200 })
  }
  const deps = { db, projectId: 'proj-1', getAccessToken: async () => 'ACCESS', call }
  const r = await sendPush(deps, { title: 'Gym', body: 'In 10 minutes (17:00)', kind: 'reminder' })
  assert.deepEqual(r, { sent: 1, removed: 1 })
  assert.equal(calls.length, 2) // the unrelated events doc is ignored
  assert.equal(calls[0].url, 'https://fcm.googleapis.com/v1/projects/proj-1/messages:send')
  assert.equal(calls[0].auth, 'Bearer ACCESS')
  const msg = calls[0].body.message as { notification: object; android: { priority: string; notification: { channel_id: string } } }
  assert.deepEqual(msg.notification, { title: 'Gym', body: 'In 10 minutes (17:00)' })
  assert.equal(msg.android.priority, 'HIGH')
  assert.equal(msg.android.notification.channel_id, 'assistant')
  assert.equal(db.docs.has('events/pushToken_b'), false) // cleaned up
  assert.equal(db.docs.has('events/pushToken_a'), true)

  // no phones saved: nothing is sent and nothing breaks
  assert.deepEqual(await sendPush({ ...deps, db: new FakeDb() }, { title: 'x', body: 'y', kind: 'morning' }), { sent: 0, removed: 0 })

  // a network failure never throws
  const boom = await sendPush({ ...deps, call: async () => { throw new Error('offline') } }, { title: 'x', body: 'y', kind: 'morning' })
  assert.equal(boom.sent, 0)

  // the proactive hook: pushes each message once, and a failing push never stops the message
  const db2 = new FakeDb()
  db2.docs.set('joelhq/state', { updateTime: 't0', data: { tasks: [{ id: 'g', t: 'Gym', time: '17:00', done: false, date: '2026-10-24' }], habitLog: {} } })
  const pushed: string[] = []
  const at = (h: number, m: number) => new Date(`2026-10-24T${String(h - 1).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`)
  await runProactive(db2, at(8, 0), undefined, async (kind) => { pushed.push(kind) })
  await runProactive(db2, at(16, 50), undefined, async (kind) => { pushed.push(kind) })
  await runProactive(db2, at(16, 52), undefined, async (kind) => { pushed.push(kind) })
  assert.deepEqual(pushed, ['morning', 'reminder'])
  const db3 = new FakeDb()
  db3.docs.set('joelhq/state', { updateTime: 't0', data: { tasks: [], habitLog: {} } })
  const did = await runProactive(db3, at(8, 0), undefined, async () => { throw new Error('fcm down') })
  assert.deepEqual(did, ['morning'])
  assert.equal([...db3.docs.keys()].filter((k) => k.startsWith('messages/')).length, 1)

  console.log('push tests passed')
}
main().catch((e) => { console.error(e); process.exit(1) })
