'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  isToday,
  isTomorrow,
  isSameDay,
  differenceInMinutes,
  parseISO,
  eachDayOfInterval,
  subDays,
  addDays,
} from 'date-fns'
import { format } from '@/lib/date-fr'
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
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { cardVariants } from '@/components/ui/card'
import { streamChatResponse } from '@/lib/ai-stream'

// Fallback pool for the Daily AI Insight card if the live request fails —
// keeps the card useful (and avoids an alarming error state) either way.
const FALLBACK_INSIGHTS = [
  '"The secret of getting ahead is getting started." — Mark Twain',
  '"Small steps every day lead to big changes." — Anonymous',
  '"Focus on progress, not perfection." — Anonymous',
  '"Your habits shape your identity." — James Clear',
  '"What you do today shapes tomorrow." — Anonymous',
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
  userId: string
}

export function DashboardClient({
  profile,
  tasks,
  events,
  habits,
  habitLogs,
  focusSessions,
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

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [localHabitLogs, setLocalHabitLogs] = useState<string[]>(
    habitLogs.filter((l) => l.logged_date === todayStr).map((l) => l.habit_id)
  )

  // ---- Tasks ----
  const todoTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
  const doneTasks = tasks.filter((t) => t.status === 'done')
  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0
  const priorityTasks = todoTasks
    .filter((t) => t.priority === 'high' || t.priority === 'urgent')
    .slice(0, 4)

  // ---- Focus ----
  const todayFocusMinutes = focusSessions
    .filter((s) => s.created_at?.startsWith(todayStr))
    .reduce((a, s) => a + (s.duration_minutes || 0), 0)
  const weekFocusMinutes = focusSessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)
  const todaySessionCount = focusSessions.filter((s) => s.created_at?.startsWith(todayStr)).length
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
      label: format(day, 'EEE'),
      tasksCompleted: tasks.filter((t) => t.status === 'done' && t.completed_at?.startsWith(dateStr)).length,
      habitsCompleted: habitLogs.filter((l) => l.logged_date === dateStr).length,
      isToday: dateStr === todayStr,
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
    productivityScore >= 60 ? 'Bon rythme' :
    productivityScore >= 40 ? 'Continue comme ça' : "C'est parti"
  const scoreCircumference = 2 * Math.PI * 52

  const toggleHabit = async (habitId: string) => {
    if (localHabitLogs.includes(habitId)) {
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .eq('user_id', userId)
        .eq('logged_date', todayStr)
      setLocalHabitLogs((prev) => prev.filter((id) => id !== habitId))
    } else {
      await supabase.from('habit_logs').upsert({
        habit_id: habitId,
        user_id: userId,
        logged_date: todayStr,
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
  const [insight, setInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(true)
  const [insightFailed, setInsightFailed] = useState(false)
  const [fallbackInsight] = useState(
    () => FALLBACK_INSIGHTS[Math.floor(Math.random() * FALLBACK_INSIGHTS.length)]
  )

  const runInsight = useCallback(async () => {
    setInsightLoading(true)
    setInsightFailed(false)
    setInsight('')
    try {
      const summary = `Tâches: ${doneTasks.length}/${tasks.length} terminées aujourd'hui. Habitudes: ${localHabitLogs.length}/${habits.length} faites. Focus: ${todayFocusMinutes} minutes aujourd'hui.`
      let received = false
      await streamChatResponse(
        [{
          role: 'user',
          content: `${summary} En te basant sur ces chiffres, donne-moi une seule observation ou un seul conseil court (1-2 phrases maximum) et encourageant pour aujourd'hui.`,
        }],
        (chunk) => {
          received = true
          setInsight((prev) => prev + chunk)
        }
      )
      if (!received) throw new Error('empty response')
    } catch {
      setInsightFailed(true)
    } finally {
      setInsightLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    runInsight()
  }, [runInsight])

  return (
    <div className="p-5 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
      {/* Header */}
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"
      >
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground">
            {greeting()}, {profile?.display_name ?? 'ami'}
          </h1>
          <p className="text-muted-foreground mt-0.5">
            {mounted ? (
              <>
                {format(time, "EEEE, MMMM d")} &mdash;{' '}
                <span className="font-mono text-sm">{format(time, 'HH:mm:ss')}</span>
              </>
            ) : (
              <span className="inline-block h-4 w-40 rounded bg-muted animate-pulse" />
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 rounded-full">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">
              Niveau {profile?.level ?? 1}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-full">
            <Award className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {profile?.xp ?? 0} XP
            </span>
          </div>
        </div>
      </motion.div>

      {/* Hero row: Score de productivité + Today's Overview */}
      <motion.div
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5"
      >
        {/* Productivity score */}
        <div className={cn(cardVariants({ padding: 'lg', hover: true }), 'flex flex-col items-center justify-center text-center')}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Score de productivité
          </p>
          <div className="relative w-32 h-32">
            <svg width="128" height="128" className="-rotate-90">
              <circle cx="64" cy="64" r="52" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
              <motion.circle
                cx="64" cy="64" r="52"
                fill="none"
                stroke="var(--kt-primary)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={scoreCircumference}
                initial={{ strokeDashoffset: scoreCircumference }}
                animate={{ strokeDashoffset: scoreCircumference * (1 - productivityScore / 100) }}
                transition={{ duration: 1, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-foreground tabular-nums">{productivityScore}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">/ 100</span>
            </div>
          </div>
          <p className="text-sm font-medium text-foreground mt-3">{scoreLabel}</p>
          <p className="text-xs text-muted-foreground mt-1">Tâches · Habitudes · Focus, combinés</p>
        </div>

        {/* Today's overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            {
              label: 'Tâches faites',
              value: doneTasks.length,
              sub: `sur ${tasks.length} au total`,
              icon: CheckSquare,
              color: 'text-kin-sage',
              bg: 'bg-kin-sage/10',
            },
            {
              label: "Focus aujourd'hui",
              value: `${todayFocusMinutes}m`,
              sub: `${todaySessionCount} sessions`,
              icon: Timer,
              color: 'text-primary',
              bg: 'bg-primary/10',
            },
            {
              label: 'Habitudes faites',
              value: `${localHabitLogs.length}/${habits.length}`,
              sub: "aujourd'hui",
              icon: Repeat2,
              color: 'text-accent',
              bg: 'bg-accent/10',
            },
            {
              label: 'Prochain événement',
              value:
                nextEventMinutes !== null
                  ? nextEventMinutes < 60
                    ? `${nextEventMinutes}m`
                    : `${Math.round(nextEventMinutes / 60)}h`
                  : '—',
              sub: nextEvent?.title ?? 'Aucun événement à venir',
              icon: CalendarDays,
              color: 'text-secondary-foreground',
              bg: 'bg-secondary/50',
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i + 2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className={cardVariants({ padding: 'md', hover: true })}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </span>
                <div className={cn('p-1.5 rounded-lg', stat.bg)}>
                  <stat.icon className={cn('w-4 h-4', stat.color)} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{stat.sub}</p>
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
        className={cardVariants({ variant: 'accent', padding: 'lg' })}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wide">
              Conseil du jour (IA)
            </span>
          </div>
          {insightFailed && (
            <button
              onClick={runInsight}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <RefreshCw className="w-3 h-3" />
              Réessayer
            </button>
          )}
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

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming tasks */}
          <motion.div
            custom={7}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={cardVariants({ padding: 'lg', hover: true })}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Tâches à venir</h2>
              <span className="text-sm font-bold text-primary">{completionRate}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completionRate}%` }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
                className="h-full bg-primary rounded-full"
              />
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {doneTasks.length} terminées · {todoTasks.length} restantes
            </p>

            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Tâches prioritaires
              </h3>
              {priorityTasks.length === 0 ? (
                <div className="text-center py-6">
                  <CheckSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground">Aucune tâche urgente — bravo !</p>
                </div>
              ) : (
                priorityTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-smooth"
                  >
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        task.priority === 'urgent' ? 'bg-destructive' : 'bg-accent'
                      )}
                    />
                    <span className="text-sm text-foreground flex-1 truncate">
                      {task.title}
                    </span>
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(task.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                ))
              )}
              {todoTasks.length > priorityTasks.length && (
                <Link
                  href="/tasks"
                  className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  Voir les {todoTasks.length} tâches
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </motion.div>

          {/* Calendar preview */}
          <motion.div
            custom={8}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={cardVariants({ padding: 'lg', hover: true })}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Aperçu du calendrier</h2>
              <Link
                href="/calendar"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </Link>
            </div>

            {/* 7-day strip */}
            <Link href="/calendar" className="grid grid-cols-7 gap-1.5 mb-4">
              {eventsByDay.map(({ date, count }) => (
                <div
                  key={date.toISOString()}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 rounded-xl transition-smooth',
                    isToday(date) ? 'bg-primary/10' : 'hover:bg-muted'
                  )}
                >
                  <span className="text-[10px] text-muted-foreground uppercase">{format(date, 'EEEEE')}</span>
                  <span className={cn('text-sm font-medium', isToday(date) ? 'text-primary' : 'text-foreground')}>
                    {format(date, 'd')}
                  </span>
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      count > 0 ? 'bg-primary' : 'bg-transparent'
                    )}
                  />
                </div>
              ))}
            </Link>

            {events.length === 0 ? (
              <div className="text-center py-6">
                <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Aucun événement à venir</p>
                <Link
                  href="/calendar"
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  Planifier quelque chose
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 4).map((event) => {
                  const start = parseISO(event.start_at)
                  const label = isToday(start)
                    ? "Aujourd'hui"
                    : isTomorrow(start)
                    ? 'Demain'
                    : format(start, 'EEE, MMM d')
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-smooth group"
                    >
                      <div
                        className="w-1 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: event.color ?? 'var(--kt-sage)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {event.title}
                        </p>
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
        </div>

        {/* Right column - 1/3 */}
        <div className="space-y-6">
          {/* Habit progress */}
          <motion.div
            custom={9}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className={cardVariants({ padding: 'lg', hover: true })}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Progrès des habitudes</h2>
              <Link href="/habits" className="text-xs text-primary hover:underline">
                Tout voir
              </Link>
            </div>
            {habits.length === 0 ? (
              <div className="text-center py-4">
                <Repeat2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Aucune habitude pour l'instant</p>
                <Link
                  href="/habits"
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  Ajouter votre première habitude
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
                      className={cn(
                        'w-full flex items-center gap-3 p-2.5 rounded-xl transition-smooth text-left',
                        done ? 'bg-primary/10' : 'hover:bg-muted'
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
            className={cardVariants({ padding: 'lg', hover: true })}
          >
            <h2 className="font-semibold text-foreground mb-4">Statistiques de focus</h2>
            {focusSessions.length === 0 ? (
              <div className="text-center py-4">
                <Timer className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Aucune session de focus cette semaine</p>
                <Link
                  href="/focus"
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  Démarrer une session
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Aujourd'hui", value: `${todayFocusMinutes}m` },
                  { label: 'Cette semaine', value: `${Math.round(weekFocusMinutes / 60)}h` },
                  { label: "Sessions aujourd'hui", value: todaySessionCount },
                  { label: 'Session moy.', value: `${avgSessionLength}m` },
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
            className={cardVariants({ padding: 'lg', hover: true })}
          >
            <h2 className="font-semibold text-foreground mb-3">Actions rapides</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Nouvelle tâche', href: '/tasks', icon: CheckSquare },
                { label: 'Nouvel événement', href: '/calendar', icon: CalendarDays },
                { label: 'Focus maintenant', href: '/focus', icon: Timer },
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

      {/* Weekly progress */}
      <motion.div
        custom={12}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className={cardVariants({ padding: 'lg', hover: true })}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-foreground">Progrès hebdomadaire</h2>
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
            <p className="text-sm text-muted-foreground">Aucune activité enregistrée cette semaine</p>
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
  )
}
