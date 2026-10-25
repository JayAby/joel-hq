import { useEffect, useRef, useState } from 'react'
import { useSyncedState } from './hooks/useSyncedState'
import { handleSpotifyRedirect } from './spotify'
import { notificationPermission, requestNotificationPermission, notify } from './notifications'
import { enablePush, pushAvailable, startPush } from './push'
import { useAssistantHealth } from './hooks/useAssistantHealth'
import { mondayOf, Task, UNSCHEDULED_KEY, HistoryEntry } from './types'
import { resetDayKey, parseLocalDateKey } from './config'
import { confirmDelete } from './confirm'
import { exportData } from './exportData'
import { generatePlanTasksForDate, activeHabits, habitWeekCount } from './plans'
import Editable from './components/Editable'
import ProgressBar from './components/ProgressBar'
import SubtaskChecklist from './components/SubtaskChecklist'
import MoneyProgressList from './components/MoneyProgressList'
import SavingsProgressList from './components/SavingsProgressList'
import { FitnessWeightPanel } from './components/FitnessWeek'
import TaskList from './components/TaskList'
import NowPlaying from './components/NowPlaying'
import Pomodoro from './components/Pomodoro'
import FocusTimer from './components/FocusTimer'
import LinksList from './components/LinksList'
import SwipeTabs from './components/SwipeTabs'
import DevicesPage from './components/DevicesPage'
import FocusLog from './components/FocusLog'
import HabitsWidget from './components/HabitsWidget'
import PlansPage from './components/PlansPage'
import QuickAdd, { QuickAddDestination } from './components/QuickAdd'
import ShoppingList from './components/ShoppingList'
import WeeklyTodoList from './components/WeeklyTodoList'
import Sidebar from './components/Sidebar'
import TodayHome from './components/TodayHome'
import SectionsPage from './components/SectionsPage'
import { SECTION_ITEMS, type ViewName } from './components/navItems'
import { useAssistantProfile } from './hooks/useAssistantProfile'
import { parseSpan, toMinutes as spanToMinutes } from './dayPlanner'
import { useDevices } from './hooks/useDevices'
import { useMyDevice } from './hooks/useMyDevice'
import { useHistory } from './hooks/useHistory'
import { usePlans } from './hooks/usePlans'
import { useHabitWeeks } from './hooks/useHabitWeeks'
import { useWeeklyTodoWeeks } from './hooks/useWeeklyTodoWeeks'
import StreaksWidget from './components/StreaksWidget'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  return now
}

function toMinutes(time: string): number {
  // Accepts "17:00" and ranges like "09:00–11:00" (uses the start).
  const span = parseSpan(time)
  return span ? span.start : spanToMinutes(time)
}

function getCurrentAndNext(tasks: Task[], now: Date, today: string) {
  const timed = tasks
    .filter((t) => t.time && (!t.date || t.date === today))
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
  const { weeks: habitWeeks, recordWeek } = useHabitWeeks()
  const { weeks: weeklyTodoWeeks, recordWeek: recordTodoWeek } = useWeeklyTodoWeeks()
  const [view, setView] = useState<ViewName>('dashboard')
  const [openSection, setOpenSection] = useState<string | null>(null)
  const profile = useAssistantProfile()
  const assistantHealth = useAssistantHealth()
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null)
  const [focusLogOpen, setFocusLogOpen] = useState(false)
  const now = useClock()
  const [notifPerm, setNotifPerm] = useState(notificationPermission())
  const notifiedRef = useRef<Set<string>>(new Set())
  const knownDeviceIdsRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    handleSpotifyRedirect()
  }, [])

  // Android app: if alerts were already allowed, refresh this phone's push token.
  useEffect(() => {
    if (!pushAvailable()) return
    void startPush()
      .then((status) => setNotifPerm(status === 'granted' ? 'granted' : 'default'))
      .catch(() => {})
  }, [])

  async function enableNotifications() {
    if (pushAvailable()) {
      const status = await enablePush().catch(() => 'denied' as const)
      setNotifPerm(status === 'granted' ? 'granted' : 'denied')
      return
    }
    const perm = await requestNotificationPermission()
    setNotifPerm(perm)
  }

  function navigate(next: ViewName) {
    setView(next)
    setOpenSection(null)
    window.scrollTo({ top: 0 })
  }

  function openSectionById(id: string) {
    setOpenSection(id)
    setView('sections')
    window.scrollTo({ top: 0 })
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
      if (t.time.slice(0, 5) === current && !notifiedRef.current.has(t.id)) {
        notifiedRef.current.add(t.id)
        notify(`⏰ ${t.t}`, `Scheduled for ${t.time}`)
      }
    })
  }, [now, state.tasks, notifPerm])

  useEffect(() => {
    const today = resetDayKey(now)
    if (ready && state.lastReset !== today) {
      const dateKey = state.lastReset

      const entry: HistoryEntry = {
        date: dateKey,
        tasksCompleted: state.tasks.filter((t) => t.done).length,
        tasksTotal: state.tasks.length,
      }
      if (state.fitness.weight) entry.weight = state.fitness.weight
      recordDay(entry)

      const statDeltas: Record<string, { generated: number; completed: number; skipped: number }> = {}
      for (const t of state.tasks) {
        if (!t.planId) continue
        const d = statDeltas[t.planId] ?? { generated: 0, completed: 0, skipped: 0 }
        d.generated++
        if (t.done) d.completed++
        else if (t.skipped) d.skipped++
        statDeltas[t.planId] = d
      }
      for (const [planId, delta] of Object.entries(statDeltas)) {
        const plan = plans.find((p) => p.id === planId)
        if (!plan) continue
        const prevStats = plan.stats ?? { generated: 0, completed: 0, skipped: 0 }
        updatePlan(planId, {
          stats: {
            generated: prevStats.generated + delta.generated,
            completed: prevStats.completed + delta.completed,
            skipped: prevStats.skipped + delta.skipped,
          },
        })
      }

      update((prev) => {
        const surviving: typeof prev.tasks = []
        const cleared: typeof prev.recentlyCleared = []
        for (const t of prev.tasks) {
          const isStaleManual = !t.planId && t.date && t.date < today
          if (isStaleManual) {
            cleared.push({ text: t.t, wasDone: t.done, clearedAt: Date.now() })
          } else {
            surviving.push({ ...t, done: false, skipped: false })
          }
        }
        return {
          ...prev,
          lastReset: today,
          tasks: surviving,
          focusSubtasksByTask: {},
          recentlyCleared: [...cleared, ...prev.recentlyCleared].slice(0, 50),
        }
      })
    }
  }, [ready, now, state.lastReset, state.tasks, state.fitness, update, recordDay, plans, updatePlan])

  useEffect(() => {
    const thisMonday = mondayOf(now)
    if (ready && state.lastWeekReset !== thisMonday) {
      const endingWeekStart = state.lastWeekReset
      const habitSnaps = activeHabits(plans).map((h) => ({
        id: h.id,
        name: h.name,
        count: habitWeekCount(h.id, state.habitLog, endingWeekStart),
        target: h.habitTargetPerWeek ?? 1,
      }))
      if (habitSnaps.length > 0) {
        recordWeek({ weekStart: endingWeekStart, habits: habitSnaps })
      }

      if (state.weeklyTodos.length > 0) {
        recordTodoWeek({
          weekStart: endingWeekStart,
          items: state.weeklyTodos.map((t) => ({ text: t.t, done: t.done })),
        })
      }

      update((prev) => ({
        ...prev,
        lastWeekReset: thisMonday,
        weeklyTodos: [],
        fitness: { ...prev.fitness, lastWeekWeight: prev.fitness.weight },
      }))
    }
  }, [
    ready,
    now,
    state.lastWeekReset,
    state.habitLog,
    state.weeklyTodos,
    plans,
    update,
    recordWeek,
    recordTodoWeek,
  ])

  useEffect(() => {
    if (!ready || !plansReady) return
    const referenceDate = parseLocalDateKey(state.lastReset)
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

  const { current: currentTask, next: nextTask } = getCurrentAndNext(state.tasks, now, resetDayKey(now))
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

  if (view === 'devices') {
    return (
      <div className="app-shell">
        <Sidebar view={view} onNavigateView={navigate} />
        <div className="app-main">
          <DevicesPage
            devices={devices}
            now={now.getTime()}
            myDeviceId={myDeviceId}
            initialOpenId={openDeviceId}
            onBack={() => navigate('dashboard')}
            onAddDevice={addDevice}
            onUpdateDevice={updateDevice}
            onRemoveDevice={removeDevice}
            onBind={bind}
            onUnbind={unbind}
          />
        </div>
      </div>
    )
  }

  if (view === 'plans') {
    return (
      <div className="app-shell">
        <Sidebar view={view} onNavigateView={navigate} />
        <div className="app-main">
          <PlansPage
            plans={plans}
            now={now}
            onBack={() => navigate('dashboard')}
            onAdd={addPlan}
            onUpdate={updatePlan}
            onRemove={removePlan}
          />
        </div>
      </div>
    )
  }

  function addQuickTask(destination: QuickAddDestination, task: Task) {
    if (destination === 'notes') return
    update((p) => ({ ...p, [destination]: [...p[destination], task] }))
  }

  function toggleTask(id: string) {
    update((p) => ({
      ...p,
      tasks: p.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, skipped: false } : t)),
    }))
  }

  function addHomeTask(task: Task) {
    update((p) => ({ ...p, tasks: [...p.tasks, task] }))
  }

  const todayKey = resetDayKey(now)
  const openTasks = state.tasks.filter((t) => !t.done && !t.skipped && (!t.date || t.date <= todayKey))
  const doneTasks = state.tasks.filter((t) => t.done && (!t.date || t.date <= todayKey))
  const doneHabitCount = habits.filter((h) => (state.habitLog[h.id] ?? []).includes(todayKey)).length
  const weeklyDone = state.weeklyTodos.filter((t) => t.done).length

  // One line under each row of the Sections page. Finance never shows a number.
  const summaries: Record<string, string> = {
    today: `${openTasks.length} open, ${doneTasks.length} done`,
    habits: habits.length ? `${doneHabitCount} of ${habits.length} done today` : 'No habits yet',
    fitness: state.fitness.weight ? `Weight ${state.fitness.weight}` : '',
    projects: state.projects.slice(0, 2).map((t) => t.t).join(', '),
    career: `${state.career.length} item${state.career.length === 1 ? '' : 's'}`,
    shopping: `${state.shoppingItems.filter((i) => !i.done).length} to get`,
    weekly: state.weeklyTodos.length ? `${weeklyDone} of ${state.weeklyTodos.length} done` : 'Nothing set',
    goals: `${state.goals.length} goal${state.goals.length === 1 ? '' : 's'}`,
    finance: 'Private. Never shared with the assistant.',
    notes: `${state.notes.length} note${state.notes.length === 1 ? '' : 's'}`,
    focus: currentTask ? currentTask.t : 'Nothing scheduled',
    streaks: 'Your runs of good days',
    pomodoro: 'Focus timer',
    music: 'Now playing',
    links: `${state.links.length} link${state.links.length === 1 ? '' : 's'}`,
  }

  function renderSection(id: string) {
    switch (id) {
      case 'today':
        return (
          <div className="card accent-mint span-12">
            <div className="card-head">
              <div className="card-title">
                <span className="card-icon-badge badge-mint">🎯</span> Today
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
              allowDateInput
              today={todayKey}
            />
          </div>
        )
      case 'habits':
        return (
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
            onRemoveHabit={(hid) => removePlan(hid)}
          />
        )
      case 'fitness':
        return (
          <div className="card accent-rose span-12">
            <div className="card-head">
              <div className="card-title">
                <span className="card-icon-badge badge-rose">🏋🏾</span> Fitness
              </div>
            </div>
            <FitnessWeightPanel fitness={state.fitness} onChange={(fitness) => update((p) => ({ ...p, fitness }))} />
          </div>
        )
      case 'projects':
        return (
          <div className="card accent-mint span-12">
            <div className="card-head">
              <div className="card-title">
                <span className="card-icon-badge badge-mint">💻</span> Projects
              </div>
            </div>
            <TaskList tasks={state.projects} onChange={(projects) => update((p) => ({ ...p, projects }))} allowAdd />
          </div>
        )
      case 'career':
        return (
          <div className="card accent-violet span-12">
            <div className="card-head">
              <div className="card-title">
                <span className="card-icon-badge badge-violet">🎓</span> Career &amp; Education
              </div>
            </div>
            <TaskList tasks={state.career} onChange={(career) => update((p) => ({ ...p, career }))} allowAdd />
          </div>
        )
      case 'shopping':
        return (
          <ShoppingList items={state.shoppingItems} onChange={(shoppingItems) => update((p) => ({ ...p, shoppingItems }))} />
        )
      case 'weekly':
        return (
          <WeeklyTodoList
            items={state.weeklyTodos}
            onChange={(weeklyTodos) => update((p) => ({ ...p, weeklyTodos }))}
            previousWeeks={weeklyTodoWeeks}
          />
        )
      case 'goals':
        return (
          <div className="card accent-mint span-12">
            <div className="card-head">
              <div className="card-title">
                <span className="card-icon-badge badge-mint">🎯</span> Goals
              </div>
            </div>
            <TaskList tasks={state.goals} onChange={(goals) => update((p) => ({ ...p, goals }))} allowAdd />
          </div>
        )
      case 'finance':
        return (
          <div className="card accent-mint span-12">
            <div className="card-head">
              <div className="card-title">
                <span className="card-icon-badge badge-mint">💰</span> Finance
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
        )
      case 'notes':
        return (
          <div className="card accent-violet span-12">
            <div className="card-head">
              <div className="card-title">
                <span className="card-icon-badge badge-violet">📝</span> Quick Notes
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
                    confirmDelete(`"${n}"`) && update((p) => ({ ...p, notes: p.notes.filter((_, idx) => idx !== i) }))
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )
      case 'focus':
        return (
          <>
            <div className="card accent-amber span-12">
              <div className="card-head">
                <div className="card-title">
                  <span className="card-icon-badge badge-amber">🔭</span> Current Focus
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
                  <span className="card-icon-badge badge-amber">🗂️</span> Today's Focus Log
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
                  today={todayKey}
                  onChangeSubtasks={(taskId, subtasks) =>
                    update((p) => ({
                      ...p,
                      focusSubtasksByTask: { ...p.focusSubtasksByTask, [taskId]: subtasks },
                    }))
                  }
                />
              )}
            </div>
          </>
        )
      case 'streaks':
        return (
          <StreaksWidget
            entries={historyEntries}
            habits={habits}
            habitLog={state.habitLog}
            habitWeeks={habitWeeks}
            now={now}
          />
        )
      case 'pomodoro':
        return <Pomodoro />
      case 'music':
        return <NowPlaying />
      case 'links':
        return (
          <div className="card accent-violet span-12">
            <div className="card-head">
              <div className="card-title">
                <span className="card-icon-badge badge-violet">🔗</span> Links
              </div>
            </div>
            <LinksList links={state.links} onChange={(links) => update((p) => ({ ...p, links }))} />
          </div>
        )
      default:
        return null
    }
  }

  // The assistant panel lives in the sidebar component; Home asks it to open with an event.
  function openAssistant() {
    window.dispatchEvent(new Event('joelhq:open-assistant'))
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} onNavigateView={navigate} />
      <div className="app-main">
        {view === 'sections' ? (
          <SectionsPage
            openId={openSection}
            summaries={summaries}
            onOpen={openSectionById}
            onBack={() => setOpenSection(null)}
          >
            {openSection && SECTION_ITEMS.some((s) => s.id === openSection) ? renderSection(openSection) : null}
          </SectionsPage>
        ) : (
          <TodayHome
            now={now}
            tasks={state.tasks}
            habits={habits}
            habitLog={state.habitLog}
            profile={profile}
            synced={synced && ready}
            health={assistantHealth}
            notifPerm={notifPerm}
            onToggleTask={toggleTask}
            onToggleHabit={toggleHabitToday}
            onAddTask={addHomeTask}
            onOpenSection={openSectionById}
            onOpenAssistant={openAssistant}
            onEnableNotifications={enableNotifications}
            onExport={() => exportData(state, devices, historyEntries)}
          />
        )}

        <FocusTimer tasks={state.tasks} onToggleTask={toggleTask} />

        <QuickAdd
          onAddTask={addQuickTask}
          onAddNote={(text) => update((p) => ({ ...p, notes: [...p.notes, text] }))}
        />
      </div>
    </div>
  )
}
