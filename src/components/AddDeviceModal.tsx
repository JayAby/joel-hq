import { useState } from 'react'
import Modal from './Modal'
import { DeviceDoc, DeviceType } from '../types'
import { DEVICE_TYPE_META } from '../devicePresence'

interface Props {
  onClose: () => void
  onCreate: (input: { name: string; type: DeviceType; capability: DeviceDoc['capability']; bindNow: boolean }) => void
}

const TYPE_OPTIONS = Object.entries(DEVICE_TYPE_META) as [DeviceType, { label: string; icon: string }][]

export default function AddDeviceModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<DeviceType>('laptop')
  const [bindNow, setBindNow] = useState(true)

  const capability: DeviceDoc['capability'] = type === 'tv' || type === 'other' ? 'manual' : 'live'

  function submit() {
    if (!name.trim()) return
    onCreate({ name: name.trim(), type, capability, bindNow: capability === 'live' && bindNow })
  }

  return (
    <Modal title="Add Device" onClose={onClose}>
      <label className="form-label">Name</label>
      <input
        className="form-input"
        value={name}
        placeholder="e.g. Joel's MacBook"
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />

      <label className="form-label" style={{ marginTop: 14 }}>
        Type
      </label>
      <div className="type-grid">
        {TYPE_OPTIONS.map(([key, meta]) => (
          <button
            key={key}
            className={`type-btn${type === key ? ' active' : ''}`}
            onClick={() => setType(key)}
            type="button"
          >
            <span className="type-btn-icon">{meta.icon}</span>
            {meta.label}
          </button>
        ))}
      </div>

      {capability === 'live' ? (
        <label className="checkbox-row" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={bindNow} onChange={(e) => setBindNow(e.target.checked)} />
          This is the device I'm using right now
        </label>
      ) : (
        <div className="form-hint" style={{ marginTop: 14 }}>
          {DEVICE_TYPE_META[type].label} devices can't run Joel HQ, so you'll set their status by hand from the
          device detail view.
        </div>
      )}

      <button className="connect-btn" style={{ marginTop: 18 }} onClick={submit}>
        Add device
      </button>
    </Modal>
  )
}