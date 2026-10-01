import { useState } from 'react'
import { MoneyItem } from '../types'
import Editable from './Editable'
import ProgressBar from './ProgressBar'
import { confirmDelete } from '../confirm'

const AVATAR_COLORS = ['#5eead4', '#f2a154', '#f2718c', '#a78bfa', '#60a5fa', '#34d399']
function avatarColorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

interface Props {
  items: MoneyItem[]
  onChange: (items: MoneyItem[]) => void
  barClass?: string
}

export default function MoneyProgressList({ items, onChange, barClass = '' }: Props) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')

  function update(i: number, patch: Partial<MoneyItem>) {
    const next = items.slice()
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  function remove(i: number) {
    if (!confirmDelete(`"${items[i].name}"`)) return
    onChange(items.filter((_, idx) => idx !== i))
  }
  function add() {
    const t = Number(target)
    if (!name.trim() || !t || t <= 0) return
    onChange([...items, { name: name.trim(), target: t, current: 0 }])
    setName('')
    setTarget('')
  }

  const totalOwed = items.reduce((s, i) => s + i.target, 0)
  const totalPaid = items.reduce((s, i) => s + i.current, 0)
  const totalLeft = Math.max(0, totalOwed - totalPaid)

  return (
    <div>
      {items.length > 0 && (
        <div className="money-totals">
          <span>
            £{totalOwed.toLocaleString()} <em>owed</em>
          </span>
          <span>
            £{totalPaid.toLocaleString()} <em>paid</em>
          </span>
          <span>
            £{totalLeft.toLocaleString()} <em>left</em>
          </span>
        </div>
      )}
      {items.map((item, i) => {
        const pct = item.target > 0 ? Math.min(100, Math.round((item.current / item.target) * 100)) : 0
        const remaining = Math.max(0, item.target - item.current)
        return (
          <div className="item" key={i}>
            <div className="item-top">
              <span className="money-avatar" style={{ background: avatarColorFor(item.name) }}>
                {item.name.trim().charAt(0).toUpperCase() || '£'}
              </span>
              <Editable className="item-name" value={item.name} onChange={(v) => update(i, { name: v })} />
              <button className="del-btn" style={{ opacity: 0.5 }} onClick={() => remove(i)}>
                ✕
              </button>
            </div>
            <div className="money-row">
              <span className="money-label">paid</span>
              <input
                type="number"
                className="money-input"
                value={item.current}
                onChange={(e) => update(i, { current: Math.max(0, Number(e.target.value)) })}
              />
              <span className="money-slash">/</span>
              <span className="money-label">owed</span>
              <input
                type="number"
                className="money-input"
                value={item.target}
                onChange={(e) => update(i, { target: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <ProgressBar value={pct} barClass={barClass} readOnly />
            <div className="money-remaining">£{remaining.toLocaleString()} left to pay</div>
          </div>
        )
      })}
      <div className="add-row" style={{ marginTop: 8 }}>
        <input value={name} placeholder="name" onChange={(e) => setName(e.target.value)} />
        <input
          type="number"
          value={target}
          placeholder="amount owed"
          onChange={(e) => setTarget(e.target.value)}
          style={{ flex: '0 0 110px' }}
        />
        <button className="add-btn" onClick={add}>
          add
        </button>
      </div>
    </div>
  )
}