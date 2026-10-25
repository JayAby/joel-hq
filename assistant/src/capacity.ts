// How much can honestly be planned in a week. Pure maths, no AI.

export type Mode = 'study' | 'work' | 'both' | 'between'

/** Share of free time it is realistic to plan, by what the person is doing. */
export const MODE_RATIO: Record<Mode, number> = { study: 0.75, work: 0.7, both: 0.6, between: 0.7 }

const MEALS_AND_SELF_CARE_HOURS = 3 * 7
const PROTECTED_REST_HOURS = 4

export const parseMode = (v: unknown): Mode | null => {
  const s = String(v ?? '').trim().toLowerCase()
  if (/^(study|studying|student|studying only|study only)$/.test(s)) return 'study'
  if (/^(work|working|working only|work only)$/.test(s)) return 'work'
  if (/^(both|study and work|studying and working|study\+work|student and working)$/.test(s)) return 'both'
  if (/^(between|between things|other|gap)$/.test(s)) return 'between'
  return null
}

export const modeLabel = (m: Mode): string =>
  ({ study: 'studying only', work: 'working only', both: 'studying and working', between: 'between things' })[m]

export function weekCapacity(a: {
  wakeMin: number
  bedMin: number
  fixedMinutes: number
  mode: Mode
  completionRate: number | null
}): { freeHours: number; plannableHours: number; share: number } {
  const awake = ((a.bedMin - a.wakeMin) / 60) * 7
  const freeHours = Math.max(0, awake - a.fixedMinutes / 60 - MEALS_AND_SELF_CARE_HOURS - PROTECTED_REST_HOURS)
  const share = a.completionRate === null ? MODE_RATIO[a.mode] : Math.min(MODE_RATIO[a.mode], Math.max(0.25, a.completionRate))
  return { freeHours, plannableHours: freeHours * share, share }
}

export function goalHours(goals: { perWeek: number; minutes: number }[]): number {
  return goals.reduce((sum, g) => sum + (g.perWeek * g.minutes) / 60, 0)
}
