'use client'

/**
 * Coach frequency control — ÉTAPE 14 §7.
 *
 * The coach must never become annoying. Every proactive intervention is
 * gated by: quiet hours, a daily cap, a minimum gap between interventions,
 * the user pause, and per-rule daily dedupe. All state is device-local.
 */

export const QUIET_START_HOUR = 22
export const QUIET_END_HOUR = 7
export const MAX_INTERVENTIONS_PER_DAY = 6
export const MIN_GAP_MINUTES = 30

const LOG_KEY = 'kininaru-coach-log'
const SEEN_KEY = 'kininaru-coach-seen'

function readLog(): number[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LOG_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

function writeLog(log: number[]) {
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-100)))
  } catch {
    // storage unavailable
  }
}

export function isQuietHours(now = new Date()): boolean {
  const h = now.getHours()
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR
}

export type InterventionReason =
  | 'disabled'
  | 'paused'
  | 'quiet'
  | 'daily-limit'
  | 'gap'

export function canCoachIntervene(prefs: {
  enabled: boolean
  proactive: boolean
  pausedUntil: string | null
}): { allowed: boolean; reason?: InterventionReason } {
  if (!prefs.enabled) return { allowed: false, reason: 'disabled' }
  if (!prefs.proactive) return { allowed: false, reason: 'disabled' }
  if (prefs.pausedUntil && Date.parse(prefs.pausedUntil) > Date.now())
    return { allowed: false, reason: 'paused' }
  if (isQuietHours()) return { allowed: false, reason: 'quiet' }

  const now = Date.now()
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const todayCount = readLog().filter((at) => at >= dayStart.getTime()).length
  if (todayCount >= MAX_INTERVENTIONS_PER_DAY) return { allowed: false, reason: 'daily-limit' }

  const log = readLog()
  const last = log[log.length - 1]
  if (last && now - last < MIN_GAP_MINUTES * 60_000) return { allowed: false, reason: 'gap' }

  return { allowed: true }
}

export function recordCoachIntervention() {
  const log = readLog()
  log.push(Date.now())
  writeLog(log)
}

/** True when this rule id already triggered a notification today. */
export function wasRuleSeenToday(ruleId: string): boolean {
  const key = `${new Date().toISOString().slice(0, 10)}:${ruleId}`
  try {
    const list = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '[]')
    return Array.isArray(list) && list.includes(key)
  } catch {
    return false
  }
}

export function markRuleSeenToday(ruleId: string) {
  const key = `${new Date().toISOString().slice(0, 10)}:${ruleId}`
  try {
    const list = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '[]')
    if (Array.isArray(list) && !list.includes(key)) {
      list.push(key)
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-60)))
    }
  } catch {
    // storage unavailable
  }
}
