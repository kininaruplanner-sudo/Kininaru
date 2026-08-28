'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  format,
  isToday,
  isSameDay,
  differenceInMinutes,
  parseISO,
} from 'date-fns'
import { fr as frLocale } from 'date-fns/locale'
import {
  CheckSquare,
  CalendarDays,
  Timer,
  Repeat2,
  Zap,
  ChevronRight,
  Plus,
  CloudSun,
  Sparkles,
  Flame,
  RefreshCw,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { cardVariants } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { streamChatResponse } from '@/lib/ai-stream'

const FALLBACK_INSIGHTS = [
  '« Le secret pour avancer, c\'est de commencer. » — Mark Twain',
  '« De petits pas chaque jour mènent à de grands changements. »',
  '« Concentrez-vous sur le progrès, pas sur la perfection. »',
  '« Vos habitudes façonnent votre identité. » — James Clear',
  '« Ce que vous faites aujourd\'hui dessine votre demain. »',
]

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  }),
}

interface DashboardProfile {
  display_name?: string | null
  level?: number | null
  xp?: number | null
}

interface DashboardTask {
  id: string
  title: string
  status: string
  priority?: string | null
  due_date?: string | null
  scheduled_time?: string | null
  completed_at?: string | null
  goal_id?: string | null
}

interface DashboardGoal {
  id: string
  title: string
  target_date?: string | null
  status: string
}

interface DashboardEvent {
  id: string
  title: string
  start_at: string
  color?: string | null
}

interface DashboardHabit {
  id: string
  title: string
  streak?: number | null
}

interface DashboardHabitLog {
  habit_id: string
  logged_date: string
}

interface DashboardFocusSession {
  duration_minutes?: number | null
  created_at?: string | null
}

interface Props {
  profile: DashboardProfile | null
  tasks: DashboardTask[]
  events: DashboardEvent[]
  habits: DashboardHabit[]
  habitLogs: DashboardHabitLog[]
  focusSessions: DashboardFocusSession[]
  families: { family_id: string; role: string; families: { name: string } | null }[]
  goals: DashboardGoal[]
  userId: string
}

export function DashboardClient({
  profile,
  tasks,
  events,
  habits,
  habitLogs,
  focusSessions,
  families,
  goals,
  userId,
}: Props) {
  const [time, setTime] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const todayLocalKey = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const todayUtcKey = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [localHabitLogs, setLocalHabitLogs] = useState<string[]>(
    habitLogs.filter((l) => l.logged_date === todayLocalKey).map((l) => l.habit_id)
  )

  // Tasks
  const todoTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
  const doneTasks = tasks.filter((t) => t.status === 'done')
  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0
  const todayTasks = todoTasks.filter((t) => {
    if (!t.due_date) return false
    const d = new Date(t.due_date)
    return isToday(d) || d < new Date()
  })

  // Focus
  const todayFocusMinutes = focusSessions
    .filter((s) => s.created_at?.startsWith(todayUtcKey))
    .reduce((a, s) => a + (s.duration_minutes || 0), 0)

  // Next event
  const nextEvent = events.find((e) => new Date(e.start_at) > time)
  const nextEventMinutes = nextEvent
    ? differenceInMinutes(parseISO(nextEvent.start_at), time)
    : null

  // Next action
  const NEXT_ACTION_KEY = `kininaru-nextaction-${todayLocalKey}`
  const [nextAction, setNextAction] = useState<{
    title: string
    taskId: string
    reason?: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    const cached = sessionStorage.getItem(NEXT_ACTION_KEY)
    if (cached) {
      try { setNextAction(JSON.parse(cached)) } catch { /* ignore */ }
      return
    }
    fetch('/api/coach/observe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 'dashboard', style: 'encouraging', notify: false }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { nextAction?: { title: string; taskId: string; reason?: string } } | null) => {
        if (cancelled || !d?.nextAction) return
        setNextAction(d.nextAction)
        try { sessionStorage.setItem(NEXT_ACTION_KEY, JSON.stringify(d.nextAction)) } catch { /* ignore */ }
      })
      .catch(() => { /* best-effort */ })
    return () => { cancelled = true }
  }, [NEXT_ACTION_KEY])

  // Daily insight
  const INSIGHT_KEY = `kininaru-insight-${todayLocalKey}`
  const [insight, setInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(true)
  const [insightFailed, setInsightFailed] = useState(false)
  const [fallbackInsight] = useState(
    () => FALLBACK_INSIGHTS[Math.floor(Math.random() * FALLBACK_INSIGHTS.length)]
  )

  const runInsight = useCallback(
    async (force = false) => {
      const cached = force ? null : sessionStorage.getItem(INSIGHT_KEY)
      if (cached) {
        setInsight(cached)
        setInsightLoading(false)
        setInsightFailed(false)
        return
      }
      setInsightLoading(true)
      setInsightFailed(false)
      setInsight('')
      let full = ''
      let received = false
      try {
        const summary = `Tâches: ${doneTasks.length}/${tasks.length} terminées. Habitudes: ${localHabitLogs.length}/${habits.length} faites. Focus: ${todayFocusMinutes} min.`
        await streamChatResponse(
          [{ role: 'user', content: `${summary} Donne un seul conseil court et encourageant (1-2 phrases max).` }],
          (chunk) => { received = true; full += chunk; setInsight(full) }
        )
        if (!received) throw new Error('empty response')
      } catch {
        setInsightFailed(true)
      } finally {
        setInsightLoading(false)
        if (received && full.trim()) {
          try { sessionStorage.setItem(INSIGHT_KEY, full) } catch { /* storage unavailable */ }
        }
      }
    },
    [doneTasks.length, tasks.length, localHabitLogs.length, habits.length, todayFocusMinutes, INSIGHT_KEY]
  )

  useEffect(() => { runInsight() }, [runInsight])

  // Habit toggle
  const toggleHabit = async (habitId: string) => {
    if (localHabitLogs.includes(habitId)) {
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .eq('user_id', userId)
        .eq('logged_date', todayLocalKey)
      setLocalHabitLogs((prev) => prev.filter((id) => id !== habitId))
    } else {
      await supabase.from('habit_logs').upsert({
        habit_id: habitId,
        user_id: userId,
        logged_date: todayLocalKey,
      })
      setLocalHabitLogs((prev) => [...prev, habitId])
    }
  }

  const greeting = () => {
    const h = time.getHours()
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  const isFirstRun = tasks.length === 0 && habits.length === 0 && events.length === 0 && focusSessions.length === 0

  return (
    <div className="p-5 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      {/* ── HEADER ── */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <p className="text-xs text-muted-foreground mb-1">
          {mounted ? format(time, 'EEEE d MMMM', { locale: frLocale }) : '…'}
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="kin-h1 text-foreground">
              {greeting()}, {profile?.display_name ?? 'ami'} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {doneTasks.length} tâche{doneTasks.length > 1 ? 's' : ''} terminée{doneTasks.length > 1 ? 's' : ''} · {todayFocusMinutes > 0 ? `${todayFocusMinutes} min focus` : 'aucun focus'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/focus"
              className="group flex items-center gap-1.5 px-3 min-h-9 rounded-xl bg-warm/15 text-warm text-sm font-medium shadow-kin hover:scale-[1.02] hover:shadow-kin-hover transition-smooth"
            >
              <Timer className="w-4 h-4" />
              Focus
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── FIRST RUN ── */}
      {isFirstRun && (
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible"
          className={cn(cardVariants({ padding: 'lg', variant: 'accent' }), 'relative overflow-hidden')}
        >
          <div className="absolute inset-0 kin-glow pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">Bienvenue</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Commencez par une première action — le coach s&apos;occupe du reste.
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              {[
                { step: '1', label: 'Créer une tâche', href: '/tasks?new=1', icon: CheckSquare },
                { step: '2', label: 'Lancer un Focus', href: '/focus', icon: Timer },
                { step: '3', label: 'Parler au coach', href: '/ai', icon: Sparkles },
              ].map((s) => (
                <Link key={s.step} href={s.href}
                  className="flex items-center gap-2.5 p-2.5 min-h-10 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-smooth"
                >
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{s.step}</span>
                  <s.icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">{s.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── NEXT ACTION (hero) ── */}
      {nextAction && (
        <motion.div custom={1.1} variants={fadeUp} initial="hidden" animate="visible"
          className={cn(cardVariants({ padding: 'lg' }), 'border-l-4 border-l-kin-sage')}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wide">
              🎯 Ta prochaine action
            </span>
            <Zap className="w-4 h-4 text-kin-sage" />
          </div>
          <p className="text-lg font-semibold text-foreground leading-snug">{nextAction.title}</p>
          {nextAction.reason && (
            <p className="text-xs text-muted-foreground mt-1.5">{nextAction.reason}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href={`/focus?taskId=${nextAction.taskId}&task=${encodeURIComponent(nextAction.title)}`}>
              <Button size="sm" className="gap-1.5">▶ Commencer</Button>
            </Link>
            <Link href="/tasks">
              <Button variant="outline" size="sm">Toutes les tâches</Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── TODAY'S TASKS ── */}
      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible"
        className={cardVariants({ padding: 'lg' })}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Aujourd&apos;hui</h2>
          </div>
          <Link href="/tasks" className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Tout voir <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {tasks.length > 0 && (
          <div className="h-1 bg-muted rounded-full overflow-hidden mb-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionRate}%` }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="h-full bg-primary rounded-full"
            />
          </div>
        )}

        {todayTasks.length === 0 && todoTasks.filter((t) => t.priority === 'high' || t.priority === 'urgent').length === 0 ? (
          <div className="text-center py-6">
            <CheckSquare className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">Aucune tâche urgente — profitez de la matinée !</p>
            <Link href="/tasks?new=1" className="text-xs text-primary hover:underline mt-1 inline-block">
              <Plus className="w-3 h-3 inline mr-0.5" />Créer une tâche
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            {todayTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 transition-smooth">
                <div className={cn('w-2 h-2 rounded-full shrink-0', task.priority === 'urgent' ? 'bg-destructive' : 'bg-kin-coral')} />
                <span className="text-sm text-foreground flex-1 truncate">{task.title}</span>
                {task.due_date && (
                  <span className={cn('text-xs', new Date(task.due_date) < new Date() ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                    {format(new Date(task.due_date), 'd MMM')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Habits — inline toggle, very compact */}
        {habits.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Habitudes</span>
              <Link href="/habits" className="text-xs text-primary hover:underline">Voir →</Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {habits.slice(0, 6).map((habit) => {
                const done = localHabitLogs.includes(habit.id)
                return (
                  <button
                    key={habit.id}
                    onClick={() => toggleHabit(habit.id)}
                    aria-pressed={done}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-smooth border',
                      done
                        ? 'bg-primary/10 border-primary/20 text-primary'
                        : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    {done ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-current opacity-50" />
                    )}
                    {habit.title}
                    {(habit.streak ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-kin-coral">
                        <Flame className="w-2.5 h-2.5" />{habit.streak}
                      </span>
                    )}
                  </button>
                )
              })}
              {habits.length > 6 && (
                <Link href="/habits" className="flex items-center px-2.5 py-1.5 rounded-full text-xs text-primary border border-primary/20 hover:bg-primary/10 transition-smooth">
                  +{habits.length - 6}
                </Link>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── NEXT EVENT ── */}
      {nextEvent && (
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible"
          className={cn(cardVariants({ padding: 'md' }), 'flex items-center gap-3')}
        >
          <div className="w-8 h-8 rounded-lg bg-kin-blue/15 flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4 text-kin-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{nextEvent.title}</p>
            <p className="text-xs text-muted-foreground">
              {nextEventMinutes !== null && nextEventMinutes < 60
                ? `dans ${nextEventMinutes} min`
                : nextEventMinutes !== null
                ? `dans ${Math.round(nextEventMinutes / 60)} h`
                : 'bientôt'}
            </p>
          </div>
          <Link href="/calendar" className="text-xs text-primary hover:underline shrink-0">
            Calendrier →
          </Link>
        </motion.div>
      )}

      {/* ── DAILY INSIGHT ── */}
      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible"
        className={cn(cardVariants({ variant: 'accent', padding: 'md' }), 'relative overflow-hidden')}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CloudSun className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Conseil du jour</span>
          </div>
          <div className="flex items-center gap-2">
            {insightFailed && (
              <button onClick={() => void runInsight(true)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <RefreshCw className="w-3 h-3" />Réessayer
              </button>
            )}
            <Link href="/ai" className="text-xs text-muted-foreground hover:text-primary transition-smooth">
              Chat →
            </Link>
          </div>
        </div>
        {insightLoading && !insight ? (
          <div className="space-y-1.5">
            <div className="h-3.5 w-11/12 rounded bg-muted/70 animate-pulse" />
            <div className="h-3.5 w-2/3 rounded bg-muted/70 animate-pulse" />
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed italic">
            {insightFailed ? fallbackInsight : insight}
          </p>
        )}
      </motion.div>
    </div>
  )
}


