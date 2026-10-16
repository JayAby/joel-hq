// Europe/London date helpers. Cloudflare runs in UTC, so never use
// getHours()/getDate() directly. Everything goes through these functions.
// They mirror the app's rules: the "logical day" resets at 06:00 London time.

export const TZ = 'Europe/London'
export const DAILY_RESET_HOUR = 6

interface Parts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function londonParts(d: Date): Parts {
  const out: Record<string, number> = {}
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return { year: out.year, month: out.month, day: out.day, hour: out.hour, minute: out.minute }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Calendar date in London, YYYY-MM-DD. */
export function londonDateKey(d: Date): string {
  const p = londonParts(d)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** London clock time, HH:MM. */
export function londonTime(d: Date): string {
  const p = londonParts(d)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** The app's "logical day": before 06:00 London still counts as yesterday. */
export function londonResetDayKey(d: Date, resetHour = DAILY_RESET_HOUR): string {
  return londonDateKey(new Date(d.getTime() - resetHour * 3600_000))
}

/** Add whole days to a YYYY-MM-DD key (pure calendar maths, no timezone). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** Monday (YYYY-MM-DD) of the logical week containing d. Matches mondayOf in the app. */
export function londonMondayOf(d: Date): string {
  const key = londonResetDayKey(d)
  const [y, m, day] = key.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay() // 0 = Sunday
  const back = (dow + 6) % 7
  return addDaysToKey(key, -back)
}

/** Minutes since midnight in London. */
export function londonMinutes(d: Date): number {
  const p = londonParts(d)
  return p.hour * 60 + p.minute
}
