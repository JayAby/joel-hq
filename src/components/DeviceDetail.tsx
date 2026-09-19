import Modal from './Modal'
import { DeviceDoc, ManualStatus } from '../types'
import { computeStatus, formatRelativeTime, STATUS_META, MANUAL_STATUS_META, DEVICE_TYPE_META } from '../devicePresence'

interface Props {
  device: DeviceDoc
  now: number
  isMine: boolean
  onClose: () => void
  onUpdate: (patch: Partial<DeviceDoc>) => void
  onBindThisBrowser: () => void
  onUnbind: () => void
  onRemove: () => void
}

const MANUAL_OPTIONS: ManualStatus[] = ['online', 'connected', 'offline']

export default function DeviceDetail({
  device,
  now,
  isMine,
  onClose,
  onUpdate,
  onBindThisBrowser,
  onUnbind,
  onRemove,
}: Props) {
  const meta = DEVICE_TYPE_META[device.type]
  const statusMeta =
    device.capability === 'manual'
      ? MANUAL_STATUS_META[device.manualStatus ?? 'offline']
      : STATUS_META[computeStatus(device.lastSeen, now)]

  return (
    <Modal title={`${meta.icon} ${device.name}`} onClose={onClose}>
      <div className="detail-status" style={{ color: statusMeta.cssVar }}>
        {statusMeta.dot} {statusMeta.label}
      </div>

      {device.capability === 'live' && (
        <>
          <div className="detail-row">
            <span className="detail-label">Last seen</span>
            <span>{formatRelativeTime(device.lastSeen, now)}</span>
          </div>
          {typeof device.battery === 'number' && (
            <div className="detail-row">
              <span className="detail-label">Battery</span>
              <span>🔋 {device.battery}%</span>
            </div>
          )}

          {isMine ? (
            <div className="detail-edit">
              <label className="form-label">What are you doing?</label>
              <input
                className="form-input"
                value={device.activity ?? ''}
                placeholder="e.g. Coding"
                onChange={(e) => onUpdate({ activity: e.target.value })}
              />
              <label className="form-label" style={{ marginTop: 10 }}>
                Current app
              </label>
              <input
                className="form-input"
                value={device.currentApp ?? ''}
                placeholder="e.g. VS Code"
                onChange={(e) => onUpdate({ currentApp: e.target.value })}
              />
              <label className="form-label" style={{ marginTop: 10 }}>
                Current project
              </label>
              <input
                className="form-input"
                value={device.currentProject ?? ''}
                placeholder="e.g. StudyPulse"
                onChange={(e) => onUpdate({ currentProject: e.target.value })}
              />
              <button className="pomo-btn" style={{ marginTop: 14 }} onClick={onUnbind}>
                This isn't this device anymore
              </button>
            </div>
          ) : (
            <>
              {(device.activity || device.currentApp || device.currentProject) && (
                <div className="detail-row" style={{ alignItems: 'flex-start' }}>
                  <span className="detail-label">Activity</span>
                  <span>
                    {device.activity}
                    {device.currentApp ? ` · ${device.currentApp}` : ''}
                    {device.currentProject ? ` · ${device.currentProject}` : ''}
                  </span>
                </div>
              )}
              <button className="connect-btn" style={{ marginTop: 14 }} onClick={onBindThisBrowser}>
                This is the device I'm using right now
              </button>
            </>
          )}
        </>
      )}

      {device.capability === 'manual' && (
        <div className="detail-edit">
          <label className="form-label">Set status by hand</label>
          <div className="type-grid">
            {MANUAL_OPTIONS.map((opt) => (
              <button
                key={opt}
                className={`type-btn${device.manualStatus === opt ? ' active' : ''}`}
                onClick={() => onUpdate({ manualStatus: opt })}
                type="button"
              >
                {MANUAL_STATUS_META[opt].dot} {MANUAL_STATUS_META[opt].label}
              </button>
            ))}
          </div>
          <div className="form-hint" style={{ marginTop: 10 }}>
            {device.name} can't run Joel HQ, so this status is manual, not automatically detected.
          </div>
        </div>
      )}

      {device.connections && device.connections.length > 0 && (
        <div className="detail-connections">
          <div className="form-label">Connections</div>
          {device.connections.map((c, i) => (
            <div key={i} className="connection-row">
              ↓ {c.label}
            </div>
          ))}
        </div>
      )}

      <button className="del-btn" style={{ opacity: 0.6, marginTop: 16 }} onClick={onRemove}>
        Remove this device
      </button>
    </Modal>
  )
}