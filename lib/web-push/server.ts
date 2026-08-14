import webpush from 'web-push'

/**
 * Server-side Web Push helpers (ÉTAPE 15.5 §9).
 *
 * VAPID keys live ONLY in server env vars:
 *   NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY  (safe to expose — public)
 *   WEB_PUSH_VAPID_PRIVATE_KEY             (secret — server only)
 *   WEB_PUSH_SUBJECT                       (contact, e.g. mailto:admin@…)
 *
 * Without these keys the app still works — push simply reports as
 * "not configured" and the UI tells the user what to set.
 */

export interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth_key: string
  prefs?: Record<string, unknown> | null
}

/** True when the VAPID key pair is configured server-side. */
export function webPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  )
}

/** Public key the browser needs to subscribe (null when unconfigured). */
export function getPublicVapidKey(): string | null {
  return process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? null
}

function buildWebPush(): typeof webpush {
  const pub = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
  const priv = process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  if (!pub || !priv) {
    throw new Error(
      'Web Push non configuré : définissez NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ' +
        'et WEB_PUSH_VAPID_PRIVATE_KEY.'
    )
  }
  const subject = process.env.WEB_PUSH_SUBJECT ?? 'mailto:admin@kininaru.app'
  webpush.setVapidDetails(subject, pub, priv)
  return webpush
}

export interface PushAction {
  action: string
  title: string
}

export interface PushPayload {
  title: string
  body?: string
  link?: string
  tag?: string
  /** Notification action buttons (shown by the OS, handled by the SW). */
  actions?: PushAction[]
  /** Vibrate pattern (ms) when the platform allows it. */
  vibrate?: number[]
  /** Keep the notification on screen until the user interacts. */
  requireInteraction?: boolean
}

/**
 * Action buttons for a notification, derived from its deep link.
 * - Focus links (/focus?taskId=…) get the two actions that matter:
 *   ▶ Commencer (navigates to the pre-filled Focus) and Plus tard (close).
 * - Everything else gets a simple Ouvrir.
 * Kept deliberately small: Web Push payloads are capped at ~4 KB.
 */
export function buildActionsForLink(link?: string): PushAction[] | undefined {
  if (!link) return undefined
  if (link.startsWith('/focus')) {
    return [
      { action: 'start', title: '▶ Commencer' },
      { action: 'later', title: 'Plus tard' },
    ]
  }
  return [{ action: 'open', title: 'Ouvrir' }]
}

/**
 * Sends a push notification to one subscription.
 * Returns 'sent' | 'gone' (subscription dead — caller should delete it) |
 * 'error' (transient — retry later).
 */
export async function sendPushNotification(
  row: PushSubscriptionRow,
  payload: PushPayload
): Promise<'sent' | 'gone' | 'error'> {
  try {
    const w = buildWebPush()
    await w.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth_key },
      },
      JSON.stringify(payload),
      // Briefs must not pile up for days in the push service.
      { TTL: 24 * 3600 }
    )
    return 'sent'
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    if (statusCode === 404 || statusCode === 410) return 'gone'
    return 'error'
  }
}

/** Quiet-hours check (device-independent, applied server-side too). */
export function isQuietHours(now = new Date(), quietStart = 22, quietEnd = 7): boolean {
  const h = now.getHours()
  if (quietStart < quietEnd) return h >= quietStart && h < quietEnd
  // overnight range (e.g. 22 → 7)
  return h >= quietStart || h < quietEnd
}

export type PushFrequency = 'low' | 'normal' | 'high'

/**
 * Daily push cap per frequency level (ÉTAPE 16 §3): the proactive coach
 * briefs (smart reminders) are capped so the user is never spammed. The
 * morning / evening / weekly scheduled briefs are NOT part of this cap —
 * they are opt-in types on their own.
 */
export const PUSH_DAILY_CAP: Record<PushFrequency, number> = {
  low: 3,
  normal: 6,
  high: 10,
}

/** Parses + sanitizes the user push prefs stored on a subscription row. */
export function parsePushPrefs(raw: unknown): {
  morning: boolean
  evening: boolean
  weekly: boolean
  coach: boolean
  frequency: PushFrequency
  quietStart: number
  quietEnd: number
} {
  const r = (raw ?? {}) as Record<string, unknown>
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(23, Math.round(v))) : fallback
  const freq =
    r.frequency === 'low' || r.frequency === 'normal' || r.frequency === 'high'
      ? (r.frequency as PushFrequency)
      : 'normal'
  return {
    morning: r.morning !== false,
    evening: r.evening !== false,
    weekly: r.weekly !== false,
    coach: r.coach !== false,
    frequency: freq,
    quietStart: num(r.quietStart, 22),
    quietEnd: num(r.quietEnd, 7),
  }
}
