'use client'

import { useCallback, useEffect, useState } from 'react'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface VoicePrefs {
  /** speechSynthesis voiceURI, or null for auto (best match by language). */
  voiceURI: string | null
  /** Speech rate (0.5 → 1.5, default 1). */
  rate: number
  /** Output volume (0 → 1, default 1). */
  volume: number
}

export const DEFAULT_VOICE_PREFS: VoicePrefs = {
  voiceURI: null,
  rate: 1,
  volume: 1,
}

/* ------------------------------------------------------------------ */
/* Persistence (device-local — voices are device-specific)             */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'kininaru-voice-prefs'

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function loadVoicePrefs(): VoicePrefs {
  if (typeof window === 'undefined') return DEFAULT_VOICE_PREFS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_VOICE_PREFS
    const parsed = JSON.parse(raw) as Partial<VoicePrefs>
    return {
      voiceURI: typeof parsed.voiceURI === 'string' && parsed.voiceURI ? parsed.voiceURI : null,
      rate: typeof parsed.rate === 'number' ? clamp(parsed.rate, 0.5, 1.5) : DEFAULT_VOICE_PREFS.rate,
      volume: typeof parsed.volume === 'number' ? clamp(parsed.volume, 0, 1) : DEFAULT_VOICE_PREFS.volume,
    }
  } catch {
    return DEFAULT_VOICE_PREFS
  }
}

export function saveVoicePrefs(prefs: VoicePrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // storage unavailable (private mode) — keep in-memory only
  }
}

/* ------------------------------------------------------------------ */
/* Voice helpers                                                       */
/* ------------------------------------------------------------------ */

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices()
}

/** Human label for the select list, e.g. "Google français (fr-FR)". */
export function voiceLabel(voice: SpeechSynthesisVoice): string {
  return `${voice.name} (${voice.lang})`
}

/**
 * Picks the voice to speak with, from a given voice list. Honors the user's
 * explicit choice; when it is unset (auto) or no longer available, falls
 * back to the best match for the current UI language (preferring
 * premium/natural-sounding voices).
 */
export function pickVoiceFromList(
  prefs: VoicePrefs,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null
  if (prefs.voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === prefs.voiceURI)
    if (chosen) return chosen
  }
  const preferred = /^fr/i.test(navigator.language) ? 'fr' : 'en'
  const byLang = voices.filter((v) => v.lang.toLowerCase().startsWith(preferred))
  return (
    byLang.find((v) => /female|google|natural|premium|enhanced/i.test(v.name)) ??
    byLang[0] ??
    voices[0]
  )
}

/** Convenience: picks from the live list returned by the browser. */
export function pickVoice(prefs: VoicePrefs): SpeechSynthesisVoice | null {
  return pickVoiceFromList(prefs, getAvailableVoices())
}

/** Speaks a short sample using the current prefs (used by the test button). */
export function speakSample(prefs: VoicePrefs, text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  const voice = pickVoice(prefs)
  if (voice) utter.voice = voice
  utter.rate = prefs.rate
  utter.volume = prefs.volume
  window.speechSynthesis.speak(utter)
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export interface UseVoicePrefsResult {
  prefs: VoicePrefs
  setPrefs: (next: VoicePrefs) => void
  voices: SpeechSynthesisVoice[]
  voicesLoaded: boolean
}

/**
 * Loads the persisted voice prefs and tracks the list of available voices
 * (some browsers populate `getVoices()` asynchronously — we listen for
 * `voiceschanged`). Every update is persisted immediately.
 */
export function useVoicePrefs(): UseVoicePrefsResult {
  // Lazy initializers restore persisted prefs and the already-available voice
  // list on first render (guarded for SSR); no syncing needed in the effect.
  const [prefs, setPrefsState] = useState<VoicePrefs>(() => loadVoicePrefs())
  const [voiceState, setVoiceState] = useState(() => {
    const list = getAvailableVoices()
    return { voices: list, loaded: list.length > 0 }
  })

  // Some browsers populate `getVoices()` asynchronously — refresh the list
  // whenever the browser says it changed.
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const refresh = () => {
      const list = getAvailableVoices()
      setVoiceState({ voices: list, loaded: true })
    }
    window.speechSynthesis.addEventListener('voiceschanged', refresh)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh)
  }, [])

  const setPrefs = useCallback((next: VoicePrefs) => {
    setPrefsState(next)
    saveVoicePrefs(next)
  }, [])

  const { voices, loaded: voicesLoaded } = voiceState

  return { prefs, setPrefs, voices, voicesLoaded }
}
