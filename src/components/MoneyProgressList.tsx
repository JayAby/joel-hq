import { useState } from 'react'
import { MoneyItem } from '../types'
import Editable from './Editable'
import ProgressBar from './ProgressBar'

interface Props {
  items: MoneyItem[]
  onChange: (items: MoneyItem[]) => void
  mode: 'debt' | 'savings'
  barClass?: string
}

export default function MoneyProgressList({ items, onChange, mode, barClass = '' }: Props) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')

  function update(i: number, patch: Partial<MoneyItem>) {
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
    onChange([...items, { name: name.trim(), target: t, current: 0 }])
    setName('')
    setTarget('')
  }

  return (
    <div>
      {items.map((item, i) => {
        const pct = item.target > 0 ? Math.min(100, Math.round((item.current / item.target) * 100)) : 0
        const remaining = Math.max(0, item.target - item.current)
        return (
          <div className="item" key={i}>
            <div className="item-top">
              <Editable className="item-name" value={item.name} onChange={(v) => update(i, { name: v })} />
              <button className="del-btn" style={{ opacity: 0.5 }} onClick={() => remove(i)}>
                ✕
              </button>
            </div>
            <div className="money-row">
              <span className="money-label">{mode === 'debt' ? 'paid' : 'saved'}</span>
              <input
                type="number"
                className="money-input"
                value={item.current}
                onChange={(e) => update(i, { current: Math.max(0, Number(e.target.value)) })}
              />
              <span className="money-slash">/</span>
              <span className="money-label">{mode === 'debt' ? 'owed' : 'goal'}</span>
              <input
                type="number"
                className="money-input"
                value={item.target}
                onChange={(e) => update(i, { target: Math.max(0, Number(e.target.value)) })}
              />
            </div>
            <ProgressBar value={pct} barClass={barClass} readOnly />
            <div className="money-remaining">
              {mode === 'debt'
                ? `£${remaining.toLocaleString()} left to pay`
                : `£${remaining.toLocaleString()} to go`}
            </div>
          </div>
        )
      })}
      <div className="add-row" style={{ marginTop: 8 }}>
        <input value={name} placeholder="name" onChange={(e) => setName(e.target.value)} />
        <input
          type="number"
          value={target}
          placeholder={mode === 'debt' ? 'amount owed' : 'goal amount'}
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