'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { Send, Sparkles, User, Bot, RotateCcw, Copy, Check, CalendarDays, Sunrise, TrendingUp, BookOpen, Repeat2, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { cardVariants } from '@/components/ui/card'

const SUGGESTIONS = [
  { icon: CalendarDays, text: 'Help me plan my day' },
  { icon: Sunrise, text: 'Suggest a morning routine' },
  { icon: TrendingUp, text: 'How can I be more productive?' },
  { icon: BookOpen, text: 'Create a weekly study schedule' },
  { icon: Repeat2, text: 'What habits should I build?' },
  { icon: Target, text: 'Help me set goals for this week' },
]

const GREETING = "Hi! I'm your Kininaru AI assistant. I can help you plan your day, build habits, set goals, and stay productive. What would you like to work on today?"

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
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
  if (!res.ok || !res.body) throw new Error('AI request failed')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
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
    } catch {
      setMessages((prev) => {
        const next = [...prev]
        next[next.length - 1] = {
          ...next[next.length - 1],
          content: "Désolé, je n'ai pas réussi à joindre l'IA. Réessaie dans un instant.",
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSend = () => sendMessage(input)

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
    const boldify = (s: string) => s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
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
            <h1 className="text-xl font-serif font-bold text-foreground">AI Assistant</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your personal productivity coach</p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={reset} title="Reset conversation">
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
                          title="Copy"
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
          <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={s.text}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                onClick={() => sendMessage(s.text)}
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

      {/* Input */}
      <div className="px-6 pb-6 pt-2 border-t border-border">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask me anything, ${displayName}...`}
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
        <p className="text-[10px] text-muted-foreground/70 mt-1.5 px-0.5">Shift + Enter for a new line</p>
      </div>
    </div>
  )
}
