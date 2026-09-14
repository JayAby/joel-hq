import { useEffect, useRef, useState } from 'react'
import { useSyncedState } from './hooks/useSyncedState'
import { handleSpotifyRedirect } from './spotify'
import { notificationPermission, requestNotificationPermission, notify } from './notifications'
import Editable from './components/Editable'
import DragPct from './components/DragPct'
import ProgressList from './components/ProgressList'
import TaskList from './components/TaskList'
import NowPlaying from './components/NowPlaying'
import Pomodoro from './components/Pomodoro'

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

  // Clear "already notified" tracking whenever the day rolls over, so
  // reminders can fire again tomorrow.
  useEffect(() => {
    notifiedRef.current = new Set()
  }, [state.lastReset])

  // Ping a notification the minute a task's scheduled start time arrives.
  useEffect(() => {
    if (notifPerm !== 'granted') return
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    state.tasks.forEach((t, i) => {
      if (!t.time || t.done) return
      const start = t.time.split(/[-–]/)[0]?.trim()
      if (start === current && !notifiedRef.current.has(i)) {
        notifiedRef.current.add(i)
        notify(`⏰ ${t.t}`, `Scheduled for ${t.time}`)
      }
    })
  }, [now, state.tasks, notifPerm])

  // Reset today's tasks (and study checklist) once per new day.
  useEffect(() => {
    const today = now.toDateString()
    if (ready && state.lastReset !== today) {
      update((prev) => ({
        ...prev,
        lastReset: today,
        tasks: prev.tasks.map((t) => ({ ...t, done: false })),
        study: prev.study.map((t) => ({ ...t, done: false })),
      }))
    }
  }, [ready, now, state.lastReset, update])

  const studyDone = state.study.filter((t) => t.done).length

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
              enable notifications
            </button>
          )}
        </div>
        <div className="clockbox">
          <div className="clock">
            {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
          </div>
          <div className="date">
            {now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <Editable
            className="quote"
            value={state.quote}
            onChange={(v) => update((p) => ({ ...p, quote: v }))}
          />
        </div>
      </div>

      <div className="grid">
        {/* TODAY */}
        <div className="card accent-mint span-5">
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
          />
        </div>

        {/* CURRENT FOCUS */}
        <div className="card accent-amber span-7">
          <div className="card-head">
            <div className="card-title">
              <span>🔭</span> Current Focus
            </div>
          </div>
          <Editable
            className="focus-title"
            value={state.focus.title}
            onChange={(v) => update((p) => ({ ...p, focus: { ...p.focus, title: v } }))}
          />
          <div className="focus-next">
            <b>Next up:</b>{' '}
            <Editable
              as="span"
              className="focus-next-text"
              value={state.focus.next}
              onChange={(v) => update((p) => ({ ...p, focus: { ...p.focus, next: v } }))}
            />
          </div>
          <div className="pbar-track">
            <div className="pbar-fill amber" style={{ width: `${state.focus.pct}%` }} />
          </div>
          <div className="pbar-label">
            <span>progress</span>
            <DragPct
              value={state.focus.pct}
              onChange={(v) => update((p) => ({ ...p, focus: { ...p.focus, pct: v } }))}
            />
          </div>
        </div>

        {/* PROJECTS */}
        <div className="card accent-mint span-4">
          <div className="card-head">
            <div className="card-title">
              <span>💻</span> Projects
            </div>
            <button
              className="card-link"
              onClick={() =>
                update((p) => ({ ...p, projects: [...p.projects, { name: 'New project', sub: '', pct: 0 }] }))
              }
            >
              + add
            </button>
          </div>
          <ProgressList items={state.projects} onChange={(projects) => update((p) => ({ ...p, projects }))} />
        </div>

        {/* CAREER */}
        <div className="card accent-violet span-4">
          <div className="card-head">
            <div className="card-title">
              <span>🎓</span> Career &amp; Education
            </div>
            <button
              className="card-link"
              onClick={() =>
                update((p) => ({ ...p, career: [...p.career, { name: 'New item', sub: '', pct: 0 }] }))
              }
            >
              + add
            </button>
          </div>
          <ProgressList items={state.career} onChange={(career) => update((p) => ({ ...p, career }))} barClass="violet" />
        </div>

        {/* QUICK LAUNCH */}
        <div className="card accent-violet span-4">
          <div className="card-head">
            <div className="card-title">
              <span>⚡</span> Quick Launch
            </div>
          </div>
          <div className="launch-grid">
            <a className="launch-btn" href="vscode://file/" target="_blank" rel="noreferrer">
              <span className="launch-ico">💻</span>VS Code
            </a>
            <a className="launch-btn" href="https://github.com" target="_blank" rel="noreferrer">
              <span className="launch-ico">🐙</span>GitHub
            </a>
            <a className="launch-btn" href="#" target="_blank" rel="noreferrer">
              <span className="launch-ico">🧠</span>StudyPulse
            </a>
            <a className="launch-btn" href="https://open.spotify.com" target="_blank" rel="noreferrer">
              <span className="launch-ico">🎧</span>Spotify
            </a>
            <a className="launch-btn" href="https://notion.so" target="_blank" rel="noreferrer">
              <span className="launch-ico">📓</span>Notion
            </a>
            <a className="launch-btn" href="#" target="_blank" rel="noreferrer">
              <span className="launch-ico">🌐</span>Browser
            </a>
          </div>
        </div>

        {/* FINANCE */}
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
          <div style={{ marginTop: 14 }}>
            {state.debts.map((d, i) => (
              <div className="debt-row" key={i}>
                <div className="debt-top">
                  <Editable
                    className="debt-name"
                    value={d.name}
                    onChange={(v) => {
                      const next = state.debts.slice()
                      next[i] = { ...next[i], name: v }
                      update((p) => ({ ...p, debts: next }))
                    }}
                  />
                  <DragPct
                    className="debt-pct"
                    value={d.pct}
                    onChange={(v) => {
                      const next = state.debts.slice()
                      next[i] = { ...next[i], pct: v }
                      update((p) => ({ ...p, debts: next }))
                    }}
                  />
                </div>
                <div className="pbar-track">
                  <div className="pbar-fill" style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <button
            className="card-link"
            style={{ marginTop: 10 }}
            onClick={() => update((p) => ({ ...p, debts: [...p.debts, { name: 'New debt', pct: 0 }] }))}
          >
            + add
          </button>
        </div>

        {/* FITNESS */}
        <div className="card accent-rose span-4">
          <div className="card-head">
            <div className="card-title">
              <span>🏋🏾</span> Fitness
            </div>
          </div>
          <div className="fit-grid">
            <div className="ring-wrap">
              <Editable
                className="ring-val"
                value={state.fitness.weight}
                onChange={(v) => update((p) => ({ ...p, fitness: { ...p.fitness, weight: v } }))}
              />
              <div className="ring-label">current weight</div>
            </div>
            <div>
              <div className="fit-stat">
                <div className="fit-stat-label">Workout</div>
                <Editable
                  className="fit-stat-val"
                  value={state.fitness.workout}
                  onChange={(v) => update((p) => ({ ...p, fitness: { ...p.fitness, workout: v } }))}
                />
              </div>
              <div className="fit-stat">
                <div className="fit-stat-label">Protein</div>
                <Editable
                  className="fit-stat-val"
                  value={state.fitness.protein}
                  onChange={(v) => update((p) => ({ ...p, fitness: { ...p.fitness, protein: v } }))}
                />
              </div>
              <div className="fit-stat">
                <div className="fit-stat-label">Steps</div>
                <Editable
                  className="fit-stat-val"
                  value={state.fitness.steps}
                  onChange={(v) => update((p) => ({ ...p, fitness: { ...p.fitness, steps: v } }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* STUDY TRACKER */}
        <div className="card accent-amber span-4">
          <div className="card-head">
            <div className="card-title">
              <span>📚</span> Study Tracker
            </div>
            <div className="card-link">
              {studyDone}/{state.study.length}
            </div>
          </div>
          <TaskList tasks={state.study} onChange={(study) => update((p) => ({ ...p, study }))} />
        </div>

        {/* GOALS */}
        <div className="card accent-mint span-6">
          <div className="card-head">
            <div className="card-title">
              <span>🎯</span> Goals
            </div>
            <button
              className="card-link"
              onClick={() => update((p) => ({ ...p, goals: [...p.goals, { name: 'New goal', pct: 0 }] }))}
            >
              + add
            </button>
          </div>
          <ProgressList items={state.goals} onChange={(goals) => update((p) => ({ ...p, goals }))} showSub={false} />
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

        {/* QUICK LINKS */}
        <div className="card accent-violet span-4">
          <div className="card-head">
            <div className="card-title">
              <span>🔗</span> Quick Links
            </div>
          </div>
          {state.links.map((l, i) => (
            <a className="link-row" href={l.url} target="_blank" rel="noreferrer" key={i}>
              <div className="link-name">{l.name}</div>
              <div>›</div>
            </a>
          ))}
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