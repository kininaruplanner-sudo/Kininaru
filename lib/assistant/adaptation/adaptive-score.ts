/**
 * Kininaru Assistant — Adaptive Score
 *
 * Extends the Phase 8 Next Action Engine with learned preferences.
 * Adds two new scoring dimensions:
 * - Preference Fit: does this action match learned preferences?
 * - Historical Success: has the user succeeded with similar actions before?
 *
 * The new dimensions do NOT override urgency, priority, or calendar constraints.
 * They only provide a gentle boost to actions that match user patterns.
 */

import type { NextActionCandidate, NextActionScore } from '../planning/next-action-engine'
import { getPreference, isAdaptationEnabled } from './preferences'
import { isConfident } from './confidence'

/* ------------------------------------------------------------------ */
/* Scoring Extension                                                   */
/* ------------------------------------------------------------------ */

/** Weight for preference fit (max 10 points) */
const PREFERENCE_FIT_WEIGHT = 10

/** Weight for historical success (max 10 points) */
const HISTORICAL_SUCCESS_WEIGHT = 10

/**
 * Calculates preference fit score for a candidate.
 * Checks if the candidate matches learned preferences.
 */
export function scorePreferenceFit(candidate: NextActionCandidate): number {
  if (!isAdaptationEnabled()) return 0

  let score = 0

  // Check focus duration preference
  if (candidate.type === 'focus' && candidate.estimatedMinutes) {
    const durationPref = getPreference('focus_duration')
    if (durationPref && isConfident(durationPref.confidence)) {
      const preferred = durationPref.value as number
      const diff = Math.abs(candidate.estimatedMinutes - preferred)
      if (diff <= 5) {
        score += 5 // Perfect match
      } else if (diff <= 15) {
        score += 3 // Close match
      }
    }
  }

  // Check preferred time period
  const periodPref = getPreference('preferred_period')
  if (periodPref && isConfident(periodPref.confidence)) {
    const now = new Date()
    const hour = now.getHours()
    const currentPeriod = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

    if (periodPref.value === currentPeriod) {
      score += 3 // Matches preferred period
    }
  }

  // Check preferred task type
  if (candidate.type === 'task') {
    const typePref = getPreference(`preferred_type_task`)
    if (typePref && isConfident(typePref.confidence)) {
      score += 2 // User likes tasks
    }
  }

  return Math.min(score, PREFERENCE_FIT_WEIGHT)
}

/**
 * Calculates historical success score for a candidate.
 * Checks if similar actions have been completed successfully before.
 */
export function scoreHistoricalSuccess(candidate: NextActionCandidate): number {
  if (!isAdaptationEnabled()) return 0

  let score = 0

  // Check if user has completed similar actions
  const successPref = getPreference(`success_${candidate.type}`)
  if (successPref && isConfident(successPref.confidence)) {
    score += Math.round(successPref.confidence * 8)
  }

  // Bonus for goal-related tasks that have progress
  if (candidate.goalId) {
    const goalProgress = getPreference(`goal_progress_${candidate.goalId}`)
    if (goalProgress && isConfident(goalProgress.confidence)) {
      score += 2 // User makes progress on goals
    }
  }

  return Math.min(score, HISTORICAL_SUCCESS_WEIGHT)
}

/**
 * Extends the base Next Action Score with adaptive components.
 * The new components are additive and cannot override urgency/priority.
 */
export function extendScore(
  baseScore: NextActionScore,
  candidate: NextActionCandidate
): NextActionScore & { preferenceFit: number; historicalSuccess: number } {
  const preferenceFit = scorePreferenceFit(candidate)
  const historicalSuccess = scoreHistoricalSuccess(candidate)

  // Adaptive components add to total but cannot exceed 100
  const adaptiveBonus = preferenceFit + historicalSuccess
  const newTotal = Math.min(100, baseScore.total + adaptiveBonus)

  return {
    ...baseScore,
    preferenceFit,
    historicalSuccess,
    total: newTotal,
  }
}

/**
 * Generates explanation factors for adaptive scoring.
 */
export function getAdaptiveExplanationFactors(
  candidate: NextActionCandidate,
  preferenceFit: number,
  historicalSuccess: number
): string[] {
  const factors: string[] = []

  if (preferenceFit >= 5) {
    factors.push('correspond à tes préférences')
  }

  if (historicalSuccess >= 5) {
    factors.push('tu réussis souvent ce type d\'action')
  }

  return factors
}
