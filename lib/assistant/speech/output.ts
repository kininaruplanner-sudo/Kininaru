/**
 * Kininaru Assistant — Speech Output (TTS)
 *
 * Modular interface for text-to-speech. Currently uses Web Speech Synthesis,
 * but can be replaced with ElevenLabs, Edge TTS, or other providers.
 *
 * Architecture:
 *   AI Processor
 *      ↓
 *   response
 *      ↓
 *   SpeechOutput
 *      ↓
 *   voice
 *
 * States: idle → speaking → idle (or error)
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SpeechOutputState = 'idle' | 'speaking' | 'error'

export interface SpeechOutputPrefs {
  /** Voice URI or null for auto */
  voiceURI: string | null
  /** Speech rate (0.5 - 1.5) */
  rate: number
  /** Volume (0 - 1) */
  volume: number
}

export interface SpeechOutputCallbacks {
  onStateChange?: (state: SpeechOutputState) => void
  onEnd?: () => void
  onError?: (error: string) => void
}

export interface SpeechOutput {
  /** Current state */
  state: SpeechOutputState
  /** Whether the browser supports speech synthesis */
  supported: boolean
  /** Speak text (interrupts any current speech) */
  speak: (text: string) => void
  /** Stop current speech */
  stop: () => void
  /** Update voice preferences */
  setPrefs: (prefs: SpeechOutputPrefs) => void
  /** Update callbacks */
  setCallbacks: (callbacks: SpeechOutputCallbacks) => void
  /** Get available voices */
  getVoices: () => SpeechSynthesisVoice[]
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Clean markdown/text for natural speech */
function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^[#>*•\-–—]+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1400)
}

/** Pick the best voice for a language */
function pickVoice(
  prefs: SpeechOutputPrefs,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null

  // Use explicit choice if available
  if (prefs.voiceURI) {
    const chosen = voices.find(v => v.voiceURI === prefs.voiceURI)
    if (chosen) return chosen
  }

  // Auto-detect language preference
  const preferred = /^fr/i.test(navigator.language) ? 'fr' : 'en'
  const byLang = voices.filter(v => v.lang.toLowerCase().startsWith(preferred))

  // Prefer natural/premium voices
  return (
    byLang.find(v => /female|google|natural|premium|enhanced/i.test(v.name)) ??
    byLang[0] ??
    voices[0]
  )
}

/* ------------------------------------------------------------------ */
/* Web Speech Synthesis Implementation                                 */
/* ------------------------------------------------------------------ */

/**
 * Creates a SpeechOutput using the Web Speech Synthesis API.
 *
 * @param prefs - Initial voice preferences
 * @param callbacks - Event callbacks
 * @returns SpeechOutput instance
 */
export function createWebSpeechOutput(
  prefs?: SpeechOutputPrefs,
  callbacks?: SpeechOutputCallbacks
): SpeechOutput {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  let state: SpeechOutputState = 'idle'
  let currentPrefs = prefs ?? { voiceURI: null, rate: 1, volume: 1 }
  let cbs = callbacks ?? {}
  let speakToken = 0

  const updateState = (newState: SpeechOutputState) => {
    state = newState
    cbs.onStateChange?.(newState)
  }

  const instance: SpeechOutput = {
    get state() { return state },
    get supported() { return supported },

    speak: (text: string) => {
      if (!supported) {
        cbs.onError?.('Synthèse vocale non supportée')
        return
      }

      const clean = cleanForSpeech(text)
      if (!clean) {
        cbs.onEnd?.()
        return
      }

      // Cancel any current speech
      window.speechSynthesis.cancel()

      const token = ++speakToken
      const utter = new SpeechSynthesisUtterance(clean)
      const voice = pickVoice(currentPrefs, window.speechSynthesis.getVoices())
      if (voice) utter.voice = voice
      utter.rate = currentPrefs.rate
      utter.volume = currentPrefs.volume

      utter.onend = () => {
        if (token !== speakToken) return
        updateState('idle')
        cbs.onEnd?.()
      }

      utter.onerror = () => {
        if (token !== speakToken) return
        updateState('error')
        cbs.onError?.('Erreur de synthèse vocale')
        cbs.onEnd?.()
      }

      updateState('speaking')
      window.speechSynthesis.speak(utter)
    },

    stop: () => {
      speakToken++
      if (supported) window.speechSynthesis.cancel()
      updateState('idle')
    },

    setPrefs: (newPrefs) => {
      currentPrefs = newPrefs
    },

    setCallbacks: (newCbs) => {
      cbs = newCbs
    },

    getVoices: () => {
      if (!supported) return []
      return window.speechSynthesis.getVoices()
    },
  }

  return instance
}
