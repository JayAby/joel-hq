import { useEffect, useState } from 'react'
import { FiHome, FiCalendar, FiMonitor, FiGrid, FiX } from 'react-icons/fi'
import { SECTION_ITEMS, type ViewName } from './navItems'
import './mobileNav.css'

interface Props {
  view: ViewName
  onNavigateView: (view: ViewName) => void
  onScrollTo: (sectionId: string) => void
}

export default function MobileNav({ view, onNavigateView, onScrollTo }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  function go(v: ViewName) {
    setSheetOpen(false)
    onNavigateView(v)
    window.scrollTo({ top: 0 })
  }

  function openSection(id: string) {
    setSheetOpen(false)
    if (view !== 'dashboard') onNavigateView('dashboard')
    // wait a tick so the dashboard is mounted before scrolling
    setTimeout(() => onScrollTo(id), 60)
  }

  return (
    <>
      {sheetOpen && (
        <div className="mnav-backdrop" onClick={() => setSheetOpen(false)}>
          <div className="mnav-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mnav-sheet-head">
              <span>Jump to</span>
              <button className="mnav-close" onClick={() => setSheetOpen(false)} aria-label="Close">
                <FiX />
              </button>
            </div>
            <div className="mnav-grid">
              {SECTION_ITEMS.map((item) => (
                <button key={item.id} className="mnav-tile" onClick={() => openSection(item.id)}>
                  <item.icon />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="mnav-bar" aria-label="Main navigation">
        <button className={`mnav-tab${view === 'dashboard' ? ' active' : ''}`} onClick={() => go('dashboard')}>
          <FiHome />
          <span>Home</span>
        </button>
        <button className={`mnav-tab${view === 'plans' ? ' active' : ''}`} onClick={() => go('plans')}>
          <FiCalendar />
          <span>Plans</span>
        </button>
        <button className={`mnav-tab${view === 'devices' ? ' active' : ''}`} onClick={() => go('devices')}>
          <FiMonitor />
          <span>Devices</span>
        </button>
        <button className={`mnav-tab${sheetOpen ? ' active' : ''}`} onClick={() => setSheetOpen((o) => !o)}>
          <FiGrid />
          <span>Sections</span>
        </button>
      </nav>
    </>
  )
}
