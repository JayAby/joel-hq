import { HistoryEntry } from './types'

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

  const tasksCompleted = week.reduce((s, e) => s + e.tasksCompleted, 0)
  const tasksTotal = week.reduce((s, e) => s + e.tasksTotal, 0)
  if (tasksTotal === 0) return null
  const pct = Math.round((tasksCompleted / tasksTotal) * 100)
  return `This week: ${tasksCompleted}/${tasksTotal} tasks completed (${pct}%)`
}