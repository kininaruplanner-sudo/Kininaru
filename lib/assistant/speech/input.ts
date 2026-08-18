/**
 * Kininaru Assistant — Speech Input (STT)
 *
 * Modular interface for speech-to-text. Currently uses Web Speech API,
 * but can be replaced with Deepgram, Groq Whisper, or other providers.
 *
 * Architecture:
 *   SpeechInput
 *      ↓
 *   transcript
 *      ↓
 *   AI Processor
 *
 * States: idle → listening → processing → idle (or error)
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SpeechInputState = 'idle' | 'listening' | 'processing' | 'error'

export interface SpeechInputResult {
  transcript: string
  isFinal: boolean
  confidence?: number
}

export interface SpeechInputCallbacks {
  onResult?: (result: SpeechInputResult) => void
  onStateChange?: (state: SpeechInputState) => void
  onError?: (error: string) => void
}

export interface SpeechInput {
  /** Current state */
  state: SpeechInputState
  /** Whether the browser supports speech recognition */
  supported: boolean
  /** Start listening */
  start: () => void
  /** Stop listening */
  stop: () => void
  /** Abort and clean up */
  abort: () => void
  /** Update callbacks */
  setCallbacks: (callbacks: SpeechInputCallbacks) => void
}

/* ------------------------------------------------------------------ */
/* Web Speech API Implementation                                       */
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

function micErrorMessage(err: unknown): string {
  const name =
    err instanceof DOMException
      ? err.name
      : ((err as { name?: string } | null)?.name ?? 'UnknownError')
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Accès au micro refusé. Autorisez le micro dans les réglages du navigateur.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Aucun microphone détecté. Branchez ou activez un microphone.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Le microphone est utilisé par une autre application.'
    case 'SecurityError':
      return 'Le navigateur a bloqué l\'accès au microphone.'
    default:
      return `Impossible d'accéder au microphone (${name}).`
  }
}

/**
 * Creates a SpeechInput using the Web Speech API.
 *
 * @param lang - Language code (e.g. 'fr-FR', 'en-US')
 * @param callbacks - Event callbacks
 * @returns SpeechInput instance
 */
export function createWebSpeechInput(
  lang?: string,
  callbacks?: SpeechInputCallbacks
): SpeechInput {
  const Ctor = getRecognitionCtor()
  const supported = Boolean(Ctor && canAccessMicrophone())

  let state: SpeechInputState = 'idle'
  let rec: SpeechRecognitionLike | null = null
  let stream: MediaStream | null = null
  let cbs = callbacks ?? {}
  let active = false

  const updateState = (newState: SpeechInputState) => {
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

  const instance: SpeechInput = {
    get state() { return state },
    get supported() { return supported },

    start: () => {
      if (!supported || active) return

      if (window.isSecureContext === false) {
        updateState('error')
        cbs.onError?.('Connexion sécurisée requise (HTTPS).')
        return
      }

      updateState('processing')

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
              const alt = result[0] as { transcript: string; confidence?: number } | undefined
              if (!alt) continue
              cbs.onResult?.({
                transcript: alt.transcript,
                isFinal: result.isFinal,
                confidence: alt.confidence,
              })
            }
          }

          r.onend = () => {
            if (active) startListening()
          }

          r.onerror = (ev) => {
            if (ev.error === 'not-allowed' || ev.error === 'audio-capture') {
              instance.abort()
              updateState('error')
              cbs.onError?.(micErrorMessage(ev.error))
            }
          }

          updateState('listening')
          startListening()
        })
        .catch((err) => {
          updateState('error')
          cbs.onError?.(micErrorMessage(err))
        })
    },

    stop: () => {
      active = false
      try { rec?.stop() } catch { /* noop */ }
      releaseMicrophone()
      updateState('idle')
    },

    abort: () => {
      active = false
      disposeRecognition()
      releaseMicrophone()
      updateState('idle')
    },

    setCallbacks: (newCbs) => {
      cbs = newCbs
    },
  }

  return instance
}
