/**
 * Kininaru Assistant — Notification System
 *
 * Barrel export for the notification center.
 * Provides types, engine, planner, history, and configuration.
 */

// Types
export type {
  KininaruNotification,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationConfig,
  PriorityConfig,
  ChannelConfig,
} from './types'

export {
  PRIORITY_CONFIGS,
  CHANNEL_DEFAULTS,
  DEFAULT_NOTIFICATION_CONFIG,
  TYPE_PRIORITY_MAP,
  MIN_PRIORITY_SCORE,
  getMinPriorityScore,
} from './types'

// Engine (main entry point)
export {
  getBestNotification,
  createNotification,
  getNotificationStatus,
  updateNotificationConfig,
  setNotificationEnabled,
  setQuietHours,
  setDailyLimit,
  setChannelEnabled,
  resetNotificationConfig,
} from './engine'

// Planner
export type { InterventionDecision } from './planner'
export {
  shouldNotify,
  opportunityToNotification,
  evaluateOpportunities,
  suggestDeferredTime,
} from './planner'

// History
export type { NotificationStats } from './history'
export {
  createFingerprint,
  isDuplicate,
  isDailyLimitReached,
  isInCooldown,
  getTimeSinceLastNotification,
  getTodayCount,
  recordNotificationShown,
  markAsRead,
  recordFeedback,
  getNotificationStats,
  clearHistory,
  isInQuietHours,
} from './history'
