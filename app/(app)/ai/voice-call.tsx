'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Mic, MicOff, Phone, PhoneOff, Settings2, Volume2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { VoiceSettingsPanel } from '@/components/voice-settings-panel'
import { pickVoice, type VoicePrefs } from '@/lib/voice-preferences'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type CallStatus = 'idle' | 'starting' | 'listening' | 'transcribing' | 'speaking' | 'error'

interface HookMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UseVoiceCallOptions {
  /** Sends a message through the normal chat pipeline (streaming + actions). */
  sendMessage: (text: string) => void
  /** True while the assistant response is streaming. */
  loading: boolean
  /** The full chat history — used to speak the latest assistant answer. */
  messages: HookMessage[]
  /** Lets the call end an in-flight stream when hanging up. */
  abortRef: { current: AbortController | null }
  /** Voice prefs (voice, rate, volume) applied when speaking. */
  prefs: VoicePrefs
}

export interface VoiceCall {
  callActive: boolean
  callStatus: CallStatus
  callError: string | null
  interim: string
  muted: boolean
  callSeconds: number
  speechSupported: boolean
  startCall: () => void
  endCall: () => void
  toggleMute: () => void
  clearError: () => void
}

/* ------------------------------------------------------------------ */
/* Speech recognition — minimal structural typing (not in lib.dom)     */
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

/** True when the browser can actually capture audio (getUserMedia). */
function canAccessMicrophone(): boolean {
  if (typeof navigator === 'undefined') return false
  return !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
}

/**
 * Maps a getUserMedia DOMException to a precise, user-actionable message.
 * Never collapses every failure into "microphone denied".
 */
function micErrorMessage(err: unknown): string {
  const name =
    err instanceof DOMException
      ? err.name
      : ((err as { name?: string } | null)?.name ?? 'UnknownError')
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Accès au micro refusé. Autorisez le micro dans les réglages du navigateur (icône micro dans la barre d’adresse), puis réessayez.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Aucun microphone détecté. Branchez ou activez un microphone, puis réessayez.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Le microphone est déjà utilisé par une autre application. Fermez-la, puis réessayez.'
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'Aucun microphone ne correspond aux réglages demandés. Vérifiez vos périphériques audio.'
    case 'SecurityError':
      return 'Le navigateur a bloqué l’accès au microphone sur cette page. Vérifiez les permissions du site.'
    case 'AbortError':
      return 'L’accès au micro a été annulé. Réessayez.'
    default:
      return `Impossible d’accéder au microphone (${name}). Réessayez, ou utilisez Chrome ou Edge.`
  }
}

/* ------------------------------------------------------------------ */
/* Text-to-speech helpers (module-level, stable)                       */
/* ------------------------------------------------------------------ */

/** Light markdown cleanup so the coach's answer reads naturally aloud. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^[#>*•\-–—]+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1400)
}

const STATUS_LABELS: Record<CallStatus, string> = {
  idle: 'Appel terminé',
  starting: 'Connexion…',
  listening: "À l'écoute",
  transcribing: 'Transcription…',
  speaking: 'Le coach vous répond',
  error: 'Appel interrompu',
}

function formatDuration(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60)
  const ss = totalSeconds % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* Hook — the whole voice-call orchestration                           */
/* ------------------------------------------------------------------ */

export function useVoiceCall({
  sendMessage,
  loading,
  messages,
  abortRef,
  prefs,
}: UseVoiceCallOptions): VoiceCall {
  const [callActive, setCallActive] = useState(false)
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [callError, setCallError] = useState<string | null>(null)
  const [interim, setInterim] = useState('')
  const [muted, setMuted] = useState(false)
  const [callSeconds, setCallSeconds] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(true)

  // Refs mirror fast-changing values so the recognition/TTS callbacks (created
  // once per call) never read stale state from their closure.
  const activeRef = useRef(false)
  const pausedRef = useRef(false)
  const mutedRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  /** Live MediaStream held while the call is active — fully released on end/unmount. */
  const streamRef = useRef<MediaStream | null>(null)
  /** Guards against double-start while the permission prompt is pending. */
  const startingRef = useRef(false)
  const sendRef = useRef(sendMessage)
  const loadingRef = useRef(loading)
  const prefsRef = useRef(prefs)
  const lastSpokenRef = useRef(-1)
  const speakTokenRef = useRef(0)

  useEffect(() => {
    sendRef.current = sendMessage
  }, [sendMessage])

  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  // Voice prefs can change mid-call (in-call settings popover) — keep the
  // latest values available to the TTS callback without re-running it.
  useEffect(() => {
    prefsRef.current = prefs
  }, [prefs])

  // Call duration timer
  useEffect(() => {
    if (!callActive) return
    const id = window.setInterval(() => setCallSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [callActive])

  /** Releases the recognition engine and its handlers — nulling the
   *  callbacks prevents late events from firing during teardown (no leaked
   *  listeners, no restart loops). */
  const disposeRecognition = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    rec.onresult = null
    rec.onend = null
    rec.onerror = null
    try {
      rec.abort()
    } catch {
      /* noop */
    }
    recognitionRef.current = null
  }, [])

  /** Stops every audio track of the held MediaStream — the microphone is
   *  fully released and the OS-level "mic in use" indicator disappears. */
  const releaseMicrophone = useCallback(() => {
    const stream = streamRef.current
    streamRef.current = null
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
  }, [])

  // Hard cleanup on unmount (never leave the mic / TTS / stream running)
  useEffect(() => {
    const abort = abortRef.current
    return () => {
      activeRef.current = false
      startingRef.current = false
      disposeRecognition()
      releaseMicrophone()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      abort?.abort()
    }
  }, [abortRef, disposeRecognition, releaseMicrophone])

  // Report unsupported browsers right away — the call button disables itself
  // instead of pretending the voice call works everywhere.
  useEffect(() => {
    setSpeechSupported(Boolean(getRecognitionCtor()) && canAccessMicrophone())
  }, [])

  const startListening = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec || !activeRef.current || pausedRef.current || mutedRef.current) return
    try {
      rec.start()
    } catch {
      // already running or permission still pending — ignore
    }
  }, [])

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {
      /* noop */
    }
  }, [])

  const resumeListening = useCallback(() => {
    pausedRef.current = false
    startListening()
  }, [startListening])

  /** Tears the call down without touching the user-facing error message. */
  const endCallInternal = useCallback(() => {
    activeRef.current = false
    startingRef.current = false
    pausedRef.current = false
    speakTokenRef.current += 1 // invalidate pending TTS callbacks
    disposeRecognition()
    releaseMicrophone()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    abortRef.current?.abort()
    setCallActive(false)
    setCallStatus('idle')
    setInterim('')
  }, [abortRef, disposeRecognition, releaseMicrophone])

  const startCall = () => {
    // Never double-start: active call, or permission prompt already pending.
    if (activeRef.current || startingRef.current) return

    // Speech recognition and getUserMedia only work in a secure context
    // (HTTPS) or on localhost. Fail early with a precise message instead of
    // a confusing "microphone denied" error later.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setCallError(
        'L’appel vocal nécessite une connexion sécurisée (HTTPS ou localhost). La reconnaissance vocale est bloquée sur cette page.'
      )
      return
    }

    const Ctor = getRecognitionCtor()
    if (!Ctor || !canAccessMicrophone()) {
      // Remember the outcome so the header button disables after the first try.
      setSpeechSupported(false)
      setCallError(
        'L’appel vocal n’est pas pris en charge par ce navigateur. Utilisez Chrome ou Edge (HTTPS ou localhost) pour parler au coach.'
      )
      return
    }

    startingRef.current = true
    setCallStatus('starting')
    setCallError(null)

    // Explicit mic permission BEFORE recognition starts. getUserMedia reports
    // the real failure cause (refused / no device / busy / blocked…) and gives
    // us a MediaStream that we hold for the whole call and fully release on
    // hang-up. The permission is never re-requested while the call is active:
    // muting only stops recognition, the stream (and its grant) stays alive.
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        startingRef.current = false
        streamRef.current = stream

        const rec = new Ctor()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = /^fr/i.test(navigator.language) ? 'fr-FR' : 'en-US'

        activeRef.current = true
        pausedRef.current = false
        mutedRef.current = false
        // The last message is already visible/read — never re-speak history.
        lastSpokenRef.current = messages.length - 1
        speakTokenRef.current = 0
        recognitionRef.current = rec

        setMuted(false)
        setInterim('')
        setCallSeconds(0)
        setCallActive(true)
        setCallStatus('listening')

        // Warm up the voice list so pickVoice() has candidates on first speak.
        if ('speechSynthesis' in window) {
          window.speechSynthesis.getVoices()
        }

        rec.onresult = (e) => {
          let finalText = ''
          let interimText = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const result = e.results[i]
            const alt = result[0]
            if (!alt) continue
            if (result.isFinal) finalText += alt.transcript
            else interimText += alt.transcript
          }
          if (interimText.trim()) setInterim(interimText.trim())
          if (finalText.trim()) {
            setInterim('')
            handleVoiceUtterance(finalText.trim())
          }
        }

        rec.onend = () => {
          // Keep the call alive: restart the mic unless we're muted/paused.
          if (activeRef.current && !pausedRef.current && !mutedRef.current) {
            startListening()
          }
        }

        rec.onerror = (ev) => {
          const error = ev.error

          // Fatal, user-fixable errors → end the call and show a precise message.
          if (error === 'not-allowed' || error === 'service-not-allowed') {
            endCallInternal()
            setCallError(
              'Accès au micro refusé. Autorisez le micro dans les réglages du navigateur (icône micro dans la barre d’adresse), puis réessayez.'
            )
            return
          }
          if (error === 'audio-capture') {
            endCallInternal()
            setCallError(
              'Aucun microphone détecté. Branchez ou activez un microphone, puis réessayez.'
            )
            return
          }
          // Transient errors (network, no-speech, aborted, language-not-supported…)
          // → keep the call alive; onend restarts the mic automatically.
        }

        startListening()
      })
      .catch((err: unknown) => {
        // The call never became active — the error banner explains the real
        // cause and offers Réessayer (startCall clears the error and re-runs
        // getUserMedia, so re-granting the permission then retrying works).
        startingRef.current = false
        setCallStatus('error')
        setCallError(micErrorMessage(err))
      })
  }

  /** A finished spoken utterance is sent through the normal chat pipeline. */
  const handleVoiceUtterance = (text: string) => {
    if (loadingRef.current) {
      // Coach is still answering — ignore this utterance, resume the mic soon.
      window.setTimeout(resumeListening, 900)
      return
    }
    pausedRef.current = true // don't hear ourselves while the coach thinks
    stopListening()
    setCallStatus('transcribing')
    sendRef.current(text)
  }

  // Speak the assistant's answer once the stream ends, then resume listening.
  useEffect(() => {
    if (!activeRef.current || loading) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant' || !last.content) return
    const idx = messages.length - 1
    if (idx === 0 || idx === lastSpokenRef.current) return

    // Friendly error messages are shown, not spoken — but keep the call alive.
    if (/désolé|n'ai pas réussi|erreur|trop de requêtes/i.test(last.content)) {
      window.setTimeout(() => {
        if (!activeRef.current) return
        setCallStatus('listening')
        pausedRef.current = false
        startListening()
      }, 400)
      return
    }
    if (mutedRef.current) return

    lastSpokenRef.current = idx
    const token = ++speakTokenRef.current

    window.setTimeout(() => {
      if (!activeRef.current || mutedRef.current || token !== speakTokenRef.current) return
      const resume = () => {
        setCallStatus('listening')
        pausedRef.current = false
        startListening()
      }
      if (!('speechSynthesis' in window)) {
        resume()
        return
      }
      const clean = cleanForSpeech(last.content)
      if (!clean) {
        resume()
        return
      }
      setCallStatus('speaking')
      const utter = new SpeechSynthesisUtterance(clean)
      const p = prefsRef.current
      const voice = pickVoice(p)
      if (voice) utter.voice = voice
      utter.rate = p.rate
      utter.volume = p.volume
      utter.onend = () => {
        if (token !== speakTokenRef.current) return
        resume()
      }
      utter.onerror = () => {
        if (token !== speakTokenRef.current) return
        resume()
      }
      window.speechSynthesis.speak(utter)
    }, 250)
  }, [loading, messages, startListening])

  const endCall = () => {
    endCallInternal()
    setCallError(null)
  }

  const toggleMute = () => {
    const next = !muted
    mutedRef.current = next
    setMuted(next)
    if (next) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      stopListening()
      speakTokenRef.current += 1 // cancel pending speech callbacks
    } else {
      setCallStatus('listening')
      resumeListening()
    }
  }

  const clearError = () => setCallError(null)

  return {
    callActive,
    callStatus,
    callError,
    interim,
    muted,
    callSeconds,
    speechSupported,
    startCall,
    endCall,
    toggleMute,
    clearError,
  }
}

/* ------------------------------------------------------------------ */
/* Call bar UI                                                         */
/* ------------------------------------------------------------------ */

interface VoiceCallBarProps {
  status: CallStatus
  interim: string
  muted: boolean
  callSeconds: number
  onToggleMute: () => void
  onEnd: () => void
  /** Voice prefs + voice list for the in-call settings popover. */
  prefs: VoicePrefs
  onPrefsChange: (next: VoicePrefs) => void
  voices: SpeechSynthesisVoice[]
  voicesLoaded: boolean
}

export function VoiceCallBar({
  status,
  interim,
  muted,
  callSeconds,
  onToggleMute,
  onEnd,
  prefs,
  onPrefsChange,
  voices,
  voicesLoaded,
}: VoiceCallBarProps) {
  const reduce = useReducedMotion()
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="relative">
      <div className="rounded-2xl border border-primary/20 bg-card shadow-kin px-4 py-3 flex items-center gap-3">
        {/* Pulsing orb */}
        <div className="relative w-11 h-11 shrink-0">
          {status === 'listening' && (
            <motion.span
              animate={reduce ? { opacity: 0.35 } : { scale: [1, 1.7], opacity: [0.5, 0] }}
              transition={{ repeat: Infinity, duration: 1.3, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full bg-primary/30"
              aria-hidden
            />
          )}
          <div
            className={cn(
              'absolute inset-0 rounded-full flex items-center justify-center transition-colors duration-300',
              status === 'speaking' ? 'bg-kin-sage/20 text-kin-sage' : 'bg-primary/10 text-primary'
            )}
          >
            {status === 'speaking' ? (
              <Volume2 className="w-5 h-5" aria-hidden />
            ) : (
              <Mic className="w-5 h-5" aria-hidden />
            )}
          </div>
        </div>

        {/* Status + live transcription */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="tabular-nums">{formatDuration(callSeconds)}</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/40" aria-hidden />
            {STATUS_LABELS[status]}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {interim
              ? `« ${interim} »`
              : status === 'speaking'
                ? 'Le coach s’exprime…'
                : 'Parlez librement, je vous écoute.'}
          </p>
        </div>

        {/* Voice settings popover toggle */}
        <button
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Réglages de la voix"
          aria-expanded={showSettings}
          title="Réglages de la voix"
          className={cn(
            'w-11 h-11 shrink-0 rounded-xl border border-border bg-background flex items-center justify-center transition-smooth',
            showSettings
              ? 'text-primary border-primary/40 bg-primary/10'
              : 'text-muted-foreground hover:text-foreground hover:border-primary/40'
          )}
        >
          <Settings2 className="w-4.5 h-4.5" aria-hidden />
        </button>

        {/* Mute */}
        <button
          onClick={onToggleMute}
          aria-label={muted ? 'Réactiver le micro' : 'Couper le micro'}
          title={muted ? 'Réactiver le micro' : 'Couper le micro'}
          className={cn(
            'w-11 h-11 shrink-0 rounded-xl border border-border bg-background flex items-center justify-center transition-smooth',
            muted
              ? 'text-destructive border-destructive/40 hover:bg-destructive/5'
              : 'text-muted-foreground hover:text-foreground hover:border-primary/40'
          )}
        >
          {muted ? <MicOff className="w-4.5 h-4.5" aria-hidden /> : <Mic className="w-4.5 h-4.5" aria-hidden />}
        </button>

        {/* Hang up */}
        <button
          onClick={onEnd}
          aria-label="Raccrocher"
          title="Raccrocher"
          className="w-11 h-11 shrink-0 rounded-xl bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 active:scale-95 transition-smooth"
        >
          <PhoneOff className="w-4.5 h-4.5" aria-hidden />
        </button>
      </div>

      {/* In-call settings popover */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="absolute bottom-full right-0 mb-2 w-72 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-popover shadow-xl p-4 z-30"
          >
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-primary" aria-hidden />
              Voix du coach
            </p>
            <VoiceSettingsPanel
              prefs={prefs}
              onChange={onPrefsChange}
              voices={voices}
              voicesLoaded={voicesLoaded}
              compact
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Pre-call home screen — tune the voice before the call starts        */
/* ------------------------------------------------------------------ */

interface VoiceCallHomeProps {
  /** Starts the call (mic + listening loop). */
  onStart: () => void
  /** Closes the home screen without starting the call. */
  onClose: () => void
  /** Voice prefs + voice list for the settings panel. */
  prefs: VoicePrefs
  onPrefsChange: (next: VoicePrefs) => void
  voices: SpeechSynthesisVoice[]
  voicesLoaded: boolean
  /** False when the browser has no speech recognition → disable start. */
  supported: boolean
}

export function VoiceCallHome({
  onStart,
  onClose,
  prefs,
  onPrefsChange,
  voices,
  voicesLoaded,
  supported,
}: VoiceCallHomeProps) {
  const reduce = useReducedMotion()
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="relative">
      <div className="rounded-2xl border border-primary/20 bg-card shadow-kin px-4 py-4 flex items-center gap-3">
        {/* Coach orb */}
        <div className="relative w-12 h-12 shrink-0">
          <motion.span
            animate={reduce ? { opacity: 0.3 } : { scale: [1, 1.6], opacity: [0.4, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full bg-primary/25"
            aria-hidden
          />
          <div className="absolute inset-0 rounded-full bg-primary/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary" aria-hidden />
          </div>
        </div>

        {/* Title + hint */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Appel vocal avec le coach</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Réglez la voix du coach, puis démarrez l’appel pour parler en mains libres.
          </p>
        </div>

        {/* Voice settings toggle */}
        <button
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Réglages de la voix"
          aria-expanded={showSettings}
          title="Réglages de la voix"
          className={cn(
            'w-11 h-11 shrink-0 rounded-xl border border-border bg-background flex items-center justify-center transition-smooth',
            showSettings
              ? 'text-primary border-primary/40 bg-primary/10'
              : 'text-muted-foreground hover:text-foreground hover:border-primary/40'
          )}
        >
          <Settings2 className="w-4.5 h-4.5" aria-hidden />
        </button>

        {/* Start call */}
        <Button
          onClick={onStart}
          disabled={!supported}
          size="lg"
          className="gap-1.5 shrink-0"
          title={supported ? "Démarrer l'appel vocal" : 'Appel vocal non pris en charge par ce navigateur'}
        >
          <Phone className="w-3.5 h-3.5" aria-hidden />
          Démarrer
        </Button>

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Fermer l'écran d'appel"
          title="Fermer"
          className="w-11 h-11 shrink-0 rounded-xl border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-smooth"
        >
          <X className="w-4.5 h-4.5" aria-hidden />
        </button>
      </div>

      {/* Voice settings panel (expands below the card) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-2xl border border-border bg-popover shadow-xl p-4">
              <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-primary" aria-hidden />
                Voix du coach
              </p>
              <VoiceSettingsPanel
                prefs={prefs}
                onChange={onPrefsChange}
                voices={voices}
                voicesLoaded={voicesLoaded}
                compact
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
