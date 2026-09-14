import { ProgressItem } from '../types'
import Editable from './Editable'
import DragPct from './DragPct'

interface Props {
  items: ProgressItem[]
  onChange: (items: ProgressItem[]) => void
  barClass?: string
  showSub?: boolean
}

export default function ProgressList({ items, onChange, barClass = '', showSub = true }: Props) {
  function update(i: number, patch: Partial<ProgressItem>) {
    const next = items.slice()
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  return (
    <div>
      {items.map((item, i) => (
        <div className="item" key={i}>
          <div className="item-top">
            <Editable
              className="item-name"
              value={item.name}
              onChange={(v) => update(i, { name: v })}
            />
            <DragPct value={item.pct} onChange={(v) => update(i, { pct: v })} />
          </div>
          {showSub && (
            <Editable
              className="item-sub"
              value={item.sub ?? ''}
              onChange={(v) => update(i, { sub: v })}
            />
          )}
          <div className="pbar-track">
            <div className={`pbar-fill ${barClass}`} style={{ width: `${item.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
