import { useMemo, useState } from 'react'
import { FiCheck, FiSend, FiStar } from 'react-icons/fi'
import { mondayOf, type RecurringPlan, type Task } from '../types'
import { resetDayKey } from '../config'
import { habitWeekCount, isHabitDoneToday } from '../plans'
import type { Health } from '../hooks/useAssistantHealth'
import { useAssistantInbox } from '../hooks/useAssistantInbox'
import { quickAction, undoActivity } from '../assistantApi'
import HeaderScene from './HeaderScene'
import { quoteFor, sceneSeed } from '../quotes'
import CheckIn from './CheckIn'
import {
  busyBlocks,
  ceil15,
  dayBar,
  freeGaps,
  parseSpan,
  suggest,
  toHHMM,
  toMinutes,
  untilText,
  type Profile,
} from '../dayPlanner'
import './home.css'

interface Props {
  now: Date
  tasks: Task[]
  habits: RecurringPlan[]
  habitLog: Record<string, string[]>
  profile: Profile
  synced: boolean
  health: Health
  notifPerm: NotificationPermission
  onToggleTask: (id: string) => void
  onToggleHabit: (id: string) => void
  onAddTask: (task: Task) => void
  onOpenSection: (id: string) => void
  onOpenAssistant: () => void
  onEnableNotifications: () => void
  onExport: () => void
}

// The app's day runs 06:00 to 05:59, so small hours sort after the evening.
const logical = (m: number) => (m < 360 ? m + 1440 : m)
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

function greetingFor(now: Date): string {
  const h = now.getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const SKY = { morning: '#ffb86b', afternoon: '#8fb4ff', evening: '#b9afff', night: '#3b4a73' }
function skyFor(now: Date): { key: keyof typeof SKY; color: string } {
  const h = now.getHours()
  const key = h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night'
  return { key, color: SKY[key] }
}

const offKey = (day: string) => `joelhq-suggest-off:${day}`

function readOff(day: string): string[] {
  try {
    const raw = localStorage.getItem(offKey(day))
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export default function TodayHome({
  now,
  tasks,
  habits,
  habitLog,
  profile,
  synced,
  health,
  notifPerm,
  onToggleTask,
  onToggleHabit,
  onAddTask,
  onOpenSection,
  onOpenAssistant,
  onEnableNotifications,
  onExport,
}: Props) {
  const today = resetDayKey(now)
  const [dismissed, setDismissed] = useState<string[]>(() => readOff(today))
  const inbox = useAssistantInbox()
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [checkIn, setCheckIn] = useState(false)
  const [ask, setAsk] = useState('')

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowL = logical(nowMin)
  const wake = toMinutes(profile.wake)
  const bed = toMinutes(profile.bed)

  const view = useMemo(() => {
    const todays = tasks.filter((t) => !t.skipped && (!t.date || t.date <= today))
    const timed = todays
      .map((t) => ({ t, block: busyBlocks([t], profile)[0] }))
      .filter((x): x is { t: Task; block: NonNullable<typeof x.block> } => !!x.block)
      .sort((a, b) => logical(a.block.start) - logical(b.block.start))

    const blocks = timed.map((x) => x.block)
    const current = timed.find((x) => !x.t.done && logical(x.block.start) <= nowL && nowL < logical(x.block.end)) ?? null
    const next = timed.find((x) => !x.t.done && logical(x.block.start) > nowL) ?? null

    const from = Math.max(wake, ceil15(nowMin + 5))
    const gaps = nowMin < bed ? freeGaps(blocks, from, bed, 60) : []

    const todayText = todays.map((t) => norm(t.t))
    const openHabits = habits.filter(
      (h) => !isHabitDoneToday(h.id, habitLog, today) && !todayText.some((x) => x.includes(norm(h.name))),
    )
    const found = suggest(
      gaps,
      openHabits.map((h) => h.name).filter((n) => !dismissed.includes(n)),
      1,
    )[0]
    const habitFor = found ? habits.find((h) => h.name === found.label) : undefined
    const doneThisWeek = habitFor ? habitWeekCount(habitFor.id, habitLog, mondayOf(now)) : 0

    const untimedOpen = todays.filter((t) => !t.done && !parseSpan(t.time))
    const timedOpen = timed.filter((x) => !x.t.done).map((x) => x.t)
    const open = [...timedOpen, ...untimedOpen]
    const doneCount = todays.filter((t) => t.done).length

    let freeLabel = ''
    if (current) freeLabel = `Busy until ${toHHMM(current.block.end)}`
    else if (nowMin >= bed) freeLabel = 'Day is done'
    else if (next) freeLabel = `Free until ${toHHMM(Math.max(nowMin, next.block.start - 15))}`
    else freeLabel = `Free until ${toHHMM(bed)}`

    return {
      blocks,
      current,
      next,
      found,
      doneThisWeek,
      open,
      doneCount,
      freeLabel,
      bar: dayBar(blocks, found ?? null, wake, bed),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, habits, habitLog, profile, today, nowMin, dismissed])

  const hero = view.current ?? view.next
  const heroSpan = hero ? parseSpan(hero.t.time) : null
  const markerPct = Math.min(100, Math.max(0, ((nowMin - wake) / (bed - wake)) * 100))
  const doneHabits = habits.filter((h) => isHabitDoneToday(h.id, habitLog, today)).length

  const sky = skyFor(now)
  const overdue = view.blocks.length > 0 && tasks.some((t) => {
    if (t.done || t.skipped || (t.date && t.date !== today)) return false
    const b = busyBlocks([t], profile)[0]
    return !!b && logical(b.end) < nowL
  })
  const needs = inbox.needs
  let headline: string
  if (view.current) headline = `${view.current.t.t} until ${toHHMM(view.current.block.end)}.`
  else if (view.next) headline = `${view.next.t.t} is next, in ${untilText(Math.max(0, logical(view.next.block.start) - nowL))}. ${view.freeLabel}.`
  else if (view.open.length > 0) headline = `${view.open.length} thing${view.open.length === 1 ? '' : 's'} left on today's list. ${view.freeLabel}.`
  else if (view.doneCount > 0) headline = `Everything on today's list is done. Nice work.`
  else headline = `Nothing planned yet. Tell me what today looks like.`
  if (needs.length > 0) headline += ` ${needs.length} thing${needs.length === 1 ? ' needs' : 's need'} you.`

  async function answer(key: string, messageId: string, chipId: string) {
    setActionError(null)
    setBusy((b) => ({ ...b, [key]: true }))
    try {
      await quickAction(messageId, chipId)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy((b) => ({ ...b, [key]: false }))
    }
  }

  async function undo(id: string) {
    setActionError(null)
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      await undoActivity(id.split(':')[0])
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy((b) => ({ ...b, [id]: false }))
    }
  }

  function submitAsk() {
    const text = ask.trim()
    if (!text) return
    setAsk('')
    window.dispatchEvent(new CustomEvent('joelhq:open-assistant', { detail: { text } }))
  }

  function dismiss(label: string) {
    const next = [...dismissed, label]
    setDismissed(next)
    try {
      localStorage.setItem(offKey(today), JSON.stringify(next))
    } catch {
      /* fine: it just comes back after a reload */
    }
  }

  function addSuggestion() {
    const s = view.found
    if (!s) return
    onAddTask({
      id: crypto.randomUUID(),
      t: s.label,
      time: toHHMM(s.start),
      minutes: s.end - s.start,
      date: today,
      done: false,
      createdAt: Date.now(),
    })
  }

  const shown = view.open.slice(0, 5)
  const hidden = view.open.length - shown.length

  return (
    <div className="hm">
      <header className={`hm-top ${sky.key}`}>
        <HeaderScene sky={sky.key} seed={sceneSeed(today)} />
        <div className="hm-top-in">
          <div className="hm-top-row">
            <div className="hm-clock">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="hm-date">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
          <h1 className="hm-greeting">{greetingFor(now)}, Joel.</h1>
          <p className="hm-headline">{headline}</p>
          <p className="hm-quote">“{quoteFor(today)}”</p>
        </div>
      </header>

      {(health.status === 'stale' || health.status === 'error') && (
        <div className="hm-health" role="status">
          {health.status === 'stale'
            ? `The assistant has not checked in since ${health.lastTick?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) ?? 'a while ago'}. Reminders may be late.`
            : 'The assistant hit a problem a moment ago. It will try again in a few minutes.'}
        </div>
      )}

      <section className="hm-card hm-next" aria-label="Next up">
        <div className="hm-eyebrow">
          <span>{view.current ? 'Now' : 'Next'}</span>
          {hero && heroSpan && (
            <span className="hm-eyebrow-sub">
              {view.current
                ? `until ${toHHMM(view.current.block.end)}`
                : `in ${untilText(Math.max(0, logical(view.next!.block.start) - nowL))}`}
            </span>
          )}
        </div>
        {hero && heroSpan ? (
          <div className="hm-hero">
            <span className="hm-hero-time">{toHHMM(heroSpan.start)}</span>
            <span className="hm-hero-title">{hero.t.t}</span>
          </div>
        ) : (
          <div className="hm-hero">
            <span className="hm-hero-title muted">Nothing fixed for the rest of today</span>
          </div>
        )}

        <div className="hm-bar-wrap">
          <div className="hm-bar" role="img" aria-label={`Your day from ${profile.wake} to ${profile.bed}. ${view.freeLabel}.`}>
            {view.bar.map((s) => (
              <div key={`${s.start}-${s.kind}`} className={`hm-seg ${s.kind}${s.end <= nowMin ? ' past' : ''}`} style={{ flexGrow: s.end - s.start }} />
            ))}
            {nowMin >= wake && nowMin <= bed && <div className="hm-now" style={{ left: `${markerPct}%` }} />}
          </div>
          <div className="hm-bar-labels">
            <span>{profile.wake}</span>
            <span>{view.freeLabel}</span>
            <span>{profile.bed}</span>
          </div>
        </div>
      </section>

      {actionError && <div className="hm-health" role="alert">{actionError}</div>}

      {needs.length > 0 && (
        <section className="hm-block" aria-label="Needs you">
          <div className="hm-block-head">
            <h2>Needs you</h2>
          </div>
          {needs.map((n) => (
            <div key={n.key} className="hm-need">
              <div className="hm-need-q">{n.prompt}</div>
              <div className="hm-need-btns">
                {n.chips.map((c, i) => (
                  <button
                    key={c.id}
                    className={`hm-need-btn${i === 0 ? ' primary' : ''}`}
                    disabled={!!busy[`${n.key}:${c.id}`]}
                    onClick={() => void answer(`${n.key}:${c.id}`, n.messageId, c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {view.found && (
        <section className="hm-card hm-suggest" aria-label="Suggestion">
          <div className="hm-suggest-head">
            <span className="hm-suggest-icon" aria-hidden="true">
              <FiStar />
            </span>
            <div className="hm-suggest-title">
              Fit in {view.found.label} at {toHHMM(view.found.start)}?
            </div>
          </div>
          <div className="hm-suggest-body">
            {untilText(view.found.end - view.found.start)} fits
            {view.next ? ` before ${view.next.t.t}` : ' this evening'}
            {view.doneThisWeek === 0 ? ', and you have not done it yet this week.' : '.'}
          </div>
          <div className="hm-actions">
            <button className="hm-btn primary" onClick={addSuggestion}>
              Add to today
            </button>
            <button className="hm-btn ghost" onClick={() => dismiss(view.found!.label)}>
              Not now
            </button>
          </div>
        </section>
      )}

      <section className="hm-block" aria-label="Today's tasks">
        <div className="hm-block-head">
          <h2>To do today</h2>
          <button className="hm-link" onClick={() => onOpenSection('today')}>
            {view.open.length === 0 ? 'Edit list' : `${view.doneCount} done · Edit list`}
          </button>
        </div>
        {view.open.length === 0 ? (
          <div className="hm-empty">All clear. Nothing left on today's list.</div>
        ) : (
          <ul className="hm-tasks">
            {shown.map((t) => (
              <li key={t.id}>
                <button className="hm-check" onClick={() => onToggleTask(t.id)} aria-label={`Mark ${t.t} done`}>
                  <FiCheck />
                </button>
                <span className="hm-task-text">{t.t}</span>
                {parseSpan(t.time) && <span className="hm-task-time">{t.time}</span>}
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 && (
          <button className="hm-link" onClick={() => onOpenSection('today')}>
            +{hidden} more
          </button>
        )}
      </section>

      <button className="hm-checkin" onClick={() => setCheckIn(true)}>
        <FiCheck /> Check in: what did you get done?
      </button>

      {habits.length > 0 && (
        <section className="hm-block" aria-label="Habits today">
          <div className="hm-block-head">
            <h2>Habits today</h2>
            <span className="hm-count">
              {doneHabits} of {habits.length}
            </span>
          </div>
          <div className="hm-chips">
            {habits.map((h) => {
              const done = isHabitDoneToday(h.id, habitLog, today)
              return (
                <button
                  key={h.id}
                  className={`hm-chip${done ? ' done' : ''}`}
                  aria-pressed={done}
                  onClick={() => onToggleHabit(h.id)}
                >
                  {done && <FiCheck />}
                  {h.name}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {inbox.done.length > 0 && (
        <section className="hm-block" aria-label="Done for you">
          <div className="hm-block-head">
            <h2>Done for you</h2>
            <button className="hm-link" onClick={onOpenAssistant}>Open chat</button>
          </div>
          <ul className="hm-done">
            {inbox.done.map((d) => (
              <li key={d.id}>
                <span className={`hm-done-text${d.undone ? ' undone' : ''}`}>{d.text}</span>
                {d.undone ? (
                  <span className="hm-done-tag">Undone</span>
                ) : (
                  <button className="hm-undo" disabled={!!busy[d.id]} onClick={() => void undo(d.id)}>
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        className="hm-askbar"
        onSubmit={(e) => {
          e.preventDefault()
          submitAsk()
        }}
      >
        <input
          className="hm-askinput"
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          placeholder="Tell me anything…"
          aria-label="Tell the assistant anything"
          enterKeyHint="send"
        />
        <button className="hm-asksend" type="submit" disabled={!ask.trim()} aria-label="Send to the assistant">
          <FiSend size={18} />
        </button>
      </form>

      {checkIn && (
        <CheckIn
          today={today}
          tasks={tasks}
          habits={habits}
          habitLog={habitLog}
          onToggleTask={onToggleTask}
          onToggleHabit={onToggleHabit}
          onClose={() => setCheckIn(false)}
        />
      )}

      <footer className="hm-foot">
        <span>
          <span className={`hm-dot${synced ? '' : ' off'}`} />
          {synced ? 'synced' : 'local only'}
        </span>
        <button className="hm-link" onClick={onExport}>
          Export my data
        </button>
        {notifPerm !== 'granted' && (
          <button className="hm-link" onClick={onEnableNotifications}>
            Turn on alerts
          </button>
        )}
      </footer>
    </div>
  )
}
