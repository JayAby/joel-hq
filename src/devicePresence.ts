import { DeviceType, PresenceStatus } from './types'

export const PRESENCE_THRESHOLDS = {
  activeMs: 30_000,
  idleMs: 5 * 60_000,
  awayMs: 15 * 60_000,
}

export const HEARTBEAT_INTERVAL_MS = 20_000

export function computeStatus(lastSeen: number | undefined, now: number): PresenceStatus {
  if (!lastSeen) return 'offline'
  const diff = now - lastSeen
  if (diff <= PRESENCE_THRESHOLDS.activeMs) return 'active'
  if (diff <= PRESENCE_THRESHOLDS.idleMs) return 'idle'
  if (diff <= PRESENCE_THRESHOLDS.awayMs) return 'away'
  return 'offline'
}

export function formatRelativeTime(ts: number | undefined, now: number): string {
  if (!ts) return 'never'
  const diffSec = Math.max(0, Math.round((now - ts) / 1000))
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

export const STATUS_META: Record<PresenceStatus, { label: string; dot: string; cssVar: string }> = {
  active: { label: 'Active', dot: '🟢', cssVar: 'var(--mint)' },
  idle: { label: 'Idle', dot: '🟡', cssVar: 'var(--amber)' },
  away: { label: 'Away', dot: '🟠', cssVar: '#e08a3a' },
  offline: { label: 'Offline', dot: '⚪', cssVar: 'var(--dim)' },
}

export const MANUAL_STATUS_META: Record<'online' | 'offline' | 'connected', { label: string; dot: string; cssVar: string }> = {
  online: { label: 'Online', dot: '🟢', cssVar: 'var(--mint)' },
  connected: { label: 'Connected', dot: '🟢', cssVar: 'var(--mint)' },
  offline: { label: 'Offline', dot: '⚪', cssVar: 'var(--dim)' },
}

export const DEVICE_TYPE_META: Record<DeviceType, { label: string; icon: string }> = {
  laptop: { label: 'Laptop', icon: '💻' },
  desktop: { label: 'Desktop', icon: '🖥️' },
  phone: { label: 'Phone', icon: '📱' },
  tablet: { label: 'Tablet', icon: '📓' },
  tv: { label: 'TV', icon: '📺' },
  other: { label: 'Other', icon: '🔌' },
}