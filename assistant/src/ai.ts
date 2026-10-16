// Talks to Cloudflare Workers AI. The model only turns words into a
// structured proposal. Dates, times and names are resolved by code.

import type { AiContext } from './privacy'

export type RunAi = (system: string, user: string) => Promise<string>

export interface AiEnv {
  AI: unknown
  AI_MODEL?: string
}

// Check the current model list in the Cloudflare dashboard (Workers AI) and
// change AI_MODEL in wrangler.toml if this one has been retired.
export const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

export function makeRunAi(env: AiEnv): RunAi {
  const model = env.AI_MODEL || DEFAULT_MODEL
  const ai = env.AI as { run: (m: string, input: unknown) => Promise<unknown> }
  return async (system, user) => {
    const out = (await ai.run(model, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 700,
      temperature: 0.2,
    })) as { response?: unknown }
    const r = out?.response
    return typeof r === 'string' ? r : JSON.stringify(r ?? '')
  }
}

export function buildSystemPrompt(ctx: AiContext): string {
  return `You are Joel's personal assistant inside his dashboard, "Joel HQ". Be brief, warm and practical.
Today is ${ctx.todayWeekday} ${ctx.today} (Europe/London).

You can only propose these actions. Joel approves them before anything happens:
- add_task: {"type":"add_task","text":"...","date":"today|tomorrow|monday..sunday|YYYY-MM-DD","time":"HH:MM (optional)"}
- log_progress: {"type":"log_progress","project":"project name","summary":"what Joel did","remaining":"what is left (optional)","blocker":"(optional)","next":"next step (optional)"}
- mark_habit_done: {"type":"mark_habit_done","habit":"habit name","date":"today|yesterday|YYYY-MM-DD"}
- add_shopping: {"type":"add_shopping","name":"item","category":"Grocery|Clothing|Household|Electronics|Other"}

Rules:
- Reply with ONLY a JSON object: {"reply":"short message to Joel","actions":[...]}. No other text.
- Never do date arithmetic. Pass words like "tomorrow" or "friday".
- Use habit and project names exactly as listed below when they match.
- Do not delete or edit anything. Do not touch money, debts or savings. If asked, say you can't do that and give no actions.
- If Joel only asks a question or chats, answer in "reply" with "actions": [].
- If a detail is unclear, ask one short question in "reply" and give no actions.
- Items shown as "[private item]" are hidden on purpose. Never guess what they are.

What you can see (some items are hidden for privacy):
${JSON.stringify(ctx, null, 1)}`
}

export interface ParsedAi {
  reply: string
  actions: unknown[]
}

/** Tolerant parser: models sometimes wrap JSON in text or code fences. */
export function parseAiReply(text: string): ParsedAi {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1)) as { reply?: unknown; actions?: unknown }
      return {
        reply: typeof obj.reply === 'string' && obj.reply.trim() ? obj.reply.trim() : 'Okay.',
        actions: Array.isArray(obj.actions) ? obj.actions : [],
      }
    } catch {
      /* fall through */
    }
  }
  return { reply: text.trim().slice(0, 500) || 'Sorry, I did not catch that.', actions: [] }
}
