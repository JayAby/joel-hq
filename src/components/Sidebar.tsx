import {
  FiHome,
  FiCheckSquare,
  FiCalendar,
  FiFolder,
  FiBriefcase,
  FiDollarSign,
  FiActivity,
  FiRepeat,
  FiFileText,
  FiTarget,
  FiClock,
  FiMonitor,
  FiShoppingCart,
  FiMusic,
} from 'react-icons/fi'

interface Props {
  view: 'dashboard' | 'devices' | 'plans'
  onNavigateView: (view: 'dashboard' | 'devices' | 'plans') => void
  onScrollTo: (sectionId: string) => void
}

const SECTION_ITEMS = [
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

export default function Sidebar({ view, onNavigateView, onScrollTo }: Props) {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">👑</span>
        <div>
          <div className="sidebar-brand-name">JOEL HQ</div>
          <div className="sidebar-brand-sub">Plan · Build · Grow · Win</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-item${view === 'dashboard' ? ' active' : ''}`}
          onClick={() => onNavigateView('dashboard')}
        >
          <FiHome /> Home
        </button>

        {view === 'dashboard' &&
          SECTION_ITEMS.map((item) => (
            <button key={item.id} className="sidebar-item" onClick={() => onScrollTo(item.id)}>
              <item.icon /> {item.label}
            </button>
          ))}

        <div className="sidebar-divider" />

        <button
          className={`sidebar-item${view === 'plans' ? ' active' : ''}`}
          onClick={() => onNavigateView('plans')}
        >
          <FiCalendar /> Plans
        </button>
        <button
          className={`sidebar-item${view === 'devices' ? ' active' : ''}`}
          onClick={() => onNavigateView('devices')}
        >
          <FiMonitor /> Devices
        </button>
      </nav>

      <div className="sidebar-profile">
        <div className="sidebar-avatar">J</div>
        <div>
          <div className="sidebar-profile-name">Joel</div>
          <div className="sidebar-profile-role">Full Stack · AI · Future PhD</div>
        </div>
        <span className="sidebar-status-dot" title="On track" />
      </div>
    </div>
  )
}