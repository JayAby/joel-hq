import {
  FiCheckSquare, FiRepeat, FiActivity, FiFolder, FiBriefcase, FiShoppingCart, FiCalendar,
  FiTarget, FiLock, FiFileText, FiEye, FiTrendingUp, FiClock, FiMusic, FiLink,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'

export type ViewName = 'dashboard' | 'sections' | 'devices' | 'plans'

export type Tone = 'mint' | 'amber' | 'rose' | 'violet' | 'blue' | 'grey'

export interface SectionItem {
  id: string
  label: string
  icon: IconType
  tone: Tone
}

// Everything that used to be a card on the long dashboard. Home shows only today;
// these open one at a time from the Sections page.
export const SECTION_ITEMS: SectionItem[] = [
  { id: 'today', label: 'Today (full list)', icon: FiCheckSquare, tone: 'mint' },
  { id: 'habits', label: 'Habits', icon: FiRepeat, tone: 'amber' },
  { id: 'fitness', label: 'Fitness', icon: FiActivity, tone: 'rose' },
  { id: 'projects', label: 'Projects', icon: FiFolder, tone: 'mint' },
  { id: 'career', label: 'Career and education', icon: FiBriefcase, tone: 'violet' },
  { id: 'shopping', label: 'Shopping', icon: FiShoppingCart, tone: 'blue' },
  { id: 'weekly', label: 'This week', icon: FiCalendar, tone: 'grey' },
  { id: 'goals', label: 'Goals', icon: FiTarget, tone: 'mint' },
  { id: 'finance', label: 'Finance', icon: FiLock, tone: 'grey' },
  { id: 'notes', label: 'Notes', icon: FiFileText, tone: 'violet' },
  { id: 'focus', label: 'Focus', icon: FiEye, tone: 'amber' },
  { id: 'streaks', label: 'Streaks', icon: FiTrendingUp, tone: 'amber' },
  { id: 'pomodoro', label: 'Pomodoro', icon: FiClock, tone: 'rose' },
  { id: 'music', label: 'Music', icon: FiMusic, tone: 'violet' },
  { id: 'links', label: 'Links', icon: FiLink, tone: 'blue' },
]
