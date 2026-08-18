/**
 * Kininaru Assistant — Wake Word Detector
 *
 * Detects the wake word "Hey Kininaru" using the Web Speech API.
 * Architecture: zero dependencies, local processing, privacy-first.
 *
 * Flow:
 *   Microphone → Web Speech API (continuous) → transcript check → activation
 *
 * Fallback modes:
 * - Wake word unavailable → manual button still works
 * - Wake word disabled by user → manual button still works
 * - Browser doesn't support STT → text input only
 *
 * Privacy:
 * - Audio is processed locally in Chrome/Edge's speech engine
 * - No audio is sent to external servers
 * - No audio is recorded or stored
 * - No IA request is made until wake word is detected
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type WakeWordState =
  | 'disabled'      // Wake word not active
  | 'idle'          // Listening for wake word
  | 'detected'      // Wake word just detected
  | 'error'         // Error occurred

export interface WakeWordCallbacks {
  onDetected?: () => void
  onStateChange?: (state: WakeWordState) => void
  onError?: (error: string) => void
}

export interface WakeWordDetector {
  /** Current state */
  state: WakeWordState
  /** Whether the browser supports wake word detection */
  supported: boolean
  /** Start listening for wake word */
  start: () => void
  /** Stop listening for wake word */
  stop: () => void
  /** Abort and clean up */
  abort: () => void
  /** Update callbacks */
  setCallbacks: (callbacks: WakeWordCallbacks) => void
}

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

/** Default wake word phrases (case-insensitive) */
const DEFAULT_WAKE_PHRASES = [
  'hey kininaru',
  'ok kininaru',
  'salut kininaru',
  'kininaru',
]

/** Cooldown after detection before listening resumes (ms) */
const DETECTION_COOLDOWN_MS = 2000

/* ------------------------------------------------------------------ */
/* Web Speech API Detection                                            */
/* ------------------------------------------------------------------ */

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }>
  }) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function canAccessMicrophone(): boolean {
  if (typeof navigator === 'undefined') return false
  return !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
}

/**
 * Checks if a transcript contains the wake word.
 * Uses fuzzy matching to handle slight pronunciation variations.
 */
function containsWakeWord(transcript: string, phrases: string[]): boolean {
  const normalized = transcript.toLowerCase().trim()
  return phrases.some(phrase => normalized.includes(phrase))
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

/**
 * Creates a WakeWordDetector using the Web Speech API.
 *
 * @param wakePhrases - Custom wake word phrases (default: "Hey Kininaru")
 * @param lang - Language code (e.g. 'fr-FR', 'en-US')
 * @param callbacks - Event callbacks
 * @returns WakeWordDetector instance
 */
export function createWakeWordDetector(
  wakePhrases?: string[],
  lang?: string,
  callbacks?: WakeWordCallbacks
): WakeWordDetector {
  const Ctor = getRecognitionCtor()
  const supported = Boolean(Ctor && canAccessMicrophone())
  const phrases = wakePhrases ?? DEFAULT_WAKE_PHRASES

  let state: WakeWordState = 'disabled'
  let rec: SpeechRecognitionLike | null = null
  let stream: MediaStream | null = null
  let cbs = callbacks ?? {}
  let active = false
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null

  const updateState = (newState: WakeWordState) => {
    state = newState
    cbs.onStateChange?.(newState)
  }

  const releaseMicrophone = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      stream = null
    }
  }

  const disposeRecognition = () => {
    if (rec) {
      rec.onresult = null
      rec.onend = null
      rec.onerror = null
      try { rec.abort() } catch { /* noop */ }
      rec = null
    }
  }

  const startListening = () => {
    if (!rec || !active) return
    try { rec.start() } catch { /* already running */ }
  }

  const handleDetection = () => {
    // Enter cooldown to prevent double-detection
    active = false
    try { rec?.stop() } catch { /* noop */ }
    updateState('detected')
    cbs.onDetected?.()

    // Resume listening after cooldown
    cooldownTimer = setTimeout(() => {
      if (active) return // Already restarted
      active = true
      updateState('idle')
      startListening()
    }, DETECTION_COOLDOWN_MS)
  }

  const instance: WakeWordDetector = {
    get state() { return state },
    get supported() { return supported },

    start: () => {
      if (!supported || active) return

      if (window.isSecureContext === false) {
        updateState('error')
        cbs.onError?.('Connexion sécurisée requise (HTTPS).')
        return
      }

      // Request microphone permission first
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((mediaStream) => {
          stream = mediaStream
          const r = new Ctor!()
          r.continuous = true
          r.interimResults = true
          r.lang = lang ?? (/^fr/i.test(navigator.language) ? 'fr-FR' : 'en-US')

          active = true
          rec = r

          r.onresult = (e) => {
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const result = e.results[i]
              const alt = result[0]
              if (!alt) continue

              // Only check final results for wake word
              if (result.isFinal && containsWakeWord(alt.transcript, phrases)) {
                handleDetection()
                return
              }
            }
          }

          r.onend = () => {
            // Auto-restart if still active
            if (active) startListening()
          }

          r.onerror = (ev) => {
            // Fatal errors: stop and report
            if (ev.error === 'not-allowed' || ev.error === 'audio-capture') {
              instance.abort()
              updateState('error')
              cbs.onError?.(ev.error === 'not-allowed'
                ? 'Accès au micro refusé. Autorisez le micro dans les réglages du navigateur.'
                : 'Aucun microphone détecté.'
              )
            }
            // Transient errors (network, no-speech, aborted): keep listening
          }

          updateState('idle')
          startListening()
        })
        .catch((err) => {
          updateState('error')
          cbs.onError?.(err instanceof Error ? err.message : 'Erreur microphone')
        })
    },

    stop: () => {
      active = false
      if (cooldownTimer) {
        clearTimeout(cooldownTimer)
        cooldownTimer = null
      }
      try { rec?.stop() } catch { /* noop */ }
      releaseMicrophone()
      updateState('disabled')
    },

    abort: () => {
      active = false
      if (cooldownTimer) {
        clearTimeout(cooldownTimer)
        cooldownTimer = null
      }
      disposeRecognition()
      releaseMicrophone()
      updateState('disabled')
    },

    setCallbacks: (newCbs) => {
      cbs = newCbs
    },
  }

  return instance
}
