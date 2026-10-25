// "What I know about you": a short list you can read, add to and clear from the chat.
//   know: I study best in the morning     (adds a fact)
//   what do you know                      (shows the list and your mode)
//   forget 2  /  forget everything
//   set mode both                         (studying | working | both | between)
// Facts that look personal are kept but marked private: they are never sent to the AI.

import type { Db } from './firestore'
import { isSensitive } from './privacy'

export type Mode = 'studying' | 'working' | 'both' | 'between'

export const MODE_LABEL: Record<Mode, string> = {
  studying: 'Studying',
  working: 'Working',
  both: 'Studying and working',
  between: 'Between things',
}

export interface Fact {
  id: string
  text: string
  source: 'you' | 'noticed'
  private: boolean
  at: number
}

const MAX_FACTS = 60

export function parseMode(word: string): Mode | null {
  const w = word.toLowerCase().trim()
  if (/^(both|studying\s*(and|\+|&)\s*working|working\s*(and|\+|&)\s*studying|study\s*(and|\+|&)\s*work|work\s*(and|\+|&)\s*study)$/.test(w)) return 'both'
  if (/^(studying|study|student|school|uni|university)$/.test(w)) return 'studying'
  if (/^(working|work|job|employed)$/.test(w)) return 'working'
  if (/^(between|between things|other|job ?hunting|gap)$/.test(w)) return 'between'
  return null
}

export async function loadFacts(db: Db): Promise<Fact[]> {
  const raw = (await db.getDoc('assistant/knowledge'))?.data.facts
  return (Array.isArray(raw) ? raw : [])
    .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null && typeof (f as Record<string, unknown>).text === 'string')
    .map((f) => ({
      id: String(f.id ?? crypto.randomUUID()),
      text: String(f.text),
      source: f.source === 'noticed' ? 'noticed' : 'you',
      private: f.private === true,
      at: Number(f.at) || 0,
    }))
}

async function saveFacts(db: Db, facts: Fact[]): Promise<void> {
  await db.update('assistant/knowledge', [{ path: ['facts'], value: facts }])
}

export async function describeKnowledge(db: Db): Promise<string> {
  const facts = await loadFacts(db)
  const mode = (await db.getDoc('assistant/profile'))?.data.mode
  const lines: string[] = []
  lines.push(`Mode: ${typeof mode === 'string' && mode in MODE_LABEL ? MODE_LABEL[mode as Mode] : 'not set yet (say "set mode both")'}`)
  if (facts.length === 0) {
    lines.push('', 'I do not know anything else about you yet. Tell me with "know: ..."')
  } else {
    lines.push('')
    facts.forEach((f, i) => lines.push(`${i + 1}. ${f.text}${f.private ? ' (private)' : ''}${f.source === 'noticed' ? ' (I noticed)' : ''}`))
    lines.push('', 'Say "forget 2" to remove one, or "forget everything".')
  }
  return lines.join('\n')
}

/** Returns a reply when the text is one of these commands, otherwise null. */
export async function handleKnowledgeCommand(db: Db, text: string, now: Date): Promise<string | null> {
  const t = text.trim()

  const mode = t.match(/^set\s+mode\s+(.+)$/i)
  if (mode) {
    const m = parseMode(mode[1])
    if (!m) return 'Pick one: studying, working, both, or between.'
    await db.update('assistant/profile', [{ path: ['mode'], value: m }])
    return `Got it: ${MODE_LABEL[m]}. I will plan around that.`
  }

  const learn = t.match(/^(?:know|learn|remember)\s*:\s*(.+)$/i)
  if (learn) {
    const facts = await loadFacts(db)
    if (facts.length >= MAX_FACTS) return 'That is a lot already. Remove some with "forget 3" first.'
    const text2 = learn[1].trim().slice(0, 200)
    const priv = isSensitive(text2)
    await saveFacts(db, [...facts, { id: crypto.randomUUID(), text: text2, source: 'you', private: priv, at: now.getTime() }])
    return priv ? 'Saved. It looks personal, so I will never send it to the AI.' : 'Saved.'
  }

  if (/^(what do you know( about me)?\??|what you know|knowledge|facts)$/i.test(t)) return describeKnowledge(db)

  if (/^forget\s+(everything|all)$/i.test(t)) {
    await saveFacts(db, [])
    return 'Done. I have forgotten everything on the list.'
  }
  const forget = t.match(/^forget\s+(\d{1,2})$/i)
  if (forget) {
    const facts = await loadFacts(db)
    const i = Number(forget[1]) - 1
    if (i < 0 || i >= facts.length) return `There is no number ${forget[1]} on the list.`
    const gone = facts[i]
    await saveFacts(db, facts.filter((_, n) => n !== i))
    return `Forgot: ${gone.text}`
  }
  return null
}
