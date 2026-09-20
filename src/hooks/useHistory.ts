import { useEffect, useState, useCallback } from 'react'
import { collection, doc, onSnapshot, setDoc, query, orderBy, limit } from 'firebase/firestore'
import { db, ensureSignedIn, isFirebaseConfigured } from '../firebase'
import { HistoryEntry } from '../types'

const COLLECTION = 'history'
const LOCAL_KEY = 'joelhq-local-history'
const MAX_ENTRIES = 90

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => {
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
      const q = query(collection(db!, COLLECTION), orderBy('date', 'desc'), limit(MAX_ENTRIES))
      unsub = onSnapshot(q, (snap) => {
        const list: HistoryEntry[] = []
        snap.forEach((d) => list.push(d.data() as HistoryEntry))
        setEntries(list)
      })
    })

    return () => unsub?.()
  }, [])

  const recordDay = useCallback(async (entry: HistoryEntry) => {
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLLECTION, entry.date), entry)
    } else {
      setEntries((prev) => {
        const next = [entry, ...prev.filter((e) => e.date !== entry.date)].slice(0, MAX_ENTRIES)
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
        return next
      })
    }
  }, [])

  return { entries, recordDay }
}