import { useState } from 'react'
import Modal from './Modal'
import {
  RecurringPlan,
  PlanKind,
  RecurrenceFrequency,
  RecurrenceEnd,
  PlanScheduleItem,
} from '../types'

interface Props {
  onClose: () => void
  onCreate: (plan: Omit<RecurringPlan, 'id' | 'createdAt'>) => void
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function PlanForm({ onClose, onCreate }: Props) {
  const [kind, setKind] = useState<PlanKind>('schedule')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly')
  const [days, setDays] = useState<number[]>([1])
  const [endType, setEndType] = useState<RecurrenceEnd>('never')
  const [endDate, setEndDate] = useState('')
  const [endCount, setEndCount] = useState('10')

  const [scheduleItems, setScheduleItems] = useState<PlanScheduleItem[]>([{ time: '09:00', label: '' }])
  const [routineItems, setRoutineItems] = useState<string[]>([''])
  const [habitTarget, setHabitTarget] = useState('4')

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }

  function submit() {
    if (!name.trim()) return

    const recurrence = {
      frequency,
      daysOfWeek: frequency === 'weekly' ? days : [],
      endType,
      endDate: endType === 'date' ? endDate || undefined : undefined,
      endCount: endType === 'count' ? Number(endCount) || undefined : undefined,
    }

    const base = {
      name: name.trim(),
      kind,
      startDate,
      recurrence,
      active: true,
    }

    if (kind === 'schedule') {
      const items = scheduleItems.filter((i) => i.label.trim())
      if (items.length === 0) return
      const scheduleByDay: Record<number, PlanScheduleItem[]> = {}
      const applyDays = frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : days
      for (const d of applyDays) scheduleByDay[d] = items
      onCreate({ ...base, scheduleByDay })
    } else if (kind === 'routine') {
      const items = routineItems.map((i) => i.trim()).filter(Boolean)
      if (items.length === 0) return
      onCreate({ ...base, routineChecklist: items })
    } else {
      const t = Number(habitTarget)
      if (!t || t <= 0) return
      onCreate({ ...base, habitTargetPerWeek: Math.min(7, t) })
    }
  }

  return (
    <Modal title="New Recurring Plan" onClose={onClose}>
      <label className="form-label">What is this?</label>
      <div className="type-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button className={`type-btn${kind === 'schedule' ? ' active' : ''}`} onClick={() => setKind('schedule')}>
          📅 Schedule
        </button>
        <button className={`type-btn${kind === 'habit' ? ' active' : ''}`} onClick={() => setKind('habit')}>
          🔁 Habit
        </button>
        <button className={`type-btn${kind === 'routine' ? ' active' : ''}`} onClick={() => setKind('routine')}>
          🧩 Routine
        </button>
      </div>

      <label className="form-label" style={{ marginTop: 14 }}>
        Name
      </label>
      <input
        className="form-input"
        value={name}
        placeholder={kind === 'schedule' ? 'e.g. University' : kind === 'habit' ? 'e.g. Gym' : 'e.g. University Day'}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="form-label" style={{ marginTop: 14 }}>
        Starts
      </label>
      <input
        type="date"
        className="form-input"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />

      {kind !== 'habit' && (
        <>
          <label className="form-label" style={{ marginTop: 14 }}>
            Repeats
          </label>
          <div className="checkbox-row" style={{ gap: 14 }}>
            <label className="checkbox-row">
              <input
                type="radio"
                checked={frequency === 'weekly'}
                onChange={() => setFrequency('weekly')}
              />
              Weekly
            </label>
            <label className="checkbox-row">
              <input type="radio" checked={frequency === 'daily'} onChange={() => setFrequency('daily')} />
              Daily
            </label>
          </div>

          {frequency === 'weekly' && (
            <div className="day-picker">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  className={`day-btn${days.includes(i) ? ' active' : ''}`}
                  onClick={() => toggleDay(i)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <label className="form-label" style={{ marginTop: 14 }}>
        Ends
      </label>
      <div className="checkbox-row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <label className="checkbox-row">
          <input type="radio" checked={endType === 'never'} onChange={() => setEndType('never')} />
          Never
        </label>
        <label className="checkbox-row">
          <input type="radio" checked={endType === 'date'} onChange={() => setEndType('date')} />
          On a date
        </label>
        <label className="checkbox-row">
          <input type="radio" checked={endType === 'count'} onChange={() => setEndType('count')} />
          After N times
        </label>
      </div>
      {endType === 'date' && (
        <input type="date" className="form-input" style={{ marginTop: 8 }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      )}
      {endType === 'count' && (
        <input
          type="number"
          className="form-input"
          style={{ marginTop: 8, width: 90 }}
          value={endCount}
          onChange={(e) => setEndCount(e.target.value)}
        />
      )}

      {kind === 'schedule' && (
        <>
          <label className="form-label" style={{ marginTop: 14 }}>
            Items (applied to every checked day above)
          </label>
          {scheduleItems.map((item, i) => (
            <div className="add-row" key={i} style={{ marginTop: 6 }}>
              <input
                type="time"
                className="task-time-input"
                style={{ marginLeft: 0 }}
                value={item.time}
                onChange={(e) => {
                  const next = scheduleItems.slice()
                  next[i] = { ...next[i], time: e.target.value }
                  setScheduleItems(next)
                }}
              />
              <input
                value={item.label}
                placeholder="e.g. Lecture: Semantics"
                onChange={(e) => {
                  const next = scheduleItems.slice()
                  next[i] = { ...next[i], label: e.target.value }
                  setScheduleItems(next)
                }}
              />
              <button className="del-btn" onClick={() => setScheduleItems(scheduleItems.filter((_, idx) => idx !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button
            className="card-link"
            style={{ marginTop: 6 }}
            onClick={() => setScheduleItems([...scheduleItems, { time: '09:00', label: '' }])}
          >
            + add item
          </button>
          <div className="form-hint" style={{ marginTop: 8 }}>
            Want different items on different days? Create separate plans, one per day pattern (e.g. "Monday
            Lectures", "Wednesday Lectures").
          </div>
        </>
      )}

      {kind === 'routine' && (
        <>
          <label className="form-label" style={{ marginTop: 14 }}>
            Checklist (applied to every checked day above)
          </label>
          {routineItems.map((item, i) => (
            <div className="add-row" key={i} style={{ marginTop: 6 }}>
              <input
                value={item}
                placeholder="e.g. Review lecture notes"
                onChange={(e) => {
                  const next = routineItems.slice()
                  next[i] = e.target.value
                  setRoutineItems(next)
                }}
              />
              <button className="del-btn" onClick={() => setRoutineItems(routineItems.filter((_, idx) => idx !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button className="card-link" style={{ marginTop: 6 }} onClick={() => setRoutineItems([...routineItems, ''])}>
            + add item
          </button>
        </>
      )}

      {kind === 'habit' && (
        <>
          <label className="form-label" style={{ marginTop: 14 }}>
            Target per week
          </label>
          <input
            type="number"
            className="form-input"
            style={{ width: 90 }}
            min={1}
            max={7}
            value={habitTarget}
            onChange={(e) => setHabitTarget(e.target.value)}
          />
        </>
      )}

      <button className="connect-btn" style={{ marginTop: 18 }} onClick={submit}>
        Create plan
      </button>
    </Modal>
  )
}