import { useState } from 'react'
import { Task } from '../types'
import Editable from './Editable'

interface Props {
  tasks: Task[]
  onChange: (tasks: Task[]) => void
  showTime?: boolean
  allowAdd?: boolean
}

export default function TaskList({ tasks, onChange, showTime = false, allowAdd = false }: Props) {
  const [draft, setDraft] = useState('')

  function toggle(i: number) {
    const next = tasks.slice()
    next[i] = { ...next[i], done: !next[i].done }
    onChange(next)
  }
  function editText(i: number, val: string) {
    const next = tasks.slice()
    next[i] = { ...next[i], t: val.trim() }
    onChange(next)
  }
  function remove(i: number) {
    onChange(tasks.filter((_, idx) => idx !== i))
  }
  function add() {
    if (!draft.trim()) return
    onChange([...tasks, { t: draft.trim(), done: false }])
    setDraft('')
  }

  return (
    <div>
      {tasks.map((task, i) => (
        <div className={`task-row${task.done ? ' done' : ''}`} key={i}>
          <button className="check" onClick={() => toggle(i)}>
            ✓
          </button>
          <Editable className="task-text" value={task.t} onChange={(v) => editText(i, v)} />
          {showTime && task.time && <div className="task-time">{task.time}</div>}
          <button className="del-btn" onClick={() => remove(i)}>
            ✕
          </button>
        </div>
      ))}
      {allowAdd && (
        <div className="add-row">
          <input
            value={draft}
            placeholder="add a task..."
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="add-btn" onClick={add}>
            add
          </button>
        </div>
      )}
    </div>
  )
}
