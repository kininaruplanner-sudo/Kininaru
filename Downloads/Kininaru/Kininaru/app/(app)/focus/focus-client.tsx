'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, Coffee, Brain, Volume2, VolumeX, Maximize2, Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const MODES = [
  { label: 'Focus', minutes: 25, color: 'text-primary', bg: 'bg-primary' },
  { label: 'Short Break', minutes: 5, color: 'text-[#CDE9D2]', bg: 'bg-[#CDE9D2]' },
  { label: 'Long Break', minutes: 15, color: 'text-accent', bg: 'bg-accent' },
]

const AMBIENT_SOUNDS = [
  { label: 'None', value: 'none', icon: VolumeX },
  { label: 'Rain', value: 'rain', icon: Volume2 },
  { label: 'Cafe', value: 'cafe', icon: Coffee },
  { label: 'Focus', value: 'focus', icon: Brain },
]

const QUOTES = [
  '"Deep work is the ability to focus without distraction on a cognitively demanding task." — Cal Newport',
  '"The secret of getting ahead is getting started." — Mark Twain',
  '"You don\'t have to be great to start, but you have to start to be great." — Zig Ziglar',
  '"Focus on being productive instead of busy." — Tim Ferriss',
  '"Your focus determines your reality." — Qui-Gon Jinn',
]

interface Props {
  userId: string
  todaySessions: any[]
  allSessions: any[]
}

export function FocusClient({ userId, todaySessions, allSessions }: Props) {
  const [modeIdx, setModeIdx] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(MODES[0].minutes * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(todaySessions)
  const [sound, setSound] = useState('none')
  const [quote, setQuote] = useState(QUOTES[0])
  const [sessionCount, setSessionCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()
  const startedAt = useRef<Date | null>(null)
  const supabase = createClient()

  const mode = MODES[modeIdx]
  const totalSeconds = mode.minutes * 60
  const progress = 1 - secondsLeft / totalSeconds
  const circumference = 2 * Math.PI * 88

  const reset = useCallback(() => {
    setRunning(false)
    setSecondsLeft(MODES[modeIdx].minutes * 60)
    startedAt.current = null
  }, [modeIdx])

  const switchMode = (idx: number) => {
    setRunning(false)
    setModeIdx(idx)
    setSecondsLeft(MODES[idx].minutes * 60)
    startedAt.current = null
  }

  const saveSession = async (minutes: number) => {
    const { data } = await supabase.from('focus_sessions').insert({
      user_id: userId,
      duration_minutes: minutes,
      session_type: mode.label.toLowerCase().replace(' ', '_'),
      completed: true,
    }).select().single()
    if (data) setSessions(prev => [data, ...prev])
    setSessionCount(c => c + 1)
  }

  useEffect(() => {
    if (running) {
      if (!startedAt.current) startedAt.current = new Date()
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            saveSession(mode.minutes)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, modeIdx])

  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)])
  }, [])

  useEffect(() => {
    reset()
  }, [modeIdx])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const todayMinutes = sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)
  const allTimeMinutes = allSessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground">Focus Mode</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sessionCount} sessions today &middot; {todayMinutes}m focused
          </p>
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Timer */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center"
            >
              {/* Mode selector */}
              <div className="flex bg-muted rounded-2xl p-1 gap-1 mb-8 w-full">
                {MODES.map((m, i) => (
                  <button
                    key={m.label}
                    onClick={() => switchMode(i)}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all duration-200',
                      modeIdx === i
                        ? 'bg-card shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Circular timer */}
              <div className="relative flex items-center justify-center mb-8">
                <svg width="220" height="220" className="-rotate-90">
                  <circle
                    cx="110" cy="110" r="88"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-border"
                  />
                  <motion.circle
                    cx="110" cy="110" r="88"
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - progress)}
                    className={cn(
                      modeIdx === 0 ? 'stroke-primary' : modeIdx === 1 ? 'stroke-[#CDE9D2]' : 'stroke-accent'
                    )}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-5xl font-mono font-bold text-foreground tabular-nums">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                  </span>
                  <p className={cn('text-sm font-medium mt-1', mode.color)}>{mode.label}</p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={reset}
                  className="p-3 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-smooth"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRunning(r => !r)}
                  className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-smooth',
                    running ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
                  )}
                >
                  {running ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
                </motion.button>
                <div className="p-3 rounded-full bg-muted w-11 h-11" />
              </div>

              {/* Ambient sound */}
              <div className="mt-6 w-full">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 text-center">
                  Ambient Sound
                </p>
                <div className="flex gap-2 justify-center">
                  {AMBIENT_SOUNDS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setSound(s.value)}
                      className={cn(
                        'flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs transition-smooth',
                        sound === s.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <s.icon className="w-4 h-4" />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Stats + Sessions */}
            <div className="space-y-4">
              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="grid grid-cols-2 gap-3"
              >
                {[
                  { label: "Today's focus", value: `${todayMinutes}m`, sub: `${sessions.length} sessions` },
                  { label: 'All time', value: `${Math.round(allTimeMinutes / 60)}h`, sub: `${allSessions.length} sessions` },
                  { label: 'Avg session', value: allSessions.length ? `${Math.round(allTimeMinutes / allSessions.length)}m` : '—', sub: 'per session' },
                  { label: 'Today sessions', value: sessions.length, sub: 'completed' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.sub}</p>
                  </div>
                ))}
              </motion.div>

              {/* Motivational quote */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="bg-primary/5 border border-primary/20 rounded-2xl p-4"
              >
                <div className="flex items-start gap-3">
                  <Quote className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground leading-relaxed italic">{quote}</p>
                </div>
              </motion.div>

              {/* Recent sessions */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="bg-card border border-border rounded-2xl p-4"
              >
                <h3 className="text-sm font-semibold text-foreground mb-3">Recent Sessions</h3>
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No sessions today — start focusing!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sessions.slice(0, 5).map((s, i) => (
                      <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm text-foreground capitalize">{(s.session_type || 'focus').replace('_', ' ')}</span>
                        <span className="text-sm font-medium text-primary">{s.duration_minutes}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
