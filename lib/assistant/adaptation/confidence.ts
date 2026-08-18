/**
 * Kininaru Assistant — Confidence Calculator
 *
 * Calculates and manages confidence levels for learned preferences.
 * Confidence is a score from 0 to 1 that represents how sure we are
 * about a preference.
 *
 * Rules:
 * - Explicit preferences start at 0.9
 * - Inferred preferences start at 0.3
 * - Confidence increases with supporting signals (diminishing returns)
 * - Confidence decreases when behavior changes
 * - Minimum confidence for recommendations: 0.3
 */

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

/** Minimum confidence to use a preference in recommendations */
export const MIN_CONFIDENCE = 0.3

/** Confidence increment per supporting signal */
export const CONFIDENCE_INCREMENT = 0.15

/** Confidence decrement when behavior contradicts */
export const CONFIDENCE_DECREMENT = 0.1

/** Maximum confidence */
export const MAX_CONFIDENCE = 0.95

/** Minimum confidence for explicit preferences */
export const EXPLICIT_INITIAL = 0.9

/** Minimum confidence for inferred preferences */
export const INFERRED_INITIAL = 0.3

/* ------------------------------------------------------------------ */
/* Calculations                                                        */
/* ------------------------------------------------------------------ */

/**
 * Calculates new confidence after a supporting signal.
 * Uses diminishing returns: the more confident we already are,
 * the less each new signal adds.
 */
export function calculateIncrease(currentConfidence: number): number {
  const increment = (1 - currentConfidence) * CONFIDENCE_INCREMENT
  return Math.min(MAX_CONFIDENCE, currentConfidence + increment)
}

/**
 * Calculates new confidence after a contradicting signal.
 */
export function calculateDecrease(currentConfidence: number): number {
  return Math.max(0, currentConfidence - CONFIDENCE_DECREMENT)
}

/**
 * Determines if a preference is confident enough to use.
 */
export function isConfident(confidence: number): boolean {
  return confidence >= MIN_CONFIDENCE
}

/**
 * Gets a human-readable confidence label.
 */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'Élevée'
  if (confidence >= 0.6) return 'Bonne'
  if (confidence >= 0.4) return 'Moyenne'
  if (confidence >= 0.2) return 'Faible'
  return 'Très faible'
}

/**
 * Gets a confidence percentage for display.
 */
export function confidencePercent(confidence: number): number {
  return Math.round(confidence * 100)
}
