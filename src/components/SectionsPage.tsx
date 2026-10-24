import type { ReactNode } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { SECTION_ITEMS } from './navItems'
import './home.css'

interface Props {
  openId: string | null
  summaries: Record<string, string>
  onOpen: (id: string) => void
  onBack: () => void
  children?: ReactNode
}

/** The list of everything outside Home. Opening a row shows that section on its own. */
export default function SectionsPage({ openId, summaries, onOpen, onBack, children }: Props) {
  const open = openId ? SECTION_ITEMS.find((s) => s.id === openId) : null

  if (open) {
    return (
      <div className="sp">
        <div className="sp-top">
          <button className="sp-back" onClick={onBack} aria-label="Back to sections">
            <FiChevronLeft /> Sections
          </button>
          <h1 className="sp-title">{open.label}</h1>
        </div>
        <div className="grid section-detail">{children}</div>
      </div>
    )
  }

  return (
    <div className="sp">
      <div className="sp-top">
        <h1 className="sp-title">Sections</h1>
      </div>
      <div className="sp-list">
        {SECTION_ITEMS.map((s) => (
          <button key={s.id} className="sp-row" onClick={() => onOpen(s.id)}>
            <span className={`sp-icon tone-${s.tone}`} aria-hidden="true">
              <s.icon />
            </span>
            <span className="sp-text">
              <span className="sp-name">{s.label}</span>
              {summaries[s.id] && <span className="sp-sub">{summaries[s.id]}</span>}
            </span>
            <FiChevronRight className="sp-chev" aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="sp-note">Open a section to edit it. All the add boxes live inside, so Home stays clear.</p>
    </div>
  )
}
