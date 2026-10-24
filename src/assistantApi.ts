import { getAuth } from 'firebase/auth'

// The assistant runs on Cloudflare. The page proves who you are with your
// Firebase login, so no password or key lives in this code.
export const ASSISTANT_URL = 'https://joel-hq-assistant.jo3l.workers.dev'

export interface AskResult {
  reply: string
  proposalId?: string
  summary: string[]
  warnings: string[]
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const auth = getAuth()
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Please log in again.')
  const token = await user.getIdToken()

  let res: Response
  try {
    res = await fetch(ASSISTANT_URL + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("I can't reach the assistant. Check your connection.")
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}

export const askAssistant = (message: string) => call<AskResult>('/ask', { message })
export const approveProposal = (id: string) => call<{ activityId: string; applied: string[]; error?: string }>('/approve', { id })
export const rejectProposal = (id: string) => call<{ rejected: boolean }>('/reject', { id })
export const undoActivity = (id: string) => call<{ undone: boolean }>('/undo', { id })
export const quickAction = (messageId: string, quickId: string) => call<{ applied: string[] }>('/quick', { messageId, quickId })
