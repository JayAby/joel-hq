import { RecurringPlan, PlanScheduleItem, Task, PlanStats } from './types'

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function matchesFrequency(plan: RecurringPlan, date: Date): boolean {
  if (plan.recurrence.frequency === 'daily') return true
  return plan.recurrence.daysOfWeek.includes(date.getDay())
}

export function countMatchesUpTo(plan: RecurringPlan, targetDate: Date): number {
  const cursor = new Date(plan.startDate)
  const target = new Date(dateKey(targetDate))
  let count = 0
  let guard = 0
  while (cursor <= target && guard < 3660) {
    if (matchesFrequency(plan, cursor)) count++
    cursor.setDate(cursor.getDate() + 1)
    guard++
  }
  return count
}

export type PlanLifecycleStatus = 'upcoming' | 'active' | 'paused' | 'completed'

export function planStatus(plan: RecurringPlan, today: Date): PlanLifecycleStatus {
  if (!plan.active) return 'paused'

  const todayKey = dateKey(today)
  if (todayKey < plan.startDate) return 'upcoming'

  const { endType, endDate, endCount } = plan.recurrence
  if (endType === 'date' && endDate && todayKey > endDate) return 'completed'
  if (endType === 'count' && endCount && countMatchesUpTo(plan, today) > endCount) return 'completed'

  return 'active'
}

export const DEFAULT_PLAN_STATS: PlanStats = { generated: 0, completed: 0, skipped: 0 }

export function planAppliesOn(plan: RecurringPlan, date: Date): boolean {
  if (!plan.active) return false
  const key = dateKey(date)
  if (key < plan.startDate) return false
  if (!matchesFrequency(plan, date)) return false

  const { endType, endDate, endCount } = plan.recurrence
  if (endType === 'date' && endDate && key > endDate) return false
  if (endType === 'count' && endCount && countMatchesUpTo(plan, date) > endCount) return false
  return true
}

function scheduleItemsFor(plan: RecurringPlan, date: Date): PlanScheduleItem[] {
  if (plan.kind !== 'schedule' || !plan.scheduleByDay) return []
  return plan.scheduleByDay[date.getDay()] ?? []
}

export function generatePlanTasksForDate(plans: RecurringPlan[], date: Date): Task[] {
  const key = dateKey(date)
  const out: Task[] = []

  for (const plan of plans) {
    if (!planAppliesOn(plan, date)) continue

    if (plan.kind === 'schedule') {
      scheduleItemsFor(plan, date).forEach((item, i) => {
        out.push({
          id: `plan_${plan.id}_${key}_${i}`,
          t: item.label,
          time: item.time,
          done: false,
          planId: plan.id,
        })
      })
    } else if (plan.kind === 'routine') {
      ;(plan.routineChecklist ?? []).forEach((label, i) => {
        out.push({
          id: `plan_${plan.id}_${key}_${i}`,
          t: label,
          done: false,
          planId: plan.id,
        })
      })
    }
  }

  return out
}

export function activeHabits(plans: RecurringPlan[]): RecurringPlan[] {
  return plans.filter((p) => p.kind === 'habit' && p.active)
}

export function habitWeekCount(habitId: string, habitLog: Record<string, string[]>, weekStartKey: string): number {
  const dates = habitLog[habitId] ?? []
  return dates.filter((d) => d >= weekStartKey).length
}

export function isHabitDoneToday(habitId: string, habitLog: Record<string, string[]>, todayKey: string): boolean {
  return (habitLog[habitId] ?? []).includes(todayKey)
}

export function habitStreakDays(habitId: string, habitLog: Record<string, string[]>, now: Date): number {
  const dates = new Set(habitLog[habitId] ?? [])
  const cursor = new Date(now)
  let key = cursor.toISOString().slice(0, 10)
  if (!dates.has(key)) cursor.setDate(cursor.getDate() - 1)

  let streak = 0
  let guard = 0
  while (guard < 3660) {
    key = cursor.toISOString().slice(0, 10)
    if (!dates.has(key)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
    guard++
  }
  return streak
}