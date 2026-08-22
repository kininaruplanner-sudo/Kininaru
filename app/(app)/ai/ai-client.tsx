'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Send,
  User,
  RotateCcw,
  Copy,
  Check,
  CalendarDays,
  Sunrise,
  TrendingUp,
  ListChecks,
  Target,
  Moon,
  Square,
  Phone,
  AlertCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CoachMascot } from '@/components/coach-mascot'
import { PageHeader } from '@/components/page-header'
import { ActionsPanel, type PendingAction } from './actions-panel'
import { isMemoryEnabled } from '@/lib/memory'
import { useVoiceCall, VoiceCallBar, VoiceCallHome } from './voice-call'
import { useVoicePrefs } from '@/lib/voice-preferences'
import type { AiAction } from '@/lib/ai/actions'
import {
  listConversations,
  createConversation,
  renameConversation as renameConversationApi,
  deleteConversation as deleteConversationApi,
  loadMessages,
  appendMessage,
  touchConversation,
  type CoachConversation,
} from '@/lib/coach/conversations'
import { ConversationsPanel, ConversationsChips } from './conversations-sidebar'

const SUGGESTIONS = [
  { icon: CalendarDays, text: 'Planifier ma journée' },
  { icon: Target, text: 'Mes priorités' },
  { icon: TrendingUp, text: 'Analyser ma semaine' },
  { icon: Sunrise, text: 'Créer une routine' },
  { icon: ListChecks, text: 'Découper un objectif' },
  { icon: Moon, text: 'Préparer demain' },
]

const GREETING =
  'Bonjour ! Je suis le coach Kininaru. Je connais vos tâches, habitudes et événements — je peux planifier votre journée, fixer vos priorités, analyser votre semaine et préparer vos prochaines étapes. Par quoi commençons-nous ?'

/**
 * Détection locale des demandes d'analyse (FR/EN, conservative) : au lieu
 * de laisser le modèle inventer des statistiques, on ouvre l'écran Analyse
 * qui calcule TOUT sur les données réelles (tâches, habitudes, focus,
 * journal — 90 jours). La réponse du coach ne contient jamais de chiffre
 * inventé.
 */
function isAnalysisRequest(text: string): boolean {
  const t = text.toLowerCase()
  return (
    /\banaly/.test(t) || // analyser / analyse / analysis…
    /\b(statistiques|stats|statistics)\b/.test(t) ||
    /\bproductiv/.test(t) || // productivité / productivity
    /\bbilan de (ma|la|cette)/.test(t) ||
    /\bcomment ai-je\b/.test(t) || // « Comment ai-je été cette semaine ? »
    /\bcomment (je|j')ai (été|passe|passé|fait|vécu|vecu)/.test(t) ||
    /\bweekly review\b/.test(t) ||
    /\bhow (was|did) my week\b/.test(t)
  )
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const freshGreeting = (): Message[] => [{ role: 'assistant', content: GREETING, timestamp: Date.now() }]

/** Strips UI-only fields (timestamp) before sending — API shape stays {messages:[{role,content}]}. */
const toApiMessages = (msgs: Message[]) => msgs.map(({ role, content }) => ({ role, content }))

async function streamAIResponse(
  history: { role: 'user' | 'assistant'; content: string }[],
  onChunk: (chunkText: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // memoryEnabled follows the Settings → Mémoire master switch.
    body: JSON.stringify({ messages: history, memoryEnabled: isMemoryEnabled() }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error('AI request failed')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }
}

/* ------------------------------------------------------------------ */
/* Action protocol parsing                                             */
/* ------------------------------------------------------------------ */

const ACTION_WHITELIST = new Set([
  'create_task',
  'create_tasks_batch',
  'create_objective',
  'create_goal',
  'create_habit',
  'create_event',
  'create_family_task',
  'create_memory',
  'complete_task',
  'update_task',
  'start_focus',
])

function extractActions(rawText: string): { text: string; actions: PendingAction[] } {
  const marker = '==ACTIONS=='
  const idx = rawText.indexOf(marker)
  if (idx === -1) return { text: rawText, actions: [] }

  const text = rawText.slice(0, idx).trimEnd()
  const jsonPart = rawText.slice(idx + marker.length).trim()
  const fenced = jsonPart.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = (fenced ? fenced[1] : jsonPart).trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { text, actions: [] }
  }

  if (!Array.isArray(parsed)) return { text, actions: [] }

  const actions: PendingAction[] = []
  for (const item of parsed.slice(0, 5)) {
    if (typeof item !== 'object' || item === null) continue
    const { action, data } = item as { action?: unknown; data?: unknown }
    if (typeof action !== 'string' || !ACTION_WHITELIST.has(action)) continue
    if (typeof data !== 'object' || data === null) continue
    actions.push({ id: `${action}-${actions.length}`, action: { action, data } as AiAction })
  }
  return { text, actions }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface Props {
  displayName: string
  /** Rendered inside the floating assistant panel: no page header, no
      conversation sidebar (chips only) so it fits a narrow right drawer. */
  embedded?: boolean
}

export function AIAssistantClient({ displayName, embedded }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(freshGreeting)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([])
  const [showCallHome, setShowCallHome] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Conversation persistence (ÉTAPE 14 §16-18): the AI page keeps a real
  // history in Supabase. `convRef` mirrors `activeConvId` so the streaming
  // path can persist without stale closures.
  const [conversations, setConversations] = useState<CoachConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [convsLoading, setConvsLoading] = useState(true)
  const convRef = useRef<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingActions])

  // Auto-resize the composer as the user types, capped so it never takes over the screen
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  // Load the conversation history once on mount. Failure-tolerant: if the
  // coach tables are missing (SQL not run yet), the list stays empty and the
  // chat works exactly as before.
  useEffect(() => {
    let cancelled = false
    listConversations().then((list) => {
      if (cancelled) return
      setConversations(list)
      setConvsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Resume an old conversation: load its last messages and restore the chat.
  const selectConversation = async (id: string) => {
    if (id === activeConvId) return
    abortRef.current?.abort()
    setShowCallHome(false)
    setPendingActions([])
    const rows = await loadMessages(id)
    if (rows.length === 0) {
      setMessages(freshGreeting())
    } else {
      setMessages(
        rows.map((r) => ({
          role: r.role,
          content: r.content,
          timestamp: Date.parse(r.created_at) || Date.now(),
        }))
      )
    }
    setActiveConvId(id)
    convRef.current = id
  }

  const sendMessage = async (text: string) => {
    const content = text.trim()
    if (!content || loading) return

    setInput('')
    setPendingActions([])
    const userMessage: Message = { role: 'user', content, timestamp: Date.now() }
    // Send the full history (including the new message) so the model keeps context
    const history = [...messages, userMessage]
    setMessages([...history, { role: 'assistant', content: '', timestamp: Date.now() }])
    setLoading(true)

    // Persistence: auto-create the conversation on the first message, then
    // store the user turn. Failures are swallowed — the chat never breaks
    // because persistence is unavailable.
    if (!convRef.current) {
      const created = await createConversation(content.slice(0, 60))
      if (created) {
        convRef.current = created.id
        setActiveConvId(created.id)
        setConversations((prev) => [created, ...prev])
      }
    }
    if (convRef.current) void appendMessage(convRef.current, 'user', content)

    // Analyse à la demande : l'IA détecte la demande, répond sans inventer
    // de chiffre, et ouvre l'écran Analyse (statistiques calculées sur les
    // données réelles des 90 derniers jours).
    if (isAnalysisRequest(content)) {
      const reply =
        "📊 C'est parti — je t'ouvre ton analyse. Elle est calculée sur tes données réelles " +
        '(tâches, habitudes, sessions de focus, journal) des 90 derniers jours — aucune ' +
        'statistique inventée.'
      setMessages([...history, { role: 'assistant', content: reply, timestamp: Date.now() }])
      if (convRef.current) {
        void appendMessage(convRef.current, 'assistant', reply)
        void touchConversation(convRef.current)
      }
      setLoading(false)
      router.push('/analytics')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      let fullText = ''
      await streamAIResponse(toApiMessages(history), (chunk) => {
        fullText += chunk
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], content: fullText }
          return next
        })
      })
      // Streaming finished: detach any structured action proposal.
      const { text: cleanText, actions } = extractActions(fullText)
      if (actions.length > 0) {
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], content: cleanText }
          return next
        })
        setPendingActions(actions)
      }

      // Store the assistant turn and bump the conversation to the top.
      const finalText = cleanText || fullText
      if (convRef.current && finalText) {
        void appendMessage(convRef.current, 'assistant', finalText)
        void touchConversation(convRef.current)
        setConversations((prev) =>
          prev
            .map((c) =>
              c.id === convRef.current ? { ...c, updated_at: new Date().toISOString() } : c
            )
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        )
      }
    } catch {
      if (!controller.signal.aborted) {
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: "Désolé, je n'ai pas réussi à joindre l'IA. Réessaie dans un instant.",
          }
          return next
        })
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  // Listen for quick-action messages from the side panel (on /ai page)
  useEffect(() => {
    const onAiSend = (e: Event) => {
      const msg = (e as CustomEvent).detail?.message
      if (typeof msg === 'string' && msg.trim()) {
        sendMessage(msg.trim())
      }
    }
    window.addEventListener('kininaru:ai-send', onAiSend)
    return () => window.removeEventListener('kininaru:ai-send', onAiSend)
  }, [sendMessage])

  // Voice-call mode: speaks the coach's answers aloud and keeps listening,
  // like a hands-free phone call. Reuses the exact same chat pipeline above.
  // Voice prefs (voice / rate / volume) live in the shared settings page and
  // in the in-call popover — persisted per device.
  const voicePrefs = useVoicePrefs()
  const voice = useVoiceCall({
    sendMessage,
    loading,
    messages,
    abortRef,
    prefs: voicePrefs.prefs,
  })

  // The header button opens the pre-call home screen (tune the voice before
  // the call starts); "Démarrer" on that screen starts the actual call.
  const startVoiceCall = () => {
    setShowCallHome(false)
    voice.startCall()
  }

  const stop = () => {
    abortRef.current?.abort()
  }

  const handleSend = () => sendMessage(input)

  // Start a fresh chat and detach from any persisted conversation.
  const newConversation = () => {
    abortRef.current?.abort()
    setMessages(freshGreeting())
    setInput('')
    setPendingActions([])
    setShowCallHome(false)
    setActiveConvId(null)
    convRef.current = null
  }

  const renameConversation = async (id: string, title: string) => {
    const ok = await renameConversationApi(id, title)
    if (ok) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c))
      )
    }
  }

  const removeConversation = async (id: string) => {
    const ok = await deleteConversationApi(id)
    if (ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (convRef.current === id) newConversation()
    }
  }

  const dismissActions = (ids: string[]) => {
    setPendingActions((prev) => prev.filter((a) => !ids.includes(a.id)))
  }

  // Apply an edited proposal back into the pending list (before confirmation).
  const editAction = (id: string, action: AiAction) => {
    setPendingActions((prev) => prev.map((a) => (a.id === id ? { ...a, action } : a)))
  }

  const copyMessage = (idx: number, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    })
  }

  // Renders **bold**, groups consecutive bullet/numbered lines into real <ul>/<ol> lists
  // instead of flat paragraphs, and blank lines become breathing room.
  //
  // Security: every chunk coming from the model is HTML-escaped BEFORE the bold
  // transform, so the model can never inject raw HTML into the DOM (XSS). The
  // bold markers survive escaping because we escape first, then wrap.
  const renderContent = (text: string) => {
    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    const boldify = (s: string) => escapeHtml(s).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    const lines = text.split('\n')
    const blocks: ReactNode[] = []
    let list: { type: 'ul' | 'ol'; items: string[] } | null = null

    const flushList = (key: string) => {
      if (!list) return
      const items = list.items
      const isOl = list.type === 'ol'
      blocks.push(
        isOl ? (
          <ol key={key} className="space-y-1 my-1 pl-5 list-decimal">
            {items.map((item, idx) => (
              <li key={idx} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: boldify(item) }} />
            ))}
          </ol>
        ) : (
          <ul key={key} className="space-y-1 my-1 pl-5 list-disc">
            {items.map((item, idx) => (
              <li key={idx} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: boldify(item) }} />
            ))}
          </ul>
        )
      )
      list = null
    }

    lines.forEach((line, i) => {
      const bullet = line.match(/^[•\-*]\s+(.*)/)
      const numbered = line.match(/^\d+\.\s+(.*)/)
      if (bullet) {
        if (!list || list.type !== 'ul') {
          flushList(`flush-${i}`)
          list = { type: 'ul', items: [] }
        }
        list.items.push(bullet[1])
      } else if (numbered) {
        if (!list || list.type !== 'ol') {
          flushList(`flush-${i}`)
          list = { type: 'ol', items: [] }
        }
        list.items.push(numbered[1])
      } else {
        flushList(`flush-${i}`)
        if (line.trim() === '') {
          blocks.push(<div key={i} className="h-1.5" />)
        } else {
          blocks.push(<p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: boldify(line) || '&nbsp;' }} />)
        }
      }
    })
    flushList('flush-end')
    return blocks
  }

  const hasStartedChat = messages.length > 1

  return (
    <div className="flex h-full">
      {!embedded && (
        <ConversationsPanel
          conversations={conversations}
          activeId={activeConvId}
          loading={convsLoading}
          onNew={newConversation}
          onSelect={selectConversation}
          onRename={renameConversation}
          onDelete={removeConversation}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {!embedded && (
        <PageHeader
        icon={CoachMascot}
        title="Assistant IA"
        subtitle="Votre coach personnel de productivité"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!voice.callActive) setShowCallHome(true)
              }}
              disabled={!voice.speechSupported}
              className={cn(
                'gap-1.5',
                (voice.callActive || showCallHome) && 'border-primary/50 bg-primary/10 text-primary'
              )}
              title={
                voice.speechSupported
                  ? 'Appel vocal avec le coach'
                  : 'Appel vocal non pris en charge par ce navigateur'
              }
            >
              <Phone className="w-3.5 h-3.5" />
              {voice.callActive ? 'Appel en cours' : 'Appel vocal'}
            </Button>
            <Button variant="ghost" size="sm" onClick={newConversation} className="gap-1.5" title="Nouvelle conversation">
              <RotateCcw className="w-3.5 h-3.5" />
              Nouvelle conversation
            </Button>
          </div>
        }
        />
        )}

      <ConversationsChips
        conversations={conversations}
        activeId={activeConvId}
        loading={convsLoading}
        onNew={newConversation}
        onSelect={selectConversation}
        embedded={embedded}
      />

      {/* Messages */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Welcome state */}
        {!hasStartedChat && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-center max-w-md mx-auto pt-6 pb-4"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-kin" style={{ background: 'linear-gradient(135deg, #8fb5a1 0%, #b0a5d4 50%, #e0a89a 100%)' }}>
              <CoachMascot mood="calm" className="w-8 h-8 text-white" />
            </div>
            <h2 className="kin-h2 text-foreground mb-2"><span className="kin-ai-gradient">Comment puis-je vous aider</span>, {displayName} ?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Je peux planifier votre journée, fixer vos priorités, analyser votre semaine,
              découper un objectif en étapes — et créer des tâches, habitudes ou événements
              avec votre confirmation.
            </p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1
            const isEmptyPlaceholder = loading && isLast && msg.role === 'assistant' && msg.content === ''
            const isActivelyStreaming = loading && isLast && msg.role === 'assistant' && msg.content !== ''

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className={cn('flex gap-3 group', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
              >
                <div className={cn(
                  'relative w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                )}>
                  {isEmptyPlaceholder && (
                    <motion.span
                      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full bg-primary/40"
                    />
                  )}
                  {msg.role === 'user'
                    ? <User className="w-4 h-4" />
                    :              <div className="w-5 h-5 flex items-center justify-center" style={{ color: '#b0a5d4' }}>
                <CoachMascot mood={isActivelyStreaming || isEmptyPlaceholder ? 'loading' : 'calm'} className="w-5 h-5" />
              </div>
                  }
                </div>

                <div className={cn('flex flex-col gap-1 max-w-[80%] sm:max-w-[75%]', msg.role === 'user' ? 'items-end' : 'items-start')}>
                  <div className={cn(
                    'rounded-2xl px-4 py-3 text-sm space-y-1 leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-kin'
                      : 'bg-muted/60 border border-border/60 rounded-tl-sm'
                  )}>
                    {isEmptyPlaceholder ? (
                      <div className="flex gap-1.5 py-1 px-0.5">
                        {[0, 1, 2].map((dot) => (
                          <motion.div
                            key={dot}
                            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 1.1, delay: dot * 0.15, ease: [0.4, 0, 0.2, 1] }}
                            className="w-2 h-2 rounded-full bg-primary/60"
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                        {renderContent(msg.content)}
                        {isActivelyStreaming && (
                          <motion.span
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                            className="inline-block w-[2px] h-3.5 bg-current align-middle ml-0.5 translate-y-0.5"
                          />
                        )}
                      </>
                    )}
                  </div>

                  {!isEmptyPlaceholder && (
                    <div className={cn(
                      // Always visible on touch devices (no hover) — hidden until
                      // hover on desktop only.
                      'flex items-center gap-2 px-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-smooth',
                      msg.role === 'user' && 'flex-row-reverse'
                    )}>
                      <span className="text-[10px] text-muted-foreground/70">{format(msg.timestamp, 'HH:mm')}</span>
                      {msg.role === 'assistant' && !isActivelyStreaming && msg.content && (
                        <button
                          onClick={() => copyMessage(i, msg.content)}
                          className="min-w-11 min-h-11 sm:min-w-7 sm:min-h-7 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                          title="Copier"
                          aria-label="Copier la réponse"
                        >
                          {copiedIdx === i ? <Check className="w-3 h-3 text-kin-sage" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Structured action proposals (below the assistant message) */}
        {pendingActions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pl-11 max-w-[80%] sm:max-w-[75%]"
          >
            <ActionsPanel actions={pendingActions} onDismiss={dismissActions} onEdit={editAction} />
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Voice call — setup error banner */}
      {voice.callError && !voice.callActive && (
        <div className="px-4 sm:px-6 pb-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <span className="flex-1 leading-relaxed">{voice.callError}</span>
            {voice.speechSupported && (
              <button
                onClick={() => {
                  // startCall() clears the error and restarts the mic — lets the
                  // user retry right after granting the permission in the browser.
                  voice.startCall()
                }}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 py-1 font-medium text-destructive hover:bg-destructive/10 active:scale-95 transition-smooth"
              >
                <RotateCcw className="w-3 h-3" aria-hidden />
                Réessayer
              </button>
            )}
            <button
              onClick={voice.clearError}
              className="w-6 h-6 flex items-center justify-center rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-smooth shrink-0"
              aria-label="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Voice call — active call bar */}
      {voice.callActive && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="px-4 sm:px-6 pb-3"
        >
          <VoiceCallBar
            status={voice.callStatus}
            interim={voice.interim}
            muted={voice.muted}
            callSeconds={voice.callSeconds}
            onToggleMute={voice.toggleMute}
            onEnd={voice.endCall}
            prefs={voicePrefs.prefs}
            onPrefsChange={voicePrefs.setPrefs}
            voices={voicePrefs.voices}
            voicesLoaded={voicePrefs.voicesLoaded}
          />
        </motion.div>
      )}

      {/* Voice call — pre-call home screen (tune the voice before starting) */}
      {!voice.callActive && showCallHome && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="px-4 sm:px-6 pb-3"
        >
          <VoiceCallHome
            onStart={startVoiceCall}
            onClose={() => setShowCallHome(false)}
            prefs={voicePrefs.prefs}
            onPrefsChange={voicePrefs.setPrefs}
            voices={voicePrefs.voices}
            voicesLoaded={voicePrefs.voicesLoaded}
            supported={voice.speechSupported}
          />
        </motion.div>
      )}

      {/* Suggestions */}
      {!hasStartedChat && !voice.callActive && !showCallHome && (
        <div className="px-4 sm:px-6 pb-4">
          <p className="text-xs text-muted-foreground mb-2.5">Essayez :</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={s.text}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                onClick={() => sendMessage(s.text)}                      className="flex items-center gap-2 px-3 py-1.5 min-h-9 sm:min-h-9 rounded-full border border-border bg-card text-sm text-foreground hover:border-kp-lavender hover:bg-kp-lavender/10 hover:-translate-y-0.5 transition-smooth shadow-kin"
              >
                <s.icon className="w-3.5 h-3.5 shrink-0" style={{ color: '#b0a5d4' }} />
                {s.text}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Input — safe-area padding keeps the composer reachable above the home bar */}
      <div className="px-4 sm:px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 border-t border-border bg-background">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Posez-moi une question, ${displayName}…`}
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm leading-relaxed max-h-40 focus:outline-none focus:border-ring focus:ring-3 focus:ring-ring/15 transition-smooth placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          {loading ? (
            <Button
              onClick={stop}
              size="icon"
              variant="outline"
              className="h-11 w-11 rounded-2xl shrink-0 transition-smooth"
              aria-label="Arrêter la réponse"
              title="Arrêter"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              size="icon"
              className="h-11 w-11 rounded-2xl shrink-0 transition-smooth hover:scale-105"
              aria-label="Envoyer le message"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-1.5 px-1">Entrée pour envoyer · Maj + Entrée pour un saut de ligne</p>
        </div>
      </div>
    </div>
  )
}
