// Work shifts. The assistant asks every Sunday "same shifts as last week?" and
// you can also type them: "shifts: mon wed 9-3, fri 12-6".

import { parseTime, weekdayOfKey } from './dates'
import type { Db } from './firestore'
import { addDaysToKey } from './london'
import type { Action } from './actions'

export interface Shift {
  day: number // 0 = Sunday
  start: string // HH:MM
  end: string // HH:MM
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DAY_RE = /\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)s?\b/gi
const RANGE_RE = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i

const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export const shiftMinutes = (s: Shift): number => (mins(s.end) - mins(s.start) + 1440) % 1440 || 1440

export const describeShift = (s: Shift): string => `${DAY_NAMES[s.day][0].toUpperCase()}${DAY_NAMES[s.day].slice(1)} ${s.start}–${s.end}`

/** "mon wed 9-3, fri 12-6" -> shifts. A string means it could not be read. */
export function parseShifts(body: string): Shift[] | string {
  const example = 'Try: shifts: mon wed 9-3, fri 12-6'
  const groups = body.split(/[,;\n]+/).map((g) => g.trim()).filter(Boolean)
  const out: Shift[] = []
  for (const g of groups) {
    const range = g.match(RANGE_RE)
    if (!range) return `I could not find the times in "${g}". ${example}`
    const startRaw = range[1].replace(/\s+/g, '')
    const endRaw = range[2].replace(/\s+/g, '')
    const start = parseTime(startRaw)
    let end = parseTime(endRaw)
    if (!start || !end) return `I could not read the times in "${g}". ${example}`
    // "9-3" means 9am to 3pm, "12-6" means noon to 6pm.
    if (mins(end) <= mins(start) && !/(am|pm)$/.test(endRaw) && mins(end) + 720 < 1440 && mins(end) < 720) end = hhmm(mins(end) + 720)
    const days = new Set<number>()
    for (const w of g.replace(range[0], ' ').match(DAY_RE) ?? []) days.add(DAY_NAMES.indexOf(w.toLowerCase().slice(0, 3)))
    if (days.size === 0) return `Which days is "${g}"? ${example}`
    for (const d of [...days].sort()) out.push({ day: d, start, end })
  }
  if (out.length === 0) return `I could not read that. ${example}`
  if (out.length > 7) return 'That is more than seven shifts. Check the days.'
  return out
}

/** The next date on or after `from` that falls on weekday `day`. */
export function nextDate(from: string, day: number): string {
  const diff = (day - weekdayOfKey(from) + 7) % 7
  return addDaysToKey(from, diff)
}

export async function saveLastWeek(db: Db, shifts: Shift[]): Promise<void> {
  await db.set('assistant/shifts', { kind: 'shifts', lastWeek: shifts, savedAt: Date.now() })
}

export async function loadLastWeek(db: Db): Promise<Shift[]> {
  const doc = await db.getDoc('assistant/shifts')
  const raw = Array.isArray(doc?.data.lastWeek) ? (doc!.data.lastWeek as Shift[]) : []
  return raw.filter((s) => typeof s?.day === 'number' && typeof s?.start === 'string' && typeof s?.end === 'string')
}

interface TaskLike {
  t?: unknown
  date?: unknown
  time?: unknown
  skipped?: unknown
}

/** Tasks to add for these shifts, from `base` onward (7 days). Skips ones already on the list. */
export function shiftActions(shifts: Shift[], base: string, tasks: TaskLike[]): Action[] {
  const out: Action[] = []
  for (const s of shifts) {
    const date = nextDate(base, s.day)
    const time = `${s.start}-${s.end}`
    const exists = tasks.some((t) => t.date === date && !t.skipped && /^\s*(work|shift)\b/i.test(String(t.t ?? '')) && String(t.time ?? '').startsWith(s.start))
    if (exists) continue
    out.push({ type: 'add_task', text: 'Work', date, time, minutes: shiftMinutes(s) })
  }
  return out
}
