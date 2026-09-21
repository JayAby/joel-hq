export const DAILY_RESET_HOUR = 6

export function resetDayKey(d: Date, resetHour: number = DAILY_RESET_HOUR): string {
  const shifted = new Date(d)
  shifted.setHours(shifted.getHours() - resetHour)
  return shifted.toDateString()
}