// The accountability layer: tone, first-open setup questions, "never miss twice",
// one follow-up on a check-in that went unanswered, and the Sunday review.
// All wording is fixed text chosen by tone. The AI is not involved.

import type { QuickItem } from './assistant'
import type { Goal } from './routines'
import { sessionsThisWeek } from './routines'
import { addDaysToKey } from './london'
import { weekdayName } from './dates'

export type Tone = 'gentle' | 'direct' | 'tough'
export const TONES: Tone[] = ['gentle', 'direct', 'tough']
export const TONE_LABEL: Record<Tone, string> = { gentle: 'Gentle', direct: 'Direct', tough: 'Tough' }

export function parseTone(word: string): Tone | null {
  const w = word.toLowerCase().trim()
  return (TONES as string[]).includes(w) ? (w as Tone) : null
}

export const toneOf = (raw: unknown): Tone => (parseTone(String(raw ?? '')) ?? 'direct')

/** Said when a planned session was missed yesterday. */
export function missedLine(tone: Tone, name: string): string {
  if (tone === 'gentle') return `${name} did not happen yesterday. That is fine. Want to get it back on today?`
  if (tone === 'tough') return `${name}: missed yesterday. Today it happens. No excuses.`
  return `You missed ${name} yesterday. Do not miss twice.`
}

/** One follow-up when a check-in got no answer. */
export function followUpLine(tone: Tone, name: string): string {
  if (tone === 'gentle') return `No rush. Did the ${name} session happen? Even a short one counts.`
  if (tone === 'tough') return `${name}: no answer. Done, or skipped? Be honest with yourself.`
  return `Still need an answer on ${name}. Done or not today?`
}

export function closingLine(tone: Tone, pct: number): string {
  if (pct >= 80) return tone === 'tough' ? 'Strong week. Do it again.' : 'Strong week. Well done.'
  if (pct >= 50) return tone === 'gentle' ? 'A decent week. Small steps add up.' : tone === 'tough' ? 'Half measures. You can do better.' : 'A fair week. There is room to push.'
  return tone === 'gentle' ? 'A hard week. Next week is a fresh start.' : tone === 'tough' ? 'That was not good enough, and you know it. Fix it.' : 'A weak week. Pick one thing and nail it next week.'
}

// ---- first-open setup: mode, then tone, then a first goal -------------------

export interface SetupMessage {
  kind: string
  text: string
  quick: QuickItem[]
}

const GOAL_ASK: Record<string, string> = {
  studying: 'What is the one thing you are studying towards? Type it like: goal: Masters 4x/week 90min',
  working: 'Is there something beyond work you want to build? Type it like: goal: Driving test 2x/week 60min',
  both: 'What do you want to make progress on besides work? Type it like: goal: Masters 4x/week 90min',
  between: 'What are you aiming for next? Type it like: goal: Job applications 5x/week 60min',
}

/** The next setup question to ask, or null when setup is done (or already asked). */
export function nextSetup(profile: Record<string, unknown> | undefined, asked: Record<string, unknown> | undefined, goals: Goal[], today: string): SetupMessage | null {
  const a = asked ?? {}
  if (a.done === true) return null // "skip setup"
  const mode = typeof profile?.mode === 'string' ? profile.mode : ''
  if (!mode) {
    if (a.mode === today) return null // ask again tomorrow if unanswered, not every 5 minutes
    return {
      kind: 'setup',
      text: 'Hi Joel. I am your assistant. To plan around your life properly, which fits you right now?',
      quick: [
        { id: 'm1', group: 'mode', prompt: 'Which fits your life right now?', label: 'Studying', kind: 'set_mode', value: 'studying', date: today },
        { id: 'm2', group: 'mode', label: 'Working', kind: 'set_mode', value: 'working', date: today },
        { id: 'm3', group: 'mode', label: 'Both', kind: 'set_mode', value: 'both', date: today },
        { id: 'm4', group: 'mode', label: 'Between things', kind: 'set_mode', value: 'between', date: today },
      ],
    }
  }
  if (!profile?.tone) {
    if (a.tone === today) return null
    return {
      kind: 'setup',
      text: 'How hard should I push you when you slip?',
      quick: [
        { id: 't1', group: 'tone', prompt: 'How hard should I push you when you slip?', label: 'Gentle', kind: 'set_tone', value: 'gentle', date: today },
        { id: 't2', group: 'tone', label: 'Direct', kind: 'set_tone', value: 'direct', date: today },
        { id: 't3', group: 'tone', label: 'Tough', kind: 'set_tone', value: 'tough', date: today },
      ],
    }
  }
  if (goals.length === 0 && !a.goal) {
    return { kind: 'setup', text: GOAL_ASK[mode] ?? GOAL_ASK.both, quick: [{ id: 'g1', group: 'goalask', prompt: GOAL_ASK[mode] ?? GOAL_ASK.both, label: 'Later', kind: 'dismiss', date: today }] }
  }
  return null
}

// ---- Sunday review ----------------------------------------------------------

interface TaskLike {
  t?: unknown
  date?: unknown
  done?: unknown
  skipped?: unknown
}

export interface Review {
  text: string
  pct: number
}

export function buildReview(tone: Tone, tasks: TaskLike[], goals: Goal[], habits: { name: string; dates: string[] }[], monday: string): Review {
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i))
  const mine = tasks.filter((t) => typeof t.date === 'string' && days.includes(t.date) && !t.skipped)
  const done = mine.filter((t) => t.done === true)
  const pct = mine.length ? Math.round((done.length / mine.length) * 100) : 0
  const lines: string[] = ['Your week in review.', '']
  lines.push(mine.length ? `Tasks: ${done.length} of ${mine.length} done (${pct}%).` : 'No tasks were planned this week.')
  const perDay = days.map((d) => ({ d, n: done.filter((t) => t.date === d).length }))
  const best = perDay.reduce((a, b) => (b.n > a.n ? b : a), perDay[0])
  if (best.n > 0) lines.push(`Best day: ${weekdayName(best.d).replace(/^./, (c) => c.toUpperCase())} (${best.n} done).`)
  for (const g of goals) lines.push(`${g.name}: ${sessionsThisWeek(g, tasks as never[], monday)} of ${g.perWeek} sessions.`)
  for (const h of habits) {
    const n = h.dates.filter((d) => days.includes(d)).length
    if (n > 0 || habits.length <= 4) lines.push(`${h.name}: ${n} of 7 days.`)
  }
  lines.push('', closingLine(tone, mine.length ? pct : 100), '', 'What got in the way most?')
  return { text: lines.join('\n'), pct }
}

export const REFLECT_CHIPS = (monday: string): QuickItem[] => [
  { id: 'r1', group: 'reflect', prompt: 'What got in the way most this week?', label: 'Too tired', kind: 'reflect', value: 'tired', date: monday },
  { id: 'r2', group: 'reflect', label: 'Too busy', kind: 'reflect', value: 'busy', date: monday },
  { id: 'r3', group: 'reflect', label: 'Forgot', kind: 'reflect', value: 'forgot', date: monday },
  { id: 'r4', group: 'reflect', label: 'Nothing, it went well', kind: 'reflect', value: 'fine', date: monday },
]
