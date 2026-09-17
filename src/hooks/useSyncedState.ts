import { useEffect, useRef, useState, useCallback } from 'react'
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'
import { db, ensureSignedIn, isFirebaseConfigured } from '../firebase'
import {
  DEFAULT_STATE,
  DashboardState,
  Task,
  Focus,
  MilestoneItem,
  ProgressItem,
  MoneyItem,
  SavingsItem,
  FitnessState,
  StudyState,
} from '../types'

const DOC_REF_PATH = ['joelhq', 'state'] as const
const LOCAL_KEY = 'joelhq-local-state'

function isTaskArray(arr: unknown): arr is Task[] {
  return Array.isArray(arr) && arr.every((x) => x && typeof x.t === 'string' && typeof x.done === 'boolean')
}
function isFocus(x: unknown): x is Focus {
  return !!x && typeof x === 'object' && typeof (x as any).title === 'string' && Array.isArray((x as any).subtasks)
}
function isMilestoneItemArray(arr: unknown): arr is MilestoneItem[] {
  return Array.isArray(arr) && arr.every((x) => x && typeof x.name === 'string' && Array.isArray(x.subtasks))
}
function isProgressItemArray(arr: unknown): arr is ProgressItem[] {
  return Array.isArray(arr) && arr.every((x) => x && typeof x.name === 'string' && typeof x.pct === 'number')
}
function isMoneyItemArray(arr: unknown): arr is MoneyItem[] {
  return (
    Array.isArray(arr) &&
    arr.every((x) => x && typeof x.target === 'number' && typeof x.current === 'number')
  )
}
function isSavingsItemArray(arr: unknown): arr is SavingsItem[] {
  return (
    Array.isArray(arr) &&
    arr.every(
      (x) =>
        x && typeof x.target === 'number' && typeof x.saved === 'number' && typeof x.withdrawn === 'number',
    )
  )
}
function isFitnessState(x: unknown): x is FitnessState {
  return !!x && typeof x === 'object' && !Array.isArray(x) && Array.isArray((x as any).days)
}
function isStudyState(x: unknown): x is StudyState {
  return !!x && typeof x === 'object' && !Array.isArray(x) && Array.isArray((x as any).days)
}

function normalize(raw: Partial<DashboardState> | undefined): DashboardState {
  const merged = { ...DEFAULT_STATE, ...raw }
  return {
    ...merged,
    tasks: isTaskArray(merged.tasks) ? merged.tasks : DEFAULT_STATE.tasks,
    focus: isFocus(merged.focus) ? merged.focus : DEFAULT_STATE.focus,
    projects: isMilestoneItemArray(merged.projects) ? merged.projects : DEFAULT_STATE.projects,
    career: isMilestoneItemArray(merged.career) ? merged.career : DEFAULT_STATE.career,
    debts: isMoneyItemArray(merged.debts) ? merged.debts : DEFAULT_STATE.debts,
    savings: isSavingsItemArray(merged.savings) ? merged.savings : DEFAULT_STATE.savings,
    fitness: isFitnessState(merged.fitness) ? merged.fitness : DEFAULT_STATE.fitness,
    study: isStudyState(merged.study) ? merged.study : DEFAULT_STATE.study,
    goals: isProgressItemArray(merged.goals) ? merged.goals : DEFAULT_STATE.goals,
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