import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import { notify } from '../notifications'

export interface AlertMessage {
  id: string
  kind?: string
  text: string
  at: number
}

interface RawMessage {
  id?: string
  role?: string
  kind?: string
  text?: string
  at?: number
}

const SEEN_KEY = 'joelhq-assistant-seen'

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

function writeSeen(at: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(at))
  } catch {
    /* private mode: the badge just resets on reload */
  }
}

export function alertTitle(m: AlertMessage): string {
  if (m.kind === 'morning') return 'Morning briefing'
  if (m.kind === 'evening') return 'Evening check-in'
  if (m.kind === 'reminder') return m.text.split('\n')[0]
  return 'Assistant'
}

export function alertBody(m: AlertMessage): string {
  if (m.kind === 'reminder') return ''
  const lines = m.text.split('\n').map((l) => l.trim()).filter(Boolean)
  const body = lines.length > 1 ? lines[1] : lines[0] ?? ''
  return body.length > 110 ? `${body.slice(0, 107)}...` : body
}

/**
 * Watches the assistant's messages.
 *  - unread: how many arrived since the chat was last open
 *  - toast: the newest message that arrived while the chat was closed (clears after a few seconds)
 *  - if HQ is open in a background tab, also shows a normal browser notification
 */
export function useAssistantAlerts(panelOpen: boolean) {
  const [unread, setUnread] = useState(0)
  const [toast, setToast] = useState<AlertMessage | null>(null)
  const openRef = useRef(panelOpen)
  const seenRef = useRef(readSeen())
  const knownRef = useRef<Set<string> | null>(null)
  const latestRef = useRef(0)

  const markSeen = useCallback(() => {
    if (latestRef.current > seenRef.current) {
      seenRef.current = latestRef.current
      writeSeen(seenRef.current)
    }
    setUnread(0)
    setToast(null)
  }, [])

  useEffect(() => {
    openRef.current = panelOpen
    if (panelOpen) markSeen()
  }, [panelOpen, markSeen])

  useEffect(() => {
    if (!db) return
    return onSnapshot(
      query(collection(db, 'messages'), orderBy('at', 'desc'), limit(30)),
      (snap) => {
        const msgs: AlertMessage[] = snap.docs
          .map((d) => d.data() as RawMessage)
          .filter((m) => m.role === 'assistant' && m.id && typeof m.at === 'number' && typeof m.text === 'string')
          .map((m) => ({ id: m.id as string, kind: m.kind, text: m.text as string, at: m.at as number }))
        latestRef.current = msgs.reduce((max, m) => Math.max(max, m.at), latestRef.current)

        const first = knownRef.current === null
        const known = knownRef.current ?? new Set<string>()
        const fresh = msgs.filter((m) => !known.has(m.id))
        msgs.forEach((m) => known.add(m.id))
        knownRef.current = known

        if (openRef.current) {
          markSeen()
          return
        }
        setUnread(msgs.filter((m) => m.at > seenRef.current).length)
        if (!first && fresh.length > 0) {
          const newest = fresh.reduce((a, b) => (b.at > a.at ? b : a))
          setToast(newest)
          if (typeof document !== 'undefined' && document.hidden) notify(alertTitle(newest), alertBody(newest) || undefined)
        }
      },
      () => {
        /* offline or signed out: no alerts */
      },
    )
  }, [markSeen])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 10000)
    return () => clearTimeout(id)
  }, [toast])

  return { unread, toast, dismissToast: () => setToast(null) }
}
