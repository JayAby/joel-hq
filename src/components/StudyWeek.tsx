import { StudyState } from '../types'
import Editable from './Editable'
import ProgressBar from './ProgressBar'

interface Props {
  study: StudyState
  onChange: (study: StudyState) => void
}

export default function StudyWeek({ study, onChange }: Props) {
  const { goalDaysPerWeek, days } = study

  function toggle(i: number) {
    const next = days.slice()
    next[i] = { ...next[i], done: !next[i].done }
    onChange({ ...study, days: next })
  }
  function editSubject(i: number, val: string) {
    const next = days.slice()
    next[i] = { ...next[i], subject: val.trim() }
    onChange({ ...study, days: next })
  }

  const doneCount = days.filter((d) => d.done).length
  const goalPct = goalDaysPerWeek > 0 ? Math.min(100, Math.round((doneCount / goalDaysPerWeek) * 100)) : 0

  return (
    <div>
      <div className="fit-goal-row">
        study sessions this week: {doneCount}/
        <input
          type="number"
          className="fit-goal-input"
          min={1}
          max={7}
          value={goalDaysPerWeek}
          onChange={(e) =>
            onChange({ ...study, goalDaysPerWeek: Math.max(1, Math.min(7, Number(e.target.value))) })
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
            <Editable
              className="fitweek-workout"
              value={d.subject}
              onChange={(v) => editSubject(i, v)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}