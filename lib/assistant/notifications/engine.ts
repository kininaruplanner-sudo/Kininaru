/**
 * Kininaru Assistant — Notification Engine
 *
 * Main entry point for the notification system.
 * Combines opportunity detection (Phase 3) with the new notification
 * planner, history, and channel system.
 *
 * Flow:
 * 1. Detect opportunities from user data (Phase 3)
 * 2. Convert to notifications
 * 3. Apply intervention rules
 * 4. Select best notification
 * 5. Record in history
 * 6. Return for delivery
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  KininaruNotification,
  NotificationConfig,
} from './types'
import { DEFAULT_NOTIFICATION_CONFIG } from './types'
import { detectOpportunities } from '../proactivity'
import {
  shouldNotify,
  opportunityToNotification,
  evaluateOpportunities,
} from './planner'
import {
  recordNotificationShown,
  isDailyLimitReached,
  getTodayCount,
  getNotificationStats,
} from './history'

/* ------------------------------------------------------------------ */
/* Configuration Storage                                               */
/* ------------------------------------------------------------------ */

const CONFIG_KEY = 'kininaru-notification-config'

function loadConfig(): NotificationConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return DEFAULT_NOTIFICATION_CONFIG
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_NOTIFICATION_CONFIG, ...parsed }
  } catch {
    return DEFAULT_NOTIFICATION_CONFIG
  }
}

function saveConfig(config: NotificationConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    // storage unavailable
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Gets the best notification for the user right now.
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - Current user ID
 * @returns The best notification, or null if none should be shown
 */
export async function getBestNotification(
  supabase: SupabaseClient,
  userId: string
): Promise<KininaruNotification | null> {
  const config = loadConfig()

  if (!config.enabled) return null

  try {
    // 1. Detect opportunities (Phase 3)
    const opportunities = await detectOpportunities(supabase, userId)

    // 2. Evaluate against notification rules
    const notification = evaluateOpportunities(opportunities, config)

    // 3. Record if we have a winner
    if (notification) {
      recordNotificationShown(notification)
    }

    return notification
  } catch (err) {
    console.error('[Kininaru] Notification engine failed:', err)
    return null
  }
}

/**
 * Creates a notification directly (for system events like briefs).
 */
export function createNotification(
  type: KininaruNotification['type'],
  title: string,
  message: string,
  options?: {
    priority?: KininaruNotification['priority']
    actionLabel?: string
    actionTarget?: string
    metadata?: Record<string, string>
  }
): KininaruNotification | null {
  const config = loadConfig()
  const priority = options?.priority ?? 'medium'

  // Check if we should show this
  const decision = shouldNotify(type, {
    config,
    priorityOverride: priority,
    metadata: options?.metadata,
  })

  if (!decision.shouldNotify) {
    return null
  }

  const notification: KininaruNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    priority,
    title,
    message,
    actionLabel: options?.actionLabel,
    actionTarget: options?.actionTarget,
    metadata: options?.metadata,
    channels: decision.channels ?? ['in_app'],
    createdAt: Date.now(),
    read: false,
  }

  recordNotificationShown(notification)
  return notification
}

/**
 * Gets notification status summary.
 */
export function getNotificationStatus(): {
  enabled: boolean
  todayCount: number
  dailyLimit: number
  stats: ReturnType<typeof getNotificationStats>
  config: NotificationConfig
} {
  const config = loadConfig()
  return {
    enabled: config.enabled,
    todayCount: getTodayCount(),
    dailyLimit: config.dailyLimit,
    stats: getNotificationStats(),
    config,
  }
}

/**
 * Updates notification configuration.
 */
export function updateNotificationConfig(
  updates: Partial<NotificationConfig>
) {
  const current = loadConfig()
  const merged = { ...current, ...updates }
  saveConfig(merged)
}

/**
 * Enables/disables the notification system.
 */
export function setNotificationEnabled(enabled: boolean) {
  updateNotificationConfig({ enabled })
}

/**
 * Sets quiet hours.
 */
export function setQuietHours(start: number, end: number) {
  updateNotificationConfig({
    quietHours: { start, end },
  })
}

/**
 * Sets daily limit.
 */
export function setDailyLimit(limit: number) {
  updateNotificationConfig({
    dailyLimit: Math.max(1, Math.min(20, limit)),
  })
}

/**
 * Enables/disables a channel.
 */
export function setChannelEnabled(channel: string, enabled: boolean) {
  const config = loadConfig()
  config.channels[channel as keyof typeof config.channels] = enabled
  saveConfig(config)
}

/**
 * Resets all notification settings to defaults.
 */
export function resetNotificationConfig() {
  saveConfig(DEFAULT_NOTIFICATION_CONFIG)
}
