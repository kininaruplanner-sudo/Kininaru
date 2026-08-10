'use client'

/**
 * Web notifications — ÉTAPE 14 §10-11.
 *
 * Permission is NEVER requested on first load: the user opts in from the
 * Coach settings, with a clear explanation first. Every notification must
 * have a reason — the coach layer above decides when (frequency + rules).
 */

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export type NotificationPermissionState =
  | NotificationPermission
  | 'unsupported'

export function getNotificationPermission(): NotificationPermissionState {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

/** Must be called from a user gesture (e.g. a button click). */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!notificationsSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/** Fires a system notification when allowed; silent no-op otherwise. */
export function browserNotify(title: string, body?: string, link?: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    const notification = new Notification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'kininaru-coach',
    })
    if (link) {
      notification.onclick = () => {
        window.focus()
        window.location.href = link
      }
    }
  } catch {
    // Notifications blocked at runtime — ignore quietly.
  }
}
