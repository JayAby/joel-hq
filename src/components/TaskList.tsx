import { useState } from 'react'
import { Task } from '../types'
import Editable from './Editable'
import { parseTaskInput } from '../quickAdd'
import { confirmDelete } from '../confirm'

interface Props {
  tasks: Task[]
  onChange: (tasks: Task[]) => void
  showTime?: boolean
  allowAdd?: boolean
  allowTimeInput?: boolean
}

export default function TaskList({
  tasks,
  onChange,
  showTime = false,
  allowAdd = false,
  allowTimeInput = false,
}: Props) {
  const [draftText, setDraftText] = useState('')
  const [draftTime, setDraftTime] = useState('')

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
  function editTime(i: number, val: string) {
    const next = tasks.slice()
    next[i] = { ...next[i], time: val }
    onChange(next)
  }
  function remove(i: number) {
    if (!confirmDelete(`"${tasks[i].t}"`)) return
    onChange(tasks.filter((_, idx) => idx !== i))
  }
  function add() {
    if (!draftText.trim()) return
    let text = draftText.trim()
    let time = draftTime || undefined

    if (!time && allowTimeInput) {
      const parsed = parseTaskInput(text)
      if (parsed.time) {
        text = parsed.text
        time = parsed.time
      }
    }

    const task: Task = { id: crypto.randomUUID(), t: text, done: false }
    if (time) task.time = time
    onChange([...tasks, task])
    setDraftText('')
    setDraftTime('')
  }

  return (
    <div>
      {tasks.map((task, i) => (
        <div className={`task-row${task.done ? ' done' : ''}`} key={i}>
          <button className="check" onClick={() => toggle(i)}>
            ✓
          </button>
          <Editable className="task-text" value={task.t} onChange={(v) => editText(i, v)} />
          {showTime && (
            <input
              type="time"
              className="task-time-input"
              value={task.time ?? ''}
              onChange={(e) => editTime(i, e.target.value)}
            />
          )}
          <button className="del-btn" onClick={() => remove(i)}>
            ✕
          </button>
        </div>
      ))}
      {allowAdd && (
        <div className="add-row">
          <input
            value={draftText}
            placeholder={allowTimeInput ? "add a task... (try 'gym 5pm')" : 'add a task...'}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          {allowTimeInput && (
            <input
              type="time"
              className="add-time-input"
              value={draftTime}
              onChange={(e) => setDraftTime(e.target.value)}
            />
          )}
          <button className="add-btn" onClick={add}>
            add
          </button>
        </div>
      )}
    </div>
  )
}