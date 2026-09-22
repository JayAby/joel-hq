import { useEffect, useRef, useState } from 'react'
import { useSyncedState } from './hooks/useSyncedState'
import { handleSpotifyRedirect } from './spotify'
import { notificationPermission, requestNotificationPermission, notify } from './notifications'
import { mondayOf, Task, UNSCHEDULED_KEY, HistoryEntry } from './types'
import { resetDayKey } from './config'
import { confirmDelete } from './confirm'
import { exportData } from './exportData'
import { generatePlanTasksForDate, activeHabits } from './plans'
import WelcomeBanner from './components/WelcomeBanner'
import Editable from './components/Editable'
import ProgressBar from './components/ProgressBar'
import SubtaskChecklist from './components/SubtaskChecklist'
import MoneyProgressList from './components/MoneyProgressList'
import SavingsProgressList from './components/SavingsProgressList'
import { FitnessWeightPanel } from './components/FitnessWeek'
import TaskList from './components/TaskList'
import NowPlaying from './components/NowPlaying'
import Pomodoro from './components/Pomodoro'
import LinksList from './components/LinksList'
import SwipeTabs from './components/SwipeTabs'
import DevicesPage from './components/DevicesPage'
import FocusLog from './components/FocusLog'
import HabitsWidget from './components/HabitsWidget'
import PlansPage from './components/PlansPage'
import QuickAdd, { QuickAddDestination } from './components/QuickAdd'
import { useDevices } from './hooks/useDevices'
import { useMyDevice } from './hooks/useMyDevice'
import { useHistory } from './hooks/useHistory'
import { usePlans } from './hooks/usePlans'
import StreaksWidget from './components/StreaksWidget'

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
  const { devices, addDevice, updateDevice, removeDevice } = useDevices()
  const { myDeviceId, bind, unbind } = useMyDevice(devices, updateDevice)
  const { entries: historyEntries, recordDay } = useHistory()
  const { plans, ready: plansReady, addPlan, updatePlan, removePlan } = usePlans()
  const [view, setView] = useState<'dashboard' | 'devices' | 'plans'>('dashboard')
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null)
  const [focusLogOpen, setFocusLogOpen] = useState(false)
  const now = useClock()
  const [notifPerm, setNotifPerm] = useState(notificationPermission())
  const notifiedRef = useRef<Set<string>>(new Set())
  const knownDeviceIdsRef = useRef<Set<string> | null>(null)

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
    const currentIds = new Set(devices.map((d) => d.id))
    if (knownDeviceIdsRef.current === null) {
      knownDeviceIdsRef.current = currentIds
      return
    }
    for (const d of devices) {
      if (!knownDeviceIdsRef.current.has(d.id)) {
        notify('🖥️ New device added', `"${d.name}" was just added to your Device Hub.`)
      }
    }
    knownDeviceIdsRef.current = currentIds
  }, [devices])

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

  useEffect(() => {
    const today = resetDayKey(now)
    if (ready && state.lastReset !== today) {
      const endingDate = new Date(state.lastReset)
      const dateKey = endingDate.toISOString().slice(0, 10)

      const entry: HistoryEntry = {
        date: dateKey,
        tasksCompleted: state.tasks.filter((t) => t.done).length,
        tasksTotal: state.tasks.length,
      }
      if (state.fitness.weight) entry.weight = state.fitness.weight
      recordDay(entry)

      update((prev) => ({
        ...prev,
        lastReset: today,
        tasks: prev.tasks.map((t) => ({ ...t, done: false, skipped: false })),
        focusSubtasksByTask: {},
      }))
    }
  }, [ready, now, state.lastReset, state.tasks, state.fitness, update, recordDay])

  useEffect(() => {
    const thisMonday = mondayOf(now)
    if (ready && state.lastWeekReset !== thisMonday) {
      update((prev) => ({
        ...prev,
        lastWeekReset: thisMonday,
        fitness: { ...prev.fitness, lastWeekWeight: prev.fitness.weight },
      }))
    }
  }, [ready, now, state.lastWeekReset, update])

  useEffect(() => {
    if (!ready || !plansReady) return
    const referenceDate = new Date(state.lastReset)
    const generated = generatePlanTasksForDate(plans, referenceDate)
    const generatedIds = new Set(generated.map((t) => t.id))

    update((prev) => {
      const manual = prev.tasks.filter((t) => !t.planId)
      const stillValid = prev.tasks.filter((t) => t.planId && generatedIds.has(t.id))
      const merged = [...manual]
      for (const g of generated) {
        const existing = stillValid.find((t) => t.id === g.id)
        merged.push(existing ?? g)
      }
      const sameLength = merged.length === prev.tasks.length
      const sameIds = sameLength && merged.every((t, i) => t.id === prev.tasks[i]?.id)
      if (sameIds) return prev
      return { ...prev, tasks: merged }
    })
  }, [plans, plansReady, ready, state.lastReset, update])

  useEffect(() => {
    if (!ready || !plansReady || state.plansSeeded) return
    if (plans.length === 0) {
      addPlan({
        name: 'Workout',
        kind: 'habit',
        startDate: resetDayKey(now),
        recurrence: { frequency: 'weekly', daysOfWeek: [], endType: 'never' },
        active: true,
        habitTargetPerWeek: 4,
      })
      addPlan({
        name: 'Study',
        kind: 'habit',
        startDate: resetDayKey(now),
        recurrence: { frequency: 'weekly', daysOfWeek: [], endType: 'never' },
        active: true,
        habitTargetPerWeek: 4,
      })
    }
    update((p) => ({ ...p, plansSeeded: true }))
  }, [ready, plansReady, state.plansSeeded, plans.length, addPlan, update, now])

  function toggleHabitToday(habitId: string) {
    const todayKey = resetDayKey(now)
    update((prev) => {
      const current = prev.habitLog[habitId] ?? []
      const has = current.includes(todayKey)
      const nextDates = has ? current.filter((d) => d !== todayKey) : [...current, todayKey]
      return { ...prev, habitLog: { ...prev.habitLog, [habitId]: nextDates } }
    })
  }

  const { current: currentTask, next: nextTask } = getCurrentAndNext(state.tasks, now)
  const focusKey = currentTask?.id ?? UNSCHEDULED_KEY
  const focusSubtasks = state.focusSubtasksByTask[focusKey] ?? []
  const focusDone = focusSubtasks.filter((t) => t.done).length
  const focusPct = focusSubtasks.length ? Math.round((focusDone / focusSubtasks.length) * 100) : 0
  const habits = activeHabits(plans)

  if (!ready) {
    return (
      <div className="page">
        <div className="loading-screen">
          <div className="brand-mark">
            JOEL <span>HQ</span>
          </div>
          <div className="np-status" style={{ marginTop: 12 }}>
            Loading your HQ…
          </div>
        </div>
      </div>
    )
  }

  const nav = (
    <div className="nav-tabs">
      <button className={`nav-tab${view === 'dashboard' ? ' active' : ''}`} onClick={() => setView('dashboard')}>
        Dashboard
      </button>
      <button className={`nav-tab${view === 'plans' ? ' active' : ''}`} onClick={() => setView('plans')}>
        🗓️ Plans
      </button>
      <button className={`nav-tab${view === 'devices' ? ' active' : ''}`} onClick={() => setView('devices')}>
        🖥️ Devices
      </button>
    </div>
  )

  if (view === 'devices') {
    return (
      <div className="page">
        {nav}
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
      </div>
    )
  }

  if (view === 'plans') {
    return (
      <div className="page">
        {nav}
        <PlansPage
          plans={plans}
          onBack={() => setView('dashboard')}
          onAdd={addPlan}
          onUpdate={updatePlan}
          onRemove={removePlan}
        />
      </div>
    )
  }

  function addQuickTask(destination: QuickAddDestination, task: Task) {
    if (destination === 'notes') return
    update((p) => ({ ...p, [destination]: [...p[destination], task] }))
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
          {nav}
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
          <button
            className="card-link"
            style={{ marginTop: 6 }}
            onClick={() => exportData(state, devices, historyEntries)}
          >
            ⬇ export my data
          </button>
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

      {!state.hasOnboarded && (
        <WelcomeBanner onDismiss={() => update((p) => ({ ...p, hasOnboarded: true }))} />
      )}

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

        <div className="card accent-amber span-12">
          <div className="card-head">
            <div className="card-title">
              <span>🗂️</span> Today's Focus Log
            </div>
            <button
              className="burger-btn"
              onClick={() => setFocusLogOpen((o) => !o)}
              aria-label={focusLogOpen ? 'Collapse focus log' : 'Expand focus log'}
            >
              {focusLogOpen ? '▾' : '☰'}
            </button>
          </div>
          {focusLogOpen && (
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
          )}
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

        <div className="card accent-rose span-4">
          <div className="card-head">
            <div className="card-title">
              <span>🏋🏾</span> Fitness
            </div>
          </div>
          <FitnessWeightPanel fitness={state.fitness} onChange={(fitness) => update((p) => ({ ...p, fitness }))} />
        </div>

        <HabitsWidget
          habits={habits}
          habitLog={state.habitLog}
          now={now}
          onToggleToday={toggleHabitToday}
          onAddHabit={(name, target) =>
            addPlan({
              name,
              kind: 'habit',
              startDate: resetDayKey(now),
              recurrence: { frequency: 'weekly', daysOfWeek: [], endType: 'never' },
              active: true,
              habitTargetPerWeek: target,
            })
          }
          onRemoveHabit={(id) => removePlan(id)}
        />

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
                onClick={() =>
                  confirmDelete(`"${n}"`) &&
                  update((p) => ({ ...p, notes: p.notes.filter((_, idx) => idx !== i) }))
                }
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <NowPlaying />
        <Pomodoro />
        <StreaksWidget entries={historyEntries} habits={habits} habitLog={state.habitLog} now={now} />

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

      <QuickAdd
        onAddTask={addQuickTask}
        onAddNote={(text) => update((p) => ({ ...p, notes: [...p.notes, text] }))}
      />
    </div>
  )
}