import { useEffect, useState } from 'react'
import { FiHome, FiGrid, FiCalendar, FiMonitor, FiMessageCircle } from 'react-icons/fi'
import AssistantPanel from './AssistantPanel'
import AssistantBanner from './AssistantBanner'
import MobileNav from './MobileNav'
import { useAssistantAlerts } from '../hooks/useAssistantAlerts'
import type { ViewName } from './navItems'
import './home.css'

interface Props {
  view: ViewName
  onNavigateView: (view: ViewName) => void
}

export default function Sidebar({ view, onNavigateView }: Props) {
  // The assistant lives here so it works on every page.
  const [assistantOpen, setAssistantOpen] = useState(false)
  const { unread, toast, dismissToast } = useAssistantAlerts(assistantOpen)

  const [prefill, setPrefill] = useState<{ text: string; n: number } | null>(null)

  useEffect(() => {
    const open = (e: Event) => {
      const text = (e as CustomEvent<{ text?: string }>).detail?.text
      if (text) setPrefill({ text, n: Date.now() })
      setAssistantOpen(true)
    }
    window.addEventListener('joelhq:open-assistant', open)
    return () => window.removeEventListener('joelhq:open-assistant', open)
  }, [])

  const item = (v: ViewName) => `sidebar-item${view === v ? ' active' : ''}`

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
          <button className={item('dashboard')} onClick={() => onNavigateView('dashboard')}>
            <FiHome /> Today
          </button>
          <button className={item('sections')} onClick={() => onNavigateView('sections')}>
            <FiGrid /> Sections
          </button>

          <div className="sidebar-divider" />

          <button
            className={`sidebar-item${assistantOpen ? ' active' : ''}`}
            onClick={() => setAssistantOpen((o) => !o)}
          >
            <FiMessageCircle /> Assistant
            {unread > 0 && !assistantOpen && <span className="sidebar-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button className={item('plans')} onClick={() => onNavigateView('plans')}>
            <FiCalendar /> Plans
          </button>
          <button className={item('devices')} onClick={() => onNavigateView('devices')}>
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

      <MobileNav
        view={view}
        assistantOpen={assistantOpen}
        unread={unread}
        onNavigateView={onNavigateView}
        onToggleAssistant={() => setAssistantOpen((o) => !o)}
        onCloseAssistant={() => setAssistantOpen(false)}
      />

      <AssistantBanner message={assistantOpen ? null : toast} onOpen={() => setAssistantOpen(true)} onDismiss={dismissToast} />
      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} prefill={prefill} onPrefillUsed={() => setPrefill(null)} />
    </>
  )
}
