/**
 * Kininaru Assistant — Notification History
 *
 * Tracks notification history for:
 * - Duplicate prevention
 * - Daily limit enforcement
 * - Cooldown management
 * - User feedback collection
 *
 * Storage: localStorage (device-local, privacy-first)
 */

import type {
  KininaruNotification,
  NotificationType,
  NotificationConfig,
} from './types'

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const HISTORY_KEY = 'kininaru-notification-history'
const MAX_HISTORY = 100
const MAX_HISTORY_DAYS = 30

interface NotificationHistoryEntry {
  id: string
  type: NotificationType
  createdAt: number
  read: boolean
  feedback?: 'useful' | 'not_useful'
  /** For duplicate detection: hash of type + key content */
  fingerprint: string
}

/* ------------------------------------------------------------------ */
/* Read / Write                                                        */
/* ------------------------------------------------------------------ */

function readHistory(): NotificationHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // Filter out entries older than MAX_HISTORY_DAYS
    const cutoff = Date.now() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000
    return parsed.filter(
      (e: NotificationHistoryEntry) => e.createdAt > cutoff
    )
  } catch {
    return []
  }
}

function writeHistory(entries: NotificationHistoryEntry[]) {
  try {
    // Keep only the most recent MAX_HISTORY entries
    const trimmed = entries.slice(-MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
  } catch {
    // storage unavailable
  }
}

/* ------------------------------------------------------------------ */
/* Fingerprint                                                         */
/* ------------------------------------------------------------------ */

/**
 * Creates a fingerprint for duplicate detection.
 * Uses type + a content hash (title + key metadata).
 */
export function createFingerprint(
  type: NotificationType,
  content: { title: string; metadata?: Record<string, string> }
): string {
  const key = `${type}:${content.title}:${JSON.stringify(content.metadata ?? {})}`
  // Simple hash — good enough for dedup, not cryptographic
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return `fp-${Math.abs(hash).toString(36)}`
}

/* ------------------------------------------------------------------ */
/* Duplicate Detection                                                 */
/* ------------------------------------------------------------------ */

/**
 * Checks if a notification is a duplicate of a recent one.
 */
export function isDuplicate(
  notification: KininaruNotification,
  cooldownMinutes: number
): boolean {
  const history = readHistory()
  const fingerprint = createFingerprint(notification.type, {
    title: notification.title,
    metadata: notification.metadata,
  })

  const cutoff = Date.now() - cooldownMinutes * 60_000

  return history.some(
    entry =>
      entry.fingerprint === fingerprint &&
      entry.createdAt > cutoff
  )
}

/* ------------------------------------------------------------------ */
/* Daily Limit                                                         */
/* ------------------------------------------------------------------ */

/**
 * Gets the count of notifications shown today.
 */
export function getTodayCount(): number {
  const history = readHistory()
  const todayStart = getTodayStart()
  return history.filter(e => e.createdAt >= todayStart).length
}

/**
 * Checks if the daily limit has been reached.
 */
export function isDailyLimitReached(dailyLimit: number): boolean {
  return getTodayCount() >= dailyLimit
}

/* ------------------------------------------------------------------ */
/* Cooldown                                                            */
/* ------------------------------------------------------------------ */

/**
 * Gets the last time a notification of this type was shown.
 */
export function getLastShownTime(type: NotificationType): number {
  const history = readHistory()
  const entries = history.filter(e => e.type === type)
  if (entries.length === 0) return 0
  return Math.max(...entries.map(e => e.createdAt))
}

/**
 * Checks if a notification type is in cooldown.
 */
export function isInCooldown(type: NotificationType, cooldownMinutes: number): boolean {
  const lastShown = getLastShownTime(type)
  const cooldownMs = cooldownMinutes * 60_000
  return Date.now() - lastShown < cooldownMs
}

/* ------------------------------------------------------------------ */
/* Gap Check                                                           */
/* ------------------------------------------------------------------ */

/**
 * Gets the time since the last notification of any type.
 */
export function getTimeSinceLastNotification(): number {
  const history = readHistory()
  if (history.length === 0) return Infinity
  const lastTime = Math.max(...history.map(e => e.createdAt))
  return Date.now() - lastTime
}

/* ------------------------------------------------------------------ */
/* Recording                                                           */
/* ------------------------------------------------------------------ */

/**
 * Records that a notification was shown.
 */
export function recordNotificationShown(notification: KininaruNotification) {
  const history = readHistory()
  const fingerprint = createFingerprint(notification.type, {
    title: notification.title,
    metadata: notification.metadata,
  })

  history.push({
    id: notification.id,
    type: notification.type,
    createdAt: notification.createdAt,
    read: notification.read,
    feedback: notification.feedback,
    fingerprint,
  })

  writeHistory(history)
}

/**
 * Marks a notification as read.
 */
export function markAsRead(notificationId: string) {
  const history = readHistory()
  const entry = history.find(e => e.id === notificationId)
  if (entry) {
    entry.read = true
    writeHistory(history)
  }
}

/**
 * Records user feedback on a notification.
 */
export function recordFeedback(
  notificationId: string,
  feedback: 'useful' | 'not_useful'
) {
  const history = readHistory()
  const entry = history.find(e => e.id === notificationId)
  if (entry) {
    entry.feedback = feedback
    writeHistory(history)
  }
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export interface NotificationStats {
  totalShown: number
  todayShown: number
  readRate: number
  usefulRate: number
  byType: Record<string, number>
}

/**
 * Gets notification statistics.
 */
export function getNotificationStats(): NotificationStats {
  const history = readHistory()
  const todayStart = getTodayStart()
  const todayEntries = history.filter(e => e.createdAt >= todayStart)

  const totalRead = history.filter(e => e.read).length
  const totalFeedback = history.filter(e => e.feedback)
  const usefulFeedback = totalFeedback.filter(e => e.feedback === 'useful').length

  const byType: Record<string, number> = {}
  for (const entry of history) {
    byType[entry.type] = (byType[entry.type] ?? 0) + 1
  }

  return {
    totalShown: history.length,
    todayShown: todayEntries.length,
    readRate: history.length > 0 ? totalRead / history.length : 0,
    usefulRate: totalFeedback.length > 0 ? usefulFeedback / totalFeedback.length : 0,
    byType,
  }
}

/**
 * Clears all notification history.
 */
export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // storage unavailable
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getTodayStart(): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

/**
 * Checks if we're in quiet hours.
 */
export function isInQuietHours(config: NotificationConfig): boolean {
  const hour = new Date().getHours()
  const { start, end } = config.quietHours

  if (start > end) {
    // Spans midnight (e.g., 22 → 7)
    return hour >= start || hour < end
  }
  // Same day (e.g., 23 → 6)
  return hour >= start && hour < end
}
