import { useEffect, useRef, useState, useCallback } from 'react'
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'
import { db, ensureSignedIn, isFirebaseConfigured } from '../firebase'
import { DEFAULT_STATE, DashboardState } from '../types'

const DOC_REF_PATH = ['joelhq', 'state'] as const
const LOCAL_KEY = 'joelhq-local-state'

export function useSyncedState() {
  const [state, setState] = useState<DashboardState>(() => {
    if (!isFirebaseConfigured) {
      try {
        const raw = localStorage.getItem(LOCAL_KEY)
        if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) }
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
        const data = docSnap.data() as DashboardState | undefined
        if (data) setState({ ...DEFAULT_STATE, ...data })
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