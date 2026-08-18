/**
 * Kininaru Assistant — Priority Engine
 *
 * Decides whether an opportunity should be presented to the user.
 * Handles cooldowns, daily limits, and notification fatigue.
 *
 * Design principles:
 * - Deterministic: no AI calls
 * - Device-local state (localStorage) for fast checks
 * - Respects user preferences (quiet hours, frequency)
 * - Per-type cooldowns to prevent spam
 */

import type { Opportunity, OpportunityType } from './opportunities'

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

/** Quiet hours: no notifications between these hours */
const QUIET_START_HOUR = 22
const QUIET_END_HOUR = 7

/** Maximum opportunities to show per day */
const MAX_OPPORTUNITIES_PER_DAY = 8

/** Minimum gap between two opportunities (minutes) */
const MIN_GAP_MINUTES = 15

/** Per-type cooldowns (minutes) — how long before showing the same type again */
const TYPE_COOLDOWNS: Record<OpportunityType, number> = {
  task_urgent: 30,       // Don't spam about the same urgent task
  task_overdue: 60,      // Once per hour for overdue
  empty_day: 120,        // Once every 2 hours
  missed_focus: 45,      // Every 45 min
  habit_pending: 60,     // Once per hour
  evening_review: 180,   // Once per evening
  goal_progress: 1440,   // Once per day (celebration)
  morning_brief: 720,    // Once per morning
}

/** Priority threshold: opportunities below this are never shown */
const MIN_PRIORITY_THRESHOLD = 25

/* ------------------------------------------------------------------ */
/* State Management (localStorage)                                     */
/* ------------------------------------------------------------------ */

const LOG_KEY = 'kininaru-proactivity-log'
const DAILY_KEY = 'kininaru-proactivity-daily'

interface ProactivityLog {
  /** Last intervention timestamp */
  lastIntervention: number
  /** Per-type last shown timestamps */
  typeTimestamps: Record<string, number>
}

function readLog(): ProactivityLog {
  try {
    const raw = JSON.parse(localStorage.getItem(LOG_KEY) ?? '{}')
    return {
      lastIntervention: typeof raw.lastIntervention === 'number' ? raw.lastIntervention : 0,
      typeTimestamps: typeof raw.typeTimestamps === 'object' && raw.typeTimestamps !== null
        ? raw.typeTimestamps as Record<string, number>
        : {},
    }
  } catch {
    return { lastIntervention: 0, typeTimestamps: {} }
  }
}

function writeLog(log: ProactivityLog) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log))
  } catch {
    // storage unavailable
  }
}

function readDailyCount(): { date: string; count: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(DAILY_KEY) ?? '{}')
    return {
      date: typeof raw.date === 'string' ? raw.date : '',
      count: typeof raw.count === 'number' ? raw.count : 0,
    }
  } catch {
    return { date: '', count: 0 }
  }
}

function writeDailyCount(date: string, count: number) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify({ date, count }))
  } catch {
    // storage unavailable
  }
}

/* ------------------------------------------------------------------ */
/* Decision Engine                                                     */
/* ------------------------------------------------------------------ */

export interface Decision {
  show: boolean
  reason?: string
}

/**
 * Decides whether to show a specific opportunity.
 *
 * Checks:
 * 1. Priority threshold
 * 2. Quiet hours
 * 3. Daily limit
 * 4. Per-type cooldown
 * 5. Minimum gap between interventions
 */
export function shouldShow(opportunity: Opportunity): Decision {
  const now = new Date()
  const hour = now.getHours()

  // 1. Priority threshold
  if (opportunity.priority < MIN_PRIORITY_THRESHOLD) {
    return { show: false, reason: 'priority_too_low' }
  }

  // 2. Quiet hours
  if (hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR) {
    return { show: false, reason: 'quiet_hours' }
  }

  // 3. Daily limit
  const today = now.toISOString().split('T')[0]
  const daily = readDailyCount()
  if (daily.date === today && daily.count >= MAX_OPPORTUNITIES_PER_DAY) {
    return { show: false, reason: 'daily_limit' }
  }

  // 4. Per-type cooldown
  const log = readLog()
  const typeKey = `type:${opportunity.type}`
  const lastShown = log.typeTimestamps[typeKey] ?? 0
  const cooldownMs = (TYPE_COOLDOWNS[opportunity.type] ?? 30) * 60_000
  if (Date.now() - lastShown < cooldownMs) {
    return { show: false, reason: 'type_cooldown' }
  }

  // 5. Minimum gap between interventions
  if (Date.now() - log.lastIntervention < MIN_GAP_MINUTES * 60_000) {
    return { show: false, reason: 'min_gap' }
  }

  return { show: true }
}

/**
 * Records that an opportunity was shown.
 * Updates cooldowns and daily count.
 */
export function recordOpportunityShown(opportunity: Opportunity) {
  const now = Date.now()
  const today = new Date().toISOString().split('T')[0]

  // Update log
  const log = readLog()
  log.lastIntervention = now
  log.typeTimestamps[`type:${opportunity.type}`] = now
  writeLog(log)

  // Update daily count
  const daily = readDailyCount()
  if (daily.date === today) {
    writeDailyCount(today, daily.count + 1)
  } else {
    writeDailyCount(today, 1)
  }
}

/**
 * Gets the best opportunity from a list that should be shown.
 * Returns null if none should be shown.
 */
export function selectBestOpportunity(opportunities: Opportunity[]): Opportunity | null {
  for (const opp of opportunities) {
    const decision = shouldShow(opp)
    if (decision.show) {
      return opp
    }
  }
  return null
}
