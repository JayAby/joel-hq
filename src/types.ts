export interface Task {
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

export interface Focus {
  subtasks: Task[]
}

export interface DashboardState {
  lastReset: string
  lastWeekReset: string
  tasks: Task[]
  focus: Focus
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

export const DEFAULT_STATE: DashboardState = {
  lastReset: new Date().toDateString(),
  lastWeekReset: mondayOf(new Date()),
  tasks: [
    { t: 'Code for 2 hours', time: '09:00', done: false },
    { t: 'Deep work session', time: '11:00', done: false },
    { t: 'Gym', time: '17:00', done: false },
    { t: 'Wind down / plan tomorrow', time: '20:30', done: false },
  ],
  focus: {
    subtasks: [
      { t: 'Set up the project structure', done: false },
      { t: 'Build the core feature', done: false },
      { t: 'Test it end to end', done: false },
    ],
  },
  projects: [
    { t: 'Example project — rename or delete me', done: false },
    { t: 'Portfolio site', done: false },
  ],
  career: [
    { t: 'Update CV & LinkedIn', done: false },
    { t: 'Apply to 1 role this week', done: false },
  ],
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
  goals: [
    { t: 'Example goal — rename or delete me', done: false },
    { t: 'Debt free by December', done: false },
  ],
  notes: ['Example note — click to edit, ✕ to delete'],
  links: [
    { name: 'VS Code', url: 'vscode://file/' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Spotify', url: 'https://open.spotify.com' },
  ],
  quote: 'Discipline builds the freedom you want.',
}