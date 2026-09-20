import { useCallback, useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db, ensureSignedIn, isFirebaseConfigured } from '../firebase'
import { DeviceDoc } from '../types'

const COLLECTION = 'devices'

export function useDevices() {
  const [devices, setDevices] = useState<DeviceDoc[]>([])
  const [ready, setReady] = useState(!isFirebaseConfigured)

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return
    let unsub: (() => void) | undefined

    ensureSignedIn(() => {
      unsub = onSnapshot(collection(db!, COLLECTION), (snap) => {
        const list: DeviceDoc[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<DeviceDoc, 'id'>) }))
        list.sort((a, b) => a.createdAt - b.createdAt)
        setDevices(list)
        setReady(true)
      })
    })

    return () => unsub?.()
  }, [])

  const addDevice = useCallback(
    async (input: { name: string; type: DeviceDoc['type']; capability: DeviceDoc['capability'] }) => {
      const id = crypto.randomUUID()
      const newDevice: DeviceDoc = {
        id,
        name: input.name,
        type: input.type,
        capability: input.capability,
        createdAt: Date.now(),
      }
      if (input.capability === 'manual') newDevice.manualStatus = 'offline'

      if (isFirebaseConfigured && db) {
        await setDoc(doc(db, COLLECTION, id), newDevice)
      } else {
        setDevices((prev) => [...prev, newDevice])
      }
      return id
    },
    [],
  )

  const updateDevice = useCallback(async (id: string, patch: Partial<DeviceDoc>) => {
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLLECTION, id), patch, { merge: true })
    } else {
      setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
    }
  }, [])

  const removeDevice = useCallback(async (id: string) => {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLLECTION, id))
    } else {
      setDevices((prev) => prev.filter((d) => d.id !== id))
    }
  }, [])

  return { devices, ready, addDevice, updateDevice, removeDevice }
}