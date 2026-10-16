// The privacy gate. Everything the AI sees passes through here.
//
// Rules (agreed with Joel):
//  - Finance (balance, debts, savings), notes, fitness/weight and history are
//    never sent. They are not in the allowlist below.
//  - Any item whose text looks personal (relationships, faith, health, money)
//    is replaced with "[private item]" before it is sent.
//  - A message from Joel that looks personal is not sent at all unless he
//    starts it with "share:".

const SENSITIVE_WORDS = [
  // relationships and family
  'girlfriend', 'boyfriend', 'partner', 'wife', 'husband', 'fiancee', 'fiance', 'dating', 'date night',
  'mum', 'mom', 'dad', 'sister', 'brother', 'family', 'funeral', 'wedding',
  // faith
  'church', 'pray', 'prayer', 'bible', 'mosque', 'temple', 'worship', 'fasting', 'god',
  // health
  'doctor', 'gp', 'dentist', 'therapy', 'therapist', 'counsel', 'medic', 'medication', 'prescription',
  'hospital', 'diagnos', 'mental', 'anxiety', 'depress', 'panic', 'period', 'pregnan', 'sick', 'ill',
  // money
  'salary', 'rent', 'debt', 'loan', 'bank', 'overdraft', 'credit', 'mortgage', 'savings', 'money', 'pay ',
  'wage', 'tax', 'invoice',
]

// Short words must match whole words (so "ill" does not match "will").
// Longer words match as prefixes (so "medic" matches "medication").
const SENSITIVE_RE = new RegExp(
  '(' +
    SENSITIVE_WORDS.map((w) => {
      const word = w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return w.trim().length <= 4 ? `\\b${word}\\b` : `\\b${word}`
    }).join('|') +
    ')|[£$€]\\s?\\d',
  'i',
)

export function isSensitive(text: string): boolean {
  return SENSITIVE_RE.test(text)
}

export const PRIVATE_PLACEHOLDER = '[private item]'

export function redact(text: string): string {
  return isSensitive(text) ? PRIVATE_PLACEHOLDER : text
}

interface TaskLike {
  id?: string
  t?: string
  time?: string
  done?: boolean
  date?: string
}

export interface ProjectRef {
  id: string
  name: string
}
export interface HabitRef {
  id: string
  name: string
}

/** What the code uses to resolve names. Never sent to the AI. */
export interface ResolveIndex {
  projects: ProjectRef[]
  habits: HabitRef[]
}

/** What the AI sees. Allowlist only, already redacted. */
export interface AiContext {
  today: string
  todayWeekday: string
  todayTasks: { text: string; time?: string; done: boolean }[]
  tomorrowTasks: { text: string; time?: string }[]
  projects: string[]
  goals: string[]
  career: string[]
  habits: string[]
  shopping: string[]
}

const arr = (v: unknown): TaskLike[] => (Array.isArray(v) ? (v as TaskLike[]) : [])

export function buildContext(
  state: Record<string, unknown>,
  plans: { id: string; data: Record<string, unknown> }[],
  today: string,
  tomorrow: string,
  weekday: string,
): { ai: AiContext; index: ResolveIndex } {
  const tasks = arr(state.tasks)
  const projects = arr(state.projects)
  const habitPlans = plans.filter((p) => p.data.kind === 'habit' && p.data.active !== false)

  const ai: AiContext = {
    today,
    todayWeekday: weekday,
    todayTasks: tasks
      .filter((t) => (t.date ?? today) === today)
      .map((t) => ({ text: redact(String(t.t ?? '')), time: t.time, done: !!t.done })),
    tomorrowTasks: tasks
      .filter((t) => t.date === tomorrow)
      .map((t) => ({ text: redact(String(t.t ?? '')), time: t.time })),
    projects: projects.map((p) => redact(String(p.t ?? ''))),
    goals: arr(state.goals).map((g) => redact(String(g.t ?? ''))),
    career: arr(state.career).map((c) => redact(String(c.t ?? ''))),
    habits: habitPlans.map((p) => redact(String(p.data.name ?? ''))),
    shopping: (Array.isArray(state.shoppingItems) ? (state.shoppingItems as { name?: string; done?: boolean }[]) : [])
      .filter((s) => !s.done)
      .map((s) => redact(String(s.name ?? ''))),
  }

  const index: ResolveIndex = {
    projects: projects.filter((p) => p.id).map((p) => ({ id: String(p.id), name: String(p.t ?? '') })),
    habits: habitPlans.map((p) => ({ id: p.id, name: String(p.data.name ?? '') })),
  }
  return { ai, index }
}
