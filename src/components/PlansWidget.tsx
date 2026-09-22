import { RecurringPlan } from '../types'

interface Props {
  plans: RecurringPlan[]
  onViewAll: () => void
}

export default function PlansWidget({ plans, onViewAll }: Props) {
  const active = plans.filter((p) => p.active)
  const scheduleCount = active.filter((p) => p.kind === 'schedule').length
  const habitCount = active.filter((p) => p.kind === 'habit').length
  const routineCount = active.filter((p) => p.kind === 'routine').length

  return (
    <div className="card accent-violet span-4">
      <div className="card-head">
        <div className="card-title">
          <span>🗓️</span> Recurring Plans
        </div>
      </div>
      {active.length === 0 ? (
        <div className="np-status">No active plans yet.</div>
      ) : (
        <div className="plan-summary">
          <div>📅 {scheduleCount} schedule{scheduleCount === 1 ? '' : 's'}</div>
          <div>🔁 {habitCount} habit{habitCount === 1 ? '' : 's'}</div>
          <div>🧩 {routineCount} routine{routineCount === 1 ? '' : 's'}</div>
        </div>
      )}
      <button className="card-link" style={{ marginTop: 10 }} onClick={onViewAll}>
        Manage plans →
      </button>
    </div>
  )
}