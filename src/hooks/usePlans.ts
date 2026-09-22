import { useCallback, useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db, ensureSignedIn, isFirebaseConfigured } from '../firebase'
import { RecurringPlan } from '../types'

const COLLECTION = 'plans'

export function usePlans() {
  const [plans, setPlans] = useState<RecurringPlan[]>([])
  const [ready, setReady] = useState(!isFirebaseConfigured)

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return
    let unsub: (() => void) | undefined

    ensureSignedIn(() => {
      unsub = onSnapshot(collection(db!, COLLECTION), (snap) => {
        const list: RecurringPlan[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<RecurringPlan, 'id'>) }))
        list.sort((a, b) => a.createdAt - b.createdAt)
        setPlans(list)
        setReady(true)
      })
    })

    return () => unsub?.()
  }, [])

  const addPlan = useCallback(async (plan: Omit<RecurringPlan, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID()
    const newPlan: RecurringPlan = { ...plan, id, createdAt: Date.now() }
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLLECTION, id), newPlan)
    } else {
      setPlans((prev) => [...prev, newPlan])
    }
    return id
  }, [])

  const updatePlan = useCallback(async (id: string, patch: Partial<RecurringPlan>) => {
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLLECTION, id), patch, { merge: true })
    } else {
      setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    }
  }, [])

  const removePlan = useCallback(async (id: string) => {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLLECTION, id))
    } else {
      setPlans((prev) => prev.filter((p) => p.id !== id))
    }
  }, [])

  return { plans, ready, addPlan, updatePlan, removePlan }
}