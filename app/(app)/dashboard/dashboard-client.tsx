'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  format,
  isToday,
  isTomorrow,
  isSameDay,
  differenceInMinutes,
  parseISO,
  eachDayOfInterval,
  subDays,
  addDays,
} from 'date-fns'
import { fr as frLocale } from 'date-fns/locale'
import {
  CheckSquare,
  CalendarDays,
  Timer,
  Repeat2,
  TrendingUp,
  Zap,
  Award,
  ChevronRight,
  Plus,
  CloudSun,
  Sparkles,
  Flame,
  RefreshCw,
  Users,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { cardVariants } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InstallAppButton } from '@/components/install-app-button'
import { streamChatResponse } from '@/lib/ai-stream'

// Fallback pool for the Daily AI Insight card if the live request fails —
// keeps the card useful (and avoids an alarming error state) either way.
const FALLBACK_INSIGHTS = [
  '« Le secret pour avancer, c’est de commencer. » — Mark Twain',
  '« De petits pas chaque jour mènent à de grands changements. »',
  '« Concentrez-vous sur le progrès, pas sur la perfection. »',
  '« Vos habitudes façonnent votre identité. » — James Clear',
  '« Ce que vous faites aujourd’hui dessine votre demain. »',
]

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  }),
}

interface Props {
  profile: any
  tasks: any[]
  events: any[]
  habits: any[]
  habitLogs: any[]
  focusSessions: any[]
  families: { family_id: string; role: string; families: { name: string } | null }[]
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

  // Habit logs are stored as plain dates and compared with the same local
  // key everywhere (habits page included) so check-ins never land on the
  // wrong calendar day for users outside UTC.
  const todayLocalKey = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  // Focus sessions store full UTC timestamps — keep the UTC day key for them.
  const todayUtcKey = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [localHabitLogs, setLocalHabitLogs] = useState<string[]>(
    habitLogs.filter((l) => l.logged_date === todayLocalKey).map((l) => l.habit_id)
  )

  // ---- Tasks ----
  const todoTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
  const doneTasks = tasks.filter((t) => t.status === 'done')
  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0
  const priorityTasks = todoTasks
    .filter((t) => t.priority === 'high' || t.priority === 'urgent')
    .slice(0, 4)
  // Tasks due today (or overdue) — the real "what should I do today" answer.
  const todayTasks = todoTasks.filter((t) => {
    if (!t.due_date) return false
    const d = new Date(t.due_date)
    return isToday(d) || d < new Date()
  })

  // ---- Focus ----
  const todayFocusMinutes = focusSessions
    .filter((s) => s.created_at?.startsWith(todayUtcKey))
    .reduce((a, s) => a + (s.duration_minutes || 0), 0)
  const weekFocusMinutes = focusSessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)
  const todaySessionCount = focusSessions.filter((s) => s.created_at?.startsWith(todayUtcKey)).length
  const avgSessionLength = focusSessions.length
    ? Math.round(weekFocusMinutes / focusSessions.length)
    : 0

  // ---- Next event ----
  const nextEvent = events.find((e) => new Date(e.start_at) > time)
  const nextEventMinutes = nextEvent
    ? differenceInMinutes(parseISO(nextEvent.start_at), time)
    : null

  // ---- Calendar preview: next 7 days, event count per day ----
  const next7Days = useMemo(
    () => eachDayOfInterval({ start: new Date(), end: addDays(new Date(), 6) }),
    []
  )
  const eventsByDay = next7Days.map((day) => ({
    date: day,
    count: events.filter((e) => isSameDay(parseISO(e.start_at), day)).length,
  }))

  // ---- Habit progress (weekly count per habit, from the 7-day habitLogs window) ----
  const habitsWithWeekly = habits.map((h) => ({
    ...h,
    weekCount: habitLogs.filter((l) => l.habit_id === h.id).length,
  }))

  // ---- Weekly progress chart: tasks completed + habits logged, last 7 days ----
  const weekDays = useMemo(() => eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }), [])
  const weeklyData = weekDays.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return {
      label: format(day, 'EEE', { locale: frLocale }),
      tasksCompleted: tasks.filter((t) => t.status === 'done' && t.completed_at?.startsWith(dateStr)).length,
      habitsCompleted: habitLogs.filter((l) => l.logged_date === dateStr).length,
      isToday: dateStr === todayLocalKey,
    }
  })
  const maxWeekly = Math.max(...weeklyData.flatMap((d) => [d.tasksCompleted, d.habitsCompleted]), 1)
  const weeklyHasActivity = weeklyData.some((d) => d.tasksCompleted > 0 || d.habitsCompleted > 0)

  // ---- Productivity score: blended, transparent heuristic ----
  const FOCUS_GOAL_MINUTES = 120
  const taskComponent = tasks.length > 0 ? completionRate : 50
  const habitComponent = habits.length > 0 ? Math.round((localHabitLogs.length / habits.length) * 100) : 50
  const focusComponent = Math.min(100, Math.round((todayFocusMinutes / FOCUS_GOAL_MINUTES) * 100))
  const productivityScore = Math.round((taskComponent + habitComponent + focusComponent) / 3)
  const scoreLabel =
    productivityScore >= 80 ? 'Excellente journée' :
    productivityScore >= 60 ? 'Belle dynamique' :
    productivityScore >= 40 ? 'Ça avance' : 'On démarre'
  const scoreCircumference = 2 * Math.PI * 52

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

  // ---- Daily AI Insight ----
  // Cost control (§15.5 §20): the insight is cached for the whole day in
  // sessionStorage, so navigating to the dashboard does NOT trigger a Groq
  // call every time. The refresh button re-generates it explicitly.
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
        const summary = `Tâches: ${doneTasks.length}/${tasks.length} terminées aujourd'hui. Habitudes: ${localHabitLogs.length}/${habits.length} faites. Focus: ${todayFocusMinutes} minutes aujourd'hui.`
        await streamChatResponse(
          [{
            role: 'user',
            content: `${summary} En te basant sur ces chiffres, donne-moi une seule observation ou un seul conseil court (1-2 phrases maximum) et encourageant pour aujourd'hui.`,
          }],
          (chunk) => {
            received = true
            full += chunk
            setInsight(full)
          }
        )
        if (!received) throw new Error('empty response')
      } catch {
        setInsightFailed(true)
      } finally {
        setInsightLoading(false)
        // Cache only complete answers (never cache partial or failed ones).
        if (received && full.trim()) {
          try {
            sessionStorage.setItem(INSIGHT_KEY, full)
          } catch {
            // storage unavailable
          }
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [doneTasks.length, tasks.length, localHabitLogs.length, habits.length, todayFocusMinutes, INSIGHT_KEY]
  )

  useEffect(() => {
    runInsight()
  }, [runInsight])

  // ---- Smart Next Action (§15.5 §8) — ONE relevant action, deterministic
  // (local rules over the daily context, never a Groq call), cached per day. */
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
      try {
        setNextAction(JSON.parse(cached))
      } catch {
        // ignore malformed cache
      }
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
        try {
          sessionStorage.setItem(NEXT_ACTION_KEY, JSON.stringify(d.nextAction))
        } catch {
          // storage unavailable
        }
      })
      .catch(() => {
        // Best-effort — the card simply does not appear.
      })
    return () => {
      cancelled = true
    }
  }, [NEXT_ACTION_KEY])

  // First-run onboarding: a brand-new account (nothing created yet) gets a
  // compact 3-step guide instead of a wall of empty states.
  const isFirstRun =
    tasks.length === 0 &&
    habits.length === 0 &&
    events.length === 0 &&
    focusSessions.length === 0

  const stats = [
    {
      label: 'Tâches terminées',
      value: doneTasks.length,
      sub: `sur ${tasks.length}`,
      icon: CheckSquare,
      color: 'text-kin-rose-dark',
      bg: 'bg-kin-rose/20',
    },
    {
      label: 'Focus aujourd’hui',
      value: `${todayFocusMinutes}m`,
      sub: `${todaySessionCount} session${todaySessionCount > 1 ? 's' : ''}`,
      icon: Timer,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Habitudes faites',
      value: `${localHabitLogs.length}/${habits.length}`,
      sub: 'aujourd’hui',
      icon: Repeat2,
      color: 'text-kin-violet',
      bg: 'bg-kin-violet/15',
    },
    {
      label: 'Prochain événement',
      value:
        nextEventMinutes !== null
          ? nextEventMinutes < 60
            ? `dans ${nextEventMinutes} min`
            : `dans ${Math.round(nextEventMinutes / 60)} h`
          : '—',
      sub: nextEvent?.title ?? 'Rien de prévu',
      icon: CalendarDays,
      color: 'text-kin-blue',
      bg: 'bg-kin-blue/15',
    },
  ]

  return (
    <div className="p-5 sm:p-6 lg:p-8 max-w-[1280px] mx-auto space-y-5 lg:space-y-7">
      {/* Header */}
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            {mounted ? format(time, 'EEEE d MMMM', { locale: frLocale }) : '…'}
          </p>
          <h1 className="kin-h1 text-foreground">
            {greeting()}, {profile?.display_name ?? 'ami'} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/ai"
            className="group flex items-center gap-1.5 px-4 min-h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-kin hover:scale-[1.02] hover:shadow-kin-hover transition-smooth"
          >
            <Sparkles className="w-4 h-4" />
            Parler au coach
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 rounded-xl">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Niv. {profile?.level ?? 1}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/70 rounded-xl">
            <Award className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{profile?.xp ?? 0} XP</span>
          </div>
        </div>
      </motion.div>

      {/* First-run welcome (empty account) — guides to first task → focus → coach */}
      {isFirstRun && (
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className={cn(cardVariants({ padding: 'lg', variant: 'accent' }), 'relative overflow-hidden')}
        >
          <div className="absolute inset-0 kin-glow pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Bienvenue sur Kininaru
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4 max-w-xl leading-relaxed">
              Commençons par une première action. Le coach s’occupe du reste : il
              prépare votre journée, vos priorités et vos rappels.
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              {[
                { step: '1', label: 'Créer une tâche', href: '/tasks?new=1', icon: CheckSquare },
                { step: '2', label: 'Lancer un Focus', href: '/focus', icon: Timer },
                { step: '3', label: 'Parler au coach', href: '/ai', icon: Sparkles },
              ].map((s) => (
                <Link
                  key={s.step}
                  href={s.href}
                  className="flex items-center gap-2.5 p-3 min-h-11 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-smooth"
                >
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {s.step}
                  </span>
                  <s.icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">{s.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Smart Next Action (§15.5 §8) — deterministic, cached, opens Focus.
          Kept at the TOP of the dashboard so “what should I do now?” is the
          first thing answered, before scores and statistics. */}
      {nextAction && (
        <motion.div
          custom={1.1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className={cn(cardVariants({ padding: 'lg' }), 'border-l-4 border-l-kin-sage')}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wide">
              🎯 Ta prochaine action
            </span>
            <Zap className="w-4 h-4 text-kin-sage" />
          </div>
          <p className="text-base font-semibold text-foreground leading-snug">
            {nextAction.title}
          </p>
          {nextAction.reason && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
              Pourquoi ? {nextAction.reason}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3.5">
            <Link
              href={`/focus?taskId=${nextAction.taskId}&task=${encodeURIComponent(nextAction.title)}`}
            >
              <Button size="sm" className="gap-1.5">
                ▶ Commencer
              </Button>
            </Link>
            <Link href="/tasks">
              <Button variant="outline" size="sm">
                Voir mes tâches
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Install prompt — slim row on mobile/tablet only (desktop has it in
          the sidebar footer, so it never duplicates). Hidden once installed. */}
      <div className="lg:hidden">
        <InstallAppButton variant="button" className="border-primary/30 text-primary" />
      </div>

      {/* Hero row: score + today's stats */}
      <motion.div
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4"
      >
        <div className={cn(cardVariants({ padding: 'lg' }), 'flex flex-col items-center justify-center text-center relative overflow-hidden')}>
          <div className="absolute inset-0 kin-glow pointer-events-none" />
          <p className="text-xs font-medium text-muted-foreground mb-3">Score de productivité</p>
          {/* Compact ring on phones so the score never dominates the
              “what should I do now” answer above it. */}
          <div className="relative w-20 h-20 lg:w-28 lg:h-28">
            <svg viewBox="0 0 112 112" className="w-20 h-20 lg:w-28 lg:h-28 -rotate-90">
              <circle cx="56" cy="56" r="46" fill="none" stroke="currentColor" strokeWidth="9" className="text-muted" />
              <motion.circle
                cx="56" cy="56" r="46"
                fill="none"
                stroke="var(--kt-primary)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={scoreCircumference}
                initial={{ strokeDashoffset: scoreCircumference }}
                animate={{ strokeDashoffset: scoreCircumference * (1 - productivityScore / 100) }}
                transition={{ duration: 1, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg lg:text-2xl font-bold text-foreground tabular-nums">{productivityScore}</span>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>
          <p className="text-sm font-medium text-foreground mt-3">{scoreLabel}</p>
          <p className="text-xs text-muted-foreground mt-1">Tâches · Habitudes · Focus</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i + 2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className={cn(cardVariants({ padding: 'md' }), 'flex flex-col justify-between min-h-[104px]')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <div className={cn('p-1.5 rounded-lg shrink-0', stat.bg)}>
                  <stat.icon className={cn('w-4 h-4', stat.color)} />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold text-foreground leading-tight truncate">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{stat.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Daily AI Insight */}
      <motion.div
        custom={6}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className={cn(cardVariants({ variant: 'accent', padding: 'lg' }), 'relative overflow-hidden')}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Conseil du jour</span>
          </div>
          <div className="flex items-center gap-2">
            {insightFailed && (
              <button
                onClick={() => void runInsight(true)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                Réessayer
              </button>
            )}
            <Link href="/ai" className="text-xs text-muted-foreground hover:text-primary transition-smooth">
              Ouvrir le chat →
            </Link>
          </div>
        </div>

        {insightLoading && !insight ? (
          <div className="space-y-2">
            <div className="h-4 w-11/12 rounded bg-muted/70 animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-muted/70 animate-pulse" />
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed italic">
            {insightFailed ? fallbackInsight : insight}
          </p>
        )}
      </motion.div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* Today's tasks */}
          <motion.div
            custom={7}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={cardVariants({ padding: 'lg' })}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="kin-h3 text-foreground">Aujourd’hui</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {doneTasks.length} terminée{doneTasks.length > 1 ? 's' : ''} · {todoTasks.length} en cours · {completionRate} %
                </p>
              </div>
              <Link href="/tasks" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Tout voir <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completionRate}%` }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
                className="h-full bg-primary rounded-full"
              />
            </div>

            {todayTasks.length === 0 && priorityTasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Aucune tâche urgente — profitez de la matinée !</p>
                <Link href="/tasks?new=1" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Créer une tâche
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-smooth"
                  >
                    <div className={cn('w-2 h-2 rounded-full shrink-0', task.priority === 'urgent' ? 'bg-destructive' : 'bg-kin-coral')} />
                    <span className="text-sm text-foreground flex-1 truncate">{task.title}</span>
                    {task.due_date && (
                      <span className={cn('text-xs', isPastDate(task.due_date) ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                        {format(new Date(task.due_date), 'd MMM')}
                      </span>
                    )}
                  </div>
                ))}
                {priorityTasks
                  .filter((t) => !todayTasks.some((x) => x.id === t.id))
                  .slice(0, 2)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted transition-smooth"
                    >
                      <div className={cn('w-2 h-2 rounded-full shrink-0', task.priority === 'urgent' ? 'bg-destructive' : 'bg-kin-coral')} />
                      <span className="text-sm text-foreground flex-1 truncate">{task.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground shrink-0">
                        {task.priority === 'urgent' ? 'Urgent' : 'Prioritaire'}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </motion.div>

          {/* Calendar preview */}
          <motion.div
            custom={8}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={cardVariants({ padding: 'lg' })}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="kin-h3 text-foreground">Calendrier</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Les 7 prochains jours</p>
              </div>
              <Link href="/calendar" className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="w-3.5 h-3.5" /> Événement
              </Link>
            </div>

            <Link href="/calendar" className="grid grid-cols-7 gap-1.5 mb-4">
              {eventsByDay.map(({ date, count }) => (
                <div
                  key={date.toISOString()}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 rounded-xl transition-smooth',
                    isToday(date) ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-muted'
                  )}
                >
                  <span className="text-[10px] text-muted-foreground uppercase">{format(date, 'EEEEE')}</span>
                  <span className={cn('text-sm font-medium', isToday(date) ? 'text-primary' : 'text-foreground')}>
                    {format(date, 'd')}
                  </span>
                  <span className={cn('w-1.5 h-1.5 rounded-full', count > 0 ? 'bg-primary' : 'bg-transparent')} />
                </div>
              ))}
            </Link>

            {events.length === 0 ? (
              <div className="text-center py-6">
                <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Aucun événement à venir</p>
                <Link href="/calendar" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Planifier quelque chose
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 3).map((event) => {
                  const start = parseISO(event.start_at)
                  const label = isToday(start)
                    ? 'Aujourd’hui'
                    : isTomorrow(start)
                    ? 'Demain'
                    : format(start, 'EEE d MMM', { locale: frLocale })
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-smooth group"
                    >
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: event.color ?? 'var(--kt-sage)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {label} · {format(start, 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Weekly progress */}
          <motion.div
            custom={12}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={cardVariants({ padding: 'lg' })}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="kin-h3 text-foreground">Progression de la semaine</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Tâches et habitudes, jour par jour</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-kin-violet" /> Tâches
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-kin-sage" /> Habitudes
                </span>
              </div>
            </div>

            {!weeklyHasActivity ? (
              <div className="text-center py-8">
                <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Aucune activité cette semaine — c’est le moment de commencer !</p>
              </div>
            ) : (
              <div className="flex items-end gap-3 sm:gap-5 h-32">
                {weeklyData.map((d, i) => (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="flex items-end gap-1 h-full">
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: i * 0.04, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        style={{ height: `${Math.max((d.tasksCompleted / maxWeekly) * 100, d.tasksCompleted > 0 ? 6 : 2)}%` }}
                        className="w-2.5 rounded-t-sm bg-kin-violet origin-bottom self-end"
                      />
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: i * 0.04 + 0.03, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        style={{ height: `${Math.max((d.habitsCompleted / maxWeekly) * 100, d.habitsCompleted > 0 ? 6 : 2)}%` }}
                        className="w-2.5 rounded-t-sm bg-kin-sage origin-bottom self-end"
                      />
                    </div>
                    <span className={cn('text-[10px]', d.isToday ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-4 lg:space-y-6">
          {/* Family summary */}
          {families.length > 0 && (
            <motion.div
              custom={13}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className={cardVariants({ padding: 'lg', variant: 'accent' })}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="kin-h3 text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Famille
                </h2>
                <Link href="/family" className="text-xs text-primary hover:underline">
                  Ouvrir →
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {families.map((m) => (
                  <span
                    key={m.family_id}
                    className="px-2.5 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-foreground shadow-kin"
                  >
                    {m.families?.name ?? 'Famille'}
                    {m.role === 'parent' && <span className="ml-1 text-primary">· parent</span>}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Habit progress */}
          <motion.div
            custom={9}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={cardVariants({ padding: 'lg' })}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="kin-h3 text-foreground">Habitudes du jour</h2>
              <Link href="/habits" className="text-xs text-primary hover:underline">Tout voir</Link>
            </div>
            {habits.length === 0 ? (
              <div className="text-center py-4">
                <Repeat2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Aucune habitude</p>
                <Link href="/habits?new=1" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Ajouter la première
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {habitsWithWeekly.map((habit) => {
                  const done = localHabitLogs.includes(habit.id)
                  return (
                    <button
                      key={habit.id}
                      onClick={() => toggleHabit(habit.id)}
                      aria-pressed={done}
                      className={cn(
                        'w-full flex items-center gap-3 p-2.5 rounded-xl transition-smooth text-left',
                        done ? 'bg-primary/10 ring-1 ring-primary/15' : 'hover:bg-muted'
                      )}
                    >
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-smooth',
                          done ? 'border-primary bg-primary' : 'border-border bg-background'
                        )}
                      >
                        {done && (
                          <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('text-sm truncate', done ? 'text-primary line-through opacity-60' : 'text-foreground')}>
                            {habit.title}
                          </span>
                          {habit.streak > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-kin-coral shrink-0">
                              <Flame className="w-3 h-3" />
                              {habit.streak}
                            </span>
                          )}
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                          <div
                            className="h-full rounded-full bg-accent transition-all duration-500"
                            style={{ width: `${(habit.weekCount / 7) * 100}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Focus statistics */}
          <motion.div
            custom={10}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={cardVariants({ padding: 'lg' })}
          >
            <h2 className="kin-h3 text-foreground mb-4">Focus</h2>
            {focusSessions.length === 0 ? (
              <div className="text-center py-4">
                <Timer className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Aucune session cette semaine</p>
                <Link href="/focus" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Démarrer une session
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Aujourd’hui', value: `${todayFocusMinutes}m` },
                  { label: 'Cette semaine', value: `${Math.round(weekFocusMinutes / 60)}h` },
                  { label: 'Sessions', value: todaySessionCount },
                  { label: 'Moyenne', value: `${avgSessionLength}m` },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-xl bg-muted/50">
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Quick actions */}
          <motion.div
            custom={11}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={cardVariants({ padding: 'lg' })}
          >
            <h2 className="kin-h3 text-foreground mb-3">Actions rapides</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Nouvelle tâche', href: '/tasks?new=1', icon: CheckSquare },
                { label: 'Nouvel événement', href: '/calendar?new=1', icon: CalendarDays },
                { label: 'Démarrer le focus', href: '/focus', icon: Timer },
                { label: 'Écrire au journal', href: '/journal', icon: CloudSun },
              ].map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 hover:bg-muted hover:shadow-kin transition-smooth hover:-translate-y-0.5 text-center"
                >
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-xs font-medium text-foreground">{label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function isPastDate(dateStr: string) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}
