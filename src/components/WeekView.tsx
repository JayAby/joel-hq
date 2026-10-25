import { useMemo, useState } from 'react'
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi'
import { mondayOf, type Task } from '../types'
import { busyBlocks, parseSpan, type Profile } from '../dayPlanner'

interface Props {
  now: Date
  today: string
  tasks: Task[]
  profile: Profile
  onClose: () => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number)
  return keyOf(new Date(y, m - 1, d + n))
}
export const HEAVY_MINUTES = 9 * 60

/** Hours booked on a day, from the tasks that have a time. */
export function bookedMinutes(tasks: Task[], profile: Profile): number {
  return busyBlocks(tasks.filter((t) => !t.skipped), profile).reduce((n, b) => n + (b.end - b.start), 0)
}

export function tasksOn(tasks: Task[], day: string, today: string): Task[] {
  // Old tasks with no date count as "today".
  return tasks.filter((t) => !t.skipped && (t.date ? t.date === day : day === today))
}

const label = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Seven days, Monday to Sunday, with what is booked and which days are heavy. */
export default function WeekView({ now, today, tasks, profile, onClose }: Props) {
  const [offset, setOffset] = useState(0)
  const monday = addDays(mondayOf(now), offset * 7)
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const key = addDays(monday, i)
        const list = tasksOn(tasks, key, today).sort((a, b) => (parseSpan(a.time)?.start ?? 9999) - (parseSpan(b.time)?.start ?? 9999))
        return { key, list, booked: bookedMinutes(list, profile) }
      }),
    [tasks, profile, monday, today],
  )

  return (
    <div className="ci wk" role="dialog" aria-label="This week">
      <div className="ci-head wk-head">
        <div>
          <div className="ci-eyebrow">{offset === 0 ? 'This week' : offset === 1 ? 'Next week' : `${offset > 0 ? '+' : ''}${offset} weeks`}</div>
          <h2 className="ci-title">{label(monday)} to {label(addDays(monday, 6))}</h2>
        </div>
        <button className="ci-close" onClick={onClose} aria-label="Close"><FiX size={22} /></button>
      </div>
      <div className="wk-nav">
        <button className="wk-arrow" onClick={() => setOffset(offset - 1)} aria-label="Previous week"><FiChevronLeft /></button>
        <button className="wk-today" onClick={() => setOffset(0)} disabled={offset === 0}>This week</button>
        <button className="wk-arrow" onClick={() => setOffset(offset + 1)} aria-label="Next week"><FiChevronRight /></button>
      </div>
      <div className="ci-body">
        {days.map((d) => (
          <div key={d.key} className={`wk-day${d.key === today ? ' today' : ''}`}>
            <div className="wk-day-head">
              <span className="wk-day-name">{label(d.key)}</span>
              {d.booked >= HEAVY_MINUTES ? (
                <span className="wk-tag heavy">Heavy · {Math.round(d.booked / 60)}h booked</span>
              ) : d.booked > 0 ? (
                <span className="wk-tag">{Math.round((d.booked / 60) * 10) / 10}h booked</span>
              ) : null}
            </div>
            {d.list.length === 0 ? (
              <div className="wk-empty">Nothing planned</div>
            ) : (
              <ul className="wk-list">
                {d.list.map((t) => (
                  <li key={t.id} className={`${t.done ? 'done' : ''}${/^\s*(work|shift)\b/i.test(t.t) ? ' work' : ''}`}>
                    <span className="wk-time">{t.time ?? ''}</span>
                    <span className="wk-text">{t.t}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <div className="wk-hint">Add shifts by typing: shifts: mon wed 9-3, fri 12-6</div>
      </div>
    </div>
  )
}
