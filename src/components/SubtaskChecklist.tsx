import { useState } from 'react'
import { Task } from '../types'
import Editable from './Editable'

interface Props {
  items: Task[]
  onChange: (items: Task[]) => void
}

export default function SubtaskChecklist({ items, onChange }: Props) {
  const [draft, setDraft] = useState('')

  function toggle(i: number) {
    const next = items.slice()
    next[i] = { ...next[i], done: !next[i].done }
    onChange(next)
  }
  function editText(i: number, val: string) {
    const next = items.slice()
    next[i] = { ...next[i], t: val.trim() }
    onChange(next)
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function add() {
    if (!draft.trim()) return
    onChange([...items, { t: draft.trim(), done: false }])
    setDraft('')
  }

  return (
    <div className="subtasks">
      {items.map((it, i) => (
        <div className={`task-row sub${it.done ? ' done' : ''}`} key={i}>
          <button className="check" onClick={() => toggle(i)}>
            ✓
          </button>
          <Editable className="task-text" value={it.t} onChange={(v) => editText(i, v)} />
          <button className="del-btn" onClick={() => remove(i)}>
            ✕
          </button>
        </div>
      ))}
      <div className="add-row">
        <input
          value={draft}
          placeholder="add a step..."
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="add-btn" onClick={add}>
          add
        </button>
      </div>
    </div>
  )
}