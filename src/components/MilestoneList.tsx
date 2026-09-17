import { MilestoneItem } from '../types'
import Editable from './Editable'
import ProgressBar from './ProgressBar'
import SubtaskChecklist from './SubtaskChecklist'

interface Props {
  items: MilestoneItem[]
  onChange: (items: MilestoneItem[]) => void
  barClass?: string
  showSub?: boolean
}

function pctOf(subtasks: MilestoneItem['subtasks']) {
  if (!subtasks.length) return 0
  return Math.round((subtasks.filter((s) => s.done).length / subtasks.length) * 100)
}

export default function MilestoneList({ items, onChange, barClass = '', showSub = true }: Props) {
  function update(i: number, patch: Partial<MilestoneItem>) {
    const next = items.slice()
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      {items.map((item, i) => (
        <div className="item" key={i}>
          <div className="item-top">
            <Editable className="item-name" value={item.name} onChange={(v) => update(i, { name: v })} />
            <button className="del-btn" style={{ opacity: 0.5 }} onClick={() => remove(i)}>
              ✕
            </button>
          </div>
          {showSub && (
            <Editable className="item-sub" value={item.sub ?? ''} onChange={(v) => update(i, { sub: v })} />
          )}
          <ProgressBar value={pctOf(item.subtasks)} barClass={barClass} readOnly />
          <SubtaskChecklist items={item.subtasks} onChange={(subtasks) => update(i, { subtasks })} />
        </div>
      ))}
    </div>
  )
}