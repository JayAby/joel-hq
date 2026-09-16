import { FitnessDay } from '../types'
import Editable from './Editable'

interface Props {
  days: FitnessDay[]
  onChange: (days: FitnessDay[]) => void
}

export default function FitnessWeek({ days, onChange }: Props) {
  function toggle(i: number) {
    const next = days.slice()
    next[i] = { ...next[i], done: !next[i].done }
    onChange(next)
  }
  function editWorkout(i: number, val: string) {
    const next = days.slice()
    next[i] = { ...next[i], workout: val.trim() }
    onChange(next)
  }

  return (
    <div>
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
  )
}