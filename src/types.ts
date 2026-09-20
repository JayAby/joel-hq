export interface Task {
  id: string
  t: string
  time?: string
  done: boolean
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

export interface FitnessDay {
  day: string
  workout: string
  done: boolean
}

export interface FitnessState {
  weight: string
  lastWeekWeight: string
  goalDaysPerWeek: number
  days: FitnessDay[]
}

export interface StudyDay {
  day: string
  subject: string
  done: boolean
}

export interface StudyState {
  goalDaysPerWeek: number
  days: StudyDay[]
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

// Key used in focusSubtasksByTask for when nothing is currently scheduled.
export const UNSCHEDULED_KEY = 'unscheduled'

export interface HistoryEntry {
  date: string
  tasksCompleted: number
  tasksTotal: number
  workoutDone: boolean
  studyDone: boolean
  weight?: string
}

export interface DashboardState {
  lastReset: string
  lastWeekReset: string
  tasks: Task[]
  // Current Focus's checklist is scoped PER task (keyed by task id), so
  // switching which task is "current" always starts with a clean checklist,
  // while an earlier task's checked-off progress is still there if you look
  // back at it later the same day. Cleared entirely on the daily reset.
  focusSubtasksByTask: Record<string, Task[]>
  projects: Task[]
  career: Task[]
  balance: string
  balanceDelta: string
  debts: MoneyItem[]
  savings: SavingsItem[]
  fitness: FitnessState
  study: StudyState
  goals: Task[]
  notes: string[]
  links: LinkItem[]
  quote: string
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
  lastReset: new Date().toDateString(),
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
    goalDaysPerWeek: 4,
    days: [
      { day: 'Mon', workout: 'Push', done: false },
      { day: 'Tue', workout: 'Rest', done: false },
      { day: 'Wed', workout: 'Pull', done: false },
      { day: 'Thu', workout: 'Rest', done: false },
      { day: 'Fri', workout: 'Legs', done: false },
      { day: 'Sat', workout: 'Full body', done: false },
      { day: 'Sun', workout: 'Rest', done: false },
    ],
  },
  study: {
    goalDaysPerWeek: 4,
    days: [
      { day: 'Mon', subject: 'MSc coursework', done: false },
      { day: 'Tue', subject: '', done: false },
      { day: 'Wed', subject: 'MSc coursework', done: false },
      { day: 'Thu', subject: '', done: false },
      { day: 'Fri', subject: 'Reading', done: false },
      { day: 'Sat', subject: '', done: false },
      { day: 'Sun', subject: 'Review week', done: false },
    ],
  },
  goals: [newTask('Example goal — rename or delete me'), newTask('Debt free by December')],
  notes: ['Example note — click to edit, ✕ to delete'],
  links: [
    { name: 'VS Code', url: 'vscode://file/' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Spotify', url: 'https://open.spotify.com' },
  ],
  quote: 'Discipline builds the freedom you want.',
}