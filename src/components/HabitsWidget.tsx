import { useState } from 'react'
import { RecurringPlan } from '../types'
import { mondayOf } from '../types'
import { habitWeekCount, isHabitDoneToday } from '../plans'
import ProgressBar from './ProgressBar'
import { confirmDelete } from '../confirm'

interface Props {
  habits: RecurringPlan[]
  habitLog: Record<string, string[]>
  now: Date
  onToggleToday: (habitId: string) => void
  onAddHabit: (name: string, targetPerWeek: number) => void
  onRemoveHabit: (id: string) => void
}

export default function HabitsWidget({
  habits,
  habitLog,
  now,
  onToggleToday,
  onAddHabit,
  onRemoveHabit,
}: Props) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('4')

  const todayKey = now.toISOString().slice(0, 10)
  const weekStart = mondayOf(now)

  function add() {
    const t = Number(target)
    if (!name.trim() || !t || t <= 0) return
    onAddHabit(name.trim(), Math.min(7, t))
    setName('')
    setTarget('4')
  }

  return (
    <div className="card accent-amber span-8">
      <div className="card-head">
        <div className="card-title">
          <span>🔁</span> Habits
        </div>
      </div>

      {habits.length === 0 && <div className="np-status">No habits yet — add one below.</div>}

      {habits.map((h) => {
        const count = habitWeekCount(h.id, habitLog, weekStart)
        const target = h.habitTargetPerWeek ?? 1
        const doneToday = isHabitDoneToday(h.id, habitLog, todayKey)
        const pct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0

        return (
          <div className="habit-row" key={h.id}>
            <button
              className={`check${doneToday ? ' habit-checked' : ''}`}
              onClick={() => onToggleToday(h.id)}
              title={doneToday ? 'Done today' : 'Mark done today'}
            >
              ✓
            </button>
            <div className="habit-info">
              <div className="habit-top">
                <span className="habit-name">{h.name}</span>
                <span className="habit-count">
                  {count}/{target} this week
                </span>
              </div>
              <ProgressBar value={pct} barClass="amber" readOnly />
            </div>
            <button
              className="del-btn"
              style={{ opacity: 0.5 }}
              onClick={() => confirmDelete(`"${h.name}"`) && onRemoveHabit(h.id)}
            >
              ✕
            </button>
          </div>
        )
      })}

      <div className="add-row" style={{ marginTop: 10 }}>
        <input value={name} placeholder="new habit name" onChange={(e) => setName(e.target.value)} />
        <input
          type="number"
          value={target}
          min={1}
          max={7}
          onChange={(e) => setTarget(e.target.value)}
          style={{ flex: '0 0 60px' }}
        />
        <span className="form-hint" style={{ alignSelf: 'center' }}>
          /week
        </span>
        <button className="add-btn" onClick={add}>
          add
        </button>
      </div>
    </div>
  )
}