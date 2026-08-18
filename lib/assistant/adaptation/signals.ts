/**
 * Kininaru Assistant — Signals
 *
 * Captures simple, bounded signals from user behavior.
 * Each signal is a discrete event that can influence preferences.
 *
 * Privacy-first:
 * - Signals are device-local (localStorage)
 * - No sensitive data captured
 * - Max 50 signals retained
 * - Signals expire after 30 days
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SignalType =
  | 'focus_duration_selected'    // User chose a focus duration
  | 'task_completed'             // User completed a task
  | 'task_dismissed'             // User dismissed/skipped a task
  | 'suggestion_accepted'        // User accepted a suggestion
  | 'suggestion_rejected'        // User rejected a suggestion
  | 'suggestion_completed'       // User completed a suggested action
  | 'preferred_time'             // User active at certain time
  | 'preferred_task_type'        // User chose certain task types

export interface Signal {
  id: string
  type: SignalType
  timestamp: number
  /** Signal-specific data */
  data: Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'kininaru-adaptation-signals'
const MAX_SIGNALS = 50
const EXPIRY_DAYS = 30

function readSignals(): Signal[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []

    // Filter expired signals
    const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000
    return raw.filter((s: Signal) => s.timestamp > cutoff)
  } catch {
    return []
  }
}

function writeSignals(signals: Signal[]) {
  try {
    const trimmed = signals.slice(-MAX_SIGNALS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // storage unavailable
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Records a signal.
 */
export function recordSignal(type: SignalType, data: Record<string, unknown> = {}): void {
  const signal: Signal = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    timestamp: Date.now(),
    data,
  }

  const signals = readSignals()
  signals.push(signal)
  writeSignals(signals)
}

/**
 * Gets recent signals of a specific type.
 */
export function getSignalsByType(type: SignalType, limit = 20): Signal[] {
  return readSignals()
    .filter(s => s.type === type)
    .slice(-limit)
}

/**
 * Gets all recent signals.
 */
export function getRecentSignals(limit = 50): Signal[] {
  return readSignals().slice(-limit)
}

/**
 * Clears all signals.
 */
export function clearSignals(): void {
  writeSignals([])
}
