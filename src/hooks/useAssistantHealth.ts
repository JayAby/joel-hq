import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export type HealthStatus = 'unknown' | 'ok' | 'stale' | 'error'
export interface Health {
  status: HealthStatus
  /** When the assistant last checked in. */
  lastTick: Date | null
}

interface Beat {
  lastTickIso?: string
  lastOkIso?: string
  lastErrorIso?: string
}

/** The assistant checks in every 5 minutes. Four missed check-ins in a row count as "stale". */
export const STALE_MINUTES = 20
const ERROR_WINDOW_MINUTES = 30

export function judgeHealth(beat: Beat | null, nowMs: number): Health {
  if (!beat || !beat.lastTickIso) return { status: 'unknown', lastTick: null }
  const tick = Date.parse(beat.lastTickIso)
  if (!Number.isFinite(tick)) return { status: 'unknown', lastTick: null }
  const lastTick = new Date(tick)
  if (nowMs - tick > STALE_MINUTES * 60_000) return { status: 'stale', lastTick }
  const err = beat.lastErrorIso ? Date.parse(beat.lastErrorIso) : NaN
  const ok = beat.lastOkIso ? Date.parse(beat.lastOkIso) : NaN
  if (Number.isFinite(err) && nowMs - err < ERROR_WINDOW_MINUTES * 60_000 && (!Number.isFinite(ok) || err > ok)) {
    return { status: 'error', lastTick }
  }
  return { status: 'ok', lastTick }
}

/** Watches the assistant's heartbeat so Home can say so when reminders may not arrive. */
export function useAssistantHealth(): Health {
  const [beat, setBeat] = useState<Beat | null>(null)
  const [tickNow, setTickNow] = useState(() => Date.now())

  useEffect(() => {
    if (!db) return
    return onSnapshot(
      doc(db, 'assistant', 'heartbeat'),
      (snap) => {
        // Cached data from an offline phone says nothing about the assistant.
        setBeat(snap.exists() && !snap.metadata.fromCache ? (snap.data() as Beat) : null)
      },
      () => setBeat(null),
    )
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  return judgeHealth(beat, tickNow)
}
