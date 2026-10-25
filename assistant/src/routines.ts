// Goals and routines.
//   goal:    something ongoing with a weekly target ("Masters 4x/week 90min").
//   routine: something that repeats on set days ("football every 2 weeks friday 19:00 ask").
// Both are created by typing in the chat (no AI involved) and live in
// `assistant/goal_<id>` and `assistant/routine_<id>`, which only the assistant can write.

import { weekdayOfKey } from './dates'
import type { Db } from './firestore'
import { addDaysToKey } from './london'
import { parseTime } from './dates'
import { freeGaps, toHHMM, toMinutes, type Block, type Slot } from './planner'

export interface Goal {
  id: string
  name: string
  perWeek: number
  minutes: number
  /** Dates (YYYY-MM-DD) a session was logged. */
  done: string[]
}

export interface Routine {
  id: string
  name: string
  /** 0 = Sunday ... 6 = Saturday */
  days: number[]
  time: string
  /** 1 = every week, 2 = every other week */
  every: number
  /** Monday (YYYY-MM-DD) of the first week; used to count fortnights. */
  anchor: string
  mode: 'ask' | 'add'
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DAY_RE = /\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)s?\b/gi

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

export const mondayOfKey = (key: string): string => addDaysToKey(key, -((weekdayOfKey(key) + 6) % 7))

const daysBetween = (a: string, b: string): number => {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400_000)
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

// ---- parsing ---------------------------------------------------------------

export function parseGoal(body: string): { name: string; perWeek: number; minutes: number } | string {
  const m = body.trim().match(/^(.+?)\s+(\d{1,2})\s*(?:x|times|sessions?)?\s*(?:\/|a|per)?\s*(?:week|wk)\b(?:\s+(\d{1,3})\s*(?:min|mins|minutes|m)\b)?\s*$/i)
  const example = 'Try: goal: Masters 4x/week 90min'
  if (!m) return `I could not read that. ${example}`
  const perWeek = Number(m[2])
  const minutes = m[3] ? Number(m[3]) : 60
  if (perWeek < 1 || perWeek > 14) return `Sessions per week should be between 1 and 14. ${example}`
  if (minutes < 10 || minutes > 480) return `Session length should be between 10 and 480 minutes. ${example}`
  return { name: cap(m[1].trim().slice(0, 60)), perWeek, minutes }
}

export function parseRoutine(
  body: string,
  todayKey: string,
): Omit<Routine, 'id'> | string {
  const example = 'Try: routine: Football every 2 weeks friday 19:00 ask'
  let rest = ` ${body.trim()} `

  let mode: 'ask' | 'add' = 'ask'
  const mm = rest.match(/\s(ask|add)\s*$/i)
  if (mm) {
    mode = mm[1].toLowerCase() as 'ask' | 'add'
    rest = rest.slice(0, rest.length - mm[0].length) + ' '
  }

  const tm = rest.match(/\b(\d{1,2}:\d{2}|\d{1,2}\s?(?:am|pm))\b/i)
  if (!tm) return `Add a time, like 20:00 or 7pm. ${example}`
  const time = parseTime(tm[1])
  if (!time) return `I could not read the time. ${example}`
  rest = rest.replace(tm[0], ' ')

  let every = 1
  const em = rest.match(/\bevery\s+(\d+|other|second)\s+weeks?\b/i) ?? rest.match(/\b(fortnightly|biweekly|every other week)\b/i)
  if (em) {
    const w = (em[1] ?? '').toLowerCase()
    every = /^\d+$/.test(w) ? Number(w) : 2
    if (every < 1 || every > 8) return `Weeks apart should be 1 to 8. ${example}`
    rest = rest.replace(em[0], ' ')
  }

  const days = new Set<number>()
  if (/\b(weekdays?)\b/i.test(rest)) {
    ;[1, 2, 3, 4, 5].forEach((d) => days.add(d))
    rest = rest.replace(/\bweekdays?\b/i, ' ')
  }
  if (/\b(daily|every ?day)\b/i.test(rest)) {
    ;[0, 1, 2, 3, 4, 5, 6].forEach((d) => days.add(d))
    rest = rest.replace(/\b(daily|every ?day)\b/i, ' ')
  }
  rest = rest.replace(DAY_RE, (w) => {
    days.add(DAY_NAMES.indexOf(w.toLowerCase().slice(0, 3)))
    return ' '
  })
  if (days.size === 0) return `Which day? ${example}`

  const name = rest
    .replace(/\b(every|on|at|each|and|weekly)\b/gi, ' ')
    .replace(/[,&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name) return `What is it called? ${example}`

  // The fortnight pattern starts from the first matching day on or after today.
  let first = todayKey
  for (let i = 0; i < 7 && !days.has(weekdayOfKey(first)); i++) first = addDaysToKey(first, 1)
  return { name: cap(name.slice(0, 60)), days: [...days].sort(), time, every, anchor: mondayOfKey(first), mode }
}

// ---- rules -------------------------------------------------------------------

export function routineOn(r: Routine, dayKey: string): boolean {
  if (!r.days.includes(weekdayOfKey(dayKey))) return false
  const weeks = Math.round(daysBetween(r.anchor, mondayOfKey(dayKey)) / 7)
  return weeks >= 0 && weeks % Math.max(1, r.every) === 0
}

export function describeRoutine(r: Routine): string {
  const days = r.days.length === 7 ? 'every day' : r.days.map((d) => cap(DAY_NAMES[d])).join(', ')
  const cadence = r.every === 1 ? '' : r.every === 2 ? ', every other week' : `, every ${r.every} weeks`
  return `${r.name}: ${days}${cadence} at ${r.time} (${r.mode === 'ask' ? 'I ask you that morning' : 'I add it automatically'})`
}

/** Sessions logged this week, from the goal's own log plus ticked tasks that mention it. */
export function sessionsThisWeek(g: Goal, tasks: { t?: string; date?: string; done?: boolean }[], monday: string): number {
  const days = new Set<string>()
  const end = addDaysToKey(monday, 6)
  for (const d of g.done) if (d >= monday && d <= end) days.add(d)
  const n = norm(g.name)
  for (const t of tasks) {
    if (t.done && t.date && t.date >= monday && t.date <= end && norm(String(t.t ?? '')).includes(n)) days.add(t.date)
  }
  return days.size
}

/** True when the goal is behind enough to deserve a nudge today. */
export function needsNudge(g: Goal, done: number, today: string): boolean {
  const left = g.perWeek - done
  if (left <= 0) return false
  const daysLeft = 7 - ((weekdayOfKey(today) + 6) % 7)
  return left / daysLeft >= 0.5
}

/** First slot of `minutes` inside the gaps, preferring evening, never before `earliest`. */
export function pickSlot(gaps: Slot[], minutes: number, earliest: number, prefer = 17 * 60): Slot | null {
  for (const floor of [Math.max(prefer, earliest), earliest]) {
    for (const g of gaps) {
      const start = Math.ceil(Math.max(g.start, floor) / 15) * 15
      if (start + minutes <= g.end) return { start, end: start + minutes }
    }
  }
  return null
}

/** Removes a used slot (plus a 15 minute buffer) from the gaps. */
export function takeFromGaps(gaps: Slot[], used: Slot, minLength = 60): Slot[] {
  const out: Slot[] = []
  for (const g of gaps) {
    if (used.end <= g.start || used.start >= g.end) {
      out.push(g)
      continue
    }
    if (used.start - 15 > g.start) out.push({ start: g.start, end: used.start - 15 })
    if (used.end + 15 < g.end) out.push({ start: used.end + 15, end: g.end })
  }
  return out.filter((g) => g.end - g.start >= minLength)
}

/** Spreads a goal's sessions across the week: returns [dayIndex, slot] pairs. */
export function planWeek(
  days: { blocks: Block[] }[],
  goal: { perWeek: number; minutes: number },
  wake: number,
  bed: number,
): { day: number; slot: Slot }[] {
  const out: { day: number; slot: Slot }[] = []
  const used = new Set<number>()
  for (let k = 0; k < goal.perWeek && out.length < days.length; k++) {
    const target = Math.round((k * days.length) / goal.perWeek)
    for (let step = 0; step < days.length; step++) {
      const i = (target + step) % days.length
      if (used.has(i)) continue
      const gaps = freeGaps(days[i].blocks, wake, bed, goal.minutes)
      const slot = pickSlot(gaps, goal.minutes, wake)
      if (slot) {
        used.add(i)
        out.push({ day: i, slot })
        days[i].blocks = [...days[i].blocks, { start: slot.start, end: slot.end, label: goal.minutes + '' }].sort((a, b) => a.start - b.start)
        break
      }
    }
  }
  return out.sort((a, b) => a.day - b.day)
}

// ---- storage -----------------------------------------------------------------

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

export async function loadGoals(db: Db): Promise<Goal[]> {
  return (await db.list('assistant'))
    .filter((d) => d.data.kind === 'goal' && typeof d.data.name === 'string')
    .map((d) => ({
      id: d.id,
      name: String(d.data.name),
      perWeek: Number(d.data.perWeek) || 3,
      minutes: Number(d.data.minutes) || 60,
      done: strArr(d.data.done),
    }))
}

export async function loadRoutines(db: Db): Promise<Routine[]> {
  return (await db.list('assistant'))
    .filter((d) => d.data.kind === 'routine' && typeof d.data.name === 'string' && typeof d.data.time === 'string')
    .map((d) => ({
      id: d.id,
      name: String(d.data.name),
      days: (Array.isArray(d.data.days) ? d.data.days : []).map(Number).filter((n) => n >= 0 && n <= 6),
      time: String(d.data.time),
      every: Number(d.data.every) || 1,
      anchor: String(d.data.anchor ?? ''),
      mode: d.data.mode === 'add' ? 'add' : 'ask',
    }))
}

export async function logGoalDate(db: Db, goalId: string, date: string): Promise<boolean> {
  const doc = await db.getDoc(`assistant/${goalId}`)
  if (!doc) return false
  const done = strArr(doc.data.done)
  if (done.includes(date)) return false
  await db.update(`assistant/${goalId}`, [{ path: ['done'], value: [...done, date].sort().slice(-90) }], { ifUpdateTime: doc.updateTime })
  return true
}

export async function unlogGoalDate(db: Db, goalId: string, date: string): Promise<void> {
  const doc = await db.getDoc(`assistant/${goalId}`)
  if (!doc) return
  await db.update(`assistant/${goalId}`, [{ path: ['done'], value: strArr(doc.data.done).filter((d) => d !== date) }])
}

// ---- chat commands -----------------------------------------------------------

export interface CommandResult {
  reply: string
}

/**
 * goal: ..., routine: ..., goals, routines, drop goal X, drop routine X.
 * Returns null when the text is not one of these.
 */
export async function handleRoutineCommand(db: Db, text: string, todayKey: string): Promise<CommandResult | null> {
  const t = text.trim()
  const make = (prefix: string) => {
    const id = `${prefix}_${crypto.randomUUID().slice(0, 8)}`
    return id
  }

  const g = t.match(/^goal\s*:\s*(.+)$/i)
  if (g) {
    const p = parseGoal(g[1])
    if (typeof p === 'string') return { reply: p }
    await db.set(`assistant/${make('goal')}`, { kind: 'goal', ...p, done: [], createdAt: Date.now() })
    return {
      reply: `Goal added: ${p.name}, ${p.perWeek} session${p.perWeek === 1 ? '' : 's'} a week, ${p.minutes} minutes each. I will nudge you when the week gets tight and suggest times in your free gaps.`,
    }
  }

  const r = t.match(/^routine\s*:\s*(.+)$/i)
  if (r) {
    const p = parseRoutine(r[1], todayKey)
    if (typeof p === 'string') return { reply: p }
    await db.set(`assistant/${make('routine')}`, { kind: 'routine', ...p, createdAt: Date.now() })
    return { reply: `Routine added. ${describeRoutine({ id: '', ...p })}.` }
  }

  if (/^(my\s+)?(goals|routines)\s*$/i.test(t)) {
    const wantGoals = /goals/i.test(t)
    if (wantGoals) {
      const goals = await loadGoals(db)
      return { reply: goals.length ? goals.map((x) => `• ${x.name}: ${x.perWeek}x a week, ${x.minutes} min`).join('\n') : 'No goals yet. Try: goal: Masters 4x/week 90min' }
    }
    const routines = await loadRoutines(db)
    return { reply: routines.length ? routines.map((x) => `• ${describeRoutine(x)}`).join('\n') : 'No routines yet. Try: routine: Football every monday 20:00 ask' }
  }

  const d = t.match(/^drop\s+(goal|routine)\s+(.+)$/i)
  if (d) {
    const kind = d[1].toLowerCase()
    const list: { id: string; name: string }[] = kind === 'goal' ? await loadGoals(db) : await loadRoutines(db)
    const w = norm(d[2])
    const hits = list.filter((x) => norm(x.name).includes(w) || w.includes(norm(x.name)))
    if (hits.length === 0) return { reply: `I could not find a ${kind} called "${d[2].trim()}".` }
    if (hits.length > 1) return { reply: `That matches more than one ${kind}: ${hits.map((h) => h.name).join(', ')}. Be more specific.` }
    await db.remove(`assistant/${hits[0].id}`)
    return { reply: `Removed ${kind}: ${hits[0].name}.` }
  }
  return null
}

export { toHHMM, toMinutes }
