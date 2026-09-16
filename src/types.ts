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
  tasks: Task[]
  focus: Focus
  projects: ProgressItem[]
  career: ProgressItem[]
  balance: string
  balanceDelta: string
  debts: ProgressItem[]
  savings: ProgressItem[]
  fitness: Task[]
  study: Task[]
  goals: ProgressItem[]
  notes: string[]
  links: LinkItem[]
  quote: string
}

export const DEFAULT_STATE: DashboardState = {
  lastReset: new Date().toDateString(),
  tasks: [],
  focus: { title: 'What are you working on?', next: '', pct: 0 },
  projects: [],
  career: [],
  balance: '£0.00',
  balanceDelta: '',
  debts: [],
  savings: [],
  fitness: [
    { t: 'Workout', done: false },
    { t: 'Protein target', done: false },
    { t: 'Creatine', done: false },
    { t: 'Steps goal', done: false },
  ],
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