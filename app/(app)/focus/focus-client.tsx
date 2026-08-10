'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, subDays, isToday, isYesterday, isSameDay } from 'date-fns'
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Coffee,
  Brain,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Quote,
  Flame,
  X,
  Target,
  Check,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, cardVariants } from '@/components/ui/card'

interface FocusSession {
  id?: string
  duration_minutes: number
  created_at: string
}

interface Props {
  userId: string
  todaySessions: FocusSession[]
  allSessions: FocusSession[]
  /** Task started from the coach (§31) — shown as the session objective. */
  initialTask?: { id: string; title: string } | null
  /** Duration in minutes (e.g. ?duration=25) to preselect the mode. */
  initialMinutes?: number
}

const MODES = [
  { label: 'Focus', minutes: 25, color: 'text-primary', ring: 'stroke-primary', icon: Brain },
  { label: 'Short Break', minutes: 5, color: 'text-kin-sage', ring: 'stroke-kin-sage', icon: Coffee },
  { label: 'Long Break', minutes: 15, color: 'text-accent', ring: 'stroke-accent', icon: Coffee },
] as const

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

/** duration_minutes doubles as the session-type signal since the schema has no type column — MODES are fixed presets so this is a reliable match. */
function inferMode(minutes: number) {
  return MODES.find((m) => m.minutes === minutes) ?? MODES[0]
}

/**
 * Synthesizes loopable ambience with the Web Audio API — no audio files or
 * network calls needed. "Rain" is filtered white noise, "Cafe" and "Focus"
 * are progressively darker filtered brown noise for a warmer, lower bed.
 */
function useAmbientSound(sound: string, volume: number) {
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  useEffect(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    gainRef.current?.disconnect()
    gainRef.current = null

    if (sound === 'none') return

    const AudioCtxCls = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtxCls) return
    if (!ctxRef.current) ctxRef.current = new AudioCtxCls()
    const ctx = ctxRef.current
    ctx.resume().catch(() => {})

    const bufferSize = 2 * ctx.sampleRate
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      if (sound === 'rain') {
        data[i] = white
      } else {
        const coeff = sound === 'cafe' ? 0.03 : 0.008
        last = (last + coeff * white) / (1 + coeff)
        data[i] = last * (sound === 'cafe' ? 3.2 : 2.5)
      }
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = sound === 'rain' ? 'highpass' : 'lowpass'
    filter.frequency.value = sound === 'rain' ? 1000 : sound === 'cafe' ? 800 : 300

    const gain = ctx.createGain()
    gain.gain.value = volume

    source.connect(filter).connect(gain).connect(ctx.destination)
    source.start()

    sourceRef.current = source
    gainRef.current = gain

    return () => {
      try { source.stop() } catch {}
      source.disconnect()
      filter.disconnect()
      gain.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound])

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume
  }, [volume])

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {})
    }
  }, [])
}

/** Short two-note chime on session completion, synthesized on the fly. */
function playChime() {
  try {
    const AudioCtxCls = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtxCls) return
    const ctx = new AudioCtxCls()
    const now = ctx.currentTime
    ;[523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.15)
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.15 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.15)
      osc.stop(now + i * 0.15 + 0.7)
    })
    setTimeout(() => ctx.close().catch(() => {}), 1200)
  } catch {
    // Web Audio unavailable — visual completion banner still shows regardless
  }
}

// ---------------------------------------------------------------------
// Circular progress ring
// ---------------------------------------------------------------------
function TimerRing({
  progress,
  size,
  strokeWidth,
  colorClass,
}: {
  progress: number
  size: number
  strokeWidth: number
  colorClass: string
}) {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-border" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: circumference * (1 - progress) }}
        transition={{ duration: 1, ease: 'linear' }}
        className={colorClass}
      />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Weekly totals mini bar-chart
// ---------------------------------------------------------------------
function WeeklyChart({ sessions }: { sessions: FocusSession[] }) {
  const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i))
  const totals = days.map((d) =>
    sessions.filter((s) => isSameDay(parseISO(s.created_at), d)).reduce((a, s) => a + s.duration_minutes, 0)
  )
  const max = Math.max(...totals, 25)
  return (
    <div>
      <div className="flex items-end gap-1.5 h-16">
        {days.map((d, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: totals[i] > 0 ? Math.max((totals[i] / max) * 64, 6) : 2 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className={cn('flex-1 rounded-t-md', isToday(d) ? 'bg-primary' : 'bg-primary/30')}
            title={`${totals[i]}m on ${format(d, 'EEE')}`}
          />
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {days.map((d, i) => (
          <span
            key={i}
            className={cn('flex-1 text-center text-[10px]', isToday(d) ? 'text-primary font-semibold' : 'text-muted-foreground')}
          >
            {format(d, 'EEEEE')}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Session history, grouped by day
// ---------------------------------------------------------------------
function SessionHistory({ sessions, onDelete }: { sessions: FocusSession[]; onDelete: (id: string) => void }) {
  const groups: { key: string; label: string; items: FocusSession[] }[] = []
  const indexByKey = new Map<string, number>()
  for (const s of sessions) {
    const d = parseISO(s.created_at)
    const key = format(d, 'yyyy-MM-dd')
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length)
      const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, MMM d')
      groups.push({ key, label, items: [] })
    }
    groups[indexByKey.get(key)!].items.push(s)
  }

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No sessions yet — start focusing!</p>
  }

  return (
    <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">{g.label}</p>
          <div className="space-y-1">
            {g.items.map((s, i) => {
              const m = inferMode(s.duration_minutes)
              const Icon = m.icon
              return (
                <div key={s.id ?? i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-smooth group/session">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <Icon className={cn('w-3.5 h-3.5 shrink-0', m.color)} />
                    {m.label}
                    <span className="text-xs text-muted-foreground">{format(parseISO(s.created_at), 'HH:mm')}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-medium text-primary">{s.duration_minutes}m</span>
                    {s.id && (
                      <button
                        onClick={() => onDelete(s.id!)}
                        className="opacity-0 group-hover/session:opacity-100 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-smooth"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------
export function FocusClient({ userId, todaySessions, allSessions, initialTask, initialMinutes }: Props) {
  // Preselect the mode when a duration was passed via the coach (?duration=25):
  // lazy initializers keep the component pure (no effect needed).
  const initialModeIdx =
    typeof initialMinutes === 'number'
      ? MODES.findIndex((m) => m.minutes === initialMinutes)
      : -1
  const startModeIdx = initialModeIdx >= 0 ? initialModeIdx : 0
  const [modeIdx, setModeIdx] = useState(startModeIdx)
  const [activeTask, setActiveTask] = useState(initialTask ?? null)
  const [secondsLeft, setSecondsLeft] = useState(MODES[startModeIdx].minutes * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(todaySessions)
  const [allSessionsState, setAllSessionsState] = useState(allSessions)
  const [sound, setSound] = useState('none')
  const [volume, setVolume] = useState(0.35)
  const [quote, setQuote] = useState(QUOTES[0])
  const [sessionCount, setSessionCount] = useState(0)
  const [focusCycles, setFocusCycles] = useState(0)
  const [zenMode, setZenMode] = useState(false)
  const [justCompleted, setJustCompleted] = useState<{ label: string; minutes: number; next: string } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const startedAt = useRef<Date | null>(null)
  const supabase = createClient()

  useAmbientSound(sound, volume)

  const mode = MODES[modeIdx]
  const totalSeconds = mode.minutes * 60
  const progress = 1 - secondsLeft / totalSeconds

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

  const skip = () => {
    // Skipping abandons the in-progress session (nothing logged) and jumps to the next mode.
    switchMode((modeIdx + 1) % MODES.length)
  }

  const saveSession = useCallback(
    async (minutes: number) => {
      const { data } = await supabase
        .from('focus_sessions')
        .insert({ user_id: userId, duration_minutes: minutes })
        .select()
        .single()
      if (data) {
        setSessions((prev) => [data, ...prev])
        setAllSessionsState((prev) => [data, ...prev])
      }
      setSessionCount((c) => c + 1)
    },
    [supabase, userId]
  )

  const deleteSession = useCallback(
    async (id: string) => {
      setAllSessionsState((prev) => prev.filter((s) => s.id !== id))
      setSessions((prev) => prev.filter((s) => s.id !== id))
      await supabase.from('focus_sessions').delete().eq('id', id)
    },
    [supabase]
  )

  // §31: after a focus session, offer to complete the task the session was for.
  const completeActiveTask = useCallback(async () => {
    if (!activeTask) return
    await supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', activeTask.id)
    setActiveTask(null)
  }, [activeTask, supabase])

  /** Auto-selects the next mode after a session completes — every 4th Focus session earns a Long Break, matching the classic Pomodoro cadence. The next phase is pre-loaded but not auto-started, so the user still decides when the clock runs. */
  const scheduleAutoAdvance = useCallback((completedIsFocus: boolean) => {
    setTimeout(() => {
      if (completedIsFocus) {
        setFocusCycles((c) => {
          const nextCycle = c + 1
          setModeIdx(nextCycle % 4 === 0 ? 2 : 1)
          return nextCycle
        })
      } else {
        setModeIdx(0)
      }
    }, 1500)
  }, [])

  useEffect(() => {
    if (running) {
      if (!startedAt.current) startedAt.current = new Date()
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            playChime()
            saveSession(mode.minutes)
            const isFocus = modeIdx === 0
            const nextLabel = isFocus ? ((focusCycles + 1) % 4 === 0 ? 'Long Break' : 'Short Break') : 'Focus'
            setJustCompleted({ label: mode.label, minutes: mode.minutes, next: nextLabel })
            setTimeout(() => setJustCompleted(null), 5000)
            scheduleAutoAdvance(isFocus)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, modeIdx, mode.minutes, mode.label, focusCycles, saveSession, scheduleAutoAdvance])

  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)])
  }, [])

  // Live countdown in the browser tab title while running
  useEffect(() => {
    if (running) {
      const m = Math.floor(secondsLeft / 60)
      const s = secondsLeft % 60
      document.title = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} · ${mode.label} — Kininaru`
    } else {
      document.title = 'Kininaru Planner'
    }
    return () => {
      document.title = 'Kininaru Planner'
    }
  }, [running, secondsLeft, mode.label])

  useEffect(() => {
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeIdx])

  // Space = play/pause, Escape = exit zen mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === ' ') {
        e.preventDefault()
        setRunning((r) => !r)
      } else if (e.key === 'Escape' && zenMode) {
        setZenMode(false)
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [zenMode])

  // Keep zenMode in sync if the user exits native fullscreen directly (e.g. OS-level Escape)
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setZenMode(false)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleZen = async () => {
    const next = !zenMode
    setZenMode(next)
    try {
      if (next && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      // Fullscreen API unavailable/blocked — the in-app zen overlay below still works either way.
    }
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const todayMinutes = sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)
  const allTimeMinutes = allSessionsState.reduce((a, s) => a + (s.duration_minutes || 0), 0)

  const streak = (() => {
    const days = new Set(allSessionsState.map((s) => format(parseISO(s.created_at), 'yyyy-MM-dd')))
    let count = 0
    let cursor = new Date()
    while (days.has(format(cursor, 'yyyy-MM-dd'))) {
      count++
      cursor = subDays(cursor, 1)
    }
    return count
  })()

  const ModeIcon = mode.icon
  const ringSize = zenMode ? 320 : 220
  const ringStroke = zenMode ? 8 : 6

  const timerCore = (
    <>
      {/* Active task (started from the coach) — the session objective */}
      {activeTask && (
        <div className="flex items-center gap-2 mb-5 w-full px-3 py-2 rounded-xl bg-primary/5 border border-primary/15">
          <Target className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">
            {activeTask.title}
          </span>
          <button
            type="button"
            onClick={() => setActiveTask(null)}
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-smooth"
            aria-label="Remove task from session"
            title="Remove"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mode selector */}
      <div className="flex bg-muted rounded-2xl p-1 gap-1 mb-8 w-full">
        {MODES.map((m, i) => (
          <button
            key={m.label}
            onClick={() => switchMode(i)}
            className={cn(
              'flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all duration-200',
              modeIdx === i ? 'bg-card shadow-kin text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Pomodoro cycle progress — every 4th focus session earns a long break */}
      <div className="flex items-center gap-1.5 justify-center mb-6">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn('w-1.5 h-1.5 rounded-full transition-smooth', i < focusCycles % 4 ? 'bg-primary' : 'bg-border')}
          />
        ))}
        <span className="text-[10px] text-muted-foreground ml-1">until long break</span>
      </div>

      {/* Circular timer */}
      <div className="relative flex items-center justify-center mb-8">
        <motion.div
          animate={running ? { scale: [1, 1.015, 1] } : { scale: 1 }}
          transition={running ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        >
          <TimerRing progress={progress} size={ringSize} strokeWidth={ringStroke} colorClass={mode.ring} />
        </motion.div>
        <div className="absolute text-center">
          <motion.span
            animate={secondsLeft <= 10 && secondsLeft > 0 && running ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 1, repeat: secondsLeft <= 10 && running ? Infinity : 0 }}
            className={cn('font-mono font-bold text-foreground tabular-nums block', zenMode ? 'text-7xl' : 'text-5xl')}
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </motion.span>
          <p className={cn('font-medium mt-1 flex items-center justify-center gap-1.5', zenMode ? 'text-base' : 'text-sm', mode.color)}>
            <ModeIcon className="w-3.5 h-3.5" />
            {mode.label}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          className="p-3 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-smooth hover:scale-105 active:scale-95"
          title="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.04 }}
          onClick={() => setRunning((r) => !r)}
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center shadow-kin-hover transition-smooth',
            running ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
          )}
          title={running ? 'Pause (Space)' : 'Start (Space)'}
        >
          {running ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
        </motion.button>
        <button
          onClick={skip}
          className="p-3 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-smooth hover:scale-105 active:scale-95"
          title="Skip to next mode"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Ambient sound */}
      <div className="mt-6 w-full">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 text-center">Ambient Sound</p>
        <div className="flex gap-2 justify-center">
          {AMBIENT_SOUNDS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSound(s.value)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs transition-smooth',
                sound === s.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {sound !== 'none' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mt-3 px-2">
                <Volume2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session complete banner */}
      <AnimatePresence>
        {justCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className={cn(cardVariants({ variant: 'accent', padding: 'sm' }), 'mt-4 w-full text-center')}
          >
            <p className="text-sm font-medium text-foreground">
              🎉 {justCompleted.label} session complete — +{justCompleted.minutes}m
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Up next: {justCompleted.next}</p>
            {activeTask && (
              <Button
                size="xs"
                onClick={completeActiveTask}
                className="gap-1.5 mt-2.5"
                title={`Mark “${activeTask.title}” as done`}
              >
                <Check className="w-3 h-3" />
                Mark task as done
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <PageHeader
        icon={Brain}
        title="Focus"
        subtitle={`${sessionCount} sessions aujourd’hui · ${todayMinutes} min de concentration`}
        actions={
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={toggleZen} title="Mode zen" aria-label="Mode zen">
            <Maximize2 className="w-4 h-4" />
          </Button>
        }
      />

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
              {timerCore}
            </motion.div>

            {/* Stats + Sessions */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="grid grid-cols-2 gap-3"
              >
                {[
                  { label: "Today's focus", value: `${todayMinutes}m`, sub: `${sessions.length} sessions` },
                  { label: 'Current streak', value: streak, sub: streak === 1 ? 'day' : 'days', icon: Flame },
                  { label: 'All time', value: `${Math.round(allTimeMinutes / 60)}h`, sub: `${allSessionsState.length} sessions` },
                  { label: 'Avg session', value: allSessionsState.length ? `${Math.round(allTimeMinutes / allSessionsState.length)}m` : '—', sub: 'per session' },
                ].map((stat) => (
                  <Card key={stat.label} padding="sm">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                      {stat.icon && <stat.icon className="w-3 h-3 text-kin-coral" />}
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.sub}</p>
                  </Card>
                ))}
              </motion.div>

              {/* Weekly chart */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.13, duration: 0.3 }}
                className={cardVariants({ padding: 'sm' })}
              >
                <h3 className="text-sm font-semibold text-foreground mb-3">This Week</h3>
                <WeeklyChart sessions={allSessionsState} />
              </motion.div>

              {/* Motivational quote */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.3 }}
                className={cardVariants({ variant: 'accent', padding: 'sm' })}
              >
                <div className="flex items-start gap-3">
                  <Quote className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground leading-relaxed italic">{quote}</p>
                </div>
              </motion.div>

              {/* Session history */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className={cardVariants({ padding: 'sm' })}
              >
                <h3 className="text-sm font-semibold text-foreground mb-3">Session History</h3>
                <SessionHistory sessions={allSessionsState} onDelete={deleteSession} />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Zen / fullscreen mode */}
      <AnimatePresence>
        {zenMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] bg-background flex flex-col items-center justify-center p-6"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-6 right-6 text-muted-foreground"
              onClick={toggleZen}
              title="Exit zen mode (Esc)"
            >
              <Minimize2 className="w-5 h-5" />
            </Button>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="flex flex-col items-center w-full max-w-sm"
            >
              {timerCore}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
