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

export interface MoneyItem {
  name: string
  target: number
  current: number
}

export interface FitnessDay {
  day: string
  workout: string
  done: boolean
}

export interface LinkItem {
  name: string
  url: string
}

export interface Focus {
  title: string
  next: string
  pct: number
}

export interface DashboardState {
  lastReset: string
  lastWeekReset: string
  tasks: Task[]
  focus: Focus
  projects: ProgressItem[]
  career: ProgressItem[]
  balance: string
  balanceDelta: string
  debts: MoneyItem[]
  savings: MoneyItem[]
  fitness: FitnessDay[]
  study: Task[]
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
  focus: { title: 'What are you working on?', next: '', pct: 0 },
  projects: [],
  career: [],
  balance: '£0.00',
  balanceDelta: '',
  debts: [],
  savings: [],
  fitness: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
    day,
    workout: '',
    done: false,
  })),
  study: [{ t: 'Study', done: false }],
  goals: [],
  notes: [],
  links: [
    { name: 'VS Code', url: 'vscode://file/' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Spotify', url: 'https://open.spotify.com' },
  ],
  quote: 'Discipline builds the freedom you want.',
}