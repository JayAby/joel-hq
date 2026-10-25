// What actually happened each day, and weekly backups.
//
//  - Every evening (from 21:00 until the day resets at 06:00) the assistant saves
//    a snapshot of the logical day: each task and habit and whether it was done.
//    This also catches things ticked in the app, not just in the chat.
//  - Snapshots live in `outcomes/<YYYY-MM>` (one document a month). Nothing in
//    the browser can read them and they are never sent to the AI. Personal-looking
//    items are stored as "[private item]", so only the shape of the day is kept.
//  - Once a week a copy of the app's data is saved to `backups/<monday>`; the
//    newest 8 are kept. This protects against a bad edit or an accidental wipe.
//    It is not an off-site copy: use "Export my data" in the app for that.

import type { Db } from './firestore'
import { londonMinutes, londonMondayOf, londonResetDayKey } from './london'
import { redact } from './privacy'

export const SNAPSHOT_FROM = 21 * 60
export const DAY_RESET = 6 * 60
export const BACKUP_FROM = 3 * 60
export const BACKUP_UNTIL = 6 * 60
export const KEEP_BACKUPS = 8
const MAX_BACKUP_BYTES = 900_000

interface TaskLike {
  t?: string
  time?: string
  minutes?: number
  done?: boolean
  skipped?: boolean
  date?: string
}

export interface DaySnapshot {
  date: string
  tasks: { t: string; time?: string; minutes?: number; done: boolean; skipped: boolean }[]
  habits: { name: string; done: boolean }[]
  sig: string
}

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function buildSnapshot(state: Record<string, unknown>, plans: { id: string; data: Record<string, unknown> }[], day: string): DaySnapshot {
  const all = (Array.isArray(state.tasks) ? state.tasks : []) as TaskLike[]
  const tasks = all
    .filter((t) => (t.date ?? day) === day)
    .map((t) => {
      const out: DaySnapshot['tasks'][number] = { t: redact(String(t.t ?? '').trim().slice(0, 120)), done: t.done === true, skipped: t.skipped === true }
      if (typeof t.time === 'string' && t.time) out.time = t.time
      const m = Number(t.minutes)
      if (Number.isFinite(m) && m > 0) out.minutes = m
      return out
    })
  const log = (state.habitLog ?? {}) as Record<string, unknown>
  const habits = plans
    .filter((p) => p.data.kind === 'habit' && p.data.active !== false && String(p.data.name ?? '').trim())
    .map((p) => ({ name: redact(String(p.data.name).trim().slice(0, 80)), done: strArr(log[p.id]).includes(day) }))
  return { date: day, tasks, habits, sig: hash(JSON.stringify([tasks, habits])) }
}

/** True if a snapshot was written. Cheap to call every tick: it only works in the evening window. */
export async function recordDay(db: Db, now: Date, force = false): Promise<boolean> {
  const minutes = londonMinutes(now)
  if (!force && minutes >= DAY_RESET && minutes < SNAPSHOT_FROM) return false
  const day = londonResetDayKey(now)
  const month = day.slice(0, 7)
  const existing = await db.getDoc(`outcomes/${month}`)
  const days = (existing?.data.days ?? {}) as Record<string, { sig?: string }>

  const state = ((await db.getDoc('joelhq/state'))?.data ?? {}) as Record<string, unknown>
  const plans = await db.list('plans')
  const snap = buildSnapshot(state, plans, day)
  if (days[day]?.sig === snap.sig) return false
  await db.update(`outcomes/${month}`, [{ path: ['days', day], value: snap }])
  return true
}

/** Once a week, in the small hours: copy the app data. Returns the backup id, or null. */
export async function backupWeekly(db: Db, now: Date, force = false): Promise<string | null> {
  const minutes = londonMinutes(now)
  if (!force && (minutes < BACKUP_FROM || minutes >= BACKUP_UNTIL)) return null
  const id = londonMondayOf(now)
  if (!force && (await db.getDoc(`backups/${id}`))) return null

  const state = await db.getDoc('joelhq/state')
  if (!state) return null
  if (JSON.stringify(state.data).length > MAX_BACKUP_BYTES) {
    await db.update('assistant/health', [
      { path: ['backupError'], value: 'App data is too large to back up in one piece.' },
      { path: ['backupErrorAt'], value: now.toISOString() },
    ])
    return null
  }
  await db.set(`backups/${id}`, { id, at: now.toISOString(), state: state.data })

  const all = await db.list('backups')
  const old = all.map((d) => d.id).sort().slice(0, Math.max(0, all.length - KEEP_BACKUPS))
  for (const o of old) await db.remove(`backups/${o}`)
  await db.update('assistant/health', [
    { path: ['lastBackup'], value: id },
    { path: ['backupError'], value: '' },
  ])
  return id
}
