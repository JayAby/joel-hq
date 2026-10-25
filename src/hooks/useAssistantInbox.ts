import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'

export interface InboxChip {
  id: string
  label: string
  done?: boolean
  group?: string
  prompt?: string
}
interface MessageDoc {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
  quick?: InboxChip[]
}
interface ActivityDoc {
  id: string
  at: number
  applied?: string[]
  undone?: boolean
}

/** A question the assistant is waiting on, with its answer buttons. */
export interface NeedCard {
  key: string
  messageId: string
  prompt: string
  chips: InboxChip[]
}
/** Something the assistant already did for you today. */
export interface DoneItem {
  id: string
  text: string
  undone: boolean
}

/** Start of today's logical day (the app resets at 06:00). */
function dayStart(): number {
  const d = new Date(Date.now() - 6 * 3600_000)
  d.setHours(0, 0, 0, 0)
  return d.getTime() + 6 * 3600_000
}

export function buildNeeds(messages: MessageDoc[], since: number): NeedCard[] {
  const cards: NeedCard[] = []
  for (const m of [...messages].sort((a, b) => b.at - a.at)) {
    if (m.role !== 'assistant' || m.at < since || !m.quick?.length) continue
    const groups = new Map<string, InboxChip[]>()
    for (const q of m.quick) {
      // Buttons with neither a group nor a question are the old "suggestion" chips: Home makes its own.
      if (!q.group && !q.prompt) continue
      const k = q.group ?? q.id
      groups.set(k, [...(groups.get(k) ?? []), q])
    }
    for (const [k, chips] of groups) {
      if (chips.some((c) => c.done)) continue
      const prompt = chips.find((c) => c.prompt)?.prompt ?? m.text.split('\n')[0].slice(0, 140)
      cards.push({ key: `${m.id}:${k}`, messageId: m.id, prompt, chips })
    }
  }
  return cards.slice(0, 4)
}

export function buildDone(activity: ActivityDoc[], since: number): DoneItem[] {
  const out: DoneItem[] = []
  for (const a of [...activity].sort((x, y) => y.at - x.at)) {
    if (a.at < since || !a.applied?.length) continue
    for (const [i, line] of a.applied.entries()) out.push({ id: i === 0 ? a.id : `${a.id}:${i}`, text: line, undone: !!a.undone })
  }
  return out.slice(0, 5)
}

/** What the assistant is waiting on and what it already handled today, live. */
export function useAssistantInbox(): { needs: NeedCard[]; done: DoneItem[]; ready: boolean } {
  const [messages, setMessages] = useState<MessageDoc[]>([])
  const [activity, setActivity] = useState<ActivityDoc[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!db) return
    const u1 = onSnapshot(
      query(collection(db, 'messages'), orderBy('at', 'desc'), limit(40)),
      (s) => {
        setMessages(s.docs.map((d) => d.data() as MessageDoc))
        setReady(true)
      },
      () => setReady(false),
    )
    const u2 = onSnapshot(
      query(collection(db, 'activityLog'), orderBy('at', 'desc'), limit(20)),
      (s) => setActivity(s.docs.map((d) => d.data() as ActivityDoc)),
      () => undefined,
    )
    return () => {
      u1()
      u2()
    }
  }, [])

  const since = dayStart()
  return { needs: buildNeeds(messages, since), done: buildDone(activity, since), ready }
}
