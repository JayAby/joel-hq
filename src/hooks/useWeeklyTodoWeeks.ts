import { useEffect, useState, useCallback } from 'react'
import { collection, doc, onSnapshot, setDoc, query, orderBy, limit } from 'firebase/firestore'
import { db, ensureSignedIn, isFirebaseConfigured } from '../firebase'
import { WeeklyTodoSnapshot } from '../types'

const COLLECTION = 'weeklyTodoWeeks'
const LOCAL_KEY = 'joelhq-local-weeklytodoweeks'
const MAX_ENTRIES = 26

export function useWeeklyTodoWeeks() {
  const [weeks, setWeeks] = useState<WeeklyTodoSnapshot[]>(() => {
    if (isFirebaseConfigured) return []
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return
    let unsub: (() => void) | undefined

    ensureSignedIn(() => {
      const q = query(collection(db!, COLLECTION), orderBy('weekStart', 'desc'), limit(MAX_ENTRIES))
      unsub = onSnapshot(q, (snap) => {
        const list: WeeklyTodoSnapshot[] = []
        snap.forEach((d) => list.push(d.data() as WeeklyTodoSnapshot))
        setWeeks(list)
      })
    })

    return () => unsub?.()
  }, [])

  const recordWeek = useCallback(async (snapshot: WeeklyTodoSnapshot) => {
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLLECTION, snapshot.weekStart), snapshot)
    } else {
      setWeeks((prev) => {
        const next = [snapshot, ...prev.filter((w) => w.weekStart !== snapshot.weekStart)].slice(0, MAX_ENTRIES)
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
        return next
      })
    }
  }, [])

  return { weeks, recordWeek }
}