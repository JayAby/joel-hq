import { useState } from 'react'
import Modal from './Modal'
import {
  RecurringPlan,
  PlanKind,
  RecurrenceFrequency,
  RecurrenceEnd,
  RecurrenceRule,
  PlanScheduleItem,
} from '../types'

interface Props {
  onClose: () => void
  onSubmit: (plan: Omit<RecurringPlan, 'id' | 'createdAt'>) => void
  initialPlan?: RecurringPlan
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function PlanForm({ onClose, onSubmit, initialPlan }: Props) {
  const isEditing = !!initialPlan

  const [kind, setKind] = useState<PlanKind>(initialPlan?.kind ?? 'schedule')
  const [name, setName] = useState(initialPlan?.name ?? '')
  const [startDate, setStartDate] = useState(
    initialPlan?.startDate ?? new Date().toISOString().slice(0, 10),
  )
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    initialPlan?.recurrence.frequency ?? 'weekly',
  )
  const [days, setDays] = useState<number[]>(
    initialPlan?.recurrence.daysOfWeek?.length ? initialPlan.recurrence.daysOfWeek : [1],
  )
  const [endType, setEndType] = useState<RecurrenceEnd>(initialPlan?.recurrence.endType ?? 'never')
  const [endDate, setEndDate] = useState(initialPlan?.recurrence.endDate ?? '')
  const [endCount, setEndCount] = useState(String(initialPlan?.recurrence.endCount ?? 10))

  const [perDayItems, setPerDayItems] = useState<Record<number, PlanScheduleItem[]>>(
    initialPlan?.scheduleByDay ?? { 1: [{ time: '09:00', label: '' }] },
  )
  const [routineItems, setRoutineItems] = useState<string[]>(
    initialPlan?.routineChecklist?.length ? initialPlan.routineChecklist : [''],
  )
  const [habitTarget, setHabitTarget] = useState(String(initialPlan?.habitTargetPerWeek ?? 4))

  function toggleDay(d: number) {
    setDays((prev) => {
      const has = prev.includes(d)
      const next = has ? prev.filter((x) => x !== d) : [...prev, d].sort()
      if (!has && !perDayItems[d]) {
        setPerDayItems((pi) => ({ ...pi, [d]: [{ time: '09:00', label: '' }] }))
      }
      return next
    })
  }

  function updateDayItem(day: number, index: number, patch: Partial<PlanScheduleItem>) {
    setPerDayItems((pi) => {
      const items = (pi[day] ?? []).slice()
      items[index] = { ...items[index], ...patch }
      return { ...pi, [day]: items }
    })
  }
  function addDayItem(day: number) {
    setPerDayItems((pi) => ({ ...pi, [day]: [...(pi[day] ?? []), { time: '09:00', label: '' }] }))
  }
  function removeDayItem(day: number, index: number) {
    setPerDayItems((pi) => ({ ...pi, [day]: (pi[day] ?? []).filter((_, i) => i !== index) }))
  }

  function submit() {
    if (!name.trim()) return

    const recurrence: RecurrenceRule = {
      frequency,
      daysOfWeek: frequency === 'weekly' ? days : [],
      endType,
    }
    if (endType === 'date' && endDate) recurrence.endDate = endDate
    if (endType === 'count') {
      const n = Number(endCount)
      if (n > 0) recurrence.endCount = n
    }

    const base: Partial<RecurringPlan> & Pick<RecurringPlan, 'name' | 'kind' | 'startDate' | 'recurrence' | 'active'> = {
      name: name.trim(),
      kind,
      startDate,
      recurrence,
      active: initialPlan?.active ?? true,
    }
    if (initialPlan?.stats) base.stats = initialPlan.stats

    if (kind === 'schedule') {
      const applyDays = frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : days
      const scheduleByDay: Record<number, PlanScheduleItem[]> = {}
      for (const d of applyDays) {
        const items = (perDayItems[d] ?? []).filter((i) => i.label.trim())
        if (items.length > 0) scheduleByDay[d] = items
      }
      if (Object.keys(scheduleByDay).length === 0) return
      onSubmit({ ...base, scheduleByDay } as Omit<RecurringPlan, 'id' | 'createdAt'>)
    } else if (kind === 'routine') {
      const items = routineItems.map((i) => i.trim()).filter(Boolean)
      if (items.length === 0) return
      onSubmit({ ...base, routineChecklist: items } as Omit<RecurringPlan, 'id' | 'createdAt'>)
    } else {
      const t = Number(habitTarget)
      if (!t || t <= 0) return
      onSubmit({ ...base, habitTargetPerWeek: Math.min(7, t) } as Omit<RecurringPlan, 'id' | 'createdAt'>)
    }
  }

  return (
    <Modal title={isEditing ? `Edit "${initialPlan!.name}"` : 'New Recurring Plan'} onClose={onClose}>
      <label className="form-label">What is this?</label>
      <div className="type-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button className={`type-btn${kind === 'schedule' ? ' active' : ''}`} onClick={() => setKind('schedule')} disabled={isEditing}>
          📅 Schedule
        </button>
        <button className={`type-btn${kind === 'habit' ? ' active' : ''}`} onClick={() => setKind('habit')} disabled={isEditing}>
          🔁 Habit
        </button>
        <button className={`type-btn${kind === 'routine' ? ' active' : ''}`} onClick={() => setKind('routine')} disabled={isEditing}>
          🧩 Routine
        </button>
      </div>
      {isEditing && <div className="form-hint" style={{ marginTop: 6 }}>Plan type can't change after creation — make a new plan instead.</div>}

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
            Items per day
          </label>
          {(frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : days).length === 0 && (
            <div className="form-hint">Pick at least one day above first.</div>
          )}
          {(frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : days).map((d) => (
            <div key={d} className="day-items-block">
              <div className="day-items-label">{DAY_LABELS[d]}</div>
              {(perDayItems[d] ?? []).map((item, i) => (
                <div className="add-row" key={i} style={{ marginTop: 6 }}>
                  <input
                    type="time"
                    className="task-time-input"
                    style={{ marginLeft: 0 }}
                    value={item.time}
                    onChange={(e) => updateDayItem(d, i, { time: e.target.value })}
                  />
                  <input
                    value={item.label}
                    placeholder="e.g. Lecture: Semantics"
                    onChange={(e) => updateDayItem(d, i, { label: e.target.value })}
                  />
                  <button className="del-btn" onClick={() => removeDayItem(d, i)}>
                    ✕
                  </button>
                </div>
              ))}
              <button className="card-link" style={{ marginTop: 4 }} onClick={() => addDayItem(d)}>
                + add item to {DAY_LABELS[d]}
              </button>
            </div>
          ))}
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
        {isEditing ? 'Save changes' : 'Create plan'}
      </button>
    </Modal>
  )
}