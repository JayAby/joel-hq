import { useState } from 'react'
import { Task, WeeklyTodoSnapshot } from '../types'
import TaskList from './TaskList'

interface Props {
  items: Task[]
  onChange: (items: Task[]) => void
  previousWeeks: WeeklyTodoSnapshot[]
}

export default function WeeklyTodoList({ items, onChange, previousWeeks }: Props) {
  const [showPrev, setShowPrev] = useState(false)

  return (
    <div className="card accent-violet span-6">
      <div className="card-head">
        <div className="card-title">
          <span>🗓️</span> This Week
        </div>
      </div>
      <TaskList tasks={items} onChange={onChange} allowAdd />

      {previousWeeks.length > 0 && (
        <div className="prev-weeks">
          <button className="card-link" onClick={() => setShowPrev((s) => !s)}>
            {showPrev ? '▾ hide previous weeks' : `▸ previous weeks (${previousWeeks.length})`}
          </button>
          {showPrev && (
            <div className="prev-weeks-list">
              {previousWeeks.map((w) => (
                <div className="prev-week-row" key={w.weekStart}>
                  <div className="prev-week-date">Week of {w.weekStart}</div>
                  {w.items.map((it, i) => (
                    <div className="prev-week-habit" key={i}>
                      {it.done ? '✓' : '✕'} {it.text}
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