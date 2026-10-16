// The only things the assistant is allowed to do. There is deliberately no
// delete action, no finance action and no way to edit existing items.
// The AI proposes these; nothing runs until Joel approves.

import { ConflictError, type Db, type Edit } from './firestore'
import type { ResolveIndex } from './privacy'
import { londonResetDayKey } from './london'
import { parseTime, resolveDate } from './dates'

export type Action =
  | { type: 'add_task'; text: string; date: string; time?: string }
  | {
      type: 'log_progress'
      project: string
      projectId?: string
      summary: string
      remaining?: string
      blocker?: string
      next?: string
      date: string
    }
  | { type: 'mark_habit_done'; habit: string; habitId: string; date: string }
  | { type: 'add_shopping'; name: string; category: string }

/** What is needed to reverse one applied action. */
export type UndoStep =
  | { kind: 'remove_task'; taskId: string }
  | { kind: 'remove_shopping'; itemId: string }
  | { kind: 'remove_habit_date'; planId: string; date: string }
  | { kind: 'remove_session'; id: string }
  | { kind: 'noop' }

const MAX_ACTIONS = 5
const SHOPPING_CATEGORIES = ['Grocery', 'Clothing', 'Household', 'Electronics', 'Other']

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined
  const s = v.trim().slice(0, max)
  return s ? s : undefined
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Finds one item by name. Exact match first, then contains. Null if none or ambiguous. */
function findByName<T extends { name: string }>(list: T[], wanted: string): { item: T | null; ambiguous: boolean } {
  const w = norm(wanted)
  if (!w) return { item: null, ambiguous: false }
  const exact = list.filter((x) => norm(x.name) === w)
  if (exact.length === 1) return { item: exact[0], ambiguous: false }
  const loose = list.filter((x) => {
    const n = norm(x.name)
    return n.includes(w) || w.includes(n)
  })
  if (loose.length === 1) return { item: loose[0], ambiguous: false }
  return { item: null, ambiguous: loose.length > 1 || exact.length > 1 }
}

export function validateActions(
  raw: unknown,
  index: ResolveIndex,
  now: Date,
): { actions: Action[]; warnings: string[] } {
  const actions: Action[] = []
  const warnings: string[] = []
  const today = londonResetDayKey(now)
  const list = Array.isArray(raw) ? raw : []
  if (list.length > MAX_ACTIONS) warnings.push(`Only the first ${MAX_ACTIONS} actions were kept.`)

  for (const item of list.slice(0, MAX_ACTIONS)) {
    const a = (item ?? {}) as Record<string, unknown>
    switch (a.type) {
      case 'add_task': {
        const text = str(a.text, 200)
        const date = resolveDate(a.date, now)
        if (!text) {
          warnings.push('Skipped a task with no text.')
          break
        }
        if (!date) {
          warnings.push(`Skipped "${text}": I could not work out the date.`)
          break
        }
        const act: Action = { type: 'add_task', text, date }
        if (a.time !== undefined && a.time !== null && a.time !== '') {
          const time = parseTime(a.time)
          if (time) act.time = time
          else warnings.push(`Ignored the time for "${text}" because I could not read it.`)
        }
        actions.push(act)
        break
      }
      case 'log_progress': {
        const project = str(a.project, 120)
        const summary = str(a.summary, 500)
        if (!project || !summary) {
          warnings.push('Skipped a progress note that was missing the project or what you did.')
          break
        }
        const found = findByName(index.projects, project)
        const act: Action = {
          type: 'log_progress',
          project: found.item ? found.item.name : project,
          summary,
          date: today,
        }
        if (found.item) act.projectId = found.item.id
        else if (found.ambiguous) warnings.push(`"${project}" matches more than one project, so I logged it without linking.`)
        const remaining = str(a.remaining, 300)
        const blocker = str(a.blocker, 300)
        const next = str(a.next, 300)
        if (remaining) act.remaining = remaining
        if (blocker) act.blocker = blocker
        if (next) act.next = next
        actions.push(act)
        break
      }
      case 'mark_habit_done': {
        const habit = str(a.habit, 120)
        const date = resolveDate(a.date, now)
        if (!habit) break
        if (!date) {
          warnings.push(`Skipped "${habit}": I could not work out the date.`)
          break
        }
        if (date > today) {
          warnings.push(`Skipped "${habit}": I will not mark a habit done in the future.`)
          break
        }
        const found = findByName(index.habits, habit)
        if (!found.item) {
          warnings.push(
            found.ambiguous
              ? `"${habit}" matches more than one habit, so I skipped it.`
              : `I could not find a habit called "${habit}".`,
          )
          break
        }
        actions.push({ type: 'mark_habit_done', habit: found.item.name, habitId: found.item.id, date })
        break
      }
      case 'add_shopping': {
        const name = str(a.name, 100)
        if (!name) break
        const cat = SHOPPING_CATEGORIES.find((c) => c.toLowerCase() === String(a.category ?? '').trim().toLowerCase())
        actions.push({ type: 'add_shopping', name, category: cat ?? 'Other' })
        break
      }
      default:
        warnings.push('Ignored an action I am not allowed to do.')
    }
  }
  return { actions, warnings }
}

export function describe(a: Action): string {
  switch (a.type) {
    case 'add_task':
      return `Add task "${a.text}" on ${a.date}${a.time ? ` at ${a.time}` : ''}`
    case 'log_progress':
      return `Log progress on ${a.project}: ${a.summary}${a.next ? ` (next: ${a.next})` : ''}`
    case 'mark_habit_done':
      return `Mark habit "${a.habit}" done for ${a.date}`
    case 'add_shopping':
      return `Add "${a.name}" to your shopping list (${a.category})`
  }
}

// ---- applying -------------------------------------------------------------

const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])

/**
 * Read, change, write with an update-time check, so a change made in the
 * browser in between is never overwritten. Retries a few times.
 */
async function modifyState(db: Db, fn: (data: Record<string, unknown>) => Edit[] | null): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const doc = await db.getDoc('joelhq/state')
    if (!doc) throw new Error('joelhq/state was not found')
    const edits = fn(doc.data)
    if (!edits || edits.length === 0) return
    try {
      await db.update('joelhq/state', edits, { ifUpdateTime: doc.updateTime })
      return
    } catch (e) {
      if (e instanceof ConflictError && i < 3) continue
      throw e
    }
  }
}

export async function applyAction(db: Db, a: Action, now: Date): Promise<UndoStep> {
  switch (a.type) {
    case 'add_task': {
      const task: Record<string, unknown> = {
        id: crypto.randomUUID(),
        t: a.text,
        done: false,
        date: a.date,
        createdAt: now.getTime(),
      }
      if (a.time) task.time = a.time
      await modifyState(db, (d) => [{ path: ['tasks'], value: [...arr(d.tasks), task] }])
      return { kind: 'remove_task', taskId: task.id as string }
    }
    case 'add_shopping': {
      const item = {
        id: crypto.randomUUID(),
        name: a.name,
        category: a.category,
        done: false,
        createdAt: now.getTime(),
      }
      await modifyState(db, (d) => [{ path: ['shoppingItems'], value: [...arr(d.shoppingItems), item] }])
      return { kind: 'remove_shopping', itemId: item.id }
    }
    case 'mark_habit_done': {
      let added = false
      await modifyState(db, (d) => {
        const log = (d.habitLog ?? {}) as Record<string, unknown>
        const dates = Array.isArray(log[a.habitId]) ? (log[a.habitId] as string[]) : []
        if (dates.includes(a.date)) return null
        added = true
        return [{ path: ['habitLog', a.habitId], value: [...dates, a.date] }]
      })
      return added ? { kind: 'remove_habit_date', planId: a.habitId, date: a.date } : { kind: 'noop' }
    }
    case 'log_progress': {
      const id = crypto.randomUUID()
      const doc: Record<string, unknown> = {
        id,
        projectName: a.project,
        summary: a.summary,
        date: a.date,
        createdAt: now.getTime(),
        source: 'assistant',
      }
      if (a.projectId) doc.projectId = a.projectId
      if (a.remaining) doc.remaining = a.remaining
      if (a.blocker) doc.blocker = a.blocker
      if (a.next) doc.next = a.next
      await db.set(`projectSessions/${id}`, doc)
      return { kind: 'remove_session', id }
    }
  }
}

export async function undoStep(db: Db, s: UndoStep): Promise<void> {
  switch (s.kind) {
    case 'remove_task':
      await modifyState(db, (d) => {
        const tasks = arr(d.tasks)
        return tasks.some((t) => t.id === s.taskId)
          ? [{ path: ['tasks'], value: tasks.filter((t) => t.id !== s.taskId) }]
          : null
      })
      return
    case 'remove_shopping':
      await modifyState(db, (d) => {
        const items = arr(d.shoppingItems)
        return items.some((t) => t.id === s.itemId)
          ? [{ path: ['shoppingItems'], value: items.filter((t) => t.id !== s.itemId) }]
          : null
      })
      return
    case 'remove_habit_date':
      await modifyState(db, (d) => {
        const log = (d.habitLog ?? {}) as Record<string, unknown>
        const dates = Array.isArray(log[s.planId]) ? (log[s.planId] as string[]) : []
        return dates.includes(s.date)
          ? [{ path: ['habitLog', s.planId], value: dates.filter((x) => x !== s.date) }]
          : null
      })
      return
    case 'remove_session':
      await db.remove(`projectSessions/${s.id}`)
      return
    case 'noop':
      return
  }
}
