// Offline smoke test: fake database + fake AI. Run with: npm test
import assert from 'node:assert/strict'
import { approve, handleMessage, HttpError, undo } from '../src/assistant'
import { nestEdits } from '../src/firestore'
import { FakeDb } from './fakes'
import { isSensitive } from '../src/privacy'
import { parseTime, resolveDate } from '../src/dates'

const now = new Date('2026-10-15T10:00:00Z') // Thu 11:00 London
const seed = () => {
  const db = new FakeDb()
  db.docs.set('joelhq/state', {
    updateTime: 't0',
    data: {
      tasks: [{ id: 'x', t: 'Code', done: false, date: '2026-10-15' }],
      projects: [{ id: 'p1', t: 'StudyPulse', done: false }, { id: 'p2', t: 'Portfolio site', done: false }],
      goals: [{ id: 'g1', t: 'Debt free by December', done: false }],
      career: [{ id: 'c1', t: 'Update CV', done: false }],
      habitLog: {},
      shoppingItems: [],
      balance: '£1,234.56',
      debts: [{ name: 'Card', target: 1000, current: 250 }],
      notes: ['secret note about my girlfriend'],
      fitness: { weight: '70kg' },
    },
  })
  db.docs.set('plans/h1', { updateTime: 'p', data: { kind: 'habit', name: 'Skincare', active: true } })
  db.docs.set('plans/h2', { updateTime: 'p', data: { kind: 'habit', name: 'Gym', active: true } })
  return db
}

let aiCalls = 0
let lastPrompt = ''
const fakeAi = (reply: string) => async (system: string) => {
  aiCalls++
  lastPrompt = system
  return reply
}

async function main() {
  // dates and times
  assert.equal(resolveDate('tomorrow', now), '2026-10-16')
  assert.equal(resolveDate('friday', now), '2026-10-16')
  assert.equal(resolveDate('thursday', now), '2026-10-22')
  assert.equal(resolveDate('2026-02-30', now), null)
  assert.equal(resolveDate('whenever', now), null)
  assert.equal(parseTime('5pm'), '17:00')
  assert.equal(parseTime('12am'), '00:00')
  assert.equal(parseTime('9:05'), '09:05')
  assert.equal(parseTime('25:00'), null)

  // privacy matching: no false positives on ordinary words
  for (const s of ['dinner with my girlfriend', 'doctor appointment', 'pay rent', 'church on sunday', 'spent £20'])
    assert.equal(isSensitive(s), true, s)
  for (const s of ['Code for 2 hours', 'This will be a current project', 'still working on the taxi app', 'Gym'])
    assert.equal(isSensitive(s), false, s)

  // nested edit body
  const nested = nestEdits([{ path: ['habitLog', 'h1'], value: ['a'] }, { path: ['tasks'], value: [] }])
  assert.ok((nested.habitLog as { mapValue: { fields: object } }).mapValue.fields)

  // 1. propose -> nothing changes -> approve -> change -> undo
  let db = seed()
  const ai1 = fakeAi(
    JSON.stringify({
      reply: 'Added gym for tomorrow.',
      actions: [{ type: 'add_task', text: 'Gym', date: 'tomorrow', time: '5pm' }],
    }),
  )
  let r = await handleMessage(db, ai1, 'gym tomorrow 5pm', now)
  assert.ok(r.proposalId)
  assert.equal(((await db.getDoc('joelhq/state'))!.data.tasks as unknown[]).length, 1, 'no change before approval')

  // the AI must never see finance, notes, fitness, or the private goal
  for (const bad of ['1,234', 'Card', 'secret note', '70kg', 'Debt free', 'girlfriend'])
    assert.ok(!lastPrompt.includes(bad), `prompt leaked: ${bad}`)
  assert.ok(lastPrompt.includes('[private item]'))
  assert.ok(lastPrompt.includes('StudyPulse') && lastPrompt.includes('Skincare'))

  const ap = await approve(db, r.proposalId!, now)
  const st = (await db.getDoc('joelhq/state'))!.data
  const added = (st.tasks as { t: string; date: string; time: string }[]).find((t) => t.t === 'Gym')!
  assert.equal(added.date, '2026-10-16')
  assert.equal(added.time, '17:00')
  assert.equal(st.balance, '£1,234.56', 'finance untouched')
  await assert.rejects(() => approve(db, r.proposalId!, now), (e) => e instanceof HttpError && e.status === 409)
  await undo(db, ap.activityId, now)
  assert.equal(((await db.getDoc('joelhq/state'))!.data.tasks as unknown[]).length, 1, 'undo removed it')
  await assert.rejects(() => undo(db, ap.activityId, now), (e) => e instanceof HttpError && e.status === 409)

  // 2. habit, then the same habit again is a no-op, undo
  db = seed()
  r = await handleMessage(db, fakeAi(JSON.stringify({ reply: 'ok', actions: [{ type: 'mark_habit_done', habit: 'skincare', date: 'today' }] })), 'did skincare', now)
  let a = await approve(db, r.proposalId!, now)
  assert.deepEqual(((await db.getDoc('joelhq/state'))!.data.habitLog as Record<string, string[]>).h1, ['2026-10-15'])
  r = await handleMessage(db, fakeAi(JSON.stringify({ reply: 'ok', actions: [{ type: 'mark_habit_done', habit: 'skincare', date: 'today' }] })), 'did skincare', now)
  const a2 = await approve(db, r.proposalId!, now)
  await undo(db, a2.activityId, now) // noop, must not remove the first entry
  assert.deepEqual(((await db.getDoc('joelhq/state'))!.data.habitLog as Record<string, string[]>).h1, ['2026-10-15'])
  await undo(db, a.activityId, now)
  assert.deepEqual(((await db.getDoc('joelhq/state'))!.data.habitLog as Record<string, string[]>).h1, [])

  // 3. project progress goes to its own collection, linked to the project
  db = seed()
  r = await handleMessage(db, fakeAi(JSON.stringify({ reply: 'ok', actions: [{ type: 'log_progress', project: 'studypulse', summary: 'Did auth', next: 'database' }] })), 'worked on studypulse', now)
  a = await approve(db, r.proposalId!, now)
  const sessions = await db.list('projectSessions')
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].data.projectId, 'p1')
  await undo(db, a.activityId, now)
  assert.equal((await db.list('projectSessions')).length, 0)

  // 4. forbidden or unknown actions are dropped with a warning
  db = seed()
  aiCalls = 0
  r = await handleMessage(db, fakeAi(JSON.stringify({ reply: 'ok', actions: [{ type: 'delete_task', id: 'x' }, { type: 'update_balance', value: '0' }, { type: 'mark_habit_done', habit: 'nope', date: 'today' }] })), 'wipe everything', now)
  assert.equal(r.proposalId, undefined)
  assert.equal(r.warnings.length, 3)

  // 5. personal messages are not sent to the AI, unless "share:"
  aiCalls = 0
  r = await handleMessage(db, fakeAi('{"reply":"x","actions":[]}'), 'dinner with my girlfriend at 7', now)
  assert.equal(aiCalls, 0)
  assert.ok(r.reply.includes('share:'))
  await handleMessage(db, fakeAi('{"reply":"x","actions":[]}'), 'share: dinner with my girlfriend at 7pm', now)
  assert.equal(aiCalls, 1)

  // 6. manual commands never call the AI
  aiCalls = 0
  r = await handleMessage(db, fakeAi('SHOULD NOT RUN'), 'task: buy shoes for the doctor tomorrow 5pm', now)
  assert.equal(aiCalls, 0)
  assert.ok(r.proposalId)
  const prop = (await db.getDoc(`proposals/${r.proposalId}`))!.data.actions as { text: string; date: string; time: string }[]
  assert.equal(prop[0].date, '2026-10-16')
  assert.equal(prop[0].time, '17:00')
  assert.equal(prop[0].text, 'buy shoes for the doctor')

  // 7. a change made in the browser mid-write is never overwritten
  db = seed()
  r = await handleMessage(db, fakeAi(JSON.stringify({ reply: 'ok', actions: [{ type: 'add_shopping', name: 'Milk', category: 'grocery' }] })), 'add milk', now)
  // arm a simulated browser write that lands between the read and the write
  const realUpdate = db.update
  let armed = false
  db.update = async (path, edits, opts) => {
    if (path === 'joelhq/state' && !armed) {
      armed = true
      const cur = db.docs.get('joelhq/state')!
      ;(cur.data.tasks as unknown[]).push({ id: 'browser', t: 'Added in browser', done: false })
      cur.updateTime = 'browser-write'
    }
    return realUpdate(path, edits, opts)
  }
  await approve(db, r.proposalId!, now)
  const fin = (await db.getDoc('joelhq/state'))!.data
  assert.equal((fin.shoppingItems as { name: string; category: string }[])[0].category, 'Grocery')
  assert.ok((fin.tasks as { id: string }[]).some((t) => t.id === 'browser'), 'browser change survived')

  // 8. garbage from the model does not crash or act
  r = await handleMessage(db, fakeAi('lol I am not json'), 'hello', now)
  assert.equal(r.proposalId, undefined)

  console.log('ALL TESTS PASSED')
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
