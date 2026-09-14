// Thin wrapper around the browser's built-in Notification API.
// Works even when the tab is in the background, as long as it's still open.

export function notificationsSupported() {
  return 'Notification' in window
}

export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  return Notification.requestPermission()
}

export function notify(title: string, body?: string) {
  if (!notificationsSupported()) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body })
  }
}