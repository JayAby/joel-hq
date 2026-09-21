import { HistoryEntry } from './types'

function streakFrom(entries: HistoryEntry[], predicate: (e: HistoryEntry) => boolean): number {
  let streak = 0
  for (const e of entries) {
    if (predicate(e)) streak++
    else break
  }
  return streak
}

export function workoutStreak(entries: HistoryEntry[]): number {
  return streakFrom(entries, (e) => e.workoutDone)
}

export function studyStreak(entries: HistoryEntry[]): number {
  return streakFrom(entries, (e) => e.studyDone)
}

export interface DayDot {
  date: string
  level: 'full' | 'partial' | 'none' | 'no-data'
}

export function lastNDaysDots(entries: HistoryEntry[], n: number): DayDot[] {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const dots: DayDot[] = []

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const e = byDate.get(key)

    if (!e) {
      dots.push({ date: key, level: 'no-data' })
      continue
    }
    if (e.tasksTotal === 0) {
      dots.push({ date: key, level: 'no-data' })
    } else if (e.tasksCompleted >= e.tasksTotal) {
      dots.push({ date: key, level: 'full' })
    } else if (e.tasksCompleted > 0) {
      dots.push({ date: key, level: 'partial' })
    } else {
      dots.push({ date: key, level: 'none' })
    }
  }
  return dots
}

export function weeklySummary(entries: HistoryEntry[]): string | null {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const cutoffKey = cutoff.toISOString().slice(0, 10)
  const week = entries.filter((e) => e.date >= cutoffKey)

  if (week.length === 0) return null

  const workouts = week.filter((e) => e.workoutDone).length
  const studySessions = week.filter((e) => e.studyDone).length
  const tasksCompleted = week.reduce((s, e) => s + e.tasksCompleted, 0)
  const tasksTotal = week.reduce((s, e) => s + e.tasksTotal, 0)
  const pct = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : null

  const parts = [`${workouts}/${week.length} workouts`, `${studySessions}/${week.length} study days`]
  if (pct !== null) parts.push(`${tasksCompleted}/${tasksTotal} tasks (${pct}%)`)
  return `This week: ${parts.join(' · ')}`
}