import { FitnessState } from '../types'
import Editable from './Editable'
import ProgressBar from './ProgressBar'

interface Props {
  fitness: FitnessState
  onChange: (fitness: FitnessState) => void
}

function parseWeight(s: string): number | null {
  const m = s.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

export default function FitnessWeek({ fitness, onChange }: Props) {
  const { weight, lastWeekWeight, goalDaysPerWeek, days } = fitness

  function toggle(i: number) {
    const next = days.slice()
    next[i] = { ...next[i], done: !next[i].done }
    onChange({ ...fitness, days: next })
  }
  function editWorkout(i: number, val: string) {
    const next = days.slice()
    next[i] = { ...next[i], workout: val.trim() }
    onChange({ ...fitness, days: next })
  }

  const doneCount = days.filter((d) => d.done).length
  const goalPct = goalDaysPerWeek > 0 ? Math.min(100, Math.round((doneCount / goalDaysPerWeek) * 100)) : 0

  const cur = parseWeight(weight)
  const prev = parseWeight(lastWeekWeight)
  let deltaText: string | null = null
  if (cur !== null && prev !== null) {
    const diff = Math.round((cur - prev) * 10) / 10
    if (diff > 0) deltaText = `▲ +${diff}kg since last week`
    else if (diff < 0) deltaText = `▼ ${diff}kg since last week`
    else deltaText = 'no change since last week'
  }

  return (
    <div>
      <div className="fit-weight-row">
        <span className="fit-weight-label">weight</span>
        <Editable
          className="fit-weight-val"
          value={weight}
          onChange={(v) => onChange({ ...fitness, weight: v })}
        />
      </div>
      {deltaText && <div className="fit-weight-delta">{deltaText}</div>}

      <div className="fit-goal-row">
        workouts this week: {doneCount}/
        <input
          type="number"
          className="fit-goal-input"
          min={1}
          max={7}
          value={goalDaysPerWeek}
          onChange={(e) =>
            onChange({ ...fitness, goalDaysPerWeek: Math.max(1, Math.min(7, Number(e.target.value))) })
          }
        />
      </div>
      <ProgressBar value={goalPct} readOnly />

      <div style={{ marginTop: 12 }}>
        {days.map((d, i) => (
          <div className={`fitweek-row${d.done ? ' done' : ''}`} key={i}>
            <button className="check" onClick={() => toggle(i)}>
              ✓
            </button>
            <div className="fitweek-day">{d.day}</div>
            <Editable className="fitweek-workout" value={d.workout} onChange={(v) => editWorkout(i, v)} />
          </div>
        ))}
      </div>
    </div>
  )
}