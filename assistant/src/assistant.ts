// The assistant core. Channel-agnostic: Telegram and the in-app chat will both
// call these functions. Order of safety checks in handleMessage:
//   1. manual commands ("task:", "shop:") never touch the AI
//   2. personal-looking messages are NOT sent to the AI unless they start with "share:"
//   3. the AI only sees the allowlisted, redacted context
//   4. everything the AI proposes is validated and waits for approval

import { applyAction, describe, undoStep, validateActions, type Action, type UndoStep } from './actions'
import { buildSystemPrompt, parseAiReply, type RunAi } from './ai'
import { parseTime, resolveDate, weekdayName, weekdayOfKey } from './dates'
import { describeShift, loadLastWeek, parseShifts, saveLastWeek, shiftActions } from './shifts'
import type { Db } from './firestore'
import { addDaysToKey, londonResetDayKey } from './london'
import { buildContext, isSensitive, type ResolveIndex } from './privacy'
import { handleKnowledgeCommand } from './knowledge'
import { handleRoutineCommand } from './routines'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export interface AskResult {
  reply: string
  proposalId?: string
  /** True when every action is low-risk and clean, so it can be applied now (Joel can undo). */
  auto?: boolean
  summary: string[]
  warnings: string[]
}

const MAX_MESSAGE = 1000
const WEEKDAY_WORDS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday'

/** "task: gym shoes tomorrow 5pm" and "shop: milk". No AI involved. */
export function parseManual(text: string, now: Date): { actions: Action[]; warnings: string[] } | null {
  const m = text.match(/^(task|shop)\s*:\s*(.+)$/i)
  if (!m) return null
  const kind = m[1].toLowerCase()
  let body = m[2].trim()

  if (kind === 'shop') {
    return { actions: [{ type: 'add_shopping', name: body.slice(0, 100), category: 'Other' }], warnings: [] }
  }

  let dateWord: string | undefined
  const dm = body.match(new RegExp(`\\b(today|tomorrow|${WEEKDAY_WORDS})\\b`, 'i'))
  if (dm) {
    dateWord = dm[1]
    body = body.replace(dm[0], ' ')
  }
  let time: string | null = null
  const tm = body.match(/\b(\d{1,2}:\d{2}|\d{1,2}\s?(?:am|pm))\b/i)
  if (tm) {
    time = parseTime(tm[1])
    body = body.replace(tm[0], ' ')
  }
  const text2 = body.replace(/\s+/g, ' ').replace(/\b(at|on)\s*$/i, '').trim()
  if (!text2) return { actions: [], warnings: ['Add some text after "task:".'] }
  const date = resolveDate(dateWord, now)
  if (!date) return { actions: [], warnings: ['I could not work out the date.'] }
  const action: Action = { type: 'add_task', text: text2.slice(0, 200), date }
  if (time) action.time = time
  return { actions: [action], warnings: [] }
}

async function loadIndexAndContext(db: Db, now: Date) {
  const state = (await db.getDoc('joelhq/state'))?.data ?? {}
  const plans = await db.list('plans')
  const today = londonResetDayKey(now)
  const tomorrow = addDaysToKey(today, 1)
  return buildContext(state, plans, today, tomorrow, weekdayName(today))
}

async function saveProposal(
  db: Db,
  now: Date,
  sourceText: string,
  reply: string,
  actions: Action[],
  warnings: string[],
): Promise<AskResult> {
  const summary = actions.map(describe)
  if (actions.length === 0) return { reply, summary, warnings }
  const auto = warnings.length === 0 && actions.length <= 3
  const id = crypto.randomUUID()
  await db.set(`proposals/${id}`, {
    id,
    status: 'pending',
    createdAt: now.getTime(),
    sourceText,
    reply,
    actions,
    summary,
    warnings,
  })
  return { reply, proposalId: id, auto, summary, warnings }
}

export async function handleMessage(db: Db, runAi: RunAi, rawText: string, now: Date): Promise<AskResult> {
  let text = rawText.trim()
  if (!text) return { reply: 'Say something and I will help.', summary: [], warnings: [] }
  if (text.length > MAX_MESSAGE) text = text.slice(0, MAX_MESSAGE)

  // 0. Settings: "set shift 6", "set wake 07:30", "set bed 23:00". No AI.
  const set = await handleSet(db, text)
  if (set) return set

  // 0a. What I know about you, and your mode: "know: ...", "what do you know", "forget 2", "set mode both". No AI.
  const known = await handleKnowledgeCommand(db, text, now)
  if (known !== null) return { reply: known, summary: [], warnings: [] }

  // 0b. Goals and routines: "goal: Masters 4x/week", "routine: football every monday 20:00". No AI.
  const cmd = await handleRoutineCommand(db, text, londonResetDayKey(now))
  if (cmd) return { reply: cmd.reply, summary: [], warnings: [] }

  // 0c. Shifts: "shifts: mon wed 9-3, fri 12-6" adds them to the week ahead. No AI.
  const sh = text.match(/^shifts?\s*:\s*(.*)$/i)
  if (sh) return handleShifts(db, sh[1], now)

  // 1. Manual commands: no AI, so nothing leaves HQ.
  const manual = parseManual(text, now)
  if (manual) {
    const reply = manual.actions.length ? 'Here is what I will do:' : manual.warnings[0] ?? 'Nothing to do.'
    return saveProposal(db, now, text, reply, manual.actions, manual.warnings)
  }

  // 2. Personal-looking messages stay off the AI unless Joel opts in.
  let allowSensitive = false
  const share = text.match(/^share\s*:\s*([\s\S]+)$/i)
  if (share) {
    allowSensitive = true
    text = share[1].trim()
  }
  if (!allowSensitive && isSensitive(text)) {
    return {
      reply:
        'That looks personal, so I did not send it to the AI. To let me use it, start the message with "share:". ' +
        'Or add it yourself with "task: ..." or "shop: ...".',
      summary: [],
      warnings: [],
    }
  }

  // 3. Allowlisted, redacted context only.
  const { ai, index } = await loadIndexAndContext(db, now)
  const raw = await runAi(buildSystemPrompt(ai), text)
  const parsed = parseAiReply(raw)

  // 4. Validate, then park as a proposal.
  const { actions, warnings } = validateActions(parsed.actions, index as ResolveIndex, now)
  return saveProposal(db, now, text, parsed.reply, actions, warnings)
}

async function handleShifts(db: Db, body: string, now: Date): Promise<AskResult> {
  const none = /^(none|off|no shifts?|nothing)$/i.test(body.trim())
  if (none) return { reply: 'Okay, no shifts for the week ahead.', summary: [], warnings: [] }
  const parsed = parseShifts(body)
  if (typeof parsed === 'string') return { reply: parsed, summary: [], warnings: [] }
  const today = londonResetDayKey(now)
  const base = weekdayOfKey(today) === 0 ? addDaysToKey(today, 1) : today
  const state = (await db.getDoc('joelhq/state'))?.data ?? {}
  const actions = shiftActions(parsed, base, Array.isArray(state.tasks) ? (state.tasks as never[]) : [])
  await saveLastWeek(db, parsed)
  if (actions.length === 0) return { reply: `Saved. Those shifts are already on your list: ${parsed.map(describeShift).join(', ')}.`, summary: [], warnings: [] }
  const undo: UndoStep[] = []
  const applied: string[] = []
  for (const a of actions) {
    undo.push(await applyAction(db, a, now))
    applied.push(`Work ${a.type === 'add_task' ? `${a.date} ${a.time}` : ''}`)
  }
  const activityId = crypto.randomUUID()
  await db.set(`activityLog/${activityId}`, { id: activityId, at: now.getTime(), applied, undo, undone: false })
  return { reply: `Added ${actions.length} shift${actions.length === 1 ? '' : 's'}: ${parsed.map(describeShift).join(', ')}. I will ask "same as last week?" next Sunday. Undo is on the Home page.`, summary: applied, warnings: [] }
}

async function handleSet(db: Db, text: string): Promise<AskResult | null> {
  const q = text.match(/^set\s+quiet\s+(\S+)\s+(\S+)$/i)
  if (q) {
    const from = parseTime(q[1])
    const until = parseTime(q[2])
    if (!from || !until) return { reply: 'Try "set quiet 22:30 07:30": no messages from the first time until the second.', summary: [], warnings: [] }
    await db.update('assistant/profile', [{ path: ['quietFrom'], value: from }, { path: ['quietBefore'], value: until }])
    return { reply: `Got it. No messages from ${from} until ${until}.`, summary: [], warnings: [] }
  }
  const m = text.match(/^set\s+(shift|wake|bed)\s+(.+)$/i)
  if (!m) return null
  const what = m[1].toLowerCase()
  const value = m[2].trim()
  const bad = (msg: string): AskResult => ({ reply: msg, summary: [], warnings: [] })
  if (what === 'shift') {
    const hours = Number(value.replace(/\s*(hours?|hrs?|h)$/i, ''))
    if (!Number.isFinite(hours) || hours < 1 || hours > 14) return bad('Tell me the shift length in hours, like "set shift 6".')
    await db.update('assistant/profile', [{ path: ['workHours'], value: hours }])
    return { reply: `Got it. I will plan around ${hours}-hour work shifts.`, summary: [], warnings: [] }
  }
  const t = parseTime(value)
  if (!t) return bad(`I did not understand that time. Try "set ${what} ${what === 'wake' ? '07:30' : '23:00'}".`)
  await db.update('assistant/profile', [{ path: [what], value: t }])
  return {
    reply: what === 'wake' ? `Got it. I will not suggest anything before ${t}.` : `Got it. I will not suggest anything after ${t}.`,
    summary: [],
    warnings: [],
  }
}

/** Keeps the conversation so the in-app chat (and later Telegram) can show it. */
export async function saveExchange(db: Db, userText: string, result: AskResult, now: Date): Promise<void> {
  const at = now.getTime()
  const userId = crypto.randomUUID()
  const botId = crypto.randomUUID()
  await db.set(`messages/${userId}`, { id: userId, role: 'user', text: userText.slice(0, MAX_MESSAGE), at })
  const bot: Record<string, unknown> = {
    id: botId,
    role: 'assistant',
    text: result.reply,
    at: at + 1,
    summary: result.summary,
    warnings: result.warnings,
  }
  if (result.proposalId) bot.proposalId = result.proposalId
  await db.set(`messages/${botId}`, bot)
}

export async function approve(db: Db, id: string, now: Date) {
  const p = await db.getDoc(`proposals/${id}`)
  if (!p) throw new HttpError(404, 'Proposal not found')
  if (p.data.status !== 'pending') throw new HttpError(409, `Proposal is already ${String(p.data.status)}`)

  // Claim it first. If two approvals race, the second one fails the time check.
  try {
    await db.update(`proposals/${id}`, [{ path: ['status'], value: 'approving' }], { ifUpdateTime: p.updateTime })
  } catch {
    throw new HttpError(409, 'Proposal is already being handled')
  }

  const actions = (Array.isArray(p.data.actions) ? p.data.actions : []) as Action[]
  const undo: UndoStep[] = []
  const applied: string[] = []
  let error: string | undefined
  for (const a of actions) {
    try {
      undo.push(await applyAction(db, a, now))
      applied.push(describe(a))
    } catch (e) {
      error = String(e)
      break
    }
  }

  const activityId = crypto.randomUUID()
  const log: Record<string, unknown> = {
    id: activityId,
    proposalId: id,
    at: now.getTime(),
    applied,
    undo,
    undone: false,
  }
  if (error) log.error = error
  await db.set(`activityLog/${activityId}`, log)
  await db.update(`proposals/${id}`, [
    { path: ['status'], value: error ? 'failed' : 'approved' },
    { path: ['decidedAt'], value: now.getTime() },
  ])
  return { activityId, applied, error }
}

export async function reject(db: Db, id: string, now: Date) {
  const p = await db.getDoc(`proposals/${id}`)
  if (!p) throw new HttpError(404, 'Proposal not found')
  if (p.data.status !== 'pending') throw new HttpError(409, `Proposal is already ${String(p.data.status)}`)
  await db.update(`proposals/${id}`, [
    { path: ['status'], value: 'rejected' },
    { path: ['decidedAt'], value: now.getTime() },
  ])
  return { rejected: true }
}

export async function undo(db: Db, activityId: string, now: Date) {
  const l = await db.getDoc(`activityLog/${activityId}`)
  if (!l) throw new HttpError(404, 'Activity not found')
  if (l.data.undone) throw new HttpError(409, 'Already undone')
  const steps = (Array.isArray(l.data.undo) ? l.data.undo : []) as UndoStep[]
  for (const s of [...steps].reverse()) await undoStep(db, s)
  await db.update(`activityLog/${activityId}`, [
    { path: ['undone'], value: true },
    { path: ['undoneAt'], value: now.getTime() },
  ])
  return { undone: true, steps: steps.length }
}

// ---- one-tap buttons on assistant messages ---------------------------------

export interface QuickItem {
  id: string
  label: string
  kind: 'shifts_same' | 'habit' | 'all_habits' | 'task' | 'task_done' | 'task_skip' | 'task_later' | 'goal_done' | 'dismiss'
  /** Buttons in one group answer the same question: answering one closes them all. */
  group?: string
  /** The question these buttons answer, shown on the Home card (set on the first button of a group). */
  prompt?: string
  taskId?: string
  goalId?: string
  date: string
  habitId?: string
  habitName?: string
  habits?: { id: string; name: string }[]
  text?: string
  time?: string
  minutes?: number
  done?: boolean
}

/** Applies one button on a message. Safe to tap twice: a done button does nothing. */
export async function quickAction(db: Db, messageId: string, quickId: string, now: Date) {
  const msg = await db.getDoc(`messages/${messageId}`)
  if (!msg) throw new HttpError(404, 'Message not found')
  const items = (Array.isArray(msg.data.quick) ? msg.data.quick : []) as QuickItem[]
  const item = items.find((q) => q.id === quickId)
  if (!item) throw new HttpError(404, 'Button not found')
  if (item.done) return { applied: [] as string[] }

  const actions: Action[] = []
  if (item.kind === 'shifts_same') {
    const last = await loadLastWeek(db)
    if (last.length === 0) throw new HttpError(400, 'I have no saved shifts yet. Type: shifts: mon wed 9-3')
    const state = (await db.getDoc('joelhq/state'))?.data ?? {}
    actions.push(...shiftActions(last, item.date, Array.isArray(state.tasks) ? (state.tasks as never[]) : []))
  } else if (item.kind === 'habit' && item.habitId && item.habitName) {
    actions.push({ type: 'mark_habit_done', habit: item.habitName, habitId: item.habitId, date: item.date })
  } else if (item.kind === 'all_habits') {
    for (const h of item.habits ?? []) actions.push({ type: 'mark_habit_done', habit: h.name, habitId: h.id, date: item.date })
  } else if (item.kind === 'task' && item.text) {
    const a: Action = { type: 'add_task', text: item.text.slice(0, 200), date: item.date }
    if (item.time) a.time = item.time
    if (item.minutes) a.minutes = item.minutes
    actions.push(a)
  }
  else if (item.kind === 'task_done' && item.taskId) {
    actions.push({ type: 'complete_task', taskId: item.taskId, text: item.text ?? 'task', goalId: item.goalId, date: item.date })
  } else if (item.kind === 'task_skip' && item.taskId) {
    actions.push({ type: 'skip_task', taskId: item.taskId, text: item.text ?? 'task' })
  } else if (item.kind === 'task_later' && item.taskId && item.time) {
    actions.push({ type: 'reschedule_task', taskId: item.taskId, text: item.text ?? 'task', time: item.time })
  } else if (item.kind === 'goal_done' && item.goalId) {
    actions.push({ type: 'log_goal', goalId: item.goalId, name: item.text ?? 'goal', date: item.date })
  }
  if (actions.length === 0 && item.kind !== 'dismiss' && item.kind !== 'shifts_same') throw new HttpError(400, 'Nothing to do for this button')

  const undo: UndoStep[] = []
  const applied: string[] = []
  for (const a of actions) {
    undo.push(await applyAction(db, a, now))
    applied.push(describe(a))
  }
  const activityId = crypto.randomUUID()
  if (actions.length) await db.set(`activityLog/${activityId}`, { id: activityId, messageId, at: now.getTime(), applied, undo, undone: false })

  // Mark the tapped button (and, for "all", every habit button) as done.
  const doneIds = new Set([item.id])
  if (item.group) for (const q of items) if (q.group === item.group) doneIds.add(q.id)
  if (item.kind === 'all_habits') for (const q of items) if (q.kind === 'habit') doneIds.add(q.id)
  await db.update(`messages/${messageId}`, [
    { path: ['quick'], value: items.map((q) => (doneIds.has(q.id) ? { ...q, done: true } : q)) },
  ])
  return { applied, activityId }
}
