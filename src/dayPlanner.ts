// Free-time planning for the Home screen. Pure maths on minutes since midnight.
// This mirrors assistant/src/planner.ts so Home and the assistant agree.

export interface Profile {
  wake: string
  bed: string
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
  return h * 60 + (m || 0)
}

export const toHHMM = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** "17:00", "5pm", "5:30 pm" -> "HH:MM", or null. */
export function parseTimeStr(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const s = input.trim().toLowerCase().replace(/\s+/g, '')
  const m = s.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (m[3]) {
    if (h < 1 || h > 12) return null
    if (m[3] === 'pm' && h !== 12) h += 12
    if (m[3] === 'am' && h === 12) h = 0
  }
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function normaliseProfile(raw: Record<string, unknown> | undefined | null): Profile {
  const wake = parseTimeStr(raw?.wake) ?? DEFAULT_PROFILE.wake
  const bed = parseTimeStr(raw?.bed) ?? DEFAULT_PROFILE.bed
  const hours = Number(raw?.workHours)
  const workHours = Number.isFinite(hours) && hours >= 1 && hours <= 14 ? hours : DEFAULT_PROFILE.workHours
  return { wake, bed, workHours }
}

/** Start and (if given) end of a task time like "14:45" or "09:00–11:00". */
export function parseSpan(time: unknown): { start: number; end: number | null } | null {
  if (typeof time !== 'string') return null
  const range = time.match(/(\d{1,2}(?::\d{2})?\s?(?:am|pm)?)\s*[–—-]\s*(\d{1,2}(?::\d{2})?\s?(?:am|pm)?)/i)
  if (range) {
    const a = parseTimeStr(range[1])
    const b = parseTimeStr(range[2])
    if (a && b) return { start: toMinutes(a), end: toMinutes(b) }
  }
  const single = parseTimeStr(time.trim())
  return single ? { start: toMinutes(single), end: null } : null
}

const isWork = (text: string) => /^\s*(work|shift)\b/i.test(text)

interface TimedLike {
  t?: string
  time?: string
  minutes?: number
}

export function busyBlocks(tasks: TimedLike[], profile: Profile): Block[] {
  const out: Block[] = []
  for (const t of tasks) {
    const span = parseSpan(t.time)
    if (!span) continue
    const text = String(t.t ?? '')
    const own = Number(t.minutes)
    const length = Number.isFinite(own) && own >= 5 && own <= 1440 ? own : isWork(text) ? profile.workHours * 60 : 60
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
export { ceil15 }

/** How long a habit deserves when it is blocked into the day, or null if it is too small to block. */
export function focusLength(name: string): number | null {
  if (/skincare|vitamin|supplement|floss|brush/i.test(name)) return null
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

export interface BarSegment {
  start: number
  end: number
  kind: 'free' | 'busy' | 'suggest'
}

/** The day bar: every minute between wake and bed is free, busy or a suggested slot. */
export function dayBar(blocks: Block[], suggestion: Suggestion | null, from: number, to: number): BarSegment[] {
  const cuts = new Set<number>([from, to])
  const add = (m: number) => {
    if (m > from && m < to) cuts.add(m)
  }
  for (const b of blocks) {
    add(b.start)
    add(b.end)
  }
  if (suggestion) {
    add(suggestion.start)
    add(suggestion.end)
  }
  const points = [...cuts].sort((a, b) => a - b)
  const out: BarSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]
    const end = points[i + 1]
    const mid = (start + end) / 2
    let kind: BarSegment['kind'] = 'free'
    if (suggestion && mid >= suggestion.start && mid < suggestion.end) kind = 'suggest'
    else if (blocks.some((b) => mid >= b.start && mid < b.end)) kind = 'busy'
    out.push({ start, end, kind })
  }
  return out
}

export function untilText(minutes: number): string {
  if (minutes < 1) return 'now'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
