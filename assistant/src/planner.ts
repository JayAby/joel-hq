// Free-time planning. Pure maths on minutes since midnight, no AI.
// A "busy block" is any timed task: "14:45" (start only) or "09:00–11:00".

import { parseTime } from './dates'

export interface Profile {
  /** Earliest time the assistant will suggest, HH:MM. */
  wake: string
  /** Latest time a suggestion may end, HH:MM. */
  bed: string
  /** Assumed length of a work shift when only a start time is known. */
  workHours: number
}

export const DEFAULT_PROFILE: Profile = { wake: '08:00', bed: '22:00', workHours: 8 }

export interface Block {
  start: number
  end: number
  label: string
}

export interface Slot {
  start: number
  end: number
}

export interface Suggestion {
  label: string
  start: number
  end: number
}

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const toHHMM = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export function normaliseProfile(raw: Record<string, unknown> | undefined): { profile: Profile; isSet: boolean } {
  const wake = parseTime(raw?.wake) ?? DEFAULT_PROFILE.wake
  const bed = parseTime(raw?.bed) ?? DEFAULT_PROFILE.bed
  const hours = Number(raw?.workHours)
  const workHours = Number.isFinite(hours) && hours >= 1 && hours <= 14 ? hours : DEFAULT_PROFILE.workHours
  return { profile: { wake, bed, workHours }, isSet: raw?.workHours !== undefined }
}

/** Start and (if given) end of a task time like "14:45" or "09:00–11:00". */
export function parseSpan(time: unknown): { start: number; end: number | null } | null {
  if (typeof time !== 'string') return null
  const range = time.match(/(\d{1,2}(?::\d{2})?\s?(?:am|pm)?)\s*[–—-]\s*(\d{1,2}(?::\d{2})?\s?(?:am|pm)?)/i)
  if (range) {
    const a = parseTime(range[1])
    const b = parseTime(range[2])
    if (a && b) return { start: toMinutes(a), end: toMinutes(b) }
  }
  const single = parseTime(time.trim())
  return single ? { start: toMinutes(single), end: null } : null
}

const isWork = (text: string) => /^\s*(work|shift)\b/i.test(text)

export function busyBlocks(tasks: { t?: string; time?: string }[], profile: Profile): Block[] {
  const out: Block[] = []
  for (const t of tasks) {
    const span = parseSpan(t.time)
    if (!span) continue
    const text = String(t.t ?? '')
    const length = isWork(text) ? profile.workHours * 60 : 60
    const end = Math.min(1440, span.end !== null && span.end > span.start ? span.end : span.start + length)
    out.push({ start: span.start, end, label: text })
  }
  return out.sort((a, b) => a.start - b.start)
}

/** Free gaps inside [from, to], leaving a buffer around busy blocks. */
export function freeGaps(blocks: Block[], from: number, to: number, minLength = 60, buffer = 15): Slot[] {
  const gaps: Slot[] = []
  let cursor = from
  for (const b of blocks) {
    const bs = b.start - buffer
    if (bs > cursor) gaps.push({ start: cursor, end: Math.min(bs, to) })
    cursor = Math.max(cursor, b.end + buffer)
    if (cursor >= to) break
  }
  if (cursor < to) gaps.push({ start: cursor, end: to })
  return gaps.filter((g) => g.end - g.start >= minLength)
}

const ceil15 = (m: number) => Math.ceil(m / 15) * 15

/** What is worth blocking time for, in order, and for how long. */
export function focusLength(name: string): number | null {
  if (/skincare|vitamin|supplement|floss|brush/i.test(name)) return null // too small to block
  if (/study|coding|learn|msc|research|read/i.test(name)) return 90
  if (/workout|gym|run|exercise|training/i.test(name)) return 60
  if (/driving|theory|practice/i.test(name)) return 45
  return 45
}

export function suggest(gaps: Slot[], habits: string[], max = 2): Suggestion[] {
  const wanted = habits
    .map((name) => ({ name, mins: focusLength(name) }))
    .filter((x): x is { name: string; mins: number } => x.mins !== null)
  const out: Suggestion[] = []
  let w = 0
  for (const g of gaps) {
    let cursor = ceil15(g.start)
    while (w < wanted.length && out.length < max) {
      const item = wanted[w]
      if (cursor + item.mins > g.end) break
      out.push({ label: item.name, start: cursor, end: cursor + item.mins })
      cursor += item.mins + 15
      w++
    }
    if (out.length >= max) break
  }
  return out
}
