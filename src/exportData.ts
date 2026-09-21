import { DashboardState, DeviceDoc, HistoryEntry } from './types'

export function exportData(
  state: DashboardState,
  devices: DeviceDoc[],
  history: HistoryEntry[],
) {
  const payload = {
    exportedAt: new Date().toISOString(),
    dashboard: state,
    devices,
    history,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `joel-hq-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}