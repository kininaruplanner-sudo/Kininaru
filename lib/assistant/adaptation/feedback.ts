/**
 * Kininaru Assistant — Feedback System
 *
 * Captures and processes user feedback on suggestions.
 * Feedback is used to update learned preferences and improve future suggestions.
 *
 * Types of feedback:
 * - accepted: User accepted the suggestion
 * - rejected: User rejected the suggestion
 * - completed: User completed the suggested action
 * - dismissed: User dismissed without action
 */

import { recordSignal, type SignalType } from './signals'
import { updatePreference } from './preferences'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type FeedbackType = 'accepted' | 'rejected' | 'completed' | 'dismissed'

export interface FeedbackContext {
  /** Type of suggestion */
  suggestionType: 'task' | 'habit' | 'focus' | 'plan'
  /** Duration if applicable (minutes) */
  duration?: number
  /** Time period */
  period?: 'morning' | 'afternoon' | 'evening'
  /** Task priority */
  priority?: string
}

/* ------------------------------------------------------------------ */
/* Processing                                                          */
/* ------------------------------------------------------------------ */

/**
 * Processes user feedback on a suggestion.
 * Updates signals and preferences accordingly.
 */
export function processFeedback(
  feedback: FeedbackType,
  context: FeedbackContext
): void {
  // Record the signal
  const signalType: SignalType =
    feedback === 'completed' ? 'suggestion_completed' :
    feedback === 'accepted' ? 'suggestion_accepted' :
    feedback === 'rejected' ? 'suggestion_rejected' :
    'task_dismissed'

  recordSignal(signalType, {
    suggestionType: context.suggestionType,
    duration: context.duration,
    period: context.period,
    priority: context.priority,
  })

  // Update preferences based on feedback
  if (context.duration) {
    const durationKey = `focus_duration_${context.duration}`
    updatePreference(
      'focus_duration',
      context.duration,
      'inferred',
      feedback === 'completed' || feedback === 'accepted'
    )
  }

  if (context.period) {
    updatePreference(
      'preferred_period',
      context.period,
      'inferred',
      feedback === 'completed' || feedback === 'accepted'
    )
  }

  if (context.suggestionType) {
    updatePreference(
      `preferred_type_${context.suggestionType}`,
      context.suggestionType,
      'inferred',
      feedback === 'completed' || feedback === 'accepted'
    )
  }
}

/**
 * Gets feedback statistics for a suggestion type.
 */
export function getFeedbackStats(suggestionType: string): {
  accepted: number
  rejected: number
  completed: number
  dismissed: number
  acceptanceRate: number
} {
  // This would analyze signals to compute stats
  // For now, return placeholder structure
  return {
    accepted: 0,
    rejected: 0,
    completed: 0,
    dismissed: 0,
    acceptanceRate: 0,
  }
}
