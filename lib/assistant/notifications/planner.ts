/**
 * Kininaru Assistant — Notification Planner
 *
 * Makes deterministic decisions about whether and when to show notifications.
 * Uses context, history, preferences, and priority to decide.
 *
 * Flow:
 * 1. Evaluate each opportunity against rules
 * 2. Apply cooldowns and limits
 * 3. Select best candidate
 * 4. Determine channels
 */

import type {
  KininaruNotification,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationConfig,
} from './types'
import {
  PRIORITY_CONFIGS,
  TYPE_PRIORITY_MAP,
  DEFAULT_NOTIFICATION_CONFIG,
} from './types'
import {
  isDuplicate,
  isDailyLimitReached,
  isInCooldown,
  getTimeSinceLastNotification,
  isInQuietHours,
} from './history'
import type { Opportunity } from '../proactivity'

/* ------------------------------------------------------------------ */
/* Intervention Decision                                               */
/* ------------------------------------------------------------------ */

export interface InterventionDecision {
  shouldNotify: boolean
  reason?: string
  priority?: NotificationPriority
  channels?: NotificationChannel[]
}

/**
 * Decides whether a notification should be shown.
 *
 * Checks in order:
 * 1. Global enabled
 * 2. Priority threshold
 * 3. Quiet hours (unless bypassed)
 * 4. Daily limit (unless bypassed)
 * 5. Type cooldown
 * 6. Duplicate prevention
 * 7. Minimum gap
 * 8. Context relevance
 */
export function shouldNotify(
  type: NotificationType,
  context: {
    config?: NotificationConfig
    priorityOverride?: NotificationPriority
    metadata?: Record<string, string>
  } = {}
): InterventionDecision {
  const config = context.config ?? DEFAULT_NOTIFICATION_CONFIG
  const priority = context.priorityOverride ?? TYPE_PRIORITY_MAP[type]
  const priorityConfig = PRIORITY_CONFIGS[priority]

  // 1. Global enabled
  if (!config.enabled) {
    return { shouldNotify: false, reason: 'disabled' }
  }

  // 2. Priority threshold
  if (priorityConfig.score < PRIORITY_CONFIGS[config.minPriority].score) {
    return { shouldNotify: false, reason: 'priority_below_threshold' }
  }

  // 3. Quiet hours (check bypass)
  if (isInQuietHours(config) && !priorityConfig.bypassQuietHours) {
    return { shouldNotify: false, reason: 'quiet_hours' }
  }

  // 4. Daily limit (check bypass)
  if (isDailyLimitReached(config.dailyLimit) && !priorityConfig.bypassDailyLimit) {
    return { shouldNotify: false, reason: 'daily_limit' }
  }

  // 5. Type cooldown (check bypass)
  const cooldownMinutes = config.typeCooldowns[type] ?? 30
  if (isInCooldown(type, cooldownMinutes) && !priorityConfig.bypassCooldown) {
    return { shouldNotify: false, reason: 'type_cooldown' }
  }

  // 6. Duplicate prevention
  if (
    isDuplicate(
      {
        id: '',
        type,
        priority: priority,
        title: '',
        message: '',
        channels: [],
        createdAt: Date.now(),
        read: false,
        metadata: context.metadata,
      },
      cooldownMinutes
    )
  ) {
    return { shouldNotify: false, reason: 'duplicate' }
  }

  // 7. Minimum gap
  const timeSinceLast = getTimeSinceLastNotification()
  const gapMs = config.minGapMinutes * 60_000
  if (timeSinceLast < gapMs && !priorityConfig.bypassCooldown) {
    return { shouldNotify: false, reason: 'min_gap' }
  }

  // 8. Determine channels
  const channels = determineChannels(type, priority, config)

  return {
    shouldNotify: true,
    priority,
    channels,
  }
}

/**
 * Quick fingerprint without creating a full notification object.
 */
function _createQuickFingerprint(
  type: NotificationType,
  metadata?: Record<string, string>
): string {
  const key = `${type}:${JSON.stringify(metadata ?? {})}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return `fp-${Math.abs(hash).toString(36)}`
}

/* ------------------------------------------------------------------ */
/* Channel Selection                                                   */
/* ------------------------------------------------------------------ */

/**
 * Determines which channels to use for a notification.
 */
function determineChannels(
  type: NotificationType,
  priority: NotificationPriority,
  config: NotificationConfig
): NotificationChannel[] {
  const channels: NotificationChannel[] = []

  // In-app is always first if enabled
  if (config.channels.in_app) {
    channels.push('in_app')
  }

  // Toast for medium+ priority
  if (config.channels.toast && (priority === 'high' || priority === 'critical')) {
    channels.push('toast')
  }

  // Push for high+ priority (if enabled)
  if (config.channels.push && (priority === 'high' || priority === 'critical')) {
    channels.push('push')
  }

  // Voice for critical (if enabled)
  if (config.channels.voice && priority === 'critical') {
    channels.push('voice')
  }

  // Ensure at least one channel
  if (channels.length === 0 && config.channels.in_app) {
    channels.push('in_app')
  }

  return channels
}

/* ------------------------------------------------------------------ */
/* Opportunity → Notification Conversion                               */
/* ------------------------------------------------------------------ */

/**
 * Converts a Phase 3 Opportunity into a KininaruNotification.
 */
export function opportunityToNotification(
  opportunity: Opportunity
): KininaruNotification {
  const type = mapOpportunityType(opportunity.type)
  const priority = TYPE_PRIORITY_MAP[type]

  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    priority,
    title: opportunity.title,
    message: opportunity.message,
    actionLabel: opportunity.actionLabel,
    actionTarget: opportunity.actionHref,
    metadata: opportunity.metadata,
    channels: ['in_app'],
    createdAt: Date.now(),
    read: false,
  }
}

/**
 * Maps Phase 3 opportunity types to Phase 12 notification types.
 */
function mapOpportunityType(oppType: string): NotificationType {
  const mapping: Record<string, NotificationType> = {
    task_urgent: 'task_urgent',
    task_overdue: 'task_overdue',
    empty_day: 'planning_suggestion',
    missed_focus: 'focus_reminder',
    habit_pending: 'habit_reminder',
    evening_review: 'evening_review',
    goal_progress: 'goal_progress',
    morning_brief: 'morning_brief',
  }
  return mapping[oppType] ?? 'tip'
}

/* ------------------------------------------------------------------ */
/* Batch Evaluation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Evaluates multiple opportunities and returns the best one that
 * passes all notification rules.
 */
export function evaluateOpportunities(
  opportunities: Opportunity[],
  config: NotificationConfig = DEFAULT_NOTIFICATION_CONFIG
): KininaruNotification | null {
  for (const opp of opportunities) {
    const notification = opportunityToNotification(opp)
    const decision = shouldNotify(notification.type, {
      config,
      metadata: notification.metadata,
    })

    if (decision.shouldNotify) {
      notification.channels = decision.channels ?? ['in_app']
      notification.priority = decision.priority ?? notification.priority
      return notification
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Context-Aware Scheduling                                            */
/* ------------------------------------------------------------------ */

/**
 * Determines if a notification should be deferred to a better time.
 * Returns null if now is fine, or a suggested time if deferral is better.
 */
export function suggestDeferredTime(
  type: NotificationType,
  _config: NotificationConfig = DEFAULT_NOTIFICATION_CONFIG
): Date | null {
  const now = new Date()
  const hour = now.getHours()

  // Morning brief: suggest 7:30 if too early
  if (type === 'morning_brief' && hour < 7) {
    const deferred = new Date(now)
    deferred.setHours(7, 30, 0, 0)
    return deferred
  }

  // Evening review: suggest 19:00 if too early
  if (type === 'evening_review' && hour < 19) {
    const deferred = new Date(now)
    deferred.setHours(19, 0, 0, 0)
    return deferred
  }

  // Focus reminder: suggest next hour boundary if in quiet focus
  if (type === 'focus_reminder' && hour >= 9 && hour <= 17) {
    // Don't defer during work hours
    return null
  }

  return null
}
