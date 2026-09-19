import { useState } from 'react'
import { Task } from '../types'
import SubtaskChecklist from './SubtaskChecklist'

interface Props {
  tasks: Task[]
  subtasksByTask: Record<string, Task[]>
  currentTaskId: string | null
  onChangeSubtasks: (taskId: string, subtasks: Task[]) => void
}

export default function FocusLog({ tasks, subtasksByTask, currentTaskId, onChangeSubtasks }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(currentTaskId)

  const timed = tasks.filter((t) => t.time).sort((a, b) => (a.time! < b.time! ? -1 : 1))

  if (timed.length === 0) {
    return <div className="np-status">Add times to your tasks in Today to build a focus log.</div>
  }

  return (
    <div className="focus-log">
      {timed.map((t) => {
        const subtasks = subtasksByTask[t.id] ?? []
        const done = subtasks.filter((s) => s.done).length
        const pct = subtasks.length ? Math.round((done / subtasks.length) * 100) : 0
        const isCurrent = t.id === currentTaskId
        const isExpanded = expandedId === t.id

        return (
          <div className={`focus-log-item${isCurrent ? ' current' : ''}`} key={t.id}>
            <div className="focus-log-head" onClick={() => setExpandedId(isExpanded ? null : t.id)}>
              <span className="focus-log-time">{t.time}</span>
              <span className="focus-log-name">{t.t}</span>
              {isCurrent && <span className="focus-log-badge">now</span>}
              <span className="focus-log-pct">{subtasks.length ? `${pct}%` : '—'}</span>
              <span className="focus-log-caret">{isExpanded ? '▾' : '▸'}</span>
            </div>
            {isExpanded && (
              <div className="focus-log-body">
                <SubtaskChecklist items={subtasks} onChange={(next) => onChangeSubtasks(t.id, next)} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}