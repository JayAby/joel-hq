import Modal from './Modal'
import { RecurringPlan } from '../types'
import { planStatus, dateKey, DEFAULT_PLAN_STATS } from '../plans'
import { confirmDelete } from '../confirm'

interface Props {
  plan: RecurringPlan
  now: Date
  onClose: () => void
  onEdit: () => void
  onTogglePause: () => void
  onEndNow: () => void
  onDelete: () => void
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_META = {
  upcoming: { label: 'Upcoming', dot: '🔵' },
  active: { label: 'Active', dot: '🟢' },
  paused: { label: 'Paused', dot: '⏸️' },
  completed: { label: 'Completed', dot: '⚪' },
}

export default function PlanDetail({ plan, now, onClose, onEdit, onTogglePause, onEndNow, onDelete }: Props) {
  const status = planStatus(plan, now)
  const meta = STATUS_META[status]
  const stats = plan.stats ?? DEFAULT_PLAN_STATS
  const isEnded = plan.recurrence.endType === 'date' && !!plan.recurrence.endDate && plan.recurrence.endDate <= dateKey(now)

  const freqLabel =
    plan.recurrence.frequency === 'daily'
      ? 'Every day'
      : `Every ${plan.recurrence.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ') || '—'}`

  const rangeLabel = `${plan.startDate} → ${
    plan.recurrence.endType === 'never'
      ? 'Ongoing'
      : plan.recurrence.endType === 'date'
        ? plan.recurrence.endDate
        : `after ${plan.recurrence.endCount} times`
  }`

  return (
    <Modal title={plan.name} onClose={onClose}>
      <div className="detail-status">
        {meta.dot} {meta.label}
      </div>
      <div className="detail-row">
        <span className="detail-label">Range</span>
        <span>{rangeLabel}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Repeats</span>
        <span>{freqLabel}</span>
      </div>

      <div className="detail-edit">
        <div className="form-label">Recurring items</div>
        {plan.kind === 'schedule' && plan.scheduleByDay && (
          <div className="plan-detail-items">
            {Object.entries(plan.scheduleByDay).map(([day, items]) => (
              <div key={day} className="day-items-block" style={{ marginTop: 8 }}>
                <div className="day-items-label">{DAY_LABELS[Number(day)]}</div>
                {items.map((item, i) => (
                  <div key={i} className="plan-detail-item">
                    {item.time} — {item.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {plan.kind === 'routine' && plan.routineChecklist && (
          <div className="plan-detail-items">
            {plan.routineChecklist.map((item, i) => (
              <div key={i} className="plan-detail-item">
                • {item}
              </div>
            ))}
          </div>
        )}
        {plan.kind === 'habit' && (
          <div className="plan-detail-item">Target: {plan.habitTargetPerWeek}× per week</div>
        )}
      </div>

      {plan.kind !== 'habit' && (
        <div className="detail-edit">
          <div className="form-label">Lifetime stats</div>
          <div className="plan-stats-row">
            <span>
              <b>{stats.generated}</b> generated
            </span>
            <span>
              <b>{stats.completed}</b> completed
            </span>
            <span>
              <b>{stats.skipped}</b> skipped
            </span>
          </div>
        </div>
      )}

      <div className="detail-actions">
        <button className="pomo-btn" onClick={onEdit}>
          Edit
        </button>
        <button className="pomo-btn" onClick={onTogglePause}>
          {plan.active ? 'Pause' : 'Resume'}
        </button>
        {!isEnded && (
          <button className="pomo-btn" onClick={onEndNow}>
            End plan
          </button>
        )}
      </div>
      <button
        className="del-btn"
        style={{ opacity: 0.6, marginTop: 14 }}
        onClick={() => confirmDelete(`"${plan.name}"`) && onDelete()}
      >
        Delete this plan
      </button>
    </Modal>
  )
}