// Goals, routines, questions, check-ins, snooze buttons, weekly plan, quiet hours.
import assert from 'node:assert/strict'
import { handleMessage, quickAction, undo } from '../src/assistant'
import { parseGoal, parseRoutine, routineOn } from '../src/routines'
import { runProactive } from '../src/proactive'
import { pushText } from '../src/push'
import { FakeDb } from './fakes'

const now = new Date('2026-10-22T10:00:00Z') // Thu 11:00 London (BST)
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(`2026-10-22T${String(h - 1).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`)
}
const noAi = async () => '{}'

type Msg = { key: string; kind: string; text: string; quick?: { id: string; label: string; kind: string; done?: boolean; date?: string; time?: string }[] }
const msgs = (db: FakeDb): Msg[] =>
  [...db.docs.entries()].filter(([k]) => k.startsWith('messages/')).map(([k, v]) => ({ key: k.split('/')[1], ...(v.data as object) })) as unknown as Msg[]
const tasksOf = (db: FakeDb) => db.docs.get('joelhq/state')!.data.tasks as { id: string; t: string; time?: string; date: string; done?: boolean; skipped?: boolean; minutes?: number }[]
const fresh = (tasks: unknown[] = []) => {
  const db = new FakeDb()
  db.docs.set('joelhq/state', { updateTime: 't0', data: { tasks, habitLog: {} } })
  return db
}

async function main() {
  // ---- parsing
  assert.deepEqual(parseGoal('Masters 4x/week 90min'), { name: 'Masters', perWeek: 4, minutes: 90 })
  assert.deepEqual(parseGoal('driving 2 a week'), { name: 'Driving', perWeek: 2, minutes: 60 })
  assert.equal(typeof parseGoal('banana'), 'string')

  const fri = parseRoutine('Football every 2 weeks friday 19:00 ask', '2026-10-22') as Exclude<ReturnType<typeof parseRoutine>, string>
  assert.deepEqual({ n: fri.name, d: fri.days, t: fri.time, e: fri.every, m: fri.mode, a: fri.anchor }, { n: 'Football', d: [5], t: '19:00', e: 2, m: 'ask', a: '2026-10-19' })
  const r = { id: 'x', ...fri }
  assert.deepEqual(['2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13'].map((d) => routineOn(r, d)), [true, false, true, false])
  const mwf = parseRoutine('work mon wed fri 9am add', '2026-10-22') as Exclude<ReturnType<typeof parseRoutine>, string>
  assert.deepEqual({ d: mwf.days, t: mwf.time, m: mwf.mode, n: mwf.name }, { d: [1, 3, 5], t: '09:00', m: 'add', n: 'Work' })
  assert.match(parseRoutine('football every friday', '2026-10-22') as string, /time/i)
  assert.match(parseRoutine('football 19:00', '2026-10-22') as string, /day/i)

  // ---- chat commands
  const cmdDb = fresh()
  assert.match((await handleMessage(cmdDb, noAi, 'goal: Masters 4x/week 90min', now)).reply, /Masters, 4 sessions a week, 90 minutes/)
  assert.match((await handleMessage(cmdDb, noAi, 'routine: football every 2 weeks friday 19:00 ask', now)).reply, /Football: Fri, every other week at 19:00/)
  assert.match((await handleMessage(cmdDb, noAi, 'goals', now)).reply, /Masters: 4x a week, 90 min/)
  assert.match((await handleMessage(cmdDb, noAi, 'routines', now)).reply, /Football/)
  assert.match((await handleMessage(cmdDb, noAi, 'drop routine foot', now)).reply, /Removed routine: Football/)
  assert.match((await handleMessage(cmdDb, noAi, 'routines', now)).reply, /No routines/)
  assert.match((await handleMessage(cmdDb, noAi, 'drop goal nothing', now)).reply, /could not find/)
  assert.match((await handleMessage(cmdDb, noAi, 'set quiet 21:00 08:30', now)).reply, /21:00 until 08:30/)

  // ---- quiet hours come from the profile
  assert.deepEqual(await runProactive(cmdDb, at('08:00')), [])

  // ---- routines in the morning briefing, and goals falling behind
  const db = fresh()
  await handleMessage(db, noAi, 'routine: Football thursday 20:00 ask', now)
  await handleMessage(db, noAi, 'routine: Dentist thursdays 09:30 add', now)
  await handleMessage(db, noAi, 'goal: Masters 4x/week 90min', now)
  assert.deepEqual(await runProactive(db, at('08:00')), ['morning'])
  assert.ok(tasksOf(db).some((t) => t.t === 'Dentist' && t.time === '09:30' && t.date === '2026-10-22')) // "add" goes straight on the list
  assert.ok(!tasksOf(db).some((t) => t.t === 'Football')) // "ask" waits for an answer
  const morning = msgs(db).find((m) => m.kind === 'morning')!
  assert.match(morning.text, /Football at 20:00 today\. Want it on your list\?/)
  assert.match(morning.text, /Masters: 0 of 4 this week\. I would do 90 min at 17:00\./)
  assert.deepEqual(morning.quick!.map((q) => q.label), ['Yes, add Football', 'Not this time', 'Add 17:00 Masters'])
  const yes = morning.quick![0]
  await quickAction(db, morning.key, yes.id, at('08:05'))
  assert.ok(tasksOf(db).some((t) => t.t === 'Football' && t.time === '20:00'))
  const after = msgs(db).find((m) => m.kind === 'morning')!
  assert.ok(after.quick![0].done && after.quick![1].done) // answering closes both buttons
  assert.ok(!after.quick![2].done)
  await quickAction(db, morning.key, after.quick![2].id, at('08:06'))
  const session = tasksOf(db).find((t) => t.t === 'Masters session')!
  assert.deepEqual({ time: session.time, minutes: session.minutes }, { time: '17:00', minutes: 90 })

  // ---- "not this time" adds nothing
  const db3 = fresh()
  await handleMessage(db3, noAi, 'routine: Football thursday 20:00 ask', now)
  await runProactive(db3, at('08:00'))
  const m3 = msgs(db3).find((m) => m.kind === 'morning')!
  await quickAction(db3, m3.key, m3.quick![1].id, at('08:05'))
  assert.equal(tasksOf(db3).length, 0)
  assert.ok(msgs(db3).find((m) => m.kind === 'morning')!.quick!.every((q) => q.done))

  // ---- the study session ends: "did you do it?"
  const did1 = await runProactive(db, at('19:00'))
  assert.ok(did1.includes('checkin'), did1.join())
  const check = msgs(db).find((m) => m.kind === 'checkin')!
  assert.equal(check.text, 'Did you get your Masters session done?')
  assert.deepEqual(check.quick!.map((q) => q.label), ['Yes, done', 'Not today'])
  assert.ok(!(await runProactive(db, at('19:05'))).includes('checkin')) // asked once
  await quickAction(db, check.key, 'yes', at('19:06'))
  assert.equal(tasksOf(db).find((t) => t.t === 'Masters session')!.done, true)
  const goalDoc = [...db.docs.entries()].find(([k, v]) => k.startsWith('assistant/goal_') && v.data.kind === 'goal')!
  assert.deepEqual(goalDoc[1].data.done, ['2026-10-22'])
  // evening: nothing left to ask about, so no message
  assert.deepEqual(await runProactive(db, at('21:00')), [])

  // ---- "not today" skips the session
  const db4 = fresh([{ id: 's1', t: 'Masters session', time: '10:00', minutes: 60, date: '2026-10-22', done: false }])
  await handleMessage(db4, noAi, 'goal: Masters 3x/week', now)
  assert.ok((await runProactive(db4, at('11:30'))).includes('checkin'))
  await quickAction(db4, msgs(db4).find((m) => m.kind === 'checkin')!.key, 'no', at('11:31'))
  assert.equal(tasksOf(db4)[0].skipped, true)

  // ---- reminders have Done and "30 min later", and both can be undone
  const db5 = fresh([{ id: 'g1', t: 'Gym', time: '17:00', date: '2026-10-22', done: false }])
  assert.deepEqual(await runProactive(db5, at('16:52')), ['reminder:g1'])
  const rem = msgs(db5).find((m) => m.kind === 'reminder')!
  assert.deepEqual(rem.quick!.map((q) => q.label), ['Done', '30 min later'])
  const moved = await quickAction(db5, rem.key, 'later', at('16:53'))
  assert.equal(tasksOf(db5)[0].time, '17:30')
  await undo(db5, moved.activityId!, at('16:54'))
  assert.equal(tasksOf(db5)[0].time, '17:00')
  await quickAction(db5, rem.key, 'done', at('16:55')) // already answered by the group? no: later closed both
  assert.ok(!tasksOf(db5)[0].done) // the group was closed by the first tap, so this does nothing

  // ---- Sunday plan for the week ahead
  const sun = new Date('2026-11-01T18:30:00Z') // Sun 18:30 London (GMT)
  const db6 = fresh([{ id: 'w1', t: 'Work', time: '09:00', date: '2026-11-03', done: false }])
  await handleMessage(db6, noAi, 'goal: Masters 3x/week 60min', sun)
  await handleMessage(db6, noAi, 'routine: Football monday 20:00 add', sun)
  assert.deepEqual(await runProactive(db6, sun), ['weekly'])
  const wk = msgs(db6).find((m) => m.kind === 'weekly')!
  assert.match(wk.text, /Your week ahead\./)
  assert.match(wk.text, /Mon: Football 20:00/)
  assert.match(wk.text, /Tue: Work 09:00/)
  assert.match(wk.text, /Masters: 3 sessions of 60 min/)
  assert.equal(wk.quick!.length, 3)
  assert.ok(wk.quick!.every((q) => q.kind === 'task' && q.date! >= '2026-11-02' && q.date! <= '2026-11-08'))
  assert.equal(new Set(wk.quick!.map((q) => q.date)).size, 3) // spread over three different days
  assert.deepEqual(await runProactive(db6, new Date('2026-11-01T19:00:00Z')), []) // only once a week

  // ---- phone wording stays plain
  assert.deepEqual(pushText('weekly', 'Your week ahead.\nMon: x'), { title: 'Your week ahead', body: 'Tap to see the plan and add sessions.' })
  assert.deepEqual(pushText('checkin', 'Did you get your Masters session done?'), { title: 'Quick check', body: 'Did you get your Masters session done?' })

  console.log('round 1 tests passed')
}
main().catch((e) => { console.error(e); process.exit(1) })
