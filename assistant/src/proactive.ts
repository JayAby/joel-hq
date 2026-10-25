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
import { applyAction } from './actions'
import { parseTime, weekdayOfKey, weekdayName } from './dates'
import { describeShift, loadLastWeek } from './shifts'
import { REFLECT_CHIPS, buildReview, followUpLine, missedLine, nextSetup, toneOf } from './accountability'
import { busyBlocks, freeGaps, normaliseProfile, parseSpan, suggest, toHHMM, toMinutes, type Block, type Slot, type Suggestion } from './planner'
import {
  loadGoals,
  loadRoutines,
  mondayOfKey,
  needsNudge,
  pickSlot,
  planWeek,
  routineOn,
  sessionsThisWeek,
  takeFromGaps,
  type Goal,
  type Routine,
} from './routines'

export const MORNING_FROM = 8 * 60
export const MORNING_UNTIL = 12 * 60
export const EVENING_FROM = 21 * 60
export const EVENING_UNTIL = 22 * 60 + 30
export const QUIET_BEFORE = 7 * 60 + 30
export const QUIET_FROM = 22 * 60 + 30
export const REMINDER_LEAD = 10
export const REMINDER_GRACE = 5
export const MAX_REMINDERS_PER_DAY = 10
export const MAX_PER_DAY = 4
export const SHIFTS_FROM = 16 * 60
export const REVIEW_FROM = 19 * 60 + 30
export const FOLLOW_UP_AFTER = 75 // minutes
export const WEEKLY_FROM = 18 * 60
export const WEEKLY_UNTIL = 21 * 60
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
  /** Task ids already asked "did you do it?" today. */
  checked?: string[]
  /** Monday of the week the Sunday plan was sent for. */
  weeklyFor?: string
  /** Monday of the week the shifts question was asked for. */
  shiftsFor?: string
  /** Monday of the week the Sunday review was sent for. */
  reviewFor?: string
  /** A goal check-in waiting for an answer: asked at (ms), for this task. */
  pending?: { taskId: string; at: number; name: string; goalId: string } | null
}

export type Force = 'morning' | 'evening' | 'reminder' | 'checkin' | 'weekly' | 'shifts' | 'review' | 'setup'

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
  asks?: string[]
  goalLines?: string[]
}): string {
  const out: string[] = ['Good morning, Joel.']
  if (a.timed.length) {
    out.push('', `Today: ${a.timed.slice(0, 4).map((t) => taskLine(t).replace('• ', '')).join(' · ')}`)
  } else {
    out.push('', 'Nothing fixed in your day yet.')
  }
  if (a.untimedOpen) out.push(`Plus ${a.untimedOpen} other thing${a.untimedOpen === 1 ? '' : 's'} to do.`)
  if (a.gaps.length) out.push(`Free: ${a.gaps.slice(0, 2).map((g) => `${clock(g.start)}–${clock(g.end)}`).join(' and ')}.`)
  if (a.asks?.length) out.push('', ...a.asks)
  if (a.goalLines?.length) out.push('', ...a.goalLines)
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

async function deliver(db: Db, now: Date, kind: string, text: string, quick: QuickItem[], push?: PushHook): Promise<void> {
  await send(db, now, kind, text, quick)
  try {
    await push?.(kind, text)
  } catch (e) {
    console.error('push hook failed', e)
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Called after a message is saved, to also push it to the phone. Failures never stop the message. */
export type PushHook = (kind: string, text: string) => Promise<unknown>

export async function runProactive(db: Db, now: Date, force?: Force, push?: PushHook): Promise<string[]> {
  const did: string[] = []
  const today = londonResetDayKey(now)
  const minutes = londonMinutes(now)
  const profileRaw = (await db.getDoc('assistant/profile'))?.data
  const quietBefore = toMinutes(parseTime(profileRaw?.quietBefore) ?? toHHMM(QUIET_BEFORE))
  const quietFrom = toMinutes(parseTime(profileRaw?.quietFrom) ?? toHHMM(QUIET_FROM))
  const quiet = minutes < quietBefore || minutes >= quietFrom
  if (quiet && !force) return did

  const { s } = await loadSchedule(db)
  // New logical day: counters start again.
  const counters: Schedule = s.day === today ? { ...s } : { ...s, day: today, sentToday: 0, remindersToday: 0, reminded: [], checked: [] }
  const edits: { path: string[]; value: unknown }[] = []
  if (s.day !== today) {
    edits.push({ path: ['day'], value: today }, { path: ['sentToday'], value: 0 }, { path: ['remindersToday'], value: 0 }, { path: ['reminded'], value: [] }, { path: ['checked'], value: [] })
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
  let tasks = asTasks(state.tasks)
  let todayTasks = tasks.filter((t) => (t.date ?? today) === today && !t.skipped)
  const [routines, goals] = await Promise.all([loadRoutines(db), loadGoals(db)])
  const monday = mondayOfKey(today)
  const tone = toneOf(profileRaw?.tone)
  const yesterdayKey = addDaysToKey(today, -1)

  // Morning briefing
  const morningDue = force === 'morning' || (minutes >= MORNING_FROM && minutes < MORNING_UNTIL && counters.morningDay !== today)
  if (morningDue) {
    const plans = await db.list('plans')
    const habits = habitsFromPlans(plans, today).filter((h) => !habitDone(state, h.id, today))
    const { profile, isSet } = normaliseProfile(profileRaw)

    // Routines due today: "add" ones go straight on the list, "ask" ones become a question.
    const asks: string[] = []
    const askChips: QuickItem[] = []
    for (const r of routines.filter((x) => routineOn(x, today))) {
      if (todayTasks.some((t) => norm(String(t.t ?? '')).includes(norm(r.name)))) continue
      if (r.mode === 'add') {
        await applyAction(db, { type: 'add_task', text: r.name, date: today, time: r.time }, now)
        todayTasks = [...todayTasks, { id: `r_${r.id}`, t: r.name, time: r.time, date: today, done: false }]
      } else if (askChips.length < 4 && (force || toMinutes(r.time) > minutes + 30)) {
        const g = `r${r.id}`
        asks.push(`${r.name} at ${r.time} today. Want it on your list?`)
        askChips.push(
          { id: `${g}y`, group: g, prompt: `${r.name} at ${r.time} today. Want it on your list?`, label: `Yes, add ${r.name}`, kind: 'task', date: today, text: r.name, time: r.time },
          { id: `${g}n`, group: g, label: 'Not this time', kind: 'dismiss', date: today },
        )
      }
    }

    // Fixed things today, and the gaps between them.
    const timedAll = todayTasks.filter((t) => timeToMinutes(t.time) !== null)
    const blocks = busyBlocks(timedAll, profile)
    const earliest = Math.max(toMinutes(profile.wake), force ? 0 : Math.ceil((minutes + 5) / 15) * 15)
    let gaps = freeGaps(blocks, earliest, toMinutes(profile.bed), 60)

    // Goals that are falling behind this week get a slot first.
    const goalLines: string[] = []
    const goalChips: QuickItem[] = []
    for (const g of goals) {
      const done = sessionsThisWeek(g, tasks, monday)
      const planned = todayTasks.some((t) => norm(String(t.t ?? '')).includes(norm(g.name)))
      const missed = tasks.some((t) => t.date === yesterdayKey && !t.done && !t.skipped && norm(String(t.t ?? '')).includes(norm(g.name)))
      if (planned || goalChips.length >= 2 || !(missed || needsNudge(g, done, today))) continue
      const slot = pickSlot(gaps, g.minutes, earliest)
      if (!slot) continue
      gaps = takeFromGaps(gaps, slot)
      goalLines.push(`${missed ? `${missedLine(tone, g.name)} ` : ''}${g.name}: ${done} of ${g.perWeek} this week. I would do ${g.minutes} min at ${clock(slot.start)}.`)
      goalChips.push({ id: `g${goalChips.length}`, prompt: goalLines[goalLines.length - 1], label: `Add ${clock(slot.start)} ${g.name}`, kind: 'task', date: today, text: `${g.name} session`, time: clock(slot.start), minutes: g.minutes })
    }

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
      asks,
      goalLines,
    })
    const quick: QuickItem[] = [...askChips, ...goalChips]
    quick.push(...suggestions.map((x, i): QuickItem => ({
      id: `q${i}`,
      label: `Add ${clock(x.start)} ${x.label}`,
      kind: 'task',
      date: today,
      text: x.label,
      time: clock(x.start),
      minutes: x.end - x.start,
    })))
    edits.push({ path: ['morningDay'], value: today })
    if (workShown) edits.push({ path: ['hintShown'], value: true })
    bump()
    await save()
    await deliver(db, now, 'morning', text, quick, push)
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
    if (!force && remindersToday >= MAX_REMINDERS_PER_DAY) break
    reminded.add(`${x.t.id}@${today}`)
    remindersToday++
    counters.remindersToday = remindersToday
    edits.push({ path: ['reminded'], value: [...reminded] }, { path: ['remindersToday'], value: remindersToday })
    await save()
    const startMin = timeToMinutes(x.t.time) ?? minutes
    const later = startMin + 30
    const chips: QuickItem[] = [
      { id: 'done', group: 'r', prompt: reminderText(x.t, Math.max(0, x.away)), label: 'Done', kind: 'task_done', date: today, taskId: String(x.t.id), text: String(x.t.t ?? 'task') },
    ]
    const gl = goals.find((g) => norm(String(x.t.t ?? '')).includes(norm(g.name)))
    if (gl) {
      const own = Number((x.t as { minutes?: number }).minutes)
      chips.push({ id: 'timer', group: 'r', label: 'Start timer', kind: 'timer', date: today, taskId: String(x.t.id), text: gl.name, minutes: Number.isFinite(own) && own >= 5 ? own : gl.minutes })
    }
    if (later < 1440 && later < quietFrom) {
      chips.push({ id: 'later', group: 'r', label: '30 min later', kind: 'task_later', date: today, taskId: String(x.t.id), text: String(x.t.t ?? 'task'), time: clock(later) })
    }
    await deliver(db, now, 'reminder', reminderText(x.t, Math.max(0, x.away)), chips, push)
    did.push(`reminder:${x.t.id}`)
    if (force) break
  }

  // "Did you do it?" for goal sessions that have finished. At most one a day, and never crowding out the evening check-in.
  const goalOf = (t: TaskLike): Goal | undefined => goals.find((g) => norm(String(t.t ?? '')).includes(norm(g.name)))
  const checked = new Set(strArr(counters.checked))
  const finished = todayTasks
    .filter((t) => t.id && !t.done && !t.skipped && !checked.has(String(t.id)))
    .map((t) => ({ t, g: goalOf(t), start: timeToMinutes(t.time) }))
    .filter((x): x is { t: TaskLike; g: Goal; start: number } => !!x.g && x.start !== null)
    .filter((x) => {
      const own = Number((x.t as { minutes?: number }).minutes)
      const length = Number.isFinite(own) && own >= 5 ? own : x.g.minutes
      return force === 'checkin' || minutes >= x.start + length + 20
    })
  if (finished.length && (force === 'checkin' || ((counters.sentToday ?? 0) <= 2 && checked.size === 0))) {
    const x = finished[0]
    checked.add(String(x.t.id))
    edits.push({ path: ['checked'], value: [...checked] }, { path: ['pending'], value: { taskId: String(x.t.id), at: now.getTime(), name: x.g.name, goalId: x.g.id } })
    bump()
    await save()
    const g = `c${x.t.id}`
    const chips: QuickItem[] = [
      { id: 'yes', group: g, prompt: `Did you get your ${x.g.name} session done?`, label: 'Yes, done', kind: 'task_done', date: today, taskId: String(x.t.id), goalId: x.g.id, text: x.g.name },
      { id: 'no', group: g, label: 'Not today', kind: 'task_skip', date: today, taskId: String(x.t.id), text: x.g.name },
    ]
    await deliver(db, now, 'checkin', `Did you get your ${x.g.name} session done?`, chips, push)
    did.push('checkin')
  }

  // One follow-up when a check-in got no answer. Only once, never in quiet hours.
  const pend = counters.pending
  if (pend && (force === 'checkin' || now.getTime() - pend.at >= FOLLOW_UP_AFTER * 60_000)) {
    const t = tasks.find((x) => String(x.id) === pend.taskId)
    edits.push({ path: ['pending'], value: null })
    counters.pending = null
    if (t && !t.done && !t.skipped && (counters.sentToday ?? 0) < MAX_PER_DAY) {
      bump()
      await save()
      const g = `f${pend.taskId}`
      const chips: QuickItem[] = [
        { id: 'yes', group: g, prompt: followUpLine(tone, pend.name), label: 'Yes, done', kind: 'task_done', date: today, taskId: pend.taskId, goalId: pend.goalId, text: pend.name },
        { id: 'no', group: g, label: 'Not today', kind: 'task_skip', date: today, taskId: pend.taskId, text: pend.name },
      ]
      await deliver(db, now, 'checkin', followUpLine(tone, pend.name), chips, push)
      did.push('followup')
    } else await save()
  }

  // First-open setup: life mode, then how hard to push, then a first goal. One question at a time.
  if (force === 'setup' || (did.length === 0 && minutes >= MORNING_FROM && (counters.sentToday ?? 0) <= 2 && (!profileRaw?.mode || !profileRaw?.tone || goals.length === 0))) {
    const asked = (await db.getDoc('assistant/setup'))?.data
    const step = nextSetup(profileRaw, asked, goals, today)
    if (step) {
      const key = !profileRaw?.mode ? 'mode' : !profileRaw?.tone ? 'tone' : 'goal'
      await db.update('assistant/setup', [{ path: [key], value: key === 'goal' ? true : today }])
      bump()
      await save()
      await deliver(db, now, step.kind, step.text, step.quick, push)
      did.push('setup')
    }
  }

  // Sunday evening: how the week went, and what got in the way.
  const reviewDue = force === 'review' || (weekdayOfKey(today) === 0 && minutes >= REVIEW_FROM && minutes < WEEKLY_UNTIL + 60 && counters.reviewFor !== monday && (counters.sentToday ?? 0) <= 4)
  if (reviewDue) {
    const plans = await db.list('plans')
    const habitRows = plans
      .filter((p) => p.data.kind === 'habit' && p.data.active !== false && String(p.data.name ?? '').trim())
      .map((p) => ({ name: String(p.data.name).trim(), dates: strArr(((state.habitLog ?? {}) as Record<string, unknown>)[p.id]) }))
    const r = buildReview(tone, tasks, goals, habitRows, monday)
    edits.push({ path: ['reviewFor'], value: monday })
    bump()
    await save()
    await deliver(db, now, 'weekly', r.text, REFLECT_CHIPS(monday), push)
    did.push('review')
  }

  // Sunday afternoon: "same shifts as last week?" (only if you work).
  const nextMon = addDaysToKey(monday, 7)
  const mode = profileRaw?.mode
  const worksMaybe = mode !== 'studying' && mode !== 'between'
  const shiftsDue = force === 'shifts' || (weekdayOfKey(today) === 0 && minutes >= SHIFTS_FROM && minutes < WEEKLY_UNTIL && counters.shiftsFor !== nextMon && (counters.sentToday ?? 0) <= 2)
  if (shiftsDue && worksMaybe) {
    const last = await loadLastWeek(db)
    const nextWeek = Array.from({ length: 7 }, (_, i) => addDaysToKey(nextMon, i))
    const already = tasks.some((t) => nextWeek.includes(String(t.date)) && /^\s*(work|shift)\b/i.test(String(t.t ?? '')))
    edits.push({ path: ['shiftsFor'], value: nextMon })
    bump()
    await save()
    if (!already) {
      if (last.length > 0) {
        const q = 'Same shifts as last week?'
        await deliver(db, now, 'weekly', `${q}\n${last.map(describeShift).join('\n')}\n\nOr type new ones: shifts: tue thu 9-3, sat 12-6`, [
          { id: 'sy', group: 'sh', prompt: `${q} ${last.map(describeShift).join(', ')}`, label: 'Yes, same', kind: 'shifts_same', date: nextMon },
          { id: 'sn', group: 'sh', label: 'No shifts / I will type them', kind: 'dismiss', date: nextMon },
        ], push)
      } else {
        await deliver(db, now, 'weekly', 'Do you work shifts next week? Type them like this:\nshifts: mon wed 9-3, fri 12-6', [
          { id: 'sn', group: 'sh', prompt: 'Any shifts next week? Type: shifts: mon wed 9-3, fri 12-6', label: 'No shifts this week', kind: 'dismiss', date: nextMon },
        ], push)
      }
      did.push('shifts')
    }
  }

  // Sunday evening: the week ahead, with sessions for each goal placed in the free gaps.
  const nextMonday = addDaysToKey(monday, 7)
  const weeklyDue =
    force === 'weekly' ||
    (weekdayOfKey(today) === 0 && minutes >= WEEKLY_FROM && minutes < WEEKLY_UNTIL && counters.weeklyFor !== nextMonday && (counters.sentToday ?? 0) <= 2)
  if (weeklyDue) {
    const { profile } = normaliseProfile(profileRaw)
    const week = Array.from({ length: 7 }, (_, i) => addDaysToKey(nextMonday, i))
    const dayData = week.map((date) => {
      const fixed = tasks.filter((t) => t.date === date && !t.skipped && timeToMinutes(t.time) !== null)
      const rs = routines.filter((r) => routineOn(r, date) && !fixed.some((t) => norm(String(t.t ?? '')).includes(norm(r.name))))
      const items = [
        ...fixed.map((t) => ({ at: timeToMinutes(t.time) as number, label: String(t.t ?? '').trim() })),
        ...rs.map((r) => ({ at: toMinutes(r.time), label: r.mode === 'ask' ? `${r.name}?` : r.name })),
      ].sort((a, b) => a.at - b.at)
      const blocks: Block[] = busyBlocks(
        [...fixed, ...rs.filter((r) => r.mode === 'add').map((r) => ({ t: r.name, time: r.time }))],
        profile,
      )
      return { date, items, blocks }
    })
    const lines: string[] = ['Your week ahead.']
    for (const d of dayData) {
      if (d.items.length) lines.push(`${weekdayName(d.date).slice(0, 3).replace(/^./, (c) => c.toUpperCase())}: ${d.items.map((i) => `${i.label} ${clock(i.at)}`).join(' · ')}`)
    }
    if (lines.length === 1) lines.push('Nothing fixed yet.')
    const heavy = dayData
      .map((d) => ({ d, busy: d.blocks.reduce((n, b) => n + (b.end - b.start), 0) }))
      .filter((x) => x.busy >= 9 * 60)
    for (const h of heavy) lines.push('', `Heavy day: ${weekdayName(h.d.date).replace(/^./, (c) => c.toUpperCase())}, about ${Math.round(h.busy / 60)}h booked. I would keep it light and not add extras.`)
    const chips: QuickItem[] = []
    for (const g of goals) {
      const picks = planWeek(dayData, g, toMinutes(profile.wake), toMinutes(profile.bed))
      if (picks.length) {
        lines.push('', `${g.name}: ${g.perWeek} sessions of ${g.minutes} min. I would do ${picks.map((p) => `${weekdayName(week[p.day]).slice(0, 3)} ${clock(p.slot.start)}`).join(', ')}.`)
        for (const p of picks) {
          if (chips.length >= 6) break
          chips.push({
            id: `w${chips.length}`,
            label: `${weekdayName(week[p.day]).slice(0, 3)} ${clock(p.slot.start)} ${g.name}`,
            kind: 'task',
            date: week[p.day],
            text: `${g.name} session`,
            time: clock(p.slot.start),
            minutes: g.minutes,
          })
        }
      }
    }
    edits.push({ path: ['weeklyFor'], value: nextMonday })
    bump()
    await save()
    await deliver(db, now, 'weekly', lines.join('\n'), chips, push)
    did.push('weekly')
  }

  // Evening check-in
  const eveningDue = force === 'evening' || (minutes >= EVENING_FROM && minutes < Math.min(EVENING_UNTIL, quietFrom) && counters.eveningDay !== today)
  if (eveningDue) {
    const plans = await db.list('plans')
    const habits = habitsFromPlans(plans, today).filter((h) => !habitDone(state, h.id, today))
    edits.push({ path: ['eveningDay'], value: today })
    const goalChips: QuickItem[] = goals
      .filter((g) => sessionsThisWeek(g, tasks, monday) < g.perWeek && !g.done.includes(today))
      .filter((g) => !tasks.some((t) => t.date === today && t.done && norm(String(t.t ?? '')).includes(norm(g.name))))
      .slice(0, 2)
      .map((g, i): QuickItem => ({ id: `g${i}`, label: `Did ${g.name}`, kind: 'goal_done', date: today, goalId: g.id, text: g.name }))
    if (habits.length || goalChips.length) {
      edits.push(
        { path: ['askedDay'], value: today },
        { path: ['askedIds'], value: habits.map((h) => h.id) },
        { path: ['askedNames'], value: habits.map((h) => h.name) },
      )
      const quick: QuickItem[] = habits.slice(0, 6).map((h, i): QuickItem => ({
        id: `q${i}`,
        label: h.name,
        kind: 'habit',
        date: today,
        habitId: h.id,
        habitName: h.name,
      }))
      quick.push(...goalChips)
      if (habits.length >= 2) {
        quick.push({ id: 'all', label: 'Did all', kind: 'all_habits', date: today, habits: habits.map((h) => ({ id: h.id, name: h.name })) })
      }
      bump()
      await save()
      await deliver(db, now, 'evening', eveningText(), quick, push)
      did.push('evening')
    } else {
      await save() // everything is done, so there is nothing to ask
    }
  }

  await save()
  return did
}
