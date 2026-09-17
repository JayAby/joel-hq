export interface Task {
  t: string
  time?: string
  done: boolean
}

export interface ProgressItem {
  name: string
  sub?: string
  pct: number
}

export interface MilestoneItem {
  name: string
  sub?: string
  subtasks: Task[]
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

export interface Focus {
  title: string
  next: string
  subtasks: Task[]
}

export interface DashboardState {
  lastReset: string
  lastWeekReset: string
  tasks: Task[]
  focus: Focus
  projects: MilestoneItem[]
  career: MilestoneItem[]
  balance: string
  balanceDelta: string
  debts: MoneyItem[]
  savings: SavingsItem[]
  fitness: FitnessState
  study: StudyState
  goals: ProgressItem[]
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

export const DEFAULT_STATE: DashboardState = {
  lastReset: new Date().toDateString(),
  lastWeekReset: mondayOf(new Date()),
  tasks: [],
  focus: { title: 'What are you working on?', next: '', subtasks: [] },
  projects: [],
  career: [],
  balance: '£0.00',
  balanceDelta: '',
  debts: [],
  savings: [],
  fitness: {
    weight: '',
    lastWeekWeight: '',
    goalDaysPerWeek: 4,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
      day,
      workout: '',
      done: false,
    })),
  },
  study: {
    goalDaysPerWeek: 4,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
      day,
      subject: '',
      done: false,
    })),
  },
  goals: [],
  notes: [],
  links: [
    { name: 'VS Code', url: 'vscode://file/' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Spotify', url: 'https://open.spotify.com' },
  ],
  quote: 'Discipline builds the freedom you want.',
}