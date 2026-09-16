import { useEffect, useRef, useState, useCallback } from 'react'
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'
import { db, ensureSignedIn, isFirebaseConfigured } from '../firebase'
import { DEFAULT_STATE, DashboardState, MoneyItem, FitnessDay } from '../types'

const DOC_REF_PATH = ['joelhq', 'state'] as const
const LOCAL_KEY = 'joelhq-local-state'

function isMoneyItemArray(arr: unknown): arr is MoneyItem[] {
  return (
    Array.isArray(arr) &&
    arr.every((x) => x && typeof x.target === 'number' && typeof x.current === 'number')
  )
}
function isFitnessDayArray(arr: unknown): arr is FitnessDay[] {
  return (
    Array.isArray(arr) &&
    arr.every((x) => x && typeof x.day === 'string' && typeof x.workout === 'string')
  )
}

function normalize(raw: Partial<DashboardState> | undefined): DashboardState {
  const merged = { ...DEFAULT_STATE, ...raw }
  return {
    ...merged,
    tasks: Array.isArray(merged.tasks) ? merged.tasks : DEFAULT_STATE.tasks,
    projects: Array.isArray(merged.projects) ? merged.projects : DEFAULT_STATE.projects,
    career: Array.isArray(merged.career) ? merged.career : DEFAULT_STATE.career,
    debts: isMoneyItemArray(merged.debts) ? merged.debts : DEFAULT_STATE.debts,
    savings: isMoneyItemArray(merged.savings) ? merged.savings : DEFAULT_STATE.savings,
    fitness: isFitnessDayArray(merged.fitness) ? merged.fitness : DEFAULT_STATE.fitness,
    study: Array.isArray(merged.study) ? merged.study : DEFAULT_STATE.study,
    goals: Array.isArray(merged.goals) ? merged.goals : DEFAULT_STATE.goals,
    notes: Array.isArray(merged.notes) ? merged.notes : DEFAULT_STATE.notes,
    links: Array.isArray(merged.links) ? merged.links : DEFAULT_STATE.links,
  }
}

export function useSyncedState() {
  const [state, setState] = useState<DashboardState>(() => {
    if (!isFirebaseConfigured) {
      try {
        const raw = localStorage.getItem(LOCAL_KEY)
        if (raw) return normalize(JSON.parse(raw))
      } catch {
        /* ignore parse errors, fall back to defaults */
      }
    }
    return DEFAULT_STATE
  })
  const [ready, setReady] = useState(!isFirebaseConfigured)
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextSnapshot = useRef(false)

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return
    let unsub: (() => void) | undefined

    ensureSignedIn(async () => {
      const ref = doc(db!, ...DOC_REF_PATH)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, DEFAULT_STATE)
      }

      unsub = onSnapshot(ref, (docSnap) => {
        if (skipNextSnapshot.current) {
          skipNextSnapshot.current = false
          return
        }
        const data = docSnap.data() as Partial<DashboardState> | undefined
        setState(normalize(data))
        setReady(true)
      })
    })

    return () => unsub?.()
  }, [])

  const update = useCallback((updater: (prev: DashboardState) => DashboardState) => {
    setState((prev) => {
      const next = updater(prev)

      if (!isFirebaseConfigured || !db) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
        return next
      }

      if (writeTimer.current) clearTimeout(writeTimer.current)
      writeTimer.current = setTimeout(() => {
        skipNextSnapshot.current = true
        setDoc(doc(db!, ...DOC_REF_PATH), next).catch((err) =>
          console.error('Sync write failed', err),
        )
      }, 400)
      return next
    })
  }, [])

  return { state, update, ready, synced: isFirebaseConfigured }
}