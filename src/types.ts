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

export interface Fitness {
  weight: string
  workout: string
  protein: string
  steps: string
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
  fitness: Fitness
  study: Task[]
  goals: ProgressItem[]
  notes: string[]
  links: LinkItem[]
  quote: string
}

export const DEFAULT_STATE: DashboardState = {
  lastReset: new Date().toDateString(),
  tasks: [
    { t: 'Code for 2 hours', time: '09:00–11:00', done: false },
    { t: 'StudyPulse (backend)', time: '11:00–13:00', done: false },
    { t: 'Gym', time: '16:00–17:30', done: false },
    { t: 'MSc admin (ARU)', time: '19:00–20:00', done: false },
  ],
  focus: { title: 'Building StudyPulse backend', next: 'Set up PostgreSQL models', pct: 70 },
  projects: [
    { name: 'StudyPulse', sub: 'AI study companion (FastAPI + React)', pct: 70 },
    { name: 'SYNCHRO', sub: 'Fragrance app (React + FastAPI)', pct: 40 },
    { name: 'Portfolio', sub: 'Personal website (Next.js)', pct: 20 },
  ],
  career: [
    { name: 'MSc AI (ARU)', sub: '10 Sep 2026 – 6 Oct 2028', pct: 15 },
    { name: 'PhD Opportunities', sub: 'Research + applications', pct: 30 },
    { name: 'Job Applications', sub: 'Revolut / Elwood / Lockwood', pct: 20 },
  ],
  balance: '£1,234.56',
  balanceDelta: '↑ +£120 this month',
  debts: [
    { name: 'Monzo CC', pct: 72 },
    { name: 'Chase CC', pct: 45 },
    { name: 'Lloyds OD', pct: 60 },
    { name: 'Klarna', pct: 15 },
  ],
  fitness: { weight: '68.5kg', workout: '4x / week', protein: '120–150g', steps: '8,000 / 10,000' },
  study: [
    { t: 'Code', done: false },
    { t: 'Study', done: false },
    { t: 'Read', done: false },
    { t: 'Learn', done: false },
  ],
  goals: [
    { name: 'Debt free by Dec 2026', pct: 45 },
    { name: 'Move out', pct: 30 },
    { name: 'Save £200–350/month', pct: 20 },
  ],
  notes: [
    'Email Prof. Y Moshfeghi (Strathclyde PhD)',
    'Update CV & LinkedIn',
    'Plan weekend (gym + food prep)',
  ],
  links: [
    { name: 'ARU Student Portal', url: '#' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'LinkedIn', url: 'https://linkedin.com' },
    { name: 'Email', url: 'mailto:' },
  ],
  quote: 'Discipline builds the freedom you want.',
}
