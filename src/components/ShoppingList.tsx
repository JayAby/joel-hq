import { useMemo, useState } from 'react'
import { ShoppingItem, SHOPPING_CATEGORY_PRESETS } from '../types'
import Editable from './Editable'
import { confirmDelete } from '../confirm'

interface Props {
  items: ShoppingItem[]
  onChange: (items: ShoppingItem[]) => void
}

export default function ShoppingList({ items, onChange }: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(SHOPPING_CATEGORY_PRESETS[0])
  const [showBought, setShowBought] = useState(false)

  const knownCategories = useMemo(() => {
    const fromItems = Array.from(new Set(items.map((i) => i.category))).filter(Boolean)
    return Array.from(new Set([...SHOPPING_CATEGORY_PRESETS, ...fromItems]))
  }, [items])

  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>()
    for (const item of items) {
      if (!showBought && item.done) continue
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return Array.from(map.entries())
  }, [items, showBought])

  function toggle(id: string) {
    onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
  }
  function editName(id: string, val: string) {
    onChange(items.map((i) => (i.id === id ? { ...i, name: val.trim() } : i)))
  }
  function remove(id: string) {
    const item = items.find((i) => i.id === id)
    if (!item || !confirmDelete(`"${item.name}"`)) return
    onChange(items.filter((i) => i.id !== id))
  }
  function add() {
    if (!name.trim()) return
    const item: ShoppingItem = {
      id: crypto.randomUUID(),
      name: name.trim(),
      category: category.trim() || 'Other',
      done: false,
      createdAt: Date.now(),
    }
    onChange([...items, item])
    setName('')
  }

  const boughtCount = items.filter((i) => i.done).length

  return (
    <div className="card accent-mint span-6">
      <div className="card-head">
        <div className="card-title">
          <span>🛒</span> Shopping List
        </div>
        {boughtCount > 0 && (
          <button className="card-link" onClick={() => setShowBought((s) => !s)}>
            {showBought ? 'hide bought' : `show bought (${boughtCount})`}
          </button>
        )}
      </div>

      {grouped.length === 0 && <div className="np-status">Nothing on the list — add something below.</div>}

      {grouped.map(([cat, catItems]) => (
        <div key={cat} style={{ marginBottom: 10 }}>
          <div className="section-label">{cat}</div>
          {catItems.map((item) => (
            <div className={`task-row${item.done ? ' done' : ''}`} key={item.id}>
              <button className="check" onClick={() => toggle(item.id)}>
                ✓
              </button>
              <Editable className="task-text" value={item.name} onChange={(v) => editName(item.id, v)} />
              <button className="del-btn" onClick={() => remove(item.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      ))}

      <div className="add-row" style={{ marginTop: 10 }}>
        <input
          value={name}
          placeholder="add an item..."
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <input
          list="shopping-categories"
          value={category}
          placeholder="category"
          onChange={(e) => setCategory(e.target.value)}
          style={{ flex: '0 0 120px' }}
        />
        <datalist id="shopping-categories">
          {knownCategories.map((c) => (
            <option value={c} key={c} />
          ))}
        </datalist>
        <button className="add-btn" onClick={add}>
          add
        </button>
      </div>
    </div>
  )
}