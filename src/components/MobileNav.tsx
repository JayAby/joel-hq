import { FiHome, FiCalendar, FiMonitor, FiGrid, FiMessageCircle } from 'react-icons/fi'
import type { ViewName } from './navItems'
import './mobileNav.css'
import './home.css'

interface Props {
  view: ViewName
  assistantOpen: boolean
  unread: number
  onNavigateView: (view: ViewName) => void
  onToggleAssistant: () => void
  onCloseAssistant: () => void
}

export default function MobileNav({
  view,
  assistantOpen,
  unread,
  onNavigateView,
  onToggleAssistant,
  onCloseAssistant,
}: Props) {
  function go(v: ViewName) {
    onCloseAssistant()
    onNavigateView(v)
    window.scrollTo({ top: 0 })
  }

  const tab = (v: ViewName) => view === v && !assistantOpen

  return (
    <nav className="mnav-bar" aria-label="Main navigation">
      <button className={`mnav-tab${tab('dashboard') ? ' active' : ''}`} onClick={() => go('dashboard')}>
        <FiHome />
        <span>Today</span>
      </button>
      <button className={`mnav-tab${tab('plans') ? ' active' : ''}`} onClick={() => go('plans')}>
        <FiCalendar />
        <span>Plans</span>
      </button>
      <button className={`mnav-tab${assistantOpen ? ' active' : ''}`} onClick={onToggleAssistant}>
        <span className="mnav-icon">
          <FiMessageCircle />
          {unread > 0 && !assistantOpen && <span className="mnav-badge">{unread > 9 ? '9+' : unread}</span>}
        </span>
        <span>Assistant</span>
      </button>
      <button className={`mnav-tab${tab('devices') ? ' active' : ''}`} onClick={() => go('devices')}>
        <FiMonitor />
        <span>Devices</span>
      </button>
      <button className={`mnav-tab${tab('sections') ? ' active' : ''}`} onClick={() => go('sections')}>
        <FiGrid />
        <span>Sections</span>
      </button>
    </nav>
  )
}
