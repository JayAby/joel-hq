// Planner, one-tap buttons, auto-apply and settings.
import assert from 'node:assert/strict'
import { approve, handleMessage, quickAction, undo } from '../src/assistant'
import { busyBlocks, DEFAULT_PROFILE, freeGaps, parseSpan, suggest, toHHMM } from '../src/planner'
import { runProactive } from '../src/proactive'
import { FakeDb } from './fakes'

const now = new Date('2026-10-22T10:00:00Z') // Thu 11:00 London (BST)
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(`2026-10-22T${String(h - 1).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`)
}

async function main() {
  // spans
  assert.deepEqual(parseSpan('14:45'), { start: 885, end: null })
  assert.deepEqual(parseSpan('09:00–11:00'), { start: 540, end: 660 })
  assert.deepEqual(parseSpan('9am-10am'), { start: 540, end: 600 })
  assert.equal(parseSpan('later'), null)

  // blocks and gaps: a work shift defaults to 8 hours, others to 1 hour
  const blocks = busyBlocks(
    [{ t: 'Work - St Matthews', time: '14:45' }, { t: 'Dentist', time: '09:00' }, { t: 'No time' }],
    DEFAULT_PROFILE,
  )
  assert.equal(blocks.length, 2)
  assert.equal(toHHMM(blocks[1].end), '22:45')
  const gaps = freeGaps(blocks, 480, 1320, 60)
  assert.deepEqual(gaps.map((g) => `${toHHMM(g.start)}-${toHHMM(g.end)}`), ['10:15-14:30'])
  const sug = suggest(gaps, ['Skincare', 'MSc Study', 'Coding Practice - Learning', 'Driving Theory'], 2)
  assert.deepEqual(sug.map((x) => `${x.label}@${toHHMM(x.start)}-${toHHMM(x.end)}`), [
    'MSc Study@10:15-11:45',
    'Coding Practice - Learning@12:00-13:30',
  ]) // skincare is never blocked, and nothing overlaps work

  // a task's own length wins over the default
  const own = busyBlocks([{ t: 'MSc Study', time: '10:00', minutes: 90 }, { t: 'Work', time: '14:00', minutes: 300 }], DEFAULT_PROFILE)
  assert.deepEqual(own.map((b) => `${toHHMM(b.start)}-${toHHMM(b.end)}`), ['10:00-11:30', '14:00-19:00'])

  // a profile changes the plan
  const db0 = new FakeDb()
  const r = await handleMessage(db0, async () => '{}', 'set shift 5', now)
  assert.match(r.reply, /5-hour/)
  assert.equal((await db0.getDoc('assistant/profile'))!.data.workHours, 5)
  assert.match((await handleMessage(db0, async () => '{}', 'set shift banana', now)).reply, /hours/)
  assert.match((await handleMessage(db0, async () => '{}', 'set wake 07:30', now)).reply, /07:30/)

  // clean proposals are auto-appliable and undoable
  const db1 = new FakeDb()
  db1.docs.set('joelhq/state', { updateTime: 't0', data: { tasks: [], habitLog: {} } })
  db1.docs.set('plans/h1', { updateTime: 'p', data: { kind: 'habit', name: 'Skincare', active: true } })
  const ai = async () => JSON.stringify({ reply: 'ok', actions: [{ type: 'mark_habit_done', habit: 'Skincare', date: 'today' }] })
  const res = await handleMessage(db1, ai, 'I did skincare', now)
  assert.equal(res.auto, true)
  const done = await approve(db1, res.proposalId!, now)
  assert.equal(done.error, undefined)
  assert.deepEqual((db1.docs.get('joelhq/state')!.data.habitLog as Record<string, string[]>).h1, ['2026-10-22'])
  await undo(db1, done.activityId, now)
  assert.deepEqual((db1.docs.get('joelhq/state')!.data.habitLog as Record<string, string[]>).h1, [])
  // anything with a warning waits for a tap, even if part of it is fine
  const mixed = await handleMessage(
    db1,
    async () => JSON.stringify({ reply: 'ok', actions: [{ type: 'mark_habit_done', habit: 'Skincare', date: 'today' }, { type: 'mark_habit_done', habit: 'Nonexistent', date: 'today' }] }),
    'did two things',
    now,
  )
  assert.equal(mixed.auto, false)
  assert.ok(mixed.proposalId)
  assert.ok(mixed.warnings.length > 0)

  // morning chips add a task with the time range; evening chips mark habits
  const db2 = new FakeDb()
  db2.docs.set('joelhq/state', {
    updateTime: 't0',
    data: { tasks: [{ id: 'w', t: 'Work - St Matthews', time: '14:45', done: false, date: '2026-10-22' }], habitLog: {} },
  })
  for (const [id, name] of [['h1', 'MSc Study'], ['h2', 'Workout'], ['h3', 'Night Skincare']]) {
    db2.docs.set(`plans/${id}`, { updateTime: 'p', data: { kind: 'habit', name, active: true } })
  }
  assert.deepEqual(await runProactive(db2, at('08:00')), ['morning'])
  const msgs = () => [...db2.docs.entries()].filter(([k]) => k.startsWith('messages/')).map(([k, v]) => ({ key: k, ...(v.data as Record<string, unknown>) })) as unknown as {
    key: string; kind: string; text: string; quick?: { id: string; label: string; done?: boolean }[]
  }[]
  const morning = msgs().find((x) => x.kind === 'morning')!
  assert.match(morning.text, /Work - St Matthews/)
  assert.match(morning.text, /assuming work shifts last 8 hours/) // hint shown once
  assert.equal(morning.quick!.length, 2)
  assert.match(morning.quick![0].label, /^Add 08:15 MSc Study$/)
  await quickAction(db2, morning.key.split('/')[1], 'q0', at('08:01'))
  const tasks = db2.docs.get('joelhq/state')!.data.tasks as { t: string; time?: string; date: string }[]
  assert.equal(tasks.length, 2)
  assert.deepEqual(
    { t: tasks[1].t, time: tasks[1].time, date: tasks[1].date, minutes: (tasks[1] as { minutes?: number }).minutes },
    { t: 'MSc Study', time: '08:15', date: '2026-10-22', minutes: 90 },
  )
  assert.equal(msgs().find((x) => x.kind === 'morning')!.quick![0].done, true)
  // tapping again changes nothing
  await quickAction(db2, morning.key.split('/')[1], 'q0', at('08:02'))
  assert.equal((db2.docs.get('joelhq/state')!.data.tasks as unknown[]).length, 2)

  // evening: one chip per open habit, plus "Did all"; tapping one marks just that one
  assert.deepEqual(await runProactive(db2, at('21:00')), ['evening'])
  const ev = msgs().find((x) => x.kind === 'evening')!
  assert.deepEqual(ev.quick!.map((q) => q.label), ['MSc Study', 'Workout', 'Night Skincare', 'Did all'])
  await quickAction(db2, ev.key.split('/')[1], 'q1', at('21:01'))
  const log = db2.docs.get('joelhq/state')!.data.habitLog as Record<string, string[]>
  assert.deepEqual(log.h2, ['2026-10-22'])
  assert.equal(log.h1, undefined)
  await quickAction(db2, ev.key.split('/')[1], 'all', at('21:02'))
  const log2 = db2.docs.get('joelhq/state')!.data.habitLog as Record<string, string[]>
  assert.deepEqual([log2.h1, log2.h2, log2.h3], [['2026-10-22'], ['2026-10-22'], ['2026-10-22']])
  assert.ok(msgs().find((x) => x.kind === 'evening')!.quick!.every((q) => q.done))

  console.log('v2 tests passed')
}
main().catch((e) => { console.error(e); process.exit(1) })
