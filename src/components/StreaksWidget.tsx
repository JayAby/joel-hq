import { HistoryEntry } from '../types'
import { workoutStreak, studyStreak, lastNDaysDots, weeklySummary } from '../streaks'

interface Props {
  entries: HistoryEntry[]
}

const DOT_STYLE: Record<string, string> = {
  full: 'var(--mint)',
  partial: 'var(--amber)',
  none: 'var(--dim)',
  'no-data': 'var(--line)',
}

export default function StreaksWidget({ entries }: Props) {
  const wStreak = workoutStreak(entries)
  const sStreak = studyStreak(entries)
  const dots = lastNDaysDots(entries, 7)
  const summary = weeklySummary(entries)

  return (
    <div className="card accent-rose span-4">
      <div className="card-head">
        <div className="card-title">
          <span>📈</span> Streaks
        </div>
      </div>

      <div className="streak-row">
        <span className="streak-icon">🏋🏾</span>
        <span className="streak-label">Workout streak</span>
        <span className="streak-value">{wStreak > 0 ? `🔥 ${wStreak}d` : '—'}</span>
      </div>
      <div className="streak-row">
        <span className="streak-icon">📚</span>
        <span className="streak-label">Study streak</span>
        <span className="streak-value">{sStreak > 0 ? `🔥 ${sStreak}d` : '—'}</span>
      </div>

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
    </div>
  )
}