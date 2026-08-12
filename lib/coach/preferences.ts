'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CoachStyle } from './rules'

/**
 * Coach preferences — ÉTAPE 14 §8-19.
 *
 * Stored per device (localStorage) so every toggle in Settings is immediate
 * and never requires a server round-trip. Nothing sensitive lives here.
 */

export interface CoachPrefs {
  /** Master switch — hides the floating coach entirely when off. */
  enabled: boolean
  /** Proactive comments / notifications (frequency-guarded). */
  proactive: boolean
  /** Browser + in-app notifications for worthy observations. */
  notifications: boolean
  /** Morning brief. */
  dailyBrief: boolean
  /** Weekly review suggestion. */
  weeklyReview: boolean
  /** How often the coach may intervene: low / normal / high. */
  frequency: CoachFrequency
  /** Communication style (never changes safety rules). */
  style: CoachStyle
  /** ISO timestamp; coach stays quiet until then. */
  pausedUntil: string | null
}

export type CoachFrequency = 'low' | 'normal' | 'high'

export const COACH_FREQUENCIES: readonly CoachFrequency[] = ['low', 'normal', 'high']

export const DEFAULT_COACH_PREFS: CoachPrefs = {
  enabled: true,
  proactive: true,
  notifications: false,
  dailyBrief: true,
  weeklyReview: true,
  frequency: 'normal',
  style: 'encouraging',
  pausedUntil: null,
}

const STORAGE_KEY = 'kininaru-coach-prefs'
const CHANGE_EVENT = 'kininaru-coach-prefs-changed'

export function loadCoachPrefs(): CoachPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_COACH_PREFS }
    const parsed = JSON.parse(raw) as Partial<CoachPrefs>
    return {
      ...DEFAULT_COACH_PREFS,
      ...parsed,
      frequency:
        parsed.frequency === 'low' ||
        parsed.frequency === 'normal' ||
        parsed.frequency === 'high'
          ? parsed.frequency
          : DEFAULT_COACH_PREFS.frequency,
      style:
        parsed.style === 'calm' ||
        parsed.style === 'encouraging' ||
        parsed.style === 'direct' ||
        parsed.style === 'concise'
          ? parsed.style
          : DEFAULT_COACH_PREFS.style,
      pausedUntil: typeof parsed.pausedUntil === 'string' ? parsed.pausedUntil : null,
    }
  } catch {
    return { ...DEFAULT_COACH_PREFS }
  }
}

export function saveCoachPrefs(prefs: CoachPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    // Keep every mounted consumer (floating bubble, settings panel) in sync.
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  } catch {
    // storage unavailable (private mode) — prefs stay in memory
  }
}

export function useCoachPrefs() {
  const [prefs, setPrefsState] = useState<CoachPrefs>(loadCoachPrefs)

  // Re-sync when prefs change elsewhere (another tab via `storage`, or the
  // settings panel via the custom event) so the bubble reacts immediately.
  useEffect(() => {
    const sync = () => setPrefsState(loadCoachPrefs())
    window.addEventListener('storage', sync)
    window.addEventListener(CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(CHANGE_EVENT, sync)
    }
  }, [])

  const setPrefs = useCallback((next: CoachPrefs) => {
    setPrefsState(next)
    saveCoachPrefs(next)
  }, [])

  const update = useCallback((patch: Partial<CoachPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch }
      saveCoachPrefs(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const defaults = { ...DEFAULT_COACH_PREFS }
    setPrefsState(defaults)
    saveCoachPrefs(defaults)
  }, [])

  const pauseFor = useCallback(
    (hours: number) => {
      update({ pausedUntil: new Date(Date.now() + hours * 3_600_000).toISOString() })
    },
    [update]
  )

  return { prefs, setPrefs, update, reset, pauseFor }
}
