// The focus timer. One timer at a time, kept in localStorage so it survives a refresh.
// It stores the END time, not a countdown, so it stays right if the screen is off.
// In the Android app it also shows an ongoing notification and schedules a "time is up" one.

import { useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export interface FocusTimer {
  label: string
  minutes: number
  startedAt: number
  endsAt: number
  taskId?: string
  /** Set once the time ran out and we asked "did you finish?" */
  ended: boolean
}

const KEY = 'joelhq-timer'
const ONGOING_ID = 7001
const END_ID = 7002
let current: FocusTimer | null = read()
const listeners = new Set<() => void>()

function read(): FocusTimer | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as FocusTimer
    return typeof t.endsAt === 'number' && typeof t.label === 'string' ? t : null
  } catch {
    return null
  }
}

function set(t: FocusTimer | null) {
  current = t
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t))
    else localStorage.removeItem(KEY)
  } catch {
    /* the timer still works until the page closes */
  }
  listeners.forEach((l) => l())
}

export function useFocusTimer(): FocusTimer | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

export const getTimer = () => current
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// ---- Android notifications (no-ops in a browser) -----------------------------

const native = () => Capacitor.isNativePlatform()

async function showNative(t: FocusTimer) {
  if (!native()) return
  try {
    let p = await LocalNotifications.checkPermissions()
    if (p.display === 'prompt' || p.display === 'prompt-with-rationale') p = await LocalNotifications.requestPermissions()
    if (p.display !== 'granted') return
    await LocalNotifications.createChannel({ id: 'timer', name: 'Focus timer', description: 'Shows while a focus timer runs', importance: 2, visibility: 1 })
    await LocalNotifications.createChannel({ id: 'timer-end', name: 'Timer finished', description: 'When a focus timer runs out', importance: 4, visibility: 1 })
    await LocalNotifications.registerActionTypes({
      types: [{ id: 'TIMER_END', actions: [{ id: 'done', title: 'Done' }, { id: 'more', title: '30 min more' }] }],
    })
    await LocalNotifications.cancel({ notifications: [{ id: ONGOING_ID }, { id: END_ID }] })
    await LocalNotifications.schedule({
      notifications: [
        { id: ONGOING_ID, title: `Focus: ${t.label}`, body: `Until ${hhmm(t.endsAt)}. Tap to open.`, ongoing: true, autoCancel: false, channelId: 'timer' },
        { id: END_ID, title: 'Time is up', body: `${t.label}. Did you finish?`, channelId: 'timer-end', actionTypeId: 'TIMER_END', schedule: { at: new Date(t.endsAt), allowWhileIdle: true } },
      ],
    })
  } catch (e) {
    console.error('timer notification failed', e)
  }
}

async function clearNative(ids: number[]) {
  if (!native()) return
  try {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) })
  } catch {
    /* nothing to clear */
  }
}

/** Phone buttons on the "time is up" notification. Call once at start. */
export async function listenForTimerActions(onAction: (id: 'done' | 'more' | 'open') => void) {
  if (!native()) return
  await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    if (e.notification.id !== END_ID && e.notification.id !== ONGOING_ID) return
    onAction(e.actionId === 'done' ? 'done' : e.actionId === 'more' ? 'more' : 'open')
  })
}

// ---- controls ---------------------------------------------------------------

export function startTimer(opts: { label: string; minutes: number; taskId?: string }) {
  const minutes = Math.max(1, Math.min(240, Math.round(opts.minutes)))
  const now = Date.now()
  const t: FocusTimer = { label: opts.label.trim().slice(0, 80) || 'Focus', minutes, startedAt: now, endsAt: now + minutes * 60_000, taskId: opts.taskId, ended: false }
  set(t)
  void showNative(t)
}

export function extendTimer(minutes: number) {
  if (!current) return
  const t: FocusTimer = { ...current, endsAt: Math.max(Date.now(), current.endsAt) + minutes * 60_000, ended: false }
  set(t)
  void showNative(t)
}

export function markEnded() {
  if (!current || current.ended) return
  set({ ...current, ended: true })
  void clearNative([ONGOING_ID])
}

export function stopTimer() {
  set(null)
  void clearNative([ONGOING_ID, END_ID])
}
