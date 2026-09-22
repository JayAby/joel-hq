import { resetDayKey } from './config'

export interface Task {
  id: string
  t: string
  time?: string
  done: boolean
  skipped?: boolean
  planId?: string
  createdAt?: number
}

export interface MoneyItem {
  name: string
  target: number
  current: number
}

export interface SavingsItem {
  name: string
  target: number
  saved: number
  withdrawn: number
}

export interface FitnessState {
  weight: string
  lastWeekWeight: string
}

export interface LinkItem {
  name: string
  url: string
}

export type DeviceType = 'laptop' | 'desktop' | 'phone' | 'tablet' | 'tv' | 'other'
export type PresenceStatus = 'active' | 'idle' | 'away' | 'offline'
export type ManualStatus = 'online' | 'offline' | 'connected'

export interface DeviceConnection {
  toDeviceId: string
  label: string
}

export interface DeviceDoc {
  id: string
  name: string
  type: DeviceType
  capability: 'live' | 'manual'
  createdAt: number

  lastSeen?: number
  activity?: string
  currentApp?: string
  currentProject?: string
  battery?: number

  manualStatus?: ManualStatus

  connections?: DeviceConnection[]
}

export const UNSCHEDULED_KEY = 'unscheduled'

export type PlanKind = 'schedule' | 'habit' | 'routine'
export type RecurrenceFrequency = 'daily' | 'weekly'
export type RecurrenceEnd = 'never' | 'date' | 'count'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  daysOfWeek: number[]
  endType: RecurrenceEnd
  endDate?: string
  endCount?: number
}

export interface PlanScheduleItem {
  time: string
  label: string
}

export interface PlanStats {
  generated: number
  completed: number
  skipped: number
}

export interface RecurringPlan {
  id: string
  name: string
  kind: PlanKind
  startDate: string
  recurrence: RecurrenceRule
  active: boolean
  createdAt: number

  scheduleByDay?: Record<number, PlanScheduleItem[]>
  habitTargetPerWeek?: number
  routineChecklist?: string[]

  stats?: PlanStats
}

export interface HistoryEntry {
  date: string
  tasksCompleted: number
  tasksTotal: number
  weight?: string
}

export interface ClearedTask {
  text: string
  wasDone: boolean
  clearedAt: number
}

export interface DashboardState {
  hasOnboarded: boolean
  lastReset: string
  lastWeekReset: string
  tasks: Task[]
  focusSubtasksByTask: Record<string, Task[]>
  projects: Task[]
  career: Task[]
  balance: string
  balanceDelta: string
  debts: MoneyItem[]
  savings: SavingsItem[]
  fitness: FitnessState
  habitLog: Record<string, string[]>
  plansSeeded: boolean
  goals: Task[]
  notes: string[]
  links: LinkItem[]
  quote: string
  recentlyCleared: ClearedTask[]
}

export function mondayOf(d: Date): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date.toISOString().slice(0, 10)
}

function newTask(t: string, time?: string): Task {
  const task: Task = { id: crypto.randomUUID(), t, done: false }
  if (time) task.time = time
  return task
}

const seedTasks = [
  newTask('Code for 2 hours', '09:00'),
  newTask('Deep work session', '11:00'),
  newTask('Gym', '17:00'),
  newTask('Wind down / plan tomorrow', '20:30'),
]

export const DEFAULT_STATE: DashboardState = {
  hasOnboarded: false,
  lastReset: resetDayKey(new Date()),
  lastWeekReset: mondayOf(new Date()),
  tasks: seedTasks,
  focusSubtasksByTask: {
    [seedTasks[0].id]: [
      newTask('Set up the project structure'),
      newTask('Build the core feature'),
      newTask('Test it end to end'),
    ],
  },
  projects: [newTask('Example project — rename or delete me'), newTask('Portfolio site')],
  career: [newTask('Update CV & LinkedIn'), newTask('Apply to 1 role this week')],
  balance: '£1,234.56',
  balanceDelta: '↑ +£120 this month',
  debts: [{ name: 'Example debt — rename me', target: 1000, current: 250 }],
  savings: [{ name: 'Example goal — rename me', target: 500, saved: 100, withdrawn: 0 }],
  fitness: {
    weight: '70kg',
    lastWeekWeight: '70.5kg',
  },
  habitLog: {},
  plansSeeded: false,
  goals: [newTask('Example goal — rename or delete me'), newTask('Debt free by December')],
  notes: ['Example note — click to edit, ✕ to delete'],
  links: [
    { name: 'VS Code', url: 'vscode://file/' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Spotify', url: 'https://open.spotify.com' },
  ],
  quote: 'Discipline builds the freedom you want.',
  recentlyCleared: [],
}