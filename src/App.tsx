import { useEffect, useRef, useState } from 'react'
import { useSyncedState } from './hooks/useSyncedState'
import { handleSpotifyRedirect } from './spotify'
import { notificationPermission, requestNotificationPermission, notify } from './notifications'
import { mondayOf, Task } from './types'
import Editable from './components/Editable'
import ProgressBar from './components/ProgressBar'
import SubtaskChecklist from './components/SubtaskChecklist'
import MoneyProgressList from './components/MoneyProgressList'
import SavingsProgressList from './components/SavingsProgressList'
import { FitnessWeightPanel, FitnessWorkoutsPanel } from './components/FitnessWeek'
import StudyWeek from './components/StudyWeek'
import TaskList from './components/TaskList'
import NowPlaying from './components/NowPlaying'
import Pomodoro from './components/Pomodoro'
import LinksList from './components/LinksList'
import SwipeTabs from './components/SwipeTabs'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  return now
}

function greetingFor(now: Date) {
  const h = now.getHours()
  if (h < 5) return 'Still up, Joel.'
  if (h < 12) return 'Good morning, Joel.'
  if (h < 18) return 'Good afternoon, Joel.'
  return 'Good evening, Joel.'
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

function getCurrentAndNext(tasks: Task[], now: Date) {
  const timed = tasks
    .filter((t) => t.time)
    .map((t) => ({ ...t, minutes: toMinutes(t.time!) }))
    .sort((a, b) => a.minutes - b.minutes)

  const nowMin = now.getHours() * 60 + now.getMinutes()
  let current: (Task & { minutes: number }) | null = null
  let next: (Task & { minutes: number }) | null = null

  for (const t of timed) {
    if (t.minutes <= nowMin) current = t
    else {
      next = t
      break
    }
  }
  return { current, next }
}

function timezoneLabel(now: Date) {
  try {
    const part = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')
    return part?.value ?? ''
  } catch {
    return ''
  }
}

export default function App() {
  const { state, update, ready, synced } = useSyncedState()
  const now = useClock()
  const [notifPerm, setNotifPerm] = useState(notificationPermission())
  const notifiedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    handleSpotifyRedirect()
  }, [])

  async function enableNotifications() {
    const perm = await requestNotificationPermission()
    setNotifPerm(perm)
  }

  useEffect(() => {
    notifiedRef.current = new Set()
  }, [state.lastReset])

  useEffect(() => {
    if (notifPerm !== 'granted') return
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    state.tasks.forEach((t, i) => {
      if (!t.time || t.done) return
      if (t.time === current && !notifiedRef.current.has(i)) {
        notifiedRef.current.add(i)
        notify(`⏰ ${t.t}`, `Scheduled for ${t.time}`)
      }
    })
  }, [now, state.tasks, notifPerm])

  useEffect(() => {
    const today = now.toDateString()
    if (ready && state.lastReset !== today) {
      update((prev) => ({
        ...prev,
        lastReset: today,
        tasks: prev.tasks.map((t) => ({ ...t, done: false })),
      }))
    }
  }, [ready, now, state.lastReset, update])

  useEffect(() => {
    const thisMonday = mondayOf(now)
    if (ready && state.lastWeekReset !== thisMonday) {
      update((prev) => ({
        ...prev,
        lastWeekReset: thisMonday,
        fitness: {
          ...prev.fitness,
          lastWeekWeight: prev.fitness.weight,
          days: prev.fitness.days.map((d) => ({ ...d, done: false })),
        },
        study: {
          ...prev.study,
          days: prev.study.days.map((d) => ({ ...d, done: false })),
        },
      }))
    }
  }, [ready, now, state.lastWeekReset, update])

  const focusDone = state.focus.subtasks.filter((t) => t.done).length
  const focusPct = state.focus.subtasks.length
    ? Math.round((focusDone / state.focus.subtasks.length) * 100)
    : 0
  const { current: currentTask, next: nextTask } = getCurrentAndNext(state.tasks, now)

  return (
    <div className="page">
      <div className="topbar">
        <div className="brand">
          <div className="brand-row">
            <div className="brand-mark">
              JOEL <span>HQ</span>
            </div>
            <div className="brand-sub">plan · build · grow · win</div>
          </div>
          <div className="greeting">
            {greetingFor(now).replace('Joel', '')}
            <span className="name">Joel</span>.
          </div>
          <div className="tagline">Same vision. Just a better version of you.</div>
          <div className="sync-dot">
            <span className={`dot${synced && ready ? '' : ' off'}`} />{' '}
            {synced ? (ready ? 'synced' : 'connecting…') : 'local only — Firebase not set up yet'}
          </div>
          {notifPerm !== 'granted' && (
            <button className="card-link" style={{ marginTop: 6 }} onClick={enableNotifications}>
              🔔 enable notifications
            </button>
          )}
        </div>
        <div className="clockbox">
          <div className="clock">
            {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
          </div>
          <div className="date">
            {now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            {' · '}
            {timezoneLabel(now)}
          </div>
          <Editable className="quote" value={state.quote} onChange={(v) => update((p) => ({ ...p, quote: v }))} />
        </div>
      </div>

      <div className="grid">
        <div className="card accent-mint span-6">
          <div className="card-head">
            <div className="card-title">
              <span>🎯</span> Today
            </div>
            <button
              className="card-link"
              onClick={() => update((p) => ({ ...p, tasks: p.tasks.map((t) => ({ ...t, done: false })) }))}
            >
              reset day
            </button>
          </div>
          <TaskList
            tasks={state.tasks}
            onChange={(tasks) => update((p) => ({ ...p, tasks }))}
            showTime
            allowAdd
            allowTimeInput
          />
        </div>

        <div className="card accent-amber span-6">
          <div className="card-head">
            <div className="card-title">
              <span>🔭</span> Current Focus
            </div>
          </div>
          <div className="focus-title">{currentTask ? currentTask.t : 'Nothing scheduled yet'}</div>
          <div className="focus-next">
            <b>Next up:</b> {nextTask ? nextTask.t : currentTask ? 'Nothing else scheduled today' : '—'}
          </div>
          <ProgressBar value={focusPct} barClass="amber" readOnly />
          <SubtaskChecklist
            items={state.focus.subtasks}
            onChange={(subtasks) => update((p) => ({ ...p, focus: { ...p.focus, subtasks } }))}
          />
        </div>

        <div className="card accent-mint span-4">
          <div className="card-head">
            <div className="card-title">
              <span>💻</span> Projects
            </div>
          </div>
          <TaskList tasks={state.projects} onChange={(projects) => update((p) => ({ ...p, projects }))} allowAdd />
        </div>

        <div className="card accent-violet span-4">
          <div className="card-head">
            <div className="card-title">
              <span>🎓</span> Career &amp; Education
            </div>
          </div>
          <TaskList tasks={state.career} onChange={(career) => update((p) => ({ ...p, career }))} allowAdd />
        </div>

        <div className="card accent-mint span-4">
          <div className="card-head">
            <div className="card-title">
              <span>💰</span> Finance
            </div>
          </div>
          <Editable className="balance" value={state.balance} onChange={(v) => update((p) => ({ ...p, balance: v }))} />
          <Editable
            className="balance-delta"
            value={state.balanceDelta}
            onChange={(v) => update((p) => ({ ...p, balanceDelta: v }))}
          />
          <div style={{ marginTop: 16 }}>
            <SwipeTabs
              tabs={[
                {
                  label: 'Debts',
                  content: (
                    <MoneyProgressList items={state.debts} onChange={(debts) => update((p) => ({ ...p, debts }))} />
                  ),
                },
                {
                  label: 'Savings',
                  content: (
                    <SavingsProgressList
                      items={state.savings}
                      onChange={(savings) => update((p) => ({ ...p, savings }))}
                      barClass="violet"
                    />
                  ),
                },
              ]}
            />
          </div>
        </div>

        <div className="card accent-rose span-6">
          <div className="card-head">
            <div className="card-title">
              <span>🏋🏾</span> Fitness Check-in
            </div>
          </div>
          <SwipeTabs
            tabs={[
              {
                label: 'Weight',
                content: (
                  <FitnessWeightPanel fitness={state.fitness} onChange={(fitness) => update((p) => ({ ...p, fitness }))} />
                ),
              },
              {
                label: 'Workouts',
                content: (
                  <FitnessWorkoutsPanel
                    fitness={state.fitness}
                    onChange={(fitness) => update((p) => ({ ...p, fitness }))}
                  />
                ),
              },
            ]}
          />
        </div>

        <div className="card accent-amber span-6">
          <div className="card-head">
            <div className="card-title">
              <span>📚</span> Study Tracker
            </div>
          </div>
          <StudyWeek study={state.study} onChange={(study) => update((p) => ({ ...p, study }))} />
        </div>

        <div className="card accent-mint span-6">
          <div className="card-head">
            <div className="card-title">
              <span>🎯</span> Goals
            </div>
          </div>
          <TaskList tasks={state.goals} onChange={(goals) => update((p) => ({ ...p, goals }))} allowAdd />
        </div>

        <div className="card accent-violet span-6">
          <div className="card-head">
            <div className="card-title">
              <span>📝</span> Quick Notes
            </div>
            <button className="card-link" onClick={() => update((p) => ({ ...p, notes: [...p.notes, 'New note...'] }))}>
              + new
            </button>
          </div>
          {state.notes.map((n, i) => (
            <div className="note-row" key={i}>
              <div className="note-dot">•</div>
              <Editable
                className="note-text"
                value={n}
                onChange={(v) => {
                  const next = state.notes.slice()
                  next[i] = v
                  update((p) => ({ ...p, notes: next }))
                }}
              />
              <button
                className="del-btn"
                style={{ opacity: 0.5 }}
                onClick={() => update((p) => ({ ...p, notes: p.notes.filter((_, idx) => idx !== i) }))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <NowPlaying />
        <Pomodoro />

        <div className="card accent-violet span-4">
          <div className="card-head">
            <div className="card-title">
              <span>🔗</span> Links
            </div>
          </div>
          <LinksList links={state.links} onChange={(links) => update((p) => ({ ...p, links }))} />
        </div>
      </div>

      <div className="footer">
        <span>better routines →</span>
        <span>better habits →</span>
        <span>bigger dreams</span>
      </div>
    </div>
  )
}