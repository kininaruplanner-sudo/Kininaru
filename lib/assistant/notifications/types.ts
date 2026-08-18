/**
 * Kininaru Assistant — Notification Types
 *
 * Defines notification types, priorities, channels, and configuration.
 * Builds on Phase 3 opportunity types with richer metadata.
 */

/* ------------------------------------------------------------------ */
/* Notification Types                                                  */
/* ------------------------------------------------------------------ */

export type NotificationType =
  // Task-related
  | 'task_urgent'
  | 'task_overdue'
  | 'task_due_soon'
  // Calendar
  | 'calendar_upcoming'
  | 'calendar_conflict'
  // Focus
  | 'focus_reminder'
  | 'focus_session_complete'
  // Habits
  | 'habit_reminder'
  | 'habit_streak_celebration'
  // Goals
  | 'goal_progress'
  | 'goal_milestone'
  | 'goal_deadline_approaching'
  // Briefs
  | 'morning_brief'
  | 'evening_review'
  | 'weekly_review'
  // Planning
  | 'next_action'
  | 'planning_suggestion'
  // System
  | 'tip'
  | 'welcome';

/* ------------------------------------------------------------------ */
/* Priority Levels                                                     */
/* ------------------------------------------------------------------ */

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low'

/**
 * Priority configuration with numeric score and behavior flags.
 */
export interface PriorityConfig {
  score: number         // 0-100
  label: string
  bypassQuietHours: boolean
  bypassDailyLimit: boolean
  bypassCooldown: boolean
}

export const PRIORITY_CONFIGS: Record<NotificationPriority, PriorityConfig> = {
  critical: {
    score: 100,
    label: 'Critique',
    bypassQuietHours: true,
    bypassDailyLimit: true,
    bypassCooldown: true,
  },
  high: {
    score: 80,
    label: 'Haute',
    bypassQuietHours: false,
    bypassDailyLimit: false,
    bypassCooldown: false,
  },
  medium: {
    score: 50,
    label: 'Moyenne',
    bypassQuietHours: false,
    bypassDailyLimit: false,
    bypassCooldown: false,
  },
  low: {
    score: 20,
    label: 'Basse',
    bypassQuietHours: false,
    bypassDailyLimit: false,
    bypassCooldown: false,
  },
}

/* ------------------------------------------------------------------ */
/* Notification Channels                                               */
/* ------------------------------------------------------------------ */

export type NotificationChannel = 'in_app' | 'toast' | 'push' | 'voice'

export interface ChannelConfig {
  enabled: boolean
  /** Whether this channel can show rich content */
  richContent: boolean
  /** Auto-dismiss delay in ms (0 = no auto-dismiss) */
  autoDismissMs: number
  /** Whether this channel supports action buttons */
  hasActions: boolean
}

export const CHANNEL_DEFAULTS: Record<NotificationChannel, ChannelConfig> = {
  in_app: {
    enabled: true,
    richContent: true,
    autoDismissMs: 0,
    hasActions: true,
  },
  toast: {
    enabled: true,
    richContent: false,
    autoDismissMs: 5000,
    hasActions: false,
  },
  push: {
    enabled: false, // opt-in
    richContent: false,
    autoDismissMs: 0,
    hasActions: true,
  },
  voice: {
    enabled: false, // opt-in
    richContent: false,
    autoDismissMs: 0,
    hasActions: false,
  },
}

/* ------------------------------------------------------------------ */
/* Notification Object                                                 */
/* ------------------------------------------------------------------ */

export interface KininaruNotification {
  /** Unique notification ID */
  id: string
  /** Notification type */
  type: NotificationType
  /** Priority level */
  priority: NotificationPriority
  /** Short title */
  title: string
  /** Full message */
  message: string
  /** Action button label */
  actionLabel?: string
  /** Action target (route or handler) */
  actionTarget?: string
  /** Metadata for the handler */
  metadata?: Record<string, string>
  /** Channels to deliver to */
  channels: NotificationChannel[]
  /** Creation timestamp */
  createdAt: number
  /** Expiration timestamp (optional) */
  expiresAt?: number
  /** Whether this has been read/dismissed */
  read: boolean
  /** User feedback (if any) */
  feedback?: 'useful' | 'not_useful'
}

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

export interface NotificationConfig {
  /** Global enable/disable */
  enabled: boolean
  /** Quiet hours */
  quietHours: {
    start: number  // hour (0-23)
    end: number    // hour (0-23)
  }
  /** Maximum notifications per day */
  dailyLimit: number
  /** Minimum gap between notifications (minutes) */
  minGapMinutes: number
  /** Per-type cooldowns (minutes) */
  typeCooldowns: Record<NotificationType, number>
  /** Minimum priority threshold */
  minPriority: NotificationPriority
  /** Enabled channels */
  channels: Record<NotificationChannel, boolean>
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  quietHours: {
    start: 22,
    end: 7,
  },
  dailyLimit: 8,
  minGapMinutes: 15,
  typeCooldowns: {
    task_urgent: 30,
    task_overdue: 60,
    task_due_soon: 120,
    calendar_upcoming: 30,
    calendar_conflict: 60,
    focus_reminder: 45,
    focus_session_complete: 120,
    habit_reminder: 60,
    habit_streak_celebration: 1440,
    goal_progress: 720,
    goal_milestone: 1440,
    goal_deadline_approaching: 360,
    morning_brief: 720,
    evening_review: 180,
    weekly_review: 10080,
    next_action: 30,
    planning_suggestion: 120,
    tip: 1440,
    welcome: 0,
  },
  minPriority: 'low',
  channels: {
    in_app: true,
    toast: true,
    push: false,
    voice: false,
  },
}

/* ------------------------------------------------------------------ */
/* Type → Priority Mapping                                             */
/* ------------------------------------------------------------------ */

export const TYPE_PRIORITY_MAP: Record<NotificationType, NotificationPriority> = {
  task_urgent: 'high',
  task_overdue: 'high',
  task_due_soon: 'medium',
  calendar_upcoming: 'high',
  calendar_conflict: 'critical',
  focus_reminder: 'medium',
  focus_session_complete: 'low',
  habit_reminder: 'medium',
  habit_streak_celebration: 'low',
  goal_progress: 'medium',
  goal_milestone: 'high',
  goal_deadline_approaching: 'high',
  morning_brief: 'medium',
  evening_review: 'medium',
  weekly_review: 'low',
  next_action: 'medium',
  planning_suggestion: 'medium',
  tip: 'low',
  welcome: 'medium',
}

/* ------------------------------------------------------------------ */
/* Default Cooldowns (exported for reference)                          */
/* ------------------------------------------------------------------ */

export const MIN_PRIORITY_SCORE = 20

export function getMinPriorityScore(priority: NotificationPriority): number {
  return PRIORITY_CONFIGS[priority]?.score ?? MIN_PRIORITY_SCORE
}
