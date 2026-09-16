import { useEffect, useRef, useState } from 'react'
import { notify } from '../notifications'

export default function Pomodoro() {
  const [focusMin, setFocusMin] = useState(25)
  const [breakMin, setBreakMin] = useState(5)
  const [seconds, setSeconds] = useState(25 * 60)
  const [mode, setMode] = useState<'FOCUS' | 'BREAK'>('FOCUS')
  const [running, setRunning] = useState(false)
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) return
    interval.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setMode((m) => {
            const next = m === 'FOCUS' ? 'BREAK' : 'FOCUS'
            setSeconds((next === 'FOCUS' ? focusMin : breakMin) * 60)
            notify(
              next === 'BREAK' ? 'Focus session done 🎯' : "Break's over — back to it 💻",
              next === 'BREAK'
                ? `Time for a ${breakMin} minute break.`
                : `Starting a new ${focusMin} minute focus block.`,
            )
            return next
          })
          return s
        }
        return s - 1
      })
    }, 1000)
    return () => {
      if (interval.current) clearInterval(interval.current)
    }
  }, [running, focusMin, breakMin])

  function reset() {
    setRunning(false)
    setMode('FOCUS')
    setSeconds(focusMin * 60)
  }

  function updateFocusMin(v: number) {
    if (Number.isNaN(v)) return
    const val = Math.max(1, Math.min(120, v))
    setFocusMin(val)
    if (!running && mode === 'FOCUS') setSeconds(val * 60)
  }
  function updateBreakMin(v: number) {
    if (Number.isNaN(v)) return
    const val = Math.max(1, Math.min(60, v))
    setBreakMin(val)
    if (!running && mode === 'BREAK') setSeconds(val * 60)
  }

  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')

  return (
    <div className="card accent-amber span-4">
      <div className="card-head">
        <div className="card-title">
          <span>⏱️</span> Focus Timer
        </div>
      </div>
      <div className="pomo-mode">{mode}</div>
      <div className="pomo-time">
        {m}:{s}
      </div>
      <div className="pomo-controls">
        <button className="pomo-btn primary" onClick={() => setRunning((r) => !r)}>
          {running ? 'pause' : 'start'}
        </button>
        <button className="pomo-btn" onClick={reset}>
          reset
        </button>
      </div>
      <div className="pomo-settings">
        <label>
          focus{' '}
          <input
            type="number"
            min={1}
            max={120}
            value={focusMin}
            disabled={running}
            onChange={(e) => updateFocusMin(Number(e.target.value))}
          />{' '}
          min
        </label>
        <label>
          break{' '}
          <input
            type="number"
            min={1}
            max={60}
            value={breakMin}
            disabled={running}
            onChange={(e) => updateBreakMin(Number(e.target.value))}
          />{' '}
          min
        </label>
      </div>
    </div>
  )
}