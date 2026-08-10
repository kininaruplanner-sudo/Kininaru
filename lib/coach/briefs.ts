'use client'

/**
 * Daily / Weekly briefs — ÉTAPE 14 §12-14 (règle finale "briefs automatisés").
 *
 * Honest design: without a cron/push infrastructure, the briefs fire when the
 * user OPENS the app (any page). The bell + system notification appear at
 * most once per day (morning / evening) and once per week. If the app is
 * closed, nothing is sent — no fake background job.
 */

export type BriefType = 'morning' | 'evening' | 'weekly'

interface BriefState {
  lastMorning: string | null
  lastEvening: string | null
  lastWeekly: string | null
}

const STORAGE_KEY = 'kininaru-coach-briefs'

const EMPTY: BriefState = { lastMorning: null, lastEvening: null, lastWeekly: null }

function readState(): BriefState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    return {
      lastMorning: typeof raw.lastMorning === 'string' ? raw.lastMorning : null,
      lastEvening: typeof raw.lastEvening === 'string' ? raw.lastEvening : null,
      lastWeekly: typeof raw.lastWeekly === 'string' ? raw.lastWeekly : null,
    }
  } catch {
    return { ...EMPTY }
  }
}

function writeState(state: BriefState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Monday-based ISO week key (e.g. "2026-33") so the weekly brief fires once a week. */
function weekKey(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const week = Math.ceil(((d.getTime() - week1.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getFullYear()}-${week}`
}

export function isMorningBriefDue(prefs: { enabled: boolean; dailyBrief: boolean }): boolean {
  if (!prefs.enabled || !prefs.dailyBrief) return false
  const h = new Date().getHours()
  if (h < 5 || h > 11) return false
  return readState().lastMorning !== todayKey()
}

export function isEveningBriefDue(prefs: { enabled: boolean; dailyBrief: boolean }): boolean {
  if (!prefs.enabled || !prefs.dailyBrief) return false
  const h = new Date().getHours()
  if (h < 19) return false
  return readState().lastEvening !== todayKey()
}

export function isWeeklyBriefDue(prefs: { enabled: boolean; weeklyReview: boolean }): boolean {
  if (!prefs.enabled || !prefs.weeklyReview) return false
  return readState().lastWeekly !== weekKey()
}

export function markBriefFired(type: BriefType) {
  const state = readState()
  const key = todayKey()
  if (type === 'morning') state.lastMorning = key
  if (type === 'evening') state.lastEvening = key
  if (type === 'weekly') state.lastWeekly = weekKey()
  writeState(state)
}
