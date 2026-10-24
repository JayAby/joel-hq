import assert from 'node:assert/strict'
import { autoTidy } from '../src/housekeeping'
import { FakeDb } from './fakes'

const now = new Date('2026-10-22T10:00:00Z')
const day = 24 * 3600_000

function seed() {
  const db = new FakeDb()
  db.docs.set('messages/old', { updateTime: 't', data: { at: now.getTime() - 8 * day, text: 'old' } })
  db.docs.set('messages/new', { updateTime: 't', data: { at: now.getTime() - 1 * day, text: 'new' } })
  db.docs.set('proposals/old', { updateTime: 't', data: { createdAt: now.getTime() - 9 * day, status: 'approved' } })
  db.docs.set('proposals/new', { updateTime: 't', data: { createdAt: now.getTime() - 1000, status: 'pending' } })
  db.docs.set('activityLog/a', { updateTime: 't', data: { at: now.getTime() - 30 * day } })
  db.docs.set('joelhq/state', { updateTime: 't', data: { tasks: [{ id: 'x' }] } })
  return db
}
const has = (db: FakeDb, k: string) => db.docs.has(k)

async function main() {
  // auto tidy: old goes, recent stays, undo history and app data untouched, once per day
  const db = seed()
  const r = await autoTidy(db, now)
  assert.deepEqual(r, { messages: 1, proposals: 1 })
  assert.equal(has(db, 'messages/old'), false)
  assert.equal(has(db, 'proposals/old'), false)
  assert.equal(has(db, 'messages/new'), true)
  assert.equal(has(db, 'proposals/new'), true)
  assert.equal(has(db, 'activityLog/a'), true)
  assert.equal(has(db, 'joelhq/state'), true)
  assert.equal(await autoTidy(db, now), null) // already done today

  console.log('housekeeping tests passed')
}
main().catch((e) => { console.error(e); process.exit(1) })
