// The assistant core. Channel-agnostic: Telegram and the in-app chat will both
// call these functions. Order of safety checks in handleMessage:
//   1. manual commands ("task:", "shop:") never touch the AI
//   2. personal-looking messages are NOT sent to the AI unless they start with "share:"
//   3. the AI only sees the allowlisted, redacted context
//   4. everything the AI proposes is validated and waits for approval

import { applyAction, describe, undoStep, validateActions, type Action, type UndoStep } from './actions'
import { buildSystemPrompt, parseAiReply, type RunAi } from './ai'
import { parseTime, resolveDate, weekdayName } from './dates'
import type { Db } from './firestore'
import { addDaysToKey, londonResetDayKey } from './london'
import { buildContext, isSensitive, type ResolveIndex } from './privacy'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export interface AskResult {
  reply: string
  proposalId?: string
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
  return { reply, proposalId: id, summary, warnings }
}

export async function handleMessage(db: Db, runAi: RunAi, rawText: string, now: Date): Promise<AskResult> {
  let text = rawText.trim()
  if (!text) return { reply: 'Say something and I will help.', summary: [], warnings: [] }
  if (text.length > MAX_MESSAGE) text = text.slice(0, MAX_MESSAGE)

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
