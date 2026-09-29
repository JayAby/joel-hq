import { useState } from 'react'
import { HistoryEntry, RecurringPlan, HabitWeekSnapshot } from '../types'
import { lastNDaysDots, weeklySummary } from '../streaks'
import { habitStreakDays } from '../plans'

interface Props {
  entries: HistoryEntry[]
  habits: RecurringPlan[]
  habitLog: Record<string, string[]>
  habitWeeks: HabitWeekSnapshot[]
  now: Date
}

const DOT_STYLE: Record<string, string> = {
  full: 'var(--mint)',
  partial: 'var(--amber)',
  none: 'var(--dim)',
  'no-data': 'var(--line)',
}

export default function StreaksWidget({ entries, habits, habitLog, habitWeeks, now }: Props) {
  const [showPrevWeeks, setShowPrevWeeks] = useState(false)
  const dots = lastNDaysDots(entries, 7)
  const summary = weeklySummary(entries)

  return (
    <div className="card accent-rose span-4">
      <div className="card-head">
        <div className="card-title">
          <span>📈</span> Streaks
        </div>
      </div>

      {habits.length === 0 ? (
        <div className="np-status">Add a habit to start building a streak.</div>
      ) : (
        habits.map((h) => {
          const streak = habitStreakDays(h.id, habitLog, now)
          return (
            <div className="streak-row" key={h.id}>
              <span className="streak-icon">🔁</span>
              <span className="streak-label">{h.name}</span>
              <span className="streak-value">{streak > 0 ? `🔥 ${streak}d` : '—'}</span>
            </div>
          )
        })
      )}

      <div className="streak-dots-label">Last 7 days · tasks completed</div>
      <div className="streak-dots">
        {dots.map((d) => (
          <span key={d.date} className="streak-dot" style={{ background: DOT_STYLE[d.level] }} title={d.date} />
        ))}
      </div>
      {entries.length === 0 && (
        <div className="form-hint" style={{ marginTop: 8 }}>
          Streaks build up from tomorrow's daily reset onward — there's no history to show yet.
        </div>
      )}
      {summary && <div className="streak-summary">{summary}</div>}

      {habitWeeks.length > 0 && (
        <div className="prev-weeks">
          <button className="card-link" onClick={() => setShowPrevWeeks((s) => !s)}>
            {showPrevWeeks ? '▾ hide previous weeks' : `▸ previous weeks (${habitWeeks.length})`}
          </button>
          {showPrevWeeks && (
            <div className="prev-weeks-list">
              {habitWeeks.map((w) => (
                <div className="prev-week-row" key={w.weekStart}>
                  <div className="prev-week-date">Week of {w.weekStart}</div>
                  {w.habits.map((h) => (
                    <div className="prev-week-habit" key={h.id}>
                      {h.name}: {h.count}/{h.target}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}