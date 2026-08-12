'use client'

/**
 * Client-side Web Push helpers (ÉTAPE 15.5 §9-10).
 *
 * - Permission is ONLY ever requested from an explicit user gesture (the
 *   Settings → Notifications panel) — never on first load.
 * - The subscription is stored server-side (push_subscriptions, RLS) so the
 *   server / cron can send real Web Push even when the app is closed.
 * - All operations are best-effort and never break the app.
 */

export type PushFrequency = 'low' | 'normal' | 'high'

export interface PushPrefs {
  morning: boolean
  evening: boolean
  weekly: boolean
  coach: boolean
  /** How many proactive push briefs per day: low / normal / high. */
  frequency: PushFrequency
  quietStart: number
  quietEnd: number
}

export const DEFAULT_PUSH_PREFS: PushPrefs = {
  morning: true,
  evening: true,
  weekly: true,
  coach: true,
  frequency: 'normal',
  quietStart: 22,
  quietEnd: 7,
}

const ENABLED_KEY = 'kininaru-push-enabled'

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isPushEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

function setEnabled(v: boolean) {
  try {
    if (v) localStorage.setItem(ENABLED_KEY, '1')
    else localStorage.removeItem(ENABLED_KEY)
  } catch {
    // storage unavailable
  }
}

export interface PushConfig {
  supported: boolean
  enabled: boolean
  vapidPublicKey: string | null
}

export async function fetchPushConfig(): Promise<PushConfig> {
  try {
    const res = await fetch('/api/push/config', { cache: 'no-store' })
    if (!res.ok) return { supported: false, enabled: false, vapidPublicKey: null }
    const d = (await res.json()) as PushConfig
    return d
  } catch {
    return { supported: false, enabled: false, vapidPublicKey: null }
  }
}

/** Base64url (VAPID) → Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/** Subscribes (or re-registers) this device for Web Push. User gesture required. */
export async function subscribePush(prefs: PushPrefs): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!pushSupported()) return { ok: false, error: 'unsupported' }
    const config = await fetchPushConfig()
    if (!config.enabled || !config.vapidPublicKey) {
      return { ok: false, error: 'not-configured' }
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, error: 'permission-denied' }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
      })
    }
    const subJson = sub.toJSON()
    const keys = subJson.keys ?? { p256dh: '', auth: '' }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys,
        prefs,
      }),
    })
    if (!res.ok) return { ok: false, error: 'server' }
    setEnabled(true)
    return { ok: true }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}

/** Unsubscribes this device (browser + server row). */
export async function unsubscribePush(): Promise<{ ok: boolean }> {
  try {
    if (!pushSupported()) return { ok: true }
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      try {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
      } catch {
        // Server row cleanup is best-effort; the browser unsubscribe below
        // is the important part.
      }
      await sub.unsubscribe()
    }
    setEnabled(false)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/** Sends an explicit test notification (user gesture — bypasses quiet hours). */
export async function sendTestPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Kininaru — push activé ✔',
        body: 'Les notifications Web Push fonctionnent sur cet appareil.',
        link: '/dashboard',
        kind: 'test',
      }),
    })
    if (!res.ok) return { ok: false, error: 'server' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}
