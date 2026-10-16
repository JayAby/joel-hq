// Date and time words -> exact values. The AI never does date maths;
// it passes words and this code resolves them in Europe/London.

import { addDaysToKey, londonResetDayKey } from './london'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function weekdayName(key: string): string {
  return WEEKDAYS[weekdayOfKey(key)]
}

function validIso(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Returns YYYY-MM-DD, or null when the words can't be understood. */
export function resolveDate(word: unknown, now: Date): string | null {
  const today = londonResetDayKey(now)
  if (word === undefined || word === null || word === '') return today
  const w = String(word).trim().toLowerCase()
  if (w === 'today' || w === 'tonight') return today
  if (w === 'tomorrow') return addDaysToKey(today, 1)
  if (w === 'yesterday') return addDaysToKey(today, -1)
  if (validIso(w)) return w
  const name = w.replace(/^(next|this|on)\s+/, '')
  const idx = WEEKDAYS.indexOf(name)
  if (idx >= 0) {
    const diff = ((idx - weekdayOfKey(today) + 7) % 7) || 7
    return addDaysToKey(today, diff)
  }
  return null
}

/** Accepts "17:00", "5pm", "5:30 pm", "9". Returns HH:MM or null. */
export function parseTime(input: unknown): string | null {
  if (input === undefined || input === null || input === '') return null
  const s = String(input).trim().toLowerCase().replace(/\s+/g, '')
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
