import { useState } from 'react'
import { RecurringPlan } from '../types'
import PlanForm from './PlanForm'
import { confirmDelete } from '../confirm'

interface Props {
  plans: RecurringPlan[]
  onBack: () => void
  onAdd: (plan: Omit<RecurringPlan, 'id' | 'createdAt'>) => void
  onUpdate: (id: string, patch: Partial<RecurringPlan>) => void
  onRemove: (id: string) => void
}

const KIND_META: Record<RecurringPlan['kind'], { label: string; icon: string }> = {
  schedule: { label: 'Recurring Schedule', icon: '📅' },
  habit: { label: 'Recurring Habits', icon: '🔁' },
  routine: { label: 'Recurring Routines', icon: '🧩' },
}

function describeRecurrence(plan: RecurringPlan): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const freq =
    plan.recurrence.frequency === 'daily'
      ? 'Every day'
      : `Every ${plan.recurrence.daysOfWeek.map((d) => days[d]).join(', ') || '—'}`
  const end =
    plan.recurrence.endType === 'never'
      ? 'no end date'
      : plan.recurrence.endType === 'date'
        ? `until ${plan.recurrence.endDate}`
        : `for ${plan.recurrence.endCount} occurrences`
  return `${freq} · from ${plan.startDate} · ${end}`
}

export default function PlansPage({ plans, onBack, onAdd, onUpdate, onRemove }: Props) {
  const [showAdd, setShowAdd] = useState(false)

  const groups: RecurringPlan['kind'][] = ['schedule', 'habit', 'routine']

  return (
    <div className="page">
      <div className="devices-header">
        <button className="card-link" onClick={onBack}>
          ← Back to dashboard
        </button>
        <div className="devices-title">
          <span>🗓️</span> Recurring Plans
        </div>
        <button className="add-btn" onClick={() => setShowAdd(true)}>
          + New plan
        </button>
      </div>

      {plans.length === 0 && (
        <div className="np-status" style={{ marginTop: 20 }}>
          No recurring plans yet. A Schedule fills in Today automatically, a Habit tracks a weekly target, a
          Routine repeats a checklist on chosen days.
        </div>
      )}

      {groups.map((kind) => {
        const items = plans.filter((p) => p.kind === kind)
        if (items.length === 0) return null
        const meta = KIND_META[kind]
        return (
          <div key={kind} style={{ marginBottom: 24 }}>
            <div className="section-label">
              {meta.icon} {meta.label}
            </div>
            {items.map((p) => (
              <div className="plan-row" key={p.id}>
                <div className="plan-row-main">
                  <div className={`plan-row-name${p.active ? '' : ' inactive'}`}>{p.name}</div>
                  <div className="plan-row-desc">{describeRecurrence(p)}</div>
                </div>
                <button className="card-link" onClick={() => onUpdate(p.id, { active: !p.active })}>
                  {p.active ? 'pause' : 'resume'}
                </button>
                <button
                  className="del-btn"
                  style={{ opacity: 0.6 }}
                  onClick={() => confirmDelete(`"${p.name}"`) && onRemove(p.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )
      })}

      {showAdd && (
        <PlanForm
          onClose={() => setShowAdd(false)}
          onCreate={(plan) => {
            onAdd(plan)
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}