import {
  FiCheckSquare, FiFolder, FiBriefcase, FiDollarSign, FiActivity, FiRepeat,
  FiFileText, FiTarget, FiClock, FiShoppingCart, FiMusic,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'

export type ViewName = 'dashboard' | 'devices' | 'plans'

export interface SectionItem {
  id: string
  label: string
  icon: IconType
}

export const SECTION_ITEMS: SectionItem[] = [
  { id: 'section-today', label: 'Today', icon: FiCheckSquare },
  { id: 'section-projects', label: 'Projects', icon: FiFolder },
  { id: 'section-career', label: 'Career', icon: FiBriefcase },
  { id: 'section-finance', label: 'Finance', icon: FiDollarSign },
  { id: 'section-fitness', label: 'Fitness', icon: FiActivity },
  { id: 'section-habits', label: 'Habits', icon: FiRepeat },
  { id: 'section-shopping', label: 'Shopping', icon: FiShoppingCart },
  { id: 'section-goals', label: 'Goals', icon: FiTarget },
  { id: 'section-notes', label: 'Notes', icon: FiFileText },
  { id: 'section-pomodoro', label: 'Pomodoro', icon: FiClock },
  { id: 'section-nowplaying', label: 'Music', icon: FiMusic },
]
