import { useState } from 'react'
import { SavingsItem } from '../types'
import Editable from './Editable'
import ProgressBar from './ProgressBar'

interface Props {
  items: SavingsItem[]
  onChange: (items: SavingsItem[]) => void
  barClass?: string
}

export default function SavingsProgressList({ items, onChange, barClass = '' }: Props) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')

  function update(i: number, patch: Partial<SavingsItem>) {
    const next = items.slice()
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function add() {
    const t = Number(target)
    if (!name.trim() || !t || t <= 0) return
    onChange([...items, { name: name.trim(), target: t, saved: 0, withdrawn: 0 }])
    setName('')
    setTarget('')
  }

  const totalSaved = items.reduce((s, i) => s + i.saved, 0)
  const totalGoal = items.reduce((s, i) => s + i.target, 0)
  const totalWithdrawn = items.reduce((s, i) => s + i.withdrawn, 0)

  return (
    <div>
      {items.length > 0 && (
        <div className="money-totals">
          <span>
            £{totalSaved.toLocaleString()} <em>saved</em>
          </span>
          <span>
            £{totalGoal.toLocaleString()} <em>goal</em>
          </span>
          <span>
            £{totalWithdrawn.toLocaleString()} <em>withdrawn</em>
          </span>
        </div>
      )}
      {items.map((item, i) => {
        const pct = item.target > 0 ? Math.min(100, Math.round((item.saved / item.target) * 100)) : 0
        const remaining = Math.max(0, item.target - item.saved)
        return (
          <div className="item" key={i}>
            <div className="item-top">
              <Editable className="item-name" value={item.name} onChange={(v) => update(i, { name: v })} />
              <button className="del-btn" style={{ opacity: 0.5 }} onClick={() => remove(i)}>
                ✕
              </button>
            </div>
            <div className="money-row">
              <span className="money-label">saved</span>
              <input
                type="number"
                className="money-input"
                value={item.saved}
                onChange={(e) => update(i, { saved: Math.max(0, Number(e.target.value)) })}
              />
              <span className="money-slash">/</span>
              <span className="money-label">goal</span>
              <input
                type="number"
                className="money-input"
                value={item.target}
                onChange={(e) => update(i, { target: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <div className="money-row">
              <span className="money-label">withdrawn</span>
              <input
                type="number"
                className="money-input"
                value={item.withdrawn}
                onChange={(e) => update(i, { withdrawn: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <ProgressBar value={pct} barClass={barClass} readOnly />
            <div className="money-remaining">£{remaining.toLocaleString()} to go</div>
          </div>
        )
      })}
      <div className="add-row" style={{ marginTop: 8 }}>
        <input value={name} placeholder="name" onChange={(e) => setName(e.target.value)} />
        <input
          type="number"
          value={target}
          placeholder="goal amount"
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