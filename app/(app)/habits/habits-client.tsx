'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import { eachDayOfInterval, subDays, isSameDay, isSameMonth, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { format } from '@/lib/date-fr'
import { Plus, X, Flame, Star, Target, TrendingUp, Award, Sparkles, ChevronLeft, ChevronRight, Heart, BookOpen, Footprints, Droplet, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, cardVariants } from '@/components/ui/card'
import { palette } from '@/lib/palette'

const HABIT_COLORS = [
  palette('sage'), palette('coral'), palette('violet'),
  palette('rose-dark'), palette('blue'), palette('lavender'),
]

const HABIT_ICONS = ['star', 'fire', 'target', 'heart', 'book', 'running', 'water', 'sleep']

const HABIT_ICON_MAP: Record<string, typeof Star> = {
  star: Star,
  fire: Flame,
  target: Target,
  heart: Heart,
  book: BookOpen,
  running: Footprints,
  water: Droplet,
  sleep: Moon,
}

/** Deterministic so a habit always gets the same icon across sessions, without needing a schema column to persist a user choice. */
function iconForHabit(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return HABIT_ICON_MAP[HABIT_ICONS[hash % HABIT_ICONS.length]]
}

interface Habit {
  id: string
  title: string
  color: string
  streak: number
  best_streak: number
}

interface Log {
  habit_id: string
  logged_date: string
}

interface Profile {
  xp: number
  level: number
}

interface Props {
  habits: Habit[]
  logs: Log[]
  userId: string
  profile: Profile | null
}

// ---------------------------------------------------------------------
// GitHub-style contribution grid — weeks as columns, Mon–Sun as rows.
// Reused for both the per-habit heatmap (single color, binary) and could
// be reused for any 0..1 intensity series.
// ---------------------------------------------------------------------
function buildWeeks(days: Date[]) {
  if (days.length === 0) return [] as (Date | null)[][]
  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = []
  const firstDow = (days[0].getDay() + 6) % 7 // Mon=0 .. Sun=6
  for (let i = 0; i < firstDow; i++) week.push(null)
  for (const d of days) {
    week.push(d)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

function HeatmapGrid({
  days,
  getIntensity,
  activeColor,
  cell = 11,
}: {
  days: Date[]
  getIntensity: (d: Date) => number
  activeColor: string
  cell?: number
}) {
  const weeks = buildWeeks(days)
  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex flex-col gap-1">
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => {
            const firstDay = week.find((d) => d !== null) ?? null
            const prevWeek = weeks[wi - 1]
            const prevFirstDay = prevWeek?.find((d) => d !== null) ?? null
            const showLabel = firstDay && (!prevFirstDay || firstDay.getMonth() !== prevFirstDay.getMonth())
            return (
              <div key={wi} style={{ width: cell }} className="text-[9px] text-muted-foreground leading-none">
                {showLabel ? format(firstDay!, 'MMM') : ''}
              </div>
            )
          })}
        </div>
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => {
                if (!day) return <div key={di} style={{ width: cell, height: cell }} />
                const intensity = getIntensity(day)
                return (
                  <div
                    key={di}
                    title={`${format(day, 'MMM d')}${intensity > 0 ? '' : ' — no check-in'}`}
                    style={{
                      width: cell,
                      height: cell,
                      backgroundColor: intensity > 0 ? activeColor : undefined,
                      opacity: intensity > 0 ? 0.18 + intensity * 0.82 : undefined,
                    }}
                    className={cn('rounded-sm transition-smooth', intensity === 0 && 'bg-muted')}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Weekly progress — % of habits completed per day, last 7 days
// ---------------------------------------------------------------------
function WeeklyProgress({ habits, isLoggedOn }: { habits: Habit[]; isLoggedOn: (id: string, d: Date) => boolean }) {
  const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() })
  const rates = days.map((d) =>
    habits.length ? Math.round((habits.filter((h) => isLoggedOn(h.id, d)).length / habits.length) * 100) : 0
  )
  return (
    <div>
      <div className="flex items-end gap-1.5 h-16">
        {days.map((d, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: rates[i] > 0 ? Math.max((rates[i] / 100) * 64, 4) : 2 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className={cn('flex-1 rounded-t-md', isSameDay(d, new Date()) ? 'bg-primary' : 'bg-primary/30')}
            title={`${format(d, 'EEE')}: ${rates[i]}%`}
          />
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {days.map((d, i) => (
          <span
            key={i}
            className={cn('flex-1 text-center text-[10px]', isSameDay(d, new Date()) ? 'text-primary font-semibold' : 'text-muted-foreground')}
          >
            {format(d, 'EEEEE')}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Monthly progress — small calendar-style grid, shaded by that day's
// across-all-habits completion rate (distinct layout from the GitHub-style
// weekly heatmap above: real calendar rows instead of week-columns).
// ---------------------------------------------------------------------
function MonthlyHeatmap({
  month,
  onPrevMonth,
  onNextMonth,
  habits,
  isLoggedOn,
}: {
  month: Date
  onPrevMonth: () => void
  onNextMonth: () => void
  habits: Habit[]
  isLoggedOn: (id: string, d: Date) => boolean
}) {
  const today = new Date()
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const days = eachDayOfInterval({ start, end })
  const firstDow = (start.getDay() + 6) % 7 // Mon=0 .. Sun=6
  const cells: (Date | null)[] = [...Array.from({ length: firstDow }, () => null), ...days]
  const rateFor = (d: Date) => (habits.length ? habits.filter((h) => isLoggedOn(h.id, d)).length / habits.length : 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onPrevMonth}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-medium text-foreground">{format(month, 'MMMM yyyy')}</span>
        <button
          onClick={onNextMonth}
          disabled={isSameMonth(month, today)}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-[9px] text-center text-muted-foreground">{d}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="w-full aspect-square" />
          if (d > today) return <div key={i} className="w-full aspect-square rounded-sm bg-muted/20" />
          const rate = rateFor(d)
          return (
            <div
              key={i}
              title={`${format(d, 'MMM d')}: ${Math.round(rate * 100)}%`}
              className={cn(
                'w-full aspect-square rounded-sm transition-smooth',
                rate === 0 && 'bg-muted',
                isSameDay(d, today) && 'ring-1 ring-primary'
              )}
              style={rate > 0 ? { backgroundColor: 'var(--kt-primary)', opacity: 0.15 + rate * 0.85 } : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}

export function HabitsClient({ habits: initialHabits, logs, userId, profile }: Props) {
  const [habits, setHabits] = useState(initialHabits)
  const [localLogs, setLocalLogs] = useState(logs)
  const [showModal, setShowModal] = useState(false)
  const [justChecked, setJustChecked] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Opened via the command palette's quick-create shortcut (?new=1)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowModal(true)
      router.replace(window.location.pathname)
    }
  }, [searchParams, router])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', color: HABIT_COLORS[0] })
  const [xp, setXp] = useState(profile?.xp ?? 0)
  const [level, setLevel] = useState(profile?.level ?? 1)
  const [xpToast, setXpToast] = useState<string | null>(null)
  const [leveledUp, setLeveledUp] = useState(false)
  const [monthCursor, setMonthCursor] = useState(new Date())
  const [milestoneHit, setMilestoneHit] = useState<{ title: string; days: number } | null>(null)
  const supabase = createClient()

  const XP_PER_CHECK_IN = 10

  /** Habit completion is the only XP source today. Levels use an increasing threshold (level N needs N*100 xp), matching the progress bar already shown below. */
  const awardXp = async (habitId: string) => {
    let newXp = xp + XP_PER_CHECK_IN
    let newLevel = level
    let didLevelUp = false
    while (newXp >= newLevel * 100) {
      newXp -= newLevel * 100
      newLevel += 1
      didLevelUp = true
    }
    setXp(newXp)
    setLevel(newLevel)
    setXpToast(habitId)
    setTimeout(() => setXpToast(null), 900)
    if (didLevelUp) {
      setLeveledUp(true)
      setTimeout(() => setLeveledUp(false), 3500)
    }
    await supabase.from('profiles').update({ xp: newXp, level: newLevel }).eq('id', userId)
  }

  const today = new Date().toISOString().split('T')[0]
  const heatmapDays = eachDayOfInterval({ start: subDays(new Date(), 104), end: new Date() })
  const last30Days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })

  const isLoggedOn = (habitId: string, date: Date) =>
    localLogs.some(
      (l) => l.habit_id === habitId && l.logged_date === format(date, 'yyyy-MM-dd')
    )

  const MILESTONES = [7, 14, 30, 60, 100]

  /** Mirrors the exact algorithm in the update_habit_streak SQL function (consecutive days ending today, or yesterday if today isn't logged yet) purely for instant client-side feedback. The RPC call below remains the actual source of truth in the database. */
  const computeStreak = (habitId: string, logs: Log[]) => {
    const loggedOn = (d: Date) => logs.some((l) => l.habit_id === habitId && l.logged_date === format(d, 'yyyy-MM-dd'))
    let cursor = new Date()
    if (!loggedOn(cursor)) cursor = subDays(cursor, 1)
    let streak = 0
    while (loggedOn(cursor)) {
      streak++
      cursor = subDays(cursor, 1)
    }
    return streak
  }

  const toggleToday = async (habitId: string) => {
    const isLogged = isLoggedOn(habitId, new Date())
    if (isLogged) {
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .eq('user_id', userId)
        .eq('logged_date', today)
      const newLogs = localLogs.filter((l) => !(l.habit_id === habitId && l.logged_date === today))
      setLocalLogs(newLogs)
      const newStreak = computeStreak(habitId, newLogs)
      setHabits((prev) => prev.map((h) => (h.id === habitId ? { ...h, streak: newStreak } : h)))
    } else {
      const { data } = await supabase
        .from('habit_logs')
        .upsert({ habit_id: habitId, user_id: userId, logged_date: today })
        .select()
        .single()
      if (data) {
        const newLogs = [...localLogs, data]
        setLocalLogs(newLogs)
        const newStreak = computeStreak(habitId, newLogs)
        setHabits((prev) =>
          prev.map((h) => (h.id === habitId ? { ...h, streak: newStreak, best_streak: Math.max(h.best_streak, newStreak) } : h))
        )
        if (MILESTONES.includes(newStreak)) {
          const habit = habits.find((h) => h.id === habitId)
          setMilestoneHit({ title: habit?.title ?? 'Habitude', days: newStreak })
          setTimeout(() => setMilestoneHit(null), 4500)
        }
      }

      // Celebratory micro-animation on the check button
      setJustChecked(habitId)
      setTimeout(() => setJustChecked(null), 700)
      awardXp(habitId)

      // Persist the streak server-side too (source of truth for the next page load)
      try {
        await supabase.rpc('update_habit_streak', { p_habit_id: habitId })
      } catch {
        // non-blocking — the local mirror above already reflects it; a future load will just re-confirm
      }
    }
  }

  const saveHabit = async () => {
    if (!form.title.trim()) return
    setLoading(true)
    const { data } = await supabase
      .from('habits')
      .insert({ user_id: userId, title: form.title, color: form.color })
      .select()
      .single()
    if (data) {
      setHabits((prev) => [...prev, data])
      setShowModal(false)
      setForm({ title: '', color: HABIT_COLORS[0] })
    }
    setLoading(false)
  }

  const deleteHabit = async (id: string) => {
    await supabase.from('habits').delete().eq('id', id)
    setHabits((prev) => prev.filter((h) => h.id !== id))
    setLocalLogs((prev) => prev.filter((l) => l.habit_id !== id))
  }

  const totalDoneToday = habits.filter((h) => isLoggedOn(h.id, new Date())).length
  const bestStreak = Math.max(...habits.map((h) => h.best_streak ?? 0), 0)

  const monthDays = eachDayOfInterval({
    start: startOfMonth(monthCursor),
    end: isSameMonth(monthCursor, new Date()) ? new Date() : endOfMonth(monthCursor),
  })
  const monthlyRate = habits.length
    ? Math.round(
        (monthDays.reduce((sum, d) => sum + habits.filter((h) => isLoggedOn(h.id, d)).length, 0) /
          (habits.length * monthDays.length)) * 100
      )
    : 0

  const xpForNext = level * 100
  const xpProgress = Math.min(1, xp / xpForNext)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground">Habitudes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalDoneToday} of {habits.length} done today
          </p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Nouvelle habitude
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Level-up celebration */}
          <AnimatePresence>
            {leveledUp && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.96 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className={cn(cardVariants({ variant: 'accent', padding: 'sm' }), 'flex items-center gap-3 text-center justify-center')}
              >
                <Sparkles className="w-5 h-5 text-kin-yellow shrink-0" />
                <p className="text-sm font-medium text-foreground">Niveau supérieur ! Vous êtes maintenant niveau {level} 🎉</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Streak milestone celebration */}
          <AnimatePresence>
            {milestoneHit && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.96 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className={cn(cardVariants({ variant: 'accent', padding: 'sm' }), 'flex items-center gap-3 text-center justify-center')}
              >
                <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5, repeat: 2 }}>
                  <Flame className="w-5 h-5 text-kin-coral shrink-0" />
                </motion.span>
                <p className="text-sm font-medium text-foreground">
                  Série de {milestoneHit.days} jours sur « {milestoneHit.title} » 🔥
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Habitudes', value: habits.length, icon: Target, color: 'text-primary' },
              { label: "Faites aujourd'hui", value: totalDoneToday, icon: Star, color: 'text-kin-sage' },
              { label: 'Meilleure série', value: `${bestStreak}j`, icon: Flame, color: 'text-accent' },
              { label: 'Taux de réussite', value: habits.length ? `${Math.round((totalDoneToday / habits.length) * 100)}%` : '0%', icon: TrendingUp, color: 'text-secondary-foreground' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.25 }}
                className={cardVariants({ padding: 'sm' })}
              >
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={cn('w-4 h-4', stat.color)} />
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Level / XP + Weekly + Monthly progress */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.25 }}>
              <Card padding="sm" className={cn('transition-smooth', leveledUp && 'ring-2 ring-kin-yellow shadow-kin-hover')}>
                <div className="flex items-center gap-2 mb-2">
                  <motion.span animate={leveledUp ? { rotate: [0, -12, 12, -8, 8, 0], scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.6 }}>
                    <Award className="w-4 h-4 text-kin-yellow" />
                  </motion.span>
                  <h3 className="text-sm font-semibold text-foreground">Niveau {level}</h3>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress * 100}%` }}
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                    className="h-full rounded-full bg-kin-yellow"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{xp} / {xpForNext} XP pour le niveau {level + 1}</p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.25 }}>
              <Card padding="sm">
                <h3 className="text-sm font-semibold text-foreground mb-3">Cette semaine</h3>
                <WeeklyProgress habits={habits} isLoggedOn={isLoggedOn} />
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.25 }}>
              <Card padding="sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {isSameMonth(monthCursor, new Date()) ? 'Ce mois-ci' : format(monthCursor, 'MMMM')}
                  </h3>
                  <span className="text-sm font-bold text-primary">{monthlyRate}%</span>
                </div>
                <MonthlyHeatmap
                  month={monthCursor}
                  onPrevMonth={() => setMonthCursor((m) => subMonths(m, 1))}
                  onNextMonth={() => setMonthCursor((m) => addMonths(m, 1))}
                  habits={habits}
                  isLoggedOn={isLoggedOn}
                />
              </Card>
            </motion.div>
          </div>

          {/* Habits list with per-habit heatmap */}
          {habits.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="text-foreground font-medium">Aucune habitude pour l'instant</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Construisez de la régularité avec des habitudes quotidiennes
              </p>
              <Button onClick={() => setShowModal(true)} size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Créer votre première habitude
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {habits.map((habit, i) => {
                const doneToday = isLoggedOn(habit.id, new Date())
                const daysLogged = last30Days.filter((d) => isLoggedOn(habit.id, d)).length
                const HabitIcon = iconForHabit(habit.id)

                return (
                  <motion.div
                    key={habit.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    className={cn(cardVariants({ padding: 'sm', hover: true }), 'group')}
                  >
                    <div className="flex items-start gap-4">
                      {/* Check button */}
                      <div className="relative shrink-0 mt-0.5">
                        <AnimatePresence>
                          {xpToast === habit.id && (
                            <motion.span
                              initial={{ opacity: 0, y: 0, scale: 0.8 }}
                              animate={{ opacity: 1, y: -22, scale: 1 }}
                              exit={{ opacity: 0, y: -32 }}
                              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                              className="absolute -top-1 left-1/2 -translate-x-1/2 text-xs font-bold text-kin-yellow pointer-events-none whitespace-nowrap z-10"
                            >
                              +{XP_PER_CHECK_IN} XP
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <AnimatePresence>
                          {justChecked === habit.id && (
                            <motion.span
                              initial={{ scale: 0.6, opacity: 0.6 }}
                              animate={{ scale: 2.2, opacity: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                              className="absolute inset-0 rounded-full pointer-events-none"
                              style={{ backgroundColor: habit.color }}
                            />
                          )}
                        </AnimatePresence>
                        <motion.button
                          onClick={() => toggleToday(habit.id)}
                          whileTap={{ scale: 0.9 }}
                          animate={justChecked === habit.id ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                          className={cn(
                            'relative w-8 h-8 rounded-full border-2 flex items-center justify-center transition-smooth hover:scale-110',
                            doneToday ? 'border-transparent' : 'border-border hover:border-current'
                          )}
                          style={doneToday ? { backgroundColor: habit.color, borderColor: habit.color } : {}}
                        >
                          <AnimatePresence mode="wait">
                            {doneToday ? (
                              <motion.svg
                                key="check"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                className="w-4 h-4 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <motion.path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </motion.svg>
                            ) : (
                              <motion.span key="icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                                <HabitIcon className="w-3.5 h-3.5 opacity-50" style={{ color: habit.color }} />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={cn('text-sm font-medium', doneToday ? 'text-muted-foreground line-through' : 'text-foreground')}>
                              {habit.title}
                            </p>
                            {habit.streak > 0 && (
                              <span
                                className={cn(
                                  'flex items-center gap-0.5 text-xs font-medium',
                                  habit.streak >= 30 ? 'text-kin-yellow' : 'text-kin-coral'
                                )}
                                title={`Série de ${habit.streak} jours`}
                              >
                                <Flame className={cn('shrink-0', habit.streak >= 14 ? 'w-4 h-4' : habit.streak >= 7 ? 'w-3.5 h-3.5' : 'w-3 h-3')} />
                                {habit.streak}
                              </span>
                            )}
                            {habit.streak > 0 && (() => {
                              const milestones = [7, 14, 30, 60, 100]
                              const next = milestones.find((m) => m > habit.streak)
                              return next ? (
                                <span className="text-[10px] text-muted-foreground">{next - habit.streak}j avant une série de {next} jours</span>
                              ) : null
                            })()}
                            {habit.best_streak > 0 && habit.best_streak !== habit.streak && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title="Meilleure série">
                                <Sparkles className="w-2.5 h-2.5" />
                                record {habit.best_streak}
                              </span>
                            )}
                            {habit.streak > 0 && habit.streak === habit.best_streak && habit.streak > 1 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-kin-yellow/20 text-kin-yellow font-medium">
                                Record personnel
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{daysLogged}/30d</span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => deleteHabit(habit.id)}
                              className="opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* GitHub-style heatmap (15 weeks) */}
                        <div className="mt-2">
                          <HeatmapGrid
                            days={heatmapDays}
                            getIntensity={(d) => (isLoggedOn(habit.id, d) ? 1 : 0)}
                            activeColor={habit.color}
                            cell={9}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* New habit modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="glass border border-border rounded-3xl p-6 w-full max-w-md shadow-kin-hover"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-serif font-bold text-foreground">Nouvelle habitude</h2>
                <Button variant="ghost" size="icon-xs" onClick={() => setShowModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Nom de l'habitude</Label>
                  <Input
                    placeholder="ex. Méditation matinale"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="mt-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) saveHabit()
                    }}
                  />
                </div>

                <div>
                  <Label>Couleur</Label>
                  <div className="flex gap-2 mt-2">
                    {HABIT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm({ ...form, color: c })}
                        className={cn(
                          'w-7 h-7 rounded-full transition-all duration-150',
                          form.color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <Button
                  onClick={saveHabit}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Création...' : "Créer l'habitude"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
