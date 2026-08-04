'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { format, isToday, isTomorrow, differenceInMinutes, parseISO } from 'date-fns'
import {
  CheckSquare,
  CalendarDays,
  Timer,
  Repeat2,
  TrendingUp,
  Clock,
  Zap,
  Award,
  ChevronRight,
  Plus,
  CloudSun,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const MOTIVATIONAL_QUOTES = [
  '"The secret of getting ahead is getting started." — Mark Twain',
  '"Small steps every day lead to big changes." — Anonymous',
  '"Focus on progress, not perfection." — Anonymous',
  '"Your habits shape your identity." — James Clear',
  '"What you do today shapes tomorrow." — Anonymous',
]

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.3, ease: [0.4, 0, 0.2, 1] },
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
  const [quote, setQuote] = useState(MOTIVATIONAL_QUOTES[0])
  const [localHabitLogs, setLocalHabitLogs] = useState<string[]>(
    habitLogs.map((l) => l.habit_id)
  )
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    setQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)])
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const todoTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
  const doneTasks = tasks.filter((t) => t.status === 'done')
  const completionRate =
    tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0
  const todayFocusMinutes = focusSessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)

  const nextEvent = events.find((e) => new Date(e.start_at) > time)
  const nextEventMinutes = nextEvent
    ? differenceInMinutes(parseISO(nextEvent.start_at), time)
    : null

  const priorityTasks = todoTasks
    .filter((t) => t.priority === 'high' || t.priority === 'urgent')
    .slice(0, 3)

  const toggleHabit = async (habitId: string) => {
    const today = new Date().toISOString().split('T')[0]
    if (localHabitLogs.includes(habitId)) {
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .eq('user_id', userId)
        .eq('logged_date', today)
      setLocalHabitLogs((prev) => prev.filter((id) => id !== habitId))
    } else {
      await supabase.from('habit_logs').upsert({
        habit_id: habitId,
        user_id: userId,
        logged_date: today,
      })
      setLocalHabitLogs((prev) => [...prev, habitId])
    }
  }

  const greeting = () => {
    const h = time.getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">
            {greeting()}, {profile?.display_name ?? 'friend'}
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
              Level {profile?.level ?? 1}
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

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Tasks Done',
            value: doneTasks.length,
            sub: `of ${tasks.length} total`,
            icon: CheckSquare,
            color: 'text-[#CDE9D2]',
            bg: 'bg-[#CDE9D2]/10',
          },
          {
            label: 'Focus Today',
            value: `${todayFocusMinutes}m`,
            sub: `${focusSessions.length} sessions`,
            icon: Timer,
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            label: 'Habits Done',
            value: `${localHabitLogs.length}/${habits.length}`,
            sub: 'today',
            icon: Repeat2,
            color: 'text-accent',
            bg: 'bg-accent/10',
          },
          {
            label: 'Next Event',
            value:
              nextEventMinutes !== null
                ? nextEventMinutes < 60
                  ? `${nextEventMinutes}m`
                  : `${Math.round(nextEventMinutes / 60)}h`
                : '—',
            sub: nextEvent?.title ?? 'No upcoming events',
            icon: CalendarDays,
            color: 'text-secondary-foreground',
            bg: 'bg-secondary/50',
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i + 1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-smooth hover:-translate-y-0.5"
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

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column - 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress card */}
          <motion.div
            custom={5}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Daily Progress</h2>
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
              {doneTasks.length} completed · {todoTasks.length} remaining
            </p>

            {/* Priority tasks */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Priority Tasks
              </h3>
              {priorityTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  No urgent tasks — great job!
                </p>
              ) : (
                priorityTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-smooth"
                  >
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        task.priority === 'urgent'
                          ? 'bg-destructive'
                          : 'bg-accent'
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
              {todoTasks.length > 3 && (
                <Link
                  href="/tasks"
                  className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  View all {todoTasks.length} tasks
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </motion.div>

          {/* Upcoming events */}
          <motion.div
            custom={6}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Upcoming Events</h2>
              <Link
                href="/calendar"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Add event
              </Link>
            </div>
            {events.length === 0 ? (
              <div className="text-center py-6">
                <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming events</p>
                <Link
                  href="/calendar"
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  Schedule something
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event) => {
                  const start = parseISO(event.start_at)
                  const label = isToday(start)
                    ? 'Today'
                    : isTomorrow(start)
                    ? 'Tomorrow'
                    : format(start, 'EEE, MMM d')
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-smooth group"
                    >
                      <div
                        className="w-1 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: event.color ?? '#CDE9D2' }}
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
        <div className="space-y-4">
          {/* Habits today */}
          <motion.div
            custom={7}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Today&apos;s Habits</h2>
              <Link href="/habits" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            {habits.length === 0 ? (
              <div className="text-center py-4">
                <Repeat2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No habits yet</p>
                <Link
                  href="/habits"
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  Add your first habit
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {habits.map((habit) => {
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
                          done
                            ? 'border-primary bg-primary'
                            : 'border-border bg-background'
                        )}
                      >
                        {done && (
                          <svg
                            className="w-3.5 h-3.5 text-primary-foreground"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-sm flex-1 truncate',
                          done ? 'text-primary line-through opacity-60' : 'text-foreground'
                        )}
                      >
                        {habit.title}
                      </span>
                      {habit.streak > 0 && (
                        <span className="text-xs text-muted-foreground">
                          🔥 {habit.streak}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Motivation */}
          <motion.div
            custom={8}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-primary/5 border border-primary/20 rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary uppercase tracking-wide">
                Daily Inspiration
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed italic">{quote}</p>
          </motion.div>

          {/* Quick actions */}
          <motion.div
            custom={9}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="bg-card border border-border rounded-2xl p-5"
          >
            <h2 className="font-semibold text-foreground mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'New Task', href: '/tasks', icon: CheckSquare },
                { label: 'New Event', href: '/calendar', icon: CalendarDays },
                { label: 'Focus Now', href: '/focus', icon: Timer },
                { label: 'Write Journal', href: '/journal', icon: CloudSun },
              ].map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 hover:bg-muted hover:shadow-sm transition-smooth hover:-translate-y-0.5 text-center"
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
