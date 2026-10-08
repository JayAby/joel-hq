import { FiHome, FiCalendar, FiMonitor } from 'react-icons/fi'
import MobileNav from './MobileNav'
import { SECTION_ITEMS, type ViewName } from './navItems'

interface Props {
  view: ViewName
  onNavigateView: (view: ViewName) => void
  onScrollTo: (sectionId: string) => void
}

export default function Sidebar({ view, onNavigateView, onScrollTo }: Props) {
  return (
    <>
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

      <MobileNav view={view} onNavigateView={onNavigateView} onScrollTo={onScrollTo} />
    </>
  )
}
