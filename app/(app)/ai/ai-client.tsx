'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from '@/lib/date-fr'
import { Send, Sparkles, User, Bot, RotateCcw, Copy, Check, CalendarDays, Sunrise, TrendingUp, BookOpen, Repeat2, Target, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { cardVariants } from '@/components/ui/card'

const QUICK_ACTIONS = [
  { icon: CalendarDays, text: 'Planifier ma journée' },
  { icon: Target, text: 'Mes priorités' },
  { icon: BookOpen, text: 'Transformer une idée en tâche' },
  { icon: TrendingUp, text: 'Planifier un objectif' },
  { icon: Repeat2, text: 'Résumer ma semaine' },
  { icon: Sunrise, text: 'Aide-moi à me concentrer' },
]

const GREETING = "Bonjour ! Je suis votre assistant IA Kininaru. Je peux vous aider à planifier votre journée, construire des habitudes, fixer des objectifs et rester productif. Sur quoi voulez-vous travailler aujourd'hui ?"

function extractTaskTitle(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const patterns = [
    /(?:ajoute|ajouter|crée|créer|nouvelle tâche|tâche)\s+(?:la\s+)?(?:tâche\s+)?(.+)/i,
    /(?:pour|à|:)\\s*(.+)$/i,
  ]

  for (const pattern of patterns) {
    const match = trimmed.match(pattern)
    if (match?.[1]) {
      return match[1].replace(/[?.!]+$/g, '').trim()
    }
  }

  return trimmed
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  actionRequest?: {
    kind: 'confirm_action'
    prompt: string
    action: string
  }
}

const freshGreeting = (): Message[] => [{ role: 'assistant', content: GREETING, timestamp: Date.now() }]

/** Strips UI-only fields (timestamp) before sending — the API request shape stays byte-identical to before: {messages: [{role, content}]}. */
const toApiMessages = (msgs: Message[]) => msgs.map(({ role, content }) => ({ role, content }))

async function streamAIResponse(
  history: { role: 'user' | 'assistant'; content: string }[],
  onChunk: (chunkText: string) => void
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: history }),
  })

  if (!res.ok || !res.body) {
    let message = `Erreur serveur (${res.status})`

    try {
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = (await res.json()) as { error?: string }
        if (data.error) message = data.error
      } else {
        const text = await res.text()
        if (text.trim()) message = text
      }
    } catch {
      // ignore parse errors and fall back to the default message
    }

    throw new Error(message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let received = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    if (chunk) {
      received = true
      onChunk(chunk)
    }
  }

  if (!received) {
    throw new Error('L\'IA n\'a renvoyé aucune réponse.')
  }
}

interface Props {
  displayName: string
}

export function AIAssistantClient({ displayName }: Props) {
  const [messages, setMessages] = useState<Message[]>(freshGreeting)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [pendingAction, setPendingAction] = useState<{ index: number; prompt: string; action: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize the composer as the user types, capped so it never takes over the screen
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const sendMessage = async (text: string) => {
    const content = text.trim()
    if (!content || loading) return

    setInput('')
    const userMessage: Message = { role: 'user', content, timestamp: Date.now() }
    // On envoie tout l'historique (y compris le nouveau message) pour que l'IA garde le contexte
    const history = [...messages, userMessage]
    setMessages([...history, { role: 'assistant', content: '', timestamp: Date.now() }])
    setLoading(true)

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

      if (fullText.toLowerCase().includes('confirmer') || fullText.toLowerCase().includes('confirmation')) {
        const assistantIndex = history.length
        setPendingAction({ index: assistantIndex, prompt: content, action: extractTaskTitle(content) || content })
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message !== 'AI request failed'
          ? err.message
          : "Désolé, je n'ai pas réussi à joindre l'IA. Réessaie dans un instant."
      setMessages((prev) => {
        const next = [...prev]
        next[next.length - 1] = {
          ...next[next.length - 1],
          content: message,
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSend = () => sendMessage(input)

  const triggerQuickAction = (text: string) => {
    const prompt = `Agis comme un coach de productivité et aide-moi à ${text.toLowerCase()}. Donne-moi un plan concret, réaliste et structuré.`
    sendMessage(prompt)
  }

  const confirmAction = async (accept: boolean) => {
    if (!pendingAction) return

    const { index, prompt, action } = pendingAction
    const response = accept
      ? `Oui, confirme l'action : ${action}.`
      : `Non, annule cette proposition.`

    setMessages((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        content: `${next[index].content}\n\n${response}`,
        actionRequest: undefined,
      }
      return next
    })
    setPendingAction(null)

    if (!accept) {
      sendMessage(response)
      return
    }

    try {
      const payloadTitle = extractTaskTitle(action) || action

      const res = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_task', payload: { title: payloadTitle } }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Impossible d’exécuter l’action.')

      sendMessage(`Action confirmée et exécutée : tâche créée avec succès (${data.task?.title || payloadTitle}).`)
    } catch (err) {
      sendMessage(err instanceof Error ? err.message : 'Échec de l’action sécurisée.')
    }
  }

  const reset = () => {
    setMessages(freshGreeting())
    setInput('')
  }

  const copyMessage = (idx: number, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    })
  }

  // Renders **bold**, groups consecutive bullet/numbered lines into real <ul>/<ol> lists
  // instead of flat paragraphs, and blank lines become breathing room.
  const renderContent = (text: string) => {
    // Security: escape raw HTML FIRST, then reintroduce only the **bold** markup
    // we generate ourselves. Without this, any '<', '>', '"' etc. coming back
    // from the model (e.g. via a prompt-injection attempt) would be parsed as
    // real HTML by dangerouslySetInnerHTML below — a stored/reflected XSS risk.
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-bold text-foreground">Assistant IA</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Votre coach de productivité personnel</p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={reset} title="Réinitialiser la conversation">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
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
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
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
                    : <Bot className="w-4 h-4 text-primary" />
                  }
                </div>

                <div className={cn('flex flex-col gap-1 max-w-[75%]', msg.role === 'user' ? 'items-end' : 'items-start')}>
                  <div className={cn(
                    'rounded-2xl px-4 py-3 text-sm space-y-1',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : cn(cardVariants({ padding: 'sm' }), 'rounded-tl-sm shadow-kin')
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
                      'flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-smooth',
                      msg.role === 'user' && 'flex-row-reverse'
                    )}>
                      <span className="text-[10px] text-muted-foreground/70">{format(msg.timestamp, 'HH:mm')}</span>
                      {msg.role === 'assistant' && !isActivelyStreaming && msg.content && (
                        <button
                          onClick={() => copyMessage(i, msg.content)}
                          className="text-muted-foreground hover:text-foreground transition-smooth"
                          title="Copier"
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
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {!hasStartedChat && (
        <div className="px-6 pb-4">
          <p className="text-xs text-muted-foreground mb-2">Actions rapides :</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((s, i) => (
              <motion.button
                key={s.text}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                onClick={() => triggerQuickAction(s.text)}
                className={cn(
                  cardVariants({ padding: 'sm', hover: true }),
                  'flex items-center gap-2.5 text-left text-sm text-foreground'
                )}
              >
                <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <s.icon className="w-3.5 h-3.5 text-primary" />
                </span>
                {s.text}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="px-6 py-3 border-t border-border bg-muted/30 flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">{pendingAction.prompt}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => confirmAction(false)}>
              <XCircle className="w-4 h-4 mr-1" /> Refuser
            </Button>
            <Button size="sm" onClick={() => confirmAction(true)}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmer
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 pb-6 pt-2 border-t border-border">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Posez-moi une question, ${displayName}...`}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm leading-relaxed max-h-40 focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0 transition-smooth hover:scale-105"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-1.5 px-0.5">Maj + Entrée pour un saut de ligne</p>
      </div>
    </div>
  )
}
