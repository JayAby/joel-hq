import { useState } from 'react'
import { DeviceDoc, DeviceType } from '../types'
import DeviceCard from './DeviceCard'
import AddDeviceModal from './AddDeviceModal'
import DeviceDetail from './DeviceDetail'

interface Props {
  devices: DeviceDoc[]
  now: number
  myDeviceId: string | null
  onBack: () => void
  onAddDevice: (input: {
    name: string
    type: DeviceType
    capability: DeviceDoc['capability']
    bindNow: boolean
  }) => Promise<string>
  onUpdateDevice: (id: string, patch: Partial<DeviceDoc>) => void
  onRemoveDevice: (id: string) => void
  onBind: (id: string) => void
  onUnbind: () => void
  initialOpenId?: string | null
}

export default function DevicesPage({
  devices,
  now,
  myDeviceId,
  onBack,
  onAddDevice,
  onUpdateDevice,
  onRemoveDevice,
  onBind,
  onUnbind,
  initialOpenId,
}: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null)

  const openDevice = devices.find((d) => d.id === openId) ?? null

  return (
    <div className="page">
      <div className="devices-header">
        <button className="card-link" onClick={onBack}>
          ← Back to dashboard
        </button>
        <div className="devices-title">
          <span>🖥️</span> Device Hub
        </div>
        <button className="add-btn" onClick={() => setShowAdd(true)}>
          + Add device
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="np-status" style={{ marginTop: 20 }}>
          No devices yet — add the one you're using right now to get started.
        </div>
      ) : (
        <div className="device-grid">
          {devices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              now={now}
              isMine={d.id === myDeviceId}
              onClick={() => setOpenId(d.id)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddDeviceModal
          onClose={() => setShowAdd(false)}
          onCreate={async (input) => {
            setShowAdd(false)
            const id = await onAddDevice(input)
            if (input.bindNow && id) onBind(id)
          }}
        />
      )}

      {openDevice && (
        <DeviceDetail
          device={openDevice}
          now={now}
          isMine={openDevice.id === myDeviceId}
          onClose={() => setOpenId(null)}
          onUpdate={(patch) => onUpdateDevice(openDevice.id, patch)}
          onBindThisBrowser={() => onBind(openDevice.id)}
          onUnbind={onUnbind}
          onRemove={() => {
            onRemoveDevice(openDevice.id)
            setOpenId(null)
          }}
        />
      )}
    </div>
  )
}