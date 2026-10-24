// Offline test of morning briefing, reminders and evening check-in.
import assert from 'node:assert/strict'
import { runProactive } from '../src/proactive'
import { FakeDb } from './fakes'

// Fri 16 Oct 2026. London is on BST (UTC+1) until 25 Oct.
const at = (hhmmLondon: string, day = '2026-10-16') => {
  const [h, m] = hhmmLondon.split(':').map(Number)
  return new Date(`${day}T${String(h - 1).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`)
}

function seed() {
  const db = new FakeDb()
  db.docs.set('joelhq/state', {
    updateTime: 't0',
    data: {
      tasks: [
        { id: 'a', t: 'Gym', time: '17:00', done: false, date: '2026-10-16' },
        { id: 'b', t: 'Call the landlord', done: false, date: '2026-10-16' },
        { id: 'c', t: 'Dentist', time: '17:05', done: false, date: '2026-10-16' },
        { id: 'd', t: 'Old thing', done: true, date: '2026-10-16' },
        { id: 'e', t: 'Tomorrow task', done: false, date: '2026-10-17' },
      ],
      habitLog: { h1: ['2026-10-16'] },
      balance: '£1,234.56',
    },
  })
  db.docs.set('plans/h1', { updateTime: 'p', data: { kind: 'habit', name: 'Skincare', active: true } })
  db.docs.set('plans/h2', { updateTime: 'p', data: { kind: 'habit', name: 'Gym habit', active: true } })
  db.docs.set('plans/h3', { updateTime: 'p', data: { kind: 'habit', name: 'Old habit', active: false } })
  return db
}
const msgs = (db: FakeDb) =>
  [...db.docs.entries()].filter(([k]) => k.startsWith('messages/')).map(([, v]) => v.data as { kind: string; text: string; role: string })

async function main() {
  const db = seed()

  // quiet hours: nothing before 07:30
  assert.deepEqual(await runProactive(db, at('06:00')), [])
  assert.equal(msgs(db).length, 0)

  // too early for the morning briefing
  assert.deepEqual(await runProactive(db, at('07:45')), [])

  // morning briefing at 08:00, once only
  assert.deepEqual(await runProactive(db, at('08:00')), ['morning'])
  assert.deepEqual(await runProactive(db, at('08:05')), [])
  const m = msgs(db)
  assert.equal(m.length, 1)
  assert.equal(m[0].role, 'assistant')
  assert.match(m[0].text, /Good morning, Joel/)
  assert.match(m[0].text, /17:00 Gym/)
  assert.match(m[0].text, /Plus 1 other thing/) // the untimed task is counted, not listed
  assert.doesNotMatch(m[0].text, /Old thing/) // done
  assert.doesNotMatch(m[0].text, /Skincare/) // already done today
  assert.match(m[0].text, /Free: /)
  assert.match(m[0].text, /Gym habit at 08:15/) // suggested into the free gap
  assert.doesNotMatch(m[0].text, /Old habit/) // inactive
  const quick = (m[0] as unknown as { quick: { kind: string; time: string; label: string }[] }).quick
  assert.equal(quick.length, 1)
  assert.equal(quick[0].kind, 'task')
  assert.equal(quick[0].time, '08:15')
  assert.doesNotMatch(m[0].text, /1,234/) // finance never appears

  // reminder 10 minutes before, once only
  assert.deepEqual(await runProactive(db, at('16:40')), [])
  assert.deepEqual(await runProactive(db, at('16:50')), ['reminder:a'])
  assert.deepEqual(await runProactive(db, at('16:52')), []) // not sent twice
  assert.match(msgs(db).filter((x) => x.kind === 'reminder')[0].text, /Gym is in 10 minutes \(17:00\)/)

  // daily reminder cap: a second reminder is allowed, a third is not
  assert.deepEqual(await runProactive(db, at('16:55')), ['reminder:c'])
  db.docs.get('joelhq/state')!.data.tasks = [
    ...(db.docs.get('joelhq/state')!.data.tasks as object[]),
    { id: 'f', t: 'Third', time: '18:00', done: false, date: '2026-10-16' },
  ]
  assert.deepEqual(await runProactive(db, at('17:55')), [])

  // evening check-in: asks only about habits not done, records what it asked
  assert.deepEqual(await runProactive(db, at('21:00')), ['evening'])
  assert.deepEqual(await runProactive(db, at('21:05')), [])
  const ev = msgs(db).filter((x) => x.kind === 'evening')[0]
  const eq = (ev as unknown as { quick: { label: string; kind: string }[] }).quick
  assert.deepEqual(eq.map((q) => q.label), ['Gym habit']) // Skincare is done, so it is not asked
  assert.match(ev.text, /unknown, not done/)

  // next morning: no answer stays "unknown", and counters reset for the new day
  assert.deepEqual(await runProactive(db, at('08:10', '2026-10-17')), ['morning'])
  const m2 = msgs(db).filter((x) => x.kind === 'morning')
  assert.equal(m2.length, 2)
  assert.ok(m2.some((x) => /never heard back about Gym habit/.test(x.text) && /unknown/.test(x.text)))

  // if it WAS done that evening, it is not reported as unknown
  const db2 = seed()
  await runProactive(db2, at('21:00'))
  ;(db2.docs.get('joelhq/state')!.data.habitLog as Record<string, string[]>).h2 = ['2026-10-16']
  await runProactive(db2, at('08:10', '2026-10-17'))
  assert.doesNotMatch(msgs(db2).filter((x) => x.kind === 'morning')[0].text, /never heard back/)

  // nothing to ask in the evening -> no message
  const db3 = seed()
  const st = db3.docs.get('joelhq/state')!.data
  ;(st.habitLog as Record<string, string[]>).h2 = ['2026-10-16']
  st.tasks = []
  assert.deepEqual(await runProactive(db3, at('21:00')), [])
  assert.equal(msgs(db3).length, 0)

  // after quiet hours start, nothing is sent
  assert.deepEqual(await runProactive(seed(), at('22:45')), [])

  // forced test messages work any time
  assert.deepEqual(await runProactive(seed(), at('03:00'), 'morning'), ['morning'])

  // 01:00 task after midnight belongs to the previous logical day and still reminds
  const db4 = seed()
  db4.docs.get('joelhq/state')!.data.tasks = [{ id: 'z', t: 'Late call', time: '01:00', done: false, date: '2026-10-16' }]
  assert.deepEqual(await runProactive(db4, at('01:55', '2026-10-17')), []) // quiet hours
  console.log('proactive tests passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
