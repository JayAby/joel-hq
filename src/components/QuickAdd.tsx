import { useEffect, useState } from 'react'
import Modal from './Modal'
import { Task } from '../types'
import { parseTaskInput } from '../quickAdd'

export type QuickAddDestination = 'tasks' | 'projects' | 'career' | 'goals' | 'notes'

interface Props {
  onAddTask: (destination: QuickAddDestination, task: Task) => void
  onAddNote: (text: string) => void
}

const DESTINATIONS: { key: QuickAddDestination; label: string }[] = [
  { key: 'tasks', label: "Today's tasks" },
  { key: 'projects', label: 'Projects' },
  { key: 'career', label: 'Career & Education' },
  { key: 'goals', label: 'Goals' },
  { key: 'notes', label: 'Quick Notes' },
]

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

export default function QuickAdd({ onAddTask, onAddNote }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [destination, setDestination] = useState<QuickAddDestination>('tasks')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'n' && !isTypingTarget(document.activeElement) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function submit() {
    const trimmed = text.trim()
    if (!trimmed) return

    if (destination === 'notes') {
      onAddNote(trimmed)
    } else {
      const parsed = destination === 'tasks' ? parseTaskInput(trimmed) : { text: trimmed, time: undefined }
      const task: Task = { id: crypto.randomUUID(), t: parsed.text, done: false, createdAt: Date.now() }
      if (parsed.time) task.time = parsed.time
      onAddTask(destination, task)
    }
    setText('')
    setOpen(false)
  }

  return (
    <>
      <button className="quick-add-btn" onClick={() => setOpen(true)} title="Quick add (press 'n')">
        +
      </button>
      {open && (
        <Modal title="Quick Add" onClose={() => setOpen(false)}>
          <input
            className="form-input"
            value={text}
            placeholder="e.g. gym 5pm"
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <label className="form-label" style={{ marginTop: 14 }}>
            Add to
          </label>
          <div className="type-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {DESTINATIONS.map((d) => (
              <button
                key={d.key}
                className={`type-btn${destination === d.key ? ' active' : ''}`}
                onClick={() => setDestination(d.key)}
                type="button"
              >
                {d.label}
              </button>
            ))}
          </div>
          {destination === 'tasks' && (
            <div className="form-hint" style={{ marginTop: 8 }}>
              Tip: end with a time like "5pm" or "17:00" and it'll be scheduled automatically.
            </div>
          )}
          <button className="connect-btn" style={{ marginTop: 16 }} onClick={submit}>
            Add
          </button>
        </Modal>
      )}
    </>
  )
}