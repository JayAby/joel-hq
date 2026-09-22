import { useState } from 'react'
import { RecurringPlan } from '../types'
import { planStatus, PlanLifecycleStatus, dateKey } from '../plans'
import PlanForm from './PlanForm'
import PlanDetail from './PlanDetail'

interface Props {
  plans: RecurringPlan[]
  now: Date
  onBack: () => void
  onAdd: (plan: Omit<RecurringPlan, 'id' | 'createdAt'>) => void
  onUpdate: (id: string, patch: Partial<RecurringPlan>) => void
  onRemove: (id: string) => void
}

const KIND_ICON: Record<RecurringPlan['kind'], string> = {
  schedule: '📅',
  habit: '🔁',
  routine: '🧩',
}

const STATUS_GROUPS: { key: PlanLifecycleStatus; label: string }[] = [
  { key: 'active', label: '🟢 Active' },
  { key: 'upcoming', label: '🔵 Upcoming' },
  { key: 'paused', label: '⏸️ Paused' },
  { key: 'completed', label: '⚪ Completed' },
]

function rangeLabel(plan: RecurringPlan): string {
  const end =
    plan.recurrence.endType === 'never'
      ? 'Ongoing'
      : plan.recurrence.endType === 'date'
        ? plan.recurrence.endDate
        : `after ${plan.recurrence.endCount}×`
  return `${plan.startDate} → ${end}`
}

export default function PlansPage({ plans, now, onBack, onAdd, onUpdate, onRemove }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const openPlan = plans.find((p) => p.id === openId) ?? null
  const editingPlan = plans.find((p) => p.id === editingId) ?? null

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

      {STATUS_GROUPS.map(({ key, label }) => {
        const items = plans.filter((p) => planStatus(p, now) === key)
        if (items.length === 0) return null
        return (
          <div key={key} style={{ marginBottom: 24 }}>
            <div className="section-label">{label}</div>
            {items.map((p) => (
              <div className="plan-row" key={p.id} onClick={() => setOpenId(p.id)} style={{ cursor: 'pointer' }}>
                <div className="plan-row-main">
                  <div className="plan-row-name">
                    {KIND_ICON[p.kind]} {p.name}
                  </div>
                  <div className="plan-row-desc">{rangeLabel(p)}</div>
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {showAdd && (
        <PlanForm
          onClose={() => setShowAdd(false)}
          onSubmit={(plan) => {
            onAdd(plan)
            setShowAdd(false)
          }}
        />
      )}

      {editingPlan && (
        <PlanForm
          initialPlan={editingPlan}
          onClose={() => setEditingId(null)}
          onSubmit={(plan) => {
            onUpdate(editingPlan.id, plan)
            setEditingId(null)
            setOpenId(null)
          }}
        />
      )}

      {openPlan && !editingPlan && (
        <PlanDetail
          plan={openPlan}
          now={now}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditingId(openPlan.id)}
          onTogglePause={() => onUpdate(openPlan.id, { active: !openPlan.active })}
          onEndNow={() =>
            onUpdate(openPlan.id, {
              recurrence: { ...openPlan.recurrence, endType: 'date', endDate: dateKey(now) },
            })
          }
          onDelete={() => {
            onRemove(openPlan.id)
            setOpenId(null)
          }}
        />
      )}
    </div>
  )
}