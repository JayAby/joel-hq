import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { FiCheck, FiSend, FiStar, FiX } from 'react-icons/fi'
import { db } from '../firebase'
import { approveProposal, askAssistant, quickAction, rejectProposal, undoActivity } from '../assistantApi'
import './assistant.css'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
  proposalId?: string
  summary?: string[]
  warnings?: string[]
  quick?: { id: string; label: string; done?: boolean; kind?: string; text?: string; minutes?: number; taskId?: string }[]
}

/** Start of today's logical day (the app resets at 06:00). The chat only shows today. */
function todayStart(): number {
  const d = new Date(Date.now() - 6 * 3600_000)
  d.setHours(0, 0, 0, 0)
  return d.getTime() + 6 * 3600_000
}

interface ProposalDoc {
  id: string
  status: 'pending' | 'approving' | 'approved' | 'rejected' | 'failed'
}

interface ActivityDoc {
  id: string
  proposalId?: string
  undone?: boolean
  error?: string
}

interface Props {
  open: boolean
  onClose: () => void
  /** Text typed on Home: sent as soon as the panel is open. */
  prefill?: { text: string; n: number } | null
  onPrefillUsed?: () => void
}

export default function AssistantPanel({ open, onClose, prefill, onPrefillUsed }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [proposals, setProposals] = useState<Record<string, ProposalDoc>>({})
  const [activities, setActivities] = useState<Record<string, ActivityDoc>>({})
  const [input, setInput] = useState('')
  const [outgoing, setOutgoing] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Live data. Starts the first time the panel opens.
  useEffect(() => {
    if (!open || !db) return
    const fail = () => setError('Could not load the conversation. Check your connection.')

    const unsubMessages = onSnapshot(
      query(collection(db, 'messages'), orderBy('at', 'desc'), limit(60)),
      (snap) => setMessages(snap.docs.map((d) => d.data() as ChatMessage).reverse()),
      fail,
    )
    const unsubProposals = onSnapshot(
      query(collection(db, 'proposals'), orderBy('createdAt', 'desc'), limit(60)),
      (snap) => {
        const next: Record<string, ProposalDoc> = {}
        snap.docs.forEach((d) => {
          const p = d.data() as ProposalDoc
          next[p.id] = p
        })
        setProposals(next)
      },
      fail,
    )
    const unsubActivity = onSnapshot(
      query(collection(db, 'activityLog'), orderBy('at', 'desc'), limit(60)),
      (snap) => {
        const next: Record<string, ActivityDoc> = {}
        snap.docs.forEach((d) => {
          const a = d.data() as ActivityDoc
          if (a.proposalId) next[a.proposalId] = a
        })
        setActivities(next)
      },
      fail,
    )
    return () => {
      unsubMessages()
      unsubProposals()
      unsubActivity()
    }
  }, [open])

  // Keep the newest message in view.
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, outgoing, sending, proposals, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Esc closes the panel.
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const sendRef = useRef<(text: string) => Promise<void>>(async () => undefined)
  useEffect(() => {
    if (!open || !prefill) return
    onPrefillUsed?.()
    void sendRef.current(prefill.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill?.n])

  if (!open) return null

  const shown = messages.filter((m) => m.at >= todayStart())

  async function send(override?: string) {
    const text = (override ?? input).trim()
    if (!text || sending) return
    setError(null)
    setSending(true)
    setOutgoing(text)
    setInput('')
    try {
      await askAssistant(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setInput(text)
    } finally {
      setOutgoing(null)
      setSending(false)
    }
  }

  sendRef.current = (t: string) => send(t)

  async function act(id: string, fn: () => Promise<unknown>) {
    setError(null)
    setBusyIds((b) => ({ ...b, [id]: true }))
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusyIds((b) => ({ ...b, [id]: false }))
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  function renderCard(m: ChatMessage) {
    const pid = m.proposalId
    if (!pid) return null
    const p = proposals[pid]
    const a = activities[pid]
    const busy = !!busyIds[pid] || (a ? !!busyIds[a.id] : false)
    const status = p?.status ?? 'pending'

    return (
      <div className="asst-card" key={`${m.id}-card`}>
        <div className="asst-card-label">{status === 'pending' ? "Here's what I'll do" : status === 'approved' ? 'Done' : 'Proposed changes'}</div>
        <ul>
          {(m.summary ?? []).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {(m.warnings ?? []).map((w, i) => (
          <div className="asst-warn" key={i}>{w}</div>
        ))}

        {status === 'pending' && (
          <div className="asst-actions">
            <button className="asst-btn primary" disabled={busy} onClick={() => act(pid, () => approveProposal(pid))}>
              {busy ? 'Working…' : 'Approve'}
            </button>
            <button className="asst-btn ghost" disabled={busy} onClick={() => act(pid, () => rejectProposal(pid))}>
              Not now
            </button>
          </div>
        )}
        {status === 'approving' && <div className="asst-status">Applying…</div>}
        {status === 'approved' && (
          <div className="asst-status ok">
            {a?.undone ? 'Undone' : 'Done'}
            {a && !a.undone && (
              <button className="asst-undo" disabled={busy} onClick={() => act(a.id, () => undoActivity(a.id))}>
                Undo
              </button>
            )}
          </div>
        )}
        {status === 'rejected' && <div className="asst-status">Dismissed. Nothing changed.</div>}
        {status === 'failed' && (
          <div className="asst-status">
            Some of this did not work{a?.error ? `: ${a.error}` : '.'}
            {a && !a.undone && (
              <button className="asst-undo" disabled={busy} onClick={() => act(a.id, () => undoActivity(a.id))}>
                Undo what was done
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="asst-panel" aria-label="Assistant">
      <div className="asst-head">
        <div className="asst-badge"><FiStar size={18} /></div>
        <div className="asst-head-text">
          <div className="asst-title">Your assistant</div>
          <div className="asst-sub">Never changes anything without asking.</div>
        </div>
        <button className="asst-close" onClick={onClose} aria-label="Close assistant"><FiX size={20} /></button>
      </div>

      <div className="asst-log" ref={logRef}>
        {shown.length === 0 && !outgoing && (
          <div className="asst-empty">
            <strong>Tell me what's happening.</strong>
            <br />
            "Gym tomorrow at 5pm", "I did skincare", or "worked on StudyPulse for 2 hours, auth is done."
          </div>
        )}

        {shown.map((m) => (
          <div key={m.id} style={{ display: 'contents' }}>
            <div className={`asst-msg ${m.role === 'user' ? 'me' : 'bot'}`}>{m.text}</div>
            {m.role === 'assistant' && m.proposalId && proposals[m.proposalId] ? renderCard(m) : null}
            {m.quick && m.quick.length > 0 && (
              <div className="asst-chips">
                {m.quick.map((q) => {
                  const key = `${m.id}:${q.id}`
                  return (
                    <button
                      key={q.id}
                      className={`asst-chip${q.done ? ' done' : ''}`}
                      disabled={!!q.done || !!busyIds[key]}
                      onClick={() => {
                        if (q.kind === 'timer') window.dispatchEvent(new CustomEvent('joelhq:start-timer', { detail: { label: q.text ?? 'Focus', minutes: q.minutes ?? 45, taskId: q.taskId } }))
                        void act(key, () => quickAction(m.id, q.id))
                      }}
                    >
                      {q.done && <FiCheck size={14} />}
                      {q.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        {outgoing && <div className="asst-msg me">{outgoing}</div>}
        {sending && <div className="asst-typing">Thinking…</div>}
        {error && <div className="asst-msg err">{error}</div>}
      </div>

      <div className="asst-hint">
        Personal-looking messages stay off the AI. Start with "share:" to allow one, or use "task: …" or "shop: …".
      </div>
      <div className="asst-form">
        <textarea
          ref={inputRef}
          className="asst-input"
          rows={1}
          placeholder="Tell me what happened…"
          aria-label="Message the assistant"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="asst-send" onClick={() => void send()} disabled={sending || !input.trim()} aria-label="Send">
          <FiSend size={18} />
        </button>
      </div>
    </aside>
  )
}
