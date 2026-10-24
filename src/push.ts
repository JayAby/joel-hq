// Phone notifications (Android app only). The app registers with Firebase Cloud
// Messaging, saves its token to Firestore, and the assistant's server sends to it.
// In a normal browser none of this runs.

import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

export const pushAvailable = () => Capacitor.isNativePlatform()

export type PushStatus = 'granted' | 'denied' | 'prompt' | 'unavailable'

let listening = false

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Stored in `events` (already readable and writable by Joel's login), so no rules change is needed.
async function saveToken(token: string) {
  if (!db || !auth) return
  await auth.authStateReady()
  if (!auth.currentUser) return
  const id = `pushToken_${(await sha256Hex(token)).slice(0, 32)}`
  await setDoc(doc(db, 'events', id), { kind: 'push-token', token, platform: 'android', updatedAt: Date.now() })
}

async function listen() {
  if (listening) return
  listening = true
  await PushNotifications.addListener('registration', (t) => {
    void saveToken(t.value).catch(() => {})
  })
  await PushNotifications.addListener('registrationError', (e) => {
    console.error('push registration failed', e)
  })
  // Tapping a notification opens the assistant.
  await PushNotifications.addListener('pushNotificationActionPerformed', () => {
    window.dispatchEvent(new Event('joelhq:open-assistant'))
  })
  try {
    await PushNotifications.createChannel({
      id: 'assistant',
      name: 'Assistant',
      description: 'Briefings, reminders and check-ins',
      importance: 4,
      visibility: 0,
    })
  } catch {
    /* channels only exist on newer Android */
  }
}

export async function pushStatus(): Promise<PushStatus> {
  if (!pushAvailable()) return 'unavailable'
  const p = await PushNotifications.checkPermissions()
  return p.receive === 'granted' ? 'granted' : p.receive === 'denied' ? 'denied' : 'prompt'
}

/** Asks for permission if needed, then registers this phone. */
export async function enablePush(): Promise<PushStatus> {
  if (!pushAvailable()) return 'unavailable'
  await listen()
  let p = await PushNotifications.checkPermissions()
  if (p.receive === 'prompt' || p.receive === 'prompt-with-rationale') p = await PushNotifications.requestPermissions()
  if (p.receive !== 'granted') return 'denied'
  await PushNotifications.register()
  return 'granted'
}

/** Call once at start: if permission was already given, quietly refresh this phone's token. */
export async function startPush(): Promise<PushStatus> {
  if (!pushAvailable()) return 'unavailable'
  const status = await pushStatus()
  if (status === 'granted') await enablePush()
  return status
}
