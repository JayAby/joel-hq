import { DeviceDoc } from '../types'
import { computeStatus, STATUS_META, MANUAL_STATUS_META, DEVICE_TYPE_META } from '../devicePresence'

interface Props {
  device: DeviceDoc
  now: number
  onClick: () => void
}

export default function DeviceRow({ device, now, onClick }: Props) {
  const meta = DEVICE_TYPE_META[device.type]

  let dot: string
  let secondary: string
  if (device.capability === 'manual') {
    const m = MANUAL_STATUS_META[device.manualStatus ?? 'offline']
    dot = m.dot
    secondary = m.label
  } else {
    const status = computeStatus(device.lastSeen, now)
    const m = STATUS_META[status]
    dot = m.dot
    secondary = device.activity || m.label
  }

  return (
    <div className="device-row" onClick={onClick}>
      <span className="device-row-dot">{dot}</span>
      <span className="device-row-icon">{meta.icon}</span>
      <span className="device-row-name">{device.name}</span>
      <span className="device-row-secondary">{secondary}</span>
    </div>
  )
}