import { useEffect, useRef, useState } from 'react'
import { useSyncedState } from './hooks/useSyncedState'
import { handleSpotifyRedirect } from './spotify'
import { notificationPermission, requestNotificationPermission, notify } from './notifications'
import { mondayOf, Task, UNSCHEDULED_KEY } from './types'
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
import DevicesWidget from './components/DevicesWidget'
import DevicesPage from './components/DevicesPage'
import FocusLog from './components/FocusLog'
import { useDevices } from './hooks/useDevices'
import { useMyDevice } from './hooks/useMyDevice'
import { useHistory } from './hooks/useHistory'
import StreaksWidget from './components/StreaksWidget'
import { HistoryEntry } from './types'

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

// Figures out which of today's scheduled tasks is "now" and which is next,
// so Current Focus can update itself automatically through the day.
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
  const { devices, addDevice, updateDevice, removeDevice } = useDevices()
  const { myDeviceId, bind, unbind } = useMyDevice(devices, updateDevice)
  const { entries: historyEntries, recordDay } = useHistory()
  const [view, setView] = useState<'dashboard' | 'devices'>('dashboard')
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null)
  const now = useClock()
  const [notifPerm, setNotifPerm] = useState(notificationPermission())
  const notifiedRef = useRef<Set<string>>(new Set())

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
    state.tasks.forEach((t) => {
      if (!t.time || t.done) return
      if (t.time === current && !notifiedRef.current.has(t.id)) {
        notifiedRef.current.add(t.id)
        notify(`⏰ ${t.t}`, `Scheduled for ${t.time}`)
      }
    })
  }, [now, state.tasks, notifPerm])

  // Daily reset: today's tasks, and a completely clean slate for Focus's
  // per-task checklists. Before wiping anything, snapshot the day that's
  // ending into history so streaks/trends have something to work with.
  useEffect(() => {
    const today = now.toDateString()
    if (ready && state.lastReset !== today) {
      const endingDate = new Date(state.lastReset)
      const dateKey = endingDate.toISOString().slice(0, 10)
      const weekdayAbbrev = endingDate.toLocaleDateString('en-GB', { weekday: 'short' })
      const fitnessDay = state.fitness.days.find((d) => d.day === weekdayAbbrev)
      const studyDay = state.study.days.find((d) => d.day === weekdayAbbrev)

      const entry: HistoryEntry = {
        date: dateKey,
        tasksCompleted: state.tasks.filter((t) => t.done).length,
        tasksTotal: state.tasks.length,
        workoutDone: fitnessDay?.done ?? false,
        studyDone: studyDay?.done ?? false,
      }
      if (state.fitness.weight) entry.weight = state.fitness.weight
      recordDay(entry)

      update((prev) => ({
        ...prev,
        lastReset: today,
        tasks: prev.tasks.map((t) => ({ ...t, done: false })),
        focusSubtasksByTask: {},
      }))
    }
  }, [ready, now, state.lastReset, state.tasks, state.fitness, state.study, update, recordDay])

  // Weekly reset: fitness + study check-ins clear, weight gets snapshotted for the delta comparison.
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

  const { current: currentTask, next: nextTask } = getCurrentAndNext(state.tasks, now)
  const focusKey = currentTask?.id ?? UNSCHEDULED_KEY
  const focusSubtasks = state.focusSubtasksByTask[focusKey] ?? []
  const focusDone = focusSubtasks.filter((t) => t.done).length
  const focusPct = focusSubtasks.length ? Math.round((focusDone / focusSubtasks.length) * 100) : 0

  if (view === 'devices') {
    return (
      <DevicesPage
        devices={devices}
        now={now.getTime()}
        myDeviceId={myDeviceId}
        initialOpenId={openDeviceId}
        onBack={() => setView('dashboard')}
        onAddDevice={addDevice}
        onUpdateDevice={updateDevice}
        onRemoveDevice={removeDevice}
        onBind={bind}
        onUnbind={unbind}
      />
    )
  }

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
        {/* TODAY / SCHEDULE */}
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

        {/* CURRENT FOCUS: auto-derived from today's schedule + time; subtasks scoped per task */}
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
            key={focusKey}
            items={focusSubtasks}
            onChange={(subtasks) =>
              update((p) => ({
                ...p,
                focusSubtasksByTask: { ...p.focusSubtasksByTask, [focusKey]: subtasks },
              }))
            }
          />
        </div>

        {/* FOCUS LOG: every scheduled task today, each with its own checklist you can revisit */}
        <div className="card accent-amber span-12">
          <div className="card-head">
            <div className="card-title">
              <span>🗂️</span> Today's Focus Log
            </div>
          </div>
          <FocusLog
            tasks={state.tasks}
            subtasksByTask={state.focusSubtasksByTask}
            currentTaskId={currentTask?.id ?? null}
            onChangeSubtasks={(taskId, subtasks) =>
              update((p) => ({
                ...p,
                focusSubtasksByTask: { ...p.focusSubtasksByTask, [taskId]: subtasks },
              }))
            }
          />
        </div>

        {/* PROJECTS: simple checkbox list */}
        <div className="card accent-mint span-4">
          <div className="card-head">
            <div className="card-title">
              <span>💻</span> Projects
            </div>
          </div>
          <TaskList tasks={state.projects} onChange={(projects) => update((p) => ({ ...p, projects }))} allowAdd />
        </div>

        {/* CAREER: simple checkbox list */}
        <div className="card accent-violet span-4">
          <div className="card-head">
            <div className="card-title">
              <span>🎓</span> Career &amp; Education
            </div>
          </div>
          <TaskList tasks={state.career} onChange={(career) => update((p) => ({ ...p, career }))} allowAdd />
        </div>

        {/* FINANCE: swipeable Debts / Savings tabs */}
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

        {/* FITNESS: swipeable Weight / Workouts tabs */}
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

        {/* STUDY TRACKER */}
        <div className="card accent-amber span-6">
          <div className="card-head">
            <div className="card-title">
              <span>📚</span> Study Tracker
            </div>
          </div>
          <StudyWeek study={state.study} onChange={(study) => update((p) => ({ ...p, study }))} />
        </div>

        {/* GOALS: simple checkbox list */}
        <div className="card accent-mint span-6">
          <div className="card-head">
            <div className="card-title">
              <span>🎯</span> Goals
            </div>
          </div>
          <TaskList tasks={state.goals} onChange={(goals) => update((p) => ({ ...p, goals }))} allowAdd />
        </div>

        {/* QUICK NOTES */}
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
        <StreaksWidget entries={historyEntries} />

        {/* LINKS */}
        <div className="card accent-violet span-4">
          <div className="card-head">
            <div className="card-title">
              <span>🔗</span> Links
            </div>
          </div>
          <LinksList links={state.links} onChange={(links) => update((p) => ({ ...p, links }))} />
        </div>

        <DevicesWidget
          devices={devices}
          now={now.getTime()}
          onOpenDevice={(id) => {
            setOpenDeviceId(id)
            setView('devices')
          }}
          onViewAll={() => {
            setOpenDeviceId(null)
            setView('devices')
          }}
        />
      </div>

      <div className="footer">
        <span>better routines →</span>
        <span>better habits →</span>
        <span>bigger dreams</span>
      </div>
    </div>
  )
}