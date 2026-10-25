import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { FiCheck, FiX } from 'react-icons/fi'
import { db } from '../firebase'
import type { RecurringPlan, Task } from '../types'
import { isHabitDoneToday } from '../plans'

interface Props {
  today: string
  tasks: Task[]
  habits: RecurringPlan[]
  habitLog: Record<string, string[]>
  onToggleTask: (id: string) => void
  onToggleHabit: (id: string) => void
  onClose: () => void
}

const LENGTHS = [30, 60, 90, 120]
const FEELS = ['Struggled', 'Solid', 'On fire']

/** "What did you get done?": tick things off, and optionally say how a study or work block went. */
export default function CheckIn({ today, tasks, habits, habitLog, onToggleTask, onToggleHabit, onClose }: Props) {
  const [minutes, setMinutes] = useState<number | null>(null)
  const [feel, setFeel] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todays = tasks.filter((t) => !t.skipped && (!t.date || t.date <= today))
  const doneCount = todays.filter((t) => t.done).length + habits.filter((h) => isHabitDoneToday(h.id, habitLog, today)).length

  async function save() {
    const hasNote = minutes !== null || feel !== null || note.trim() !== ''
    if (!hasNote) return onClose()
    if (!db) return onClose()
    setSaving(true)
    setError(null)
    try {
      await setDoc(doc(db, 'events', `checkin_${today}_${Date.now()}`), {
        kind: 'checkin-note',
        date: today,
        minutes,
        feel,
        note: note.trim().slice(0, 200),
        at: Date.now(),
      })
      onClose()
    } catch {
      setError('Could not save the note. Your ticks are saved.')
      setSaving(false)
    }
  }

  return (
    <div className="ci" role="dialog" aria-label="Check in">
      <div className="ci-head">
        <div>
          <div className="ci-eyebrow">Check in</div>
          <h2 className="ci-title">What did you get done?</h2>
        </div>
        <button className="ci-close" onClick={onClose} aria-label="Close"><FiX size={22} /></button>
      </div>

      <div className="ci-body">
        <div className="ci-count">{doneCount} done today</div>

        {todays.length > 0 && (
          <>
            <div className="ci-label">Tasks</div>
            <div className="ci-chips">
              {todays.map((t) => (
                <button key={t.id} className={`ci-chip${t.done ? ' done' : ''}`} aria-pressed={!!t.done} onClick={() => onToggleTask(t.id)}>
                  {t.done && <FiCheck />} {t.t}
                </button>
              ))}
            </div>
          </>
        )}

        {habits.length > 0 && (
          <>
            <div className="ci-label">Habits</div>
            <div className="ci-chips">
              {habits.map((h) => {
                const done = isHabitDoneToday(h.id, habitLog, today)
                return (
                  <button key={h.id} className={`ci-chip${done ? ' done' : ''}`} aria-pressed={done} onClick={() => onToggleHabit(h.id)}>
                    {done && <FiCheck />} {h.name}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {todays.length === 0 && habits.length === 0 && <div className="ci-empty">Nothing on today's list yet.</div>}

        <div className="ci-label">How did a block of work go? (optional)</div>
        <div className="ci-chips">
          {LENGTHS.map((m) => (
            <button key={m} className={`ci-chip${minutes === m ? ' on' : ''}`} aria-pressed={minutes === m} onClick={() => setMinutes(minutes === m ? null : m)}>
              {m} min
            </button>
          ))}
        </div>
        <div className="ci-chips">
          {FEELS.map((f) => (
            <button key={f} className={`ci-chip${feel === f ? ' on' : ''}`} aria-pressed={feel === f} onClick={() => setFeel(feel === f ? null : f)}>
              {f}
            </button>
          ))}
        </div>
        <input className="ci-note" placeholder="One line about it" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <div className="ci-error">{error}</div>}
      </div>

      <div className="ci-foot">
        <button className="ci-save" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Done'}
        </button>
      </div>
    </div>
  )
}
