import { useEffect, useRef, useState } from 'react'
import { FiPlay, FiX } from 'react-icons/fi'
import { notify } from '../notifications'
import { extendTimer, listenForTimerActions, markEnded, startTimer, stopTimer, useFocusTimer } from '../timer'
import type { Task } from '../types'

interface Props {
  tasks: Task[]
  onToggleTask: (id: string) => void
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[0, 0.25, 0.5].forEach((at) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      g.gain.value = 0.15
      o.connect(g)
      g.connect(ctx.destination)
      o.start(ctx.currentTime + at)
      o.stop(ctx.currentTime + at + 0.15)
    })
  } catch {
    /* no sound is fine */
  }
}

const LENGTHS = [25, 45, 60, 90]
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** The floating timer, the "start focus" sheet and the "time is up" card. Lives above every page. */
export default function FocusTimer({ tasks, onToggleTask }: Props) {
  const timer = useFocusTimer()
  const [now, setNow] = useState(Date.now())
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState<{ label: string; minutes: number; taskId?: string } | null>(null)
  const latest = useRef({ tasks, onToggleTask })
  latest.current = { tasks, onToggleTask }

  // Other parts of the app start a timer with an event.
  useEffect(() => {
    const onStart = (e: Event) => {
      const d = (e as CustomEvent<{ label?: string; minutes?: number; taskId?: string; ask?: boolean }>).detail ?? {}
      if (d.ask || !d.minutes) setSheet({ label: d.label ?? '', minutes: d.minutes ?? 45, taskId: d.taskId })
      else startTimer({ label: d.label ?? 'Focus', minutes: d.minutes, taskId: d.taskId })
    }
    window.addEventListener('joelhq:start-timer', onStart)
    return () => window.removeEventListener('joelhq:start-timer', onStart)
  }, [])

  useEffect(() => {
    void listenForTimerActions((a) => {
      if (a === 'more') extendTimer(30)
      else if (a === 'done') finish()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [timer])

  useEffect(() => {
    if (timer && !timer.ended && now >= timer.endsAt) {
      markEnded()
      beep()
      notify('Time is up', `${timer.label}. Did you finish?`)
    }
  }, [timer, now])

  function finish() {
    const t = latest.current
    const cur = JSON.parse(localStorage.getItem('joelhq-timer') ?? 'null') as { taskId?: string } | null
    const task = cur?.taskId ? t.tasks.find((x) => x.id === cur.taskId) : undefined
    if (task && !task.done) t.onToggleTask(task.id)
    stopTimer()
    setOpen(false)
  }

  const open_tasks = tasks.filter((t) => !t.done && !t.skipped).slice(0, 5)

  return (
    <>
      {timer && !timer.ended && (
        <div className="ft-pill-wrap">
          <button className="ft-pill" onClick={() => setOpen((o) => !o)} aria-label="Focus timer">
            <span className="ft-dot" />
            <span className="ft-label">{timer.label}</span>
            <span className="ft-time">{mmss(timer.endsAt - now)}</span>
          </button>
          {open && (
            <div className="ft-menu">
              <button onClick={() => extendTimer(10)}>+10 min</button>
              <button onClick={finish}>Done</button>
              <button className="danger" onClick={() => { stopTimer(); setOpen(false) }}>Stop</button>
            </div>
          )}
        </div>
      )}

      {timer?.ended && (
        <div className="ft-end" role="alertdialog" aria-label="Time is up">
          <div className="ft-end-card">
            <div className="ft-end-title">Time is up</div>
            <div className="ft-end-sub">{timer.label}. Did you finish?</div>
            <div className="ft-end-btns">
              <button className="primary" onClick={finish}>Done</button>
              <button onClick={() => extendTimer(30)}>30 min more</button>
              <button onClick={() => { stopTimer() }}>Stop</button>
            </div>
          </div>
        </div>
      )}

      {sheet && (
        <div className="ft-end" role="dialog" aria-label="Start focus">
          <div className="ft-end-card">
            <div className="ft-sheet-head">
              <div className="ft-end-title">Start focus</div>
              <button className="ft-x" onClick={() => setSheet(null)} aria-label="Close"><FiX size={20} /></button>
            </div>
            {open_tasks.length > 0 && (
              <div className="ft-chips">
                {open_tasks.map((t) => (
                  <button key={t.id} className={`ft-chip${sheet.taskId === t.id ? ' on' : ''}`} onClick={() => setSheet({ ...sheet, label: t.t, taskId: t.id })}>
                    {t.t}
                  </button>
                ))}
              </div>
            )}
            <input className="ft-input" placeholder="Or type what you are working on" value={sheet.taskId ? '' : sheet.label} onChange={(e) => setSheet({ ...sheet, label: e.target.value, taskId: undefined })} />
            <div className="ft-chips">
              {LENGTHS.map((m) => (
                <button key={m} className={`ft-chip${sheet.minutes === m ? ' on' : ''}`} onClick={() => setSheet({ ...sheet, minutes: m })}>
                  {m} min
                </button>
              ))}
            </div>
            <button
              className="ft-start"
              onClick={() => {
                startTimer({ label: sheet.label || 'Focus', minutes: sheet.minutes, taskId: sheet.taskId })
                setSheet(null)
              }}
            >
              <FiPlay /> Start
            </button>
          </div>
        </div>
      )}
    </>
  )
}
