'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { CallStatus } from '@/app/(app)/ai/voice-call'
import type { VoicePrefs } from '@/lib/voice-preferences'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface VoiceCallContextValue {
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
  /** Register the sendMessage function from the mounted AI client. */
  registerSend: (fn: ((text: string) => void) | null) => void
  /** Register the loading state from the mounted AI client. */
  registerLoading: (loading: boolean) => void
  /** Register the messages array from the mounted AI client. */
  registerMessages: (msgs: Array<{ role: 'user' | 'assistant'; content: string }>) => void
  /** Register the abort controller ref from the mounted AI client. */
  registerAbortRef: (ref: { current: AbortController | null } | null) => void
  /** Register voice prefs from the mounted settings. */
  registerPrefs: (prefs: VoicePrefs) => void
  /** Register available voices. */
  registerVoices: (voices: SpeechSynthesisVoice[]) => void
  /** Whether voices list is loaded. */
  voicesLoaded: boolean
  voices: SpeechSynthesisVoice[]
}

/* ------------------------------------------------------------------ */
/* Speech recognition typing                                          */
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
      return 'Le microphone est déjà utilisé par une autre application.'
    case 'SecurityError':
      return 'Le navigateur a bloqué l\'accès au microphone sur cette page.'
    default:
      return `Impossible d'accéder au microphone (${name}). Réessayez.`
  }
}

function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^[#>*•\-–—]+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1400)
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null)

export function useVoiceCallGlobal() {
  const ctx = useContext(VoiceCallContext)
  if (!ctx) throw new Error('useVoiceCallGlobal must be used within VoiceCallProvider')
  return ctx
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function VoiceCallProvider({ children }: { children: React.ReactNode }) {
  const [callActive, setCallActive] = useState(false)
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [callError, setCallError] = useState<string | null>(null)
  const [interim, setInterim] = useState('')
  const [muted, setMuted] = useState(false)
  const [callSeconds, setCallSeconds] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  // Refs for values that change across navigation but the recognition
  // callbacks (created once per call) need the latest.
  const activeRef = useRef(false)
  const pausedRef = useRef(false)
  const mutedRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startingRef = useRef(false)
  const sendRef = useRef<((text: string) => void) | null>(null)
  const loadingRef = useRef(false)
  const prefsRef = useRef<VoicePrefs | null>(null)
  const abortRef = useRef<{ current: AbortController | null } | null>(null)
  const lastSpokenRef = useRef(-1)
  const speakTokenRef = useRef(0)

  // Registration functions — the AI client calls these on mount
  const registerSend = useCallback((fn: ((text: string) => void) | null) => {
    sendRef.current = fn
  }, [])

  const registerLoading = useCallback((loading: boolean) => {
    loadingRef.current = loading
  }, [])

  const registerMessages = useCallback((_msgs: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    // Messages are tracked via lastSpokenRef — we don't store them here
    // because the TTS effect in useVoiceCall handles this. For the global
    // provider, we track the last message index externally.
  }, [])

  const registerAbortRef = useCallback((ref: { current: AbortController | null } | null) => {
    abortRef.current = ref
  }, [])

  const registerPrefs = useCallback((prefs: VoicePrefs) => {
    prefsRef.current = prefs
  }, [])

  const registerVoices = useCallback((v: SpeechSynthesisVoice[]) => {
    setVoices(v)
    setVoicesLoaded(v.length > 0)
  }, [])

  // Call duration timer
  useEffect(() => {
    if (!callActive) return
    const id = window.setInterval(() => setCallSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [callActive])

  // Detect speech support on mount
  useEffect(() => {
    setSpeechSupported(Boolean(getRecognitionCtor()) && canAccessMicrophone())
    // Load voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const list = window.speechSynthesis.getVoices()
      if (list.length > 0) {
        setVoices(list)
        setVoicesLoaded(true)
      }
      const refresh = () => {
        const v = window.speechSynthesis.getVoices()
        setVoices(v)
        setVoicesLoaded(v.length > 0)
      }
      window.speechSynthesis.addEventListener('voiceschanged', refresh)
      return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh)
    }
  }, [])

  const disposeRecognition = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    rec.onresult = null
    rec.onend = null
    rec.onerror = null
    try { rec.abort() } catch { /* noop */ }
    recognitionRef.current = null
  }, [])

  const releaseMicrophone = useCallback(() => {
    const stream = streamRef.current
    streamRef.current = null
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const startListening = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec || !activeRef.current || pausedRef.current || mutedRef.current) return
    try { rec.start() } catch { /* already running */ }
  }, [])

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop() } catch { /* noop */ }
  }, [])

  const resumeListening = useCallback(() => {
    pausedRef.current = false
    startListening()
  }, [startListening])

  const endCallInternal = useCallback(() => {
    activeRef.current = false
    startingRef.current = false
    pausedRef.current = false
    mutedRef.current = false
    speakTokenRef.current += 1
    disposeRecognition()
    releaseMicrophone()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    abortRef.current?.current?.abort()
    setCallActive(false)
    setCallStatus('idle')
    setInterim('')
    setCallSeconds(0)
  }, [disposeRecognition, releaseMicrophone])

  const handleVoiceUtterance = useCallback((text: string) => {
    if (loadingRef.current) {
      window.setTimeout(resumeListening, 900)
      return
    }
    pausedRef.current = true
    stopListening()
    setCallStatus('transcribing')
    sendRef.current?.(text)
  }, [resumeListening, stopListening])

  const startCall = useCallback(() => {
    if (activeRef.current || startingRef.current) return

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setCallError('L\'appel vocal nécessite HTTPS ou localhost.')
      return
    }

    const Ctor = getRecognitionCtor()
    if (!Ctor || !canAccessMicrophone()) {
      setSpeechSupported(false)
      setCallError('L\'appel vocal n\'est pas pris en charge par ce navigateur.')
      return
    }

    startingRef.current = true
    setCallStatus('starting')
    setCallError(null)

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
        lastSpokenRef.current = -1
        speakTokenRef.current = 0
        recognitionRef.current = rec

        setMuted(false)
        setInterim('')
        setCallSeconds(0)
        setCallActive(true)
        setCallStatus('listening')

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
          if (activeRef.current && !pausedRef.current && !mutedRef.current) {
            startListening()
          }
        }

        rec.onerror = (ev) => {
          const error = ev.error
          if (error === 'not-allowed' || error === 'service-not-allowed') {
            endCallInternal()
            setCallError('Accès au micro refusé. Autorisez le micro dans les réglages du navigateur.')
            return
          }
          if (error === 'audio-capture') {
            endCallInternal()
            setCallError('Aucun microphone détecté.')
            return
          }
        }

        startListening()
      })
      .catch((err: unknown) => {
        startingRef.current = false
        setCallStatus('error')
        setCallError(micErrorMessage(err))
      })
  }, [handleVoiceUtterance, startListening, endCallInternal])

  const endCall = useCallback(() => {
    endCallInternal()
    setCallError(null)
  }, [endCallInternal])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      mutedRef.current = next
      if (next) {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel()
        }
        stopListening()
        speakTokenRef.current += 1
      } else {
        setCallStatus('listening')
        pausedRef.current = false
        startListening()
      }
      return next
    })
  }, [startListening, stopListening])

  const clearError = useCallback(() => setCallError(null), [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false
      startingRef.current = false
      disposeRecognition()
      releaseMicrophone()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [disposeRecognition, releaseMicrophone])

  const value: VoiceCallContextValue = {
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
    registerSend,
    registerLoading,
    registerMessages,
    registerAbortRef,
    registerPrefs,
    registerVoices,
    voicesLoaded,
    voices,
  }

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
    </VoiceCallContext.Provider>
  )
}
