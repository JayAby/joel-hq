import { useState } from 'react'
import { LinkItem } from '../types'
import Editable from './Editable'

interface Props {
  links: LinkItem[]
  onChange: (links: LinkItem[]) => void
}

export default function LinksList({ links, onChange }: Props) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  function updateName(i: number, val: string) {
    const next = links.slice()
    next[i] = { ...next[i], name: val }
    onChange(next)
  }
  function editUrl(i: number) {
    const current = links[i].url
    const next = window.prompt(`URL for "${links[i].name}"`, current || 'https://')
    if (next === null) return
    const updated = links.slice()
    updated[i] = { ...updated[i], url: next.trim() }
    onChange(updated)
  }
  function remove(i: number) {
    onChange(links.filter((_, idx) => idx !== i))
  }
  function add() {
    if (!name.trim() || !url.trim()) return
    onChange([...links, { name: name.trim(), url: url.trim() }])
    setName('')
    setUrl('')
  }

  return (
    <div>
      <div className="launch-grid">
        {links.map((l, i) => (
          <div className="launch-tile" key={i}>
            <div className="launch-tile-actions">
              <button className="del-btn" style={{ opacity: 0.7 }} onClick={() => editUrl(i)} title="Edit URL">
                ✎
              </button>
              <button className="del-btn" style={{ opacity: 0.7 }} onClick={() => remove(i)} title="Remove">
                ✕
              </button>
            </div>
            <a className="launch-open" href={l.url} target="_blank" rel="noreferrer" title={l.url}>
              ↗
            </a>
            <Editable as="span" className="launch-name" value={l.name} onChange={(v) => updateName(i, v)} />
          </div>
        ))}
      </div>
      <div className="add-row" style={{ marginTop: 10 }}>
        <input
          value={name}
          placeholder="name"
          onChange={(e) => setName(e.target.value)}
          style={{ flex: '0 0 90px' }}
        />
        <input
          value={url}
          placeholder="https://..."
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="add-btn" onClick={add}>
          add
        </button>
      </div>
    </div>
  )
}