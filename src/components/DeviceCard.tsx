import { DeviceDoc } from '../types'
import { computeStatus, formatRelativeTime, STATUS_META, MANUAL_STATUS_META, DEVICE_TYPE_META } from '../devicePresence'

interface Props {
  device: DeviceDoc
  now: number
  isMine: boolean
  onClick: () => void
}

export default function DeviceCard({ device, now, isMine, onClick }: Props) {
  const meta = DEVICE_TYPE_META[device.type]

  const statusMeta =
    device.capability === 'manual'
      ? MANUAL_STATUS_META[device.manualStatus ?? 'offline']
      : STATUS_META[computeStatus(device.lastSeen, now)]

  return (
    <div className="device-card" onClick={onClick}>
      <div className="device-card-top">
        <span className="device-card-icon">{meta.icon}</span>
        {isMine && <span className="device-card-mine">this device</span>}
      </div>
      <div className="device-card-name">{device.name}</div>
      <div className="device-card-status" style={{ color: statusMeta.cssVar }}>
        {statusMeta.dot} {statusMeta.label}
      </div>
      {device.capability === 'live' && device.activity && (
        <div className="device-card-activity">
          {device.activity}
          {device.currentApp ? ` · ${device.currentApp}` : ''}
        </div>
      )}
      {device.capability === 'live' && (
        <div className="device-card-lastseen">Last seen {formatRelativeTime(device.lastSeen, now)}</div>
      )}
      {typeof device.battery === 'number' && (
        <div className="device-card-battery">🔋 {device.battery}%</div>
      )}
    </div>
  )
}