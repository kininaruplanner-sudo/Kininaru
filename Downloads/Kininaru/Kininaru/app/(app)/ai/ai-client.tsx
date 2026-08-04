'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, User, Bot, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const SUGGESTIONS = [
  'Help me plan my day',
  'Suggest a morning routine',
  'How can I be more productive?',
  'Create a weekly study schedule',
  'What habits should I build?',
  'Help me set goals for this week',
]

const INITIAL_MESSAGES = [
  {
    role: 'assistant' as const,
    content: "Hi! I'm your Kininaru AI assistant. I can help you plan your day, build habits, set goals, and stay productive. What would you like to work on today?",
  },
]

interface Message {
  role: 'user' | 'assistant'
  content: string
}

async function fetchAIResponse(prompt: string): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  if (!res.ok) throw new Error('Failed to get AI response')
  const data = await res.json()
  return data.response as string
}

interface Props {
  displayName: string
}

export function AIAssistantClient({ displayName }: Props) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    const content = text.trim()
    if (!content || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content }])
    setLoading(true)

    try {
      const response = await fetchAIResponse(content)
      setMessages((prev) => [...prev, { role: 'assistant', content: response }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't connect to the AI. Please try again." },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = () => sendMessage(input)

  const reset = () => {
    setMessages(INITIAL_MESSAGES)
    setInput('')
  }

  // Simple markdown-like rendering
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      return (
        <p key={i} className={cn('leading-relaxed', line.startsWith('•') || line.match(/^\d\./) ? 'ml-2' : '')}
          dangerouslySetInnerHTML={{ __html: bold || '&nbsp;' }}
        />
      )
    })
  }

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
        <button
          onClick={reset}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth"
          title="Reset conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                {msg.role === 'user'
                  ? <User className="w-4 h-4" />
                  : <Bot className="w-4 h-4 text-primary" />
                }
              </div>
              <div className={cn(
                'max-w-[75%] rounded-2xl px-4 py-3 text-sm space-y-1',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-card border border-border text-foreground rounded-tl-sm'
              )}>
                {renderContent(msg.content)}
              </div>
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                      className="w-2 h-2 rounded-full bg-muted-foreground"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-6 pb-3">
          <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-xs text-foreground rounded-full transition-smooth hover:shadow-sm"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 pb-6 pt-2 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask me anything, ${displayName}...`}
            className="flex-1 h-11 rounded-xl"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) handleSend()
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
