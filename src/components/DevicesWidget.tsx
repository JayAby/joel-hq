import { DeviceDoc } from '../types'
import DeviceRow from './DeviceRow'

interface Props {
  devices: DeviceDoc[]
  now: number
  onOpenDevice: (id: string) => void
  onViewAll: () => void
}

export default function DevicesWidget({ devices, now, onOpenDevice, onViewAll }: Props) {
  const shown = devices.slice(0, 5)

  return (
    <div className="card accent-violet span-4">
      <div className="card-head">
        <div className="card-title">
          <span>🖥️</span> My Devices
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="np-status">No devices registered yet.</div>
      ) : (
        shown.map((d) => <DeviceRow key={d.id} device={d} now={now} onClick={() => onOpenDevice(d.id)} />)
      )}
      <button className="card-link" style={{ marginTop: 10 }} onClick={onViewAll}>
        View all devices →
      </button>
    </div>
  )
}