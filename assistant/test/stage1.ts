// Stage 1: daily outcome record, weekly backup, what-I-know list, mode.
import assert from 'node:assert/strict'
import { handleMessage } from '../src/assistant'
import { backupWeekly, buildSnapshot, recordDay } from '../src/outcomes'
import { FakeDb } from './fakes'

const noAi = async () => '{}'
// London is on GMT from 25 Oct 2026, so UTC time equals London time.
const at = (iso: string) => new Date(`${iso}:00Z`)

async function main() {
  // ---- snapshot content: private items are hidden, habit status is read from the log
  const state = {
    tasks: [
      { id: '1', t: 'Masters session', time: '10:00', minutes: 90, done: true, date: '2026-10-26' },
      { id: '2', t: 'Dentist appointment', time: '15:00', done: false, date: '2026-10-26' },
      { id: '3', t: 'Skipped thing', skipped: true, date: '2026-10-26' },
      { id: '4', t: 'Another day', date: '2026-10-27' },
    ],
    habitLog: { h1: ['2026-10-26'] },
  }
  const plans = [
    { id: 'h1', data: { kind: 'habit', name: 'Workout', active: true } },
    { id: 'h2', data: { kind: 'habit', name: 'Night skincare', active: true } },
    { id: 'h3', data: { kind: 'habit', name: 'Old one', active: false } },
  ]
  const snap = buildSnapshot(state, plans, '2026-10-26')
  assert.equal(snap.tasks.length, 3)
  assert.deepEqual(snap.tasks[0], { t: 'Masters session', done: true, skipped: false, time: '10:00', minutes: 90 })
  assert.equal(snap.tasks[1].t, '[private item]') // the dentist never lands in the record
  assert.equal(snap.tasks[2].skipped, true)
  assert.deepEqual(snap.habits, [{ name: 'Workout', done: true }, { name: 'Night skincare', done: false }])
  assert.equal(buildSnapshot(state, plans, '2026-10-26').sig, snap.sig) // stable

  // ---- recordDay: only in the evening window, only when something changed
  const db = new FakeDb()
  db.docs.set('joelhq/state', { updateTime: 't0', data: state })
  plans.forEach((p) => db.docs.set(`plans/${p.id}`, { updateTime: 'p', data: p.data }))
  assert.equal(await recordDay(db, at('2026-10-26T14:00')), false) // afternoon: nothing
  assert.equal(await recordDay(db, at('2026-10-26T21:05')), true)
  const month = () => db.docs.get('outcomes/2026-10')!.data.days as Record<string, { tasks: unknown[]; sig: string }>
  assert.equal(month()['2026-10-26'].tasks.length, 3)
  assert.equal(await recordDay(db, at('2026-10-26T21:10')), false) // unchanged: no rewrite
  state.tasks[1].done = true // ticked in the app later that night
  db.docs.set('joelhq/state', { updateTime: 't1', data: state })
  assert.equal(await recordDay(db, at('2026-10-26T23:00')), true)
  assert.equal((month()['2026-10-26'].tasks[1] as { done: boolean }).done, true)
  // 01:00 the next calendar day still belongs to the same logical day
  assert.equal(await recordDay(db, at('2026-10-27T01:00')), false)
  assert.ok(month()['2026-10-26'])
  assert.equal(month()['2026-10-27'], undefined)
  // forced run (used from Terminal) works any time
  assert.equal(await recordDay(db, at('2026-10-27T10:00'), true), true)
  assert.ok(month()['2026-10-27'])

  // ---- weekly backup
  assert.equal(await backupWeekly(db, at('2026-10-26T12:00')), null) // outside the small hours
  // 03:30 on Monday still belongs to the week that just ended (the day resets at 06:00)
  assert.equal(await backupWeekly(db, at('2026-10-26T03:30')), '2026-10-19')
  assert.deepEqual((db.docs.get('backups/2026-10-19')!.data.state as { habitLog: unknown }).habitLog, { h1: ['2026-10-26'] })
  assert.equal(await backupWeekly(db, at('2026-10-26T04:00')), null) // once a week
  for (let i = 1; i <= 9; i++) db.docs.set(`backups/2026-0${i}-01`, { updateTime: 'x', data: { id: 'x' } })
  assert.equal(await backupWeekly(db, at('2026-11-02T03:30')), '2026-10-26')
  const kept = [...db.docs.keys()].filter((k) => k.startsWith('backups/'))
  assert.equal(kept.length, 8) // the oldest are dropped
  assert.ok(kept.includes('backups/2026-10-26') && kept.includes('backups/2026-10-19'))
  assert.ok(!kept.includes('backups/2026-01-01'))
  assert.equal((db.docs.get('assistant/health')!.data as { lastBackup: string }).lastBackup, '2026-10-26')

  // ---- what I know
  const k = new FakeDb()
  const say = async (m: string) => (await handleMessage(k, noAi, m, at('2026-10-26T10:00'))).reply
  assert.match(await say('what do you know'), /Mode: not set yet/)
  assert.match(await say('know: I study best in the morning'), /^Saved\.$/)
  assert.match(await say('know: my therapist is on Tuesdays'), /looks personal.*never send it to the AI/)
  const list = await say('what do you know about me')
  assert.match(list, /1\. I study best in the morning\n2\. my therapist is on Tuesdays \(private\)/)
  assert.match(await say('forget 9'), /no number 9/)
  assert.match(await say('forget 1'), /Forgot: I study best/)
  assert.match(await say('what do you know'), /1\. my therapist/)
  assert.match(await say('forget everything'), /forgotten everything/)
  assert.match(await say('what do you know'), /do not know anything else/)

  // ---- mode
  assert.match(await say('set mode studying and working'), /Studying and working/)
  assert.equal(k.docs.get('assistant/profile')!.data.mode, 'both')
  assert.match(await say('set mode student'), /Studying/)
  assert.equal(k.docs.get('assistant/profile')!.data.mode, 'studying')
  assert.match(await say('set mode banana'), /Pick one/)
  assert.match(await say('what do you know'), /Mode: Studying/)

  console.log('stage 1 tests passed')
}
main().catch((e) => { console.error(e); process.exit(1) })
