export const DAILY_RESET_HOUR = 6

// The one canonical way to turn a Date into a "YYYY-MM-DD" key anywhere in
// this app. Deliberately uses LOCAL date parts (never .toISOString(), which
// silently converts to UTC first and can shift the date backward or forward
// by a day depending on the timezone offset — exactly the bug that caused
// habit weeks and plan day-matching to sometimes disagree with each other).
export function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// The "logical day" boundary — shifts by DAILY_RESET_HOUR before reading
// local date parts, so a moment at 2am still counts as "yesterday."
export function resetDayKey(d: Date, resetHour: number = DAILY_RESET_HOUR): string {
  const shifted = new Date(d)
  shifted.setHours(shifted.getHours() - resetHour)
  return localDateKey(shifted)
}

// The inverse of localDateKey: turns a "YYYY-MM-DD" string back into a Date
// at LOCAL midnight. Deliberately never uses `new Date(dateOnlyString)`
// directly — the JS spec parses a bare date-only ISO string as UTC
// midnight, which then reads back as the wrong local day for negative UTC
// offsets (most of the Americas). Constructing from parsed y/m/d parts
// avoids that entirely.
export function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}