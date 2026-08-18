/**
 * Kininaru Assistant — Learned Preferences
 *
 * Stores and manages preferences learned from user behavior.
 * Each preference has a confidence level and source (explicit vs inferred).
 *
 * Privacy-first:
 * - All preferences are device-local (localStorage)
 * - No sensitive data stored
 * - User can view, delete, or reset any preference
 * - Opt-out disables inferred preferences
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type PreferenceSource = 'explicit' | 'inferred'

export interface LearnedPreference {
  /** Preference key (e.g. 'focus_duration', 'preferred_period') */
  key: string
  /** Preference value */
  value: unknown
  /** Confidence level (0-1) */
  confidence: number
  /** How this preference was learned */
  source: PreferenceSource
  /** Timestamp of last update */
  updatedAt: number
  /** Number of supporting signals */
  signalCount: number
}

export interface AdaptationPrefs {
  /** Master switch for adaptive intelligence */
  enabled: boolean
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const PREFS_KEY = 'kininaru-adaptation-prefs'
const LEARNED_KEY = 'kininaru-learned-preferences'
const CHANGE_EVENT = 'kininaru-adaptation-changed'

function readLearned(): LearnedPreference[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LEARNED_KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function writeLearned(prefs: LearnedPreference[]) {
  try {
    localStorage.setItem(LEARNED_KEY, JSON.stringify(prefs))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  } catch {
    // storage unavailable
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Gets the adaptation master switch.
 */
export function isAdaptationEnabled(): boolean {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return true // Default: enabled
    const prefs = JSON.parse(raw) as Partial<AdaptationPrefs>
    return prefs.enabled !== false
  } catch {
    return true
  }
}

/**
 * Sets the adaptation master switch.
 */
export function setAdaptationEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ enabled }))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  } catch {
    // storage unavailable
  }
}

/**
 * Gets a learned preference by key.
 */
export function getPreference(key: string): LearnedPreference | null {
  const prefs = readLearned()
  return prefs.find(p => p.key === key) ?? null
}

/**
 * Gets all learned preferences.
 */
export function getAllPreferences(): LearnedPreference[] {
  return readLearned()
}

/**
 * Updates or creates a learned preference.
 * Confidence increases with more signals, decreases when behavior changes.
 */
export function updatePreference(
  key: string,
  value: unknown,
  source: PreferenceSource,
  supportingSignal = true
): void {
  const prefs = readLearned()
  const existing = prefs.find(p => p.key === key)

  if (existing) {
    // Update existing preference
    if (supportingSignal) {
      // Confidence increases (diminishing returns)
      const increment = (1 - existing.confidence) * 0.15
      existing.confidence = Math.min(0.95, existing.confidence + increment)
      existing.signalCount++
    } else {
      // Confidence decreases
      existing.confidence = Math.max(0.1, existing.confidence - 0.1)
    }

    // Only update value if confidence is high enough or explicit
    if (source === 'explicit' || existing.confidence > 0.5) {
      existing.value = value
    }

    existing.updatedAt = Date.now()
    existing.source = source === 'explicit' ? 'explicit' : existing.source
  } else {
    // Create new preference
    prefs.push({
      key,
      value,
      confidence: source === 'explicit' ? 0.9 : 0.3,
      source,
      updatedAt: Date.now(),
      signalCount: 1,
    })
  }

  writeLearned(prefs)
}

/**
 * Deletes a learned preference.
 */
export function deletePreference(key: string): void {
  const prefs = readLearned().filter(p => p.key !== key)
  writeLearned(prefs)
}

/**
 * Resets all learned preferences.
 */
export function resetAllPreferences(): void {
  writeLearned([])
}

/**
 * Gets preferences relevant to a specific context.
 */
export function getRelevantPreferences(keys: string[]): LearnedPreference[] {
  const all = readLearned()
  return all.filter(p =>
    keys.includes(p.key) && p.confidence >= 0.3
  )
}
