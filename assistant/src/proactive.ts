// Proactive messages, delivered into the in-app chat (the `messages` collection).
// Runs from the 5-minute cron and decides what is due using Europe/London time.
//
//   - morning briefing: from 08:00 until 12:00, once per day
//   - reminder: 10 minutes before a timed task (skipped if more than 5 minutes late)
//   - evening check-in: from 21:00 until 22:30, once per day
//
// No AI is involved, so nothing private leaves HQ. Rules:
//   - Quiet hours: nothing before 07:30 or after 22:30.
//   - Notification budget: at most 4 proactive messages a day. Morning and
//     evening are reserved; at most 2 reminders fill the rest.
//   - An unanswered check-in stays "unknown". It is never counted as done.
//   - Each message is marked as sent BEFORE it is written, so a retry can
//     never send a duplicate.

import type { Db } from './firestore'
import { addDaysToKey, londonMinutes, londonResetDayKey } from './london'
import type { QuickItem } from './assistant'
import { busyBlocks, freeGaps, normaliseProfile, parseSpan, suggest, toHHMM, toMinutes, type Slot, type Suggestion } from './planner'

export const MORNING_FROM = 8 * 60
export const MORNING_UNTIL = 12 * 60
export const EVENING_FROM = 21 * 60
export const EVENING_UNTIL = 22 * 60 + 30
export const QUIET_BEFORE = 7 * 60 + 30
export const QUIET_FROM = 22 * 60 + 30
export const REMINDER_LEAD = 10
export const REMINDER_GRACE = 5
export const MAX_REMINDERS_PER_DAY = 2
export const MAX_PER_DAY = 4
const DAY_RESET = 6 * 60

interface TaskLike {
  id?: string
  t?: string
  time?: string
  done?: boolean
  skipped?: boolean
  date?: string
}

interface Habit {
  id: string
  name: string
}

export interface Schedule {
  /** Logical day the counters below belong to. */
  day?: string
  morningDay?: string
  eveningDay?: string
  /** "taskId@YYYY-MM-DD" keys already reminded. */
  reminded?: string[]
  sentToday?: number
  remindersToday?: number
  /** Habits the evening check-in asked about (so we can report "unknown"). */
  askedDay?: string
  askedIds?: string[]
  askedNames?: string[]
  /** The "I assume 8-hour shifts" hint is shown once. */
  hintShown?: boolean
  cleanedDay?: string
}

export type Force = 'morning' | 'evening' | 'reminder'

const asTasks = (v: unknown): TaskLike[] => (Array.isArray(v) ? (v as TaskLike[]) : [])
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Minutes on the app's logical day: 06:00 = 360 ... 05:59 next morning = 1799. */
function logicalMinutes(m: number): number {
  return m < DAY_RESET ? m + 1440 : m
}

function timeToMinutes(time: unknown): number | null {
  const span = parseSpan(time)
  return span ? span.start : null
}

function byTime(a: TaskLike, b: TaskLike): number {
  const am = timeToMinutes(a.time)
  const bm = timeToMinutes(b.time)
  return (am === null ? 9999 : logicalMinutes(am)) - (bm === null ? 9999 : logicalMinutes(bm))
}

function taskLine(t: TaskLike): string {
  const span = parseSpan(t.time)
  const time = span ? `${String(t.time).trim()} ` : ''
  return `• ${time}${String(t.t ?? '').trim() || 'Untitled'}`
}

function habitsFromPlans(plans: { id: string; data: Record<string, unknown> }[], today: string): Habit[] {
  return plans
    .filter((p) => p.data.kind === 'habit' && p.data.active !== false)
    .filter((p) => {
      // If a habit lists the days it applies to, respect that. If we cannot
      // tell, include it rather than silently hiding it.
      const days = p.data.days
      if (!Array.isArray(days) || days.length === 0) return true
      const [y, m, d] = today.split('-').map(Number)
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      return days.some((x) => x === dow || String(x).toLowerCase().slice(0, 3) === ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dow])
    })
    .map((p) => ({ id: p.id, name: String(p.data.name ?? '').trim() }))
    .filter((h) => h.name)
}

function habitDone(state: Record<string, unknown>, id: string, day: string): boolean {
  const log = (state.habitLog ?? {}) as Record<string, unknown>
  return strArr(log[id]).includes(day)
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// ---- message text (pure, so it is easy to test) -------------------------

function clock(m: number): string {
  return toHHMM(m)
}

export function morningText(a: {
  timed: TaskLike[]
  untimedOpen: number
  gaps: Slot[]
  suggestions: Suggestion[]
  otherHabits: string[]
  unknownYesterday: string[]
  assumedShift: number | null
}): string {
  const out: string[] = ['Good morning, Joel.']
  if (a.timed.length) {
    out.push('', `Today: ${a.timed.slice(0, 4).map((t) => taskLine(t).replace('• ', '')).join(' · ')}`)
  } else {
    out.push('', 'Nothing fixed in your day yet.')
  }
  if (a.untimedOpen) out.push(`Plus ${a.untimedOpen} other thing${a.untimedOpen === 1 ? '' : 's'} to do.`)
  if (a.gaps.length) out.push(`Free: ${a.gaps.slice(0, 2).map((g) => `${clock(g.start)}–${clock(g.end)}`).join(' and ')}.`)
  if (a.suggestions.length) {
    out.push('', `I would fit in ${joinNames(a.suggestions.map((x) => `${x.label} at ${clock(x.start)}`))}. Tap to add.`)
  }
  if (a.otherHabits.length) {
    const shown = a.otherHabits.slice(0, 3)
    const more = a.otherHabits.length - shown.length
    out.push('', `Also today: ${joinNames(shown)}${more > 0 ? ` and ${more} more` : ''}.`)
  }
  if (a.unknownYesterday.length) {
    out.push('', `I never heard back about ${joinNames(a.unknownYesterday)} yesterday, so it stays unknown.`)
  }
  if (a.assumedShift !== null) {
    out.push('', `I am assuming work shifts last ${a.assumedShift} hours. Reply "set shift 6" to change that.`)
  }
  return out.join('\n')
}

export function reminderText(t: TaskLike, minutesAway: number): string {
  const when = minutesAway <= 1 ? 'now' : `in ${minutesAway} minutes`
  const at = parseSpan(t.time)
  return `${String(t.t ?? '').trim() || 'Task'} is ${when}${at ? ` (${clock(at.start)})` : ''}.`
}

export function eveningText(): string {
  return 'Evening check-in. Tap what you did today. If I do not hear back I will leave the rest as unknown, not done.'
}

// ---- the tick -----------------------------------------------------------

async function loadSchedule(db: Db): Promise<{ s: Schedule; known: boolean }> {
  const doc = await db.getDoc('assistant/schedule')
  return { s: ((doc?.data ?? {}) as Schedule) ?? {}, known: doc !== null }
}

async function send(db: Db, now: Date, kind: string, text: string, quick: QuickItem[] = []): Promise<void> {
  const id = crypto.randomUUID()
  const doc: Record<string, unknown> = { id, role: 'assistant', kind, text, at: now.getTime(), summary: [], warnings: [] }
  if (quick.length) doc.quick = quick
  await db.set(`messages/${id}`, doc)
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

export async function runProactive(db: Db, now: Date, force?: Force): Promise<string[]> {
  const did: string[] = []
  const today = londonResetDayKey(now)
  const minutes = londonMinutes(now)
  const quiet = minutes < QUIET_BEFORE || minutes >= QUIET_FROM
  if (quiet && !force) return did

  const { s } = await loadSchedule(db)
  // New logical day: counters start again.
  const counters: Schedule = s.day === today ? { ...s } : { ...s, day: today, sentToday: 0, remindersToday: 0, reminded: [] }
  const edits: { path: string[]; value: unknown }[] = []
  if (s.day !== today) {
    edits.push({ path: ['day'], value: today }, { path: ['sentToday'], value: 0 }, { path: ['remindersToday'], value: 0 }, { path: ['reminded'], value: [] })
  }
  const save = async () => {
    if (edits.length) await db.update('assistant/schedule', edits)
    edits.length = 0
  }
  const bump = () => {
    counters.sentToday = (counters.sentToday ?? 0) + 1
    edits.push({ path: ['sentToday'], value: counters.sentToday })
  }

  const state = ((await db.getDoc('joelhq/state'))?.data ?? {}) as Record<string, unknown>
  const tasks = asTasks(state.tasks)
  const todayTasks = tasks.filter((t) => (t.date ?? today) === today && !t.skipped)

  // Morning briefing
  const morningDue = force === 'morning' || (minutes >= MORNING_FROM && minutes < MORNING_UNTIL && counters.morningDay !== today)
  if (morningDue) {
    const plans = await db.list('plans')
    const habits = habitsFromPlans(plans, today).filter((h) => !habitDone(state, h.id, today))
    const { profile, isSet } = normaliseProfile((await db.getDoc('assistant/profile'))?.data)

    // Fixed things today, and the gaps between them.
    const timedAll = todayTasks.filter((t) => timeToMinutes(t.time) !== null)
    const blocks = busyBlocks(timedAll, profile)
    const earliest = Math.max(toMinutes(profile.wake), force ? 0 : Math.ceil((minutes + 5) / 15) * 15)
    const gaps = freeGaps(blocks, earliest, toMinutes(profile.bed), 60)

    // Do not suggest a habit that is already on today's list.
    const todayText = todayTasks.map((t) => norm(String(t.t ?? '')))
    const free = habits.filter((h) => !todayText.some((x) => x.includes(norm(h.name))))
    const suggestions = suggest(gaps, free.map((h) => h.name), 2)
    const placed = new Set(suggestions.map((x) => x.label))

    const yesterday = addDaysToKey(today, -1)
    const unknown: string[] = []
    if (counters.askedDay === yesterday) {
      const ids = strArr(counters.askedIds)
      const names = strArr(counters.askedNames)
      ids.forEach((id, i) => {
        if (!habitDone(state, id, yesterday) && names[i]) unknown.push(names[i])
      })
    }

    const workShown = !isSet && !counters.hintShown && timedAll.some((t) => /^\s*(work|shift)\b/i.test(String(t.t ?? '')))
    const text = morningText({
      timed: timedAll.filter((t) => !t.done).sort(byTime),
      untimedOpen: todayTasks.filter((t) => !t.done && timeToMinutes(t.time) === null).length,
      gaps,
      suggestions,
      otherHabits: habits.map((h) => h.name).filter((n) => !placed.has(n)),
      unknownYesterday: unknown,
      assumedShift: workShown ? profile.workHours : null,
    })
    const quick: QuickItem[] = suggestions.map((x, i) => ({
      id: `q${i}`,
      label: `Add ${clock(x.start)} ${x.label}`,
      kind: 'task',
      date: today,
      text: x.label,
      time: clock(x.start),
      minutes: x.end - x.start,
    }))
    edits.push({ path: ['morningDay'], value: today })
    if (workShown) edits.push({ path: ['hintShown'], value: true })
    bump()
    await save()
    await send(db, now, 'morning', text, quick)
    did.push('morning')
  }

  // Timed reminders
  const nowL = logicalMinutes(minutes)
  const reminded = new Set(strArr(counters.reminded))
  let remindersToday = counters.remindersToday ?? 0
  const due = todayTasks
    .filter((t) => !t.done && t.id)
    .map((t) => ({ t, m: timeToMinutes(t.time) }))
    .filter((x): x is { t: TaskLike; m: number } => x.m !== null)
    .map((x) => ({ t: x.t, away: logicalMinutes(x.m) - nowL }))
    .filter((x) => force === 'reminder' || (x.away <= REMINDER_LEAD && x.away >= -REMINDER_GRACE))
    .filter((x) => !reminded.has(`${x.t.id}@${today}`))
    .sort((a, b) => a.away - b.away)

  for (const x of due) {
    if (!force && (remindersToday >= MAX_REMINDERS_PER_DAY || (counters.sentToday ?? 0) >= MAX_PER_DAY)) break
    reminded.add(`${x.t.id}@${today}`)
    remindersToday++
    counters.remindersToday = remindersToday
    edits.push({ path: ['reminded'], value: [...reminded] }, { path: ['remindersToday'], value: remindersToday })
    bump()
    await save()
    await send(db, now, 'reminder', reminderText(x.t, Math.max(0, x.away)))
    did.push(`reminder:${x.t.id}`)
    if (force) break
  }

  // Evening check-in
  const eveningDue = force === 'evening' || (minutes >= EVENING_FROM && minutes < EVENING_UNTIL && counters.eveningDay !== today)
  if (eveningDue) {
    const plans = await db.list('plans')
    const habits = habitsFromPlans(plans, today).filter((h) => !habitDone(state, h.id, today))
    edits.push({ path: ['eveningDay'], value: today })
    if (habits.length) {
      edits.push(
        { path: ['askedDay'], value: today },
        { path: ['askedIds'], value: habits.map((h) => h.id) },
        { path: ['askedNames'], value: habits.map((h) => h.name) },
      )
      const quick: QuickItem[] = habits.slice(0, 6).map((h, i) => ({
        id: `q${i}`,
        label: h.name,
        kind: 'habit',
        date: today,
        habitId: h.id,
        habitName: h.name,
      }))
      if (habits.length >= 2) {
        quick.push({ id: 'all', label: 'Did all', kind: 'all_habits', date: today, habits: habits.map((h) => ({ id: h.id, name: h.name })) })
      }
      bump()
      await save()
      await send(db, now, 'evening', eveningText(), quick)
      did.push('evening')
    } else {
      await save() // everything is done, so there is nothing to ask
    }
  }

  await save()
  return did
}
