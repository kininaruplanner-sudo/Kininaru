'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, eachDayOfInterval, subDays, isSameDay, parseISO } from 'date-fns'
import { Plus, X, Flame, Star, Target, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const HABIT_COLORS = [
  '#CDE9D2', '#FFC8B8', '#B9A7FF', '#EA8EB8', '#BFDFFF', '#CDB8FF',
]

const HABIT_ICONS = ['star', 'fire', 'target', 'heart', 'book', 'running', 'water', 'sleep']

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

interface Props {
  habits: Habit[]
  logs: Log[]
  userId: string
}

export function HabitsClient({ habits: initialHabits, logs, userId }: Props) {
  const [habits, setHabits] = useState(initialHabits)
  const [localLogs, setLocalLogs] = useState(logs)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', color: HABIT_COLORS[0] })
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]
  const last30Days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })

  const isLoggedOn = (habitId: string, date: Date) =>
    localLogs.some(
      (l) => l.habit_id === habitId && l.logged_date === format(date, 'yyyy-MM-dd')
    )

  const toggleToday = async (habitId: string) => {
    const isLogged = isLoggedOn(habitId, new Date())
    if (isLogged) {
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .eq('user_id', userId)
        .eq('logged_date', today)
      setLocalLogs((prev) =>
        prev.filter((l) => !(l.habit_id === habitId && l.logged_date === today))
      )
    } else {
      const { data } = await supabase
        .from('habit_logs')
        .upsert({ habit_id: habitId, user_id: userId, logged_date: today })
        .select()
        .single()
      if (data) setLocalLogs((prev) => [...prev, data])

      // Update streak
      await supabase.rpc('update_habit_streak', { p_habit_id: habitId }).catch(() => {})
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground">Habits</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalDoneToday} of {habits.length} done today
          </p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> New Habit
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Habits', value: habits.length, icon: Target, color: 'text-primary' },
              { label: 'Done Today', value: totalDoneToday, icon: Star, color: 'text-[#CDE9D2]' },
              { label: 'Best Streak', value: `${bestStreak}d`, icon: Flame, color: 'text-accent' },
              { label: 'Completion', value: habits.length ? `${Math.round((totalDoneToday / habits.length) * 100)}%` : '0%', icon: TrendingUp, color: 'text-secondary-foreground' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.25 }}
                className="bg-card border border-border rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={cn('w-4 h-4', stat.color)} />
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Habits list with heatmap */}
          {habits.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="text-foreground font-medium">No habits yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Build consistency with daily habits
              </p>
              <Button onClick={() => setShowModal(true)} size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Create your first habit
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {habits.map((habit, i) => {
                const doneToday = isLoggedOn(habit.id, new Date())
                const daysLogged = last30Days.filter((d) => isLoggedOn(habit.id, d)).length

                return (
                  <motion.div
                    key={habit.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-smooth group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Check button */}
                      <button
                        onClick={() => toggleToday(habit.id)}
                        className={cn(
                          'mt-0.5 w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-110',
                          doneToday
                            ? 'border-transparent'
                            : 'border-border hover:border-current'
                        )}
                        style={doneToday ? { backgroundColor: habit.color, borderColor: habit.color } : {}}
                      >
                        {doneToday && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className={cn('text-sm font-medium', doneToday ? 'text-muted-foreground line-through' : 'text-foreground')}>
                              {habit.title}
                            </p>
                            {habit.streak > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-orange-500 font-medium">
                                <Flame className="w-3 h-3" />
                                {habit.streak}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{daysLogged}/30d</span>
                            <button
                              onClick={() => deleteHabit(habit.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive text-muted-foreground transition-smooth"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 30-day heatmap */}
                        <div className="flex gap-0.5 mt-2 flex-wrap">
                          {last30Days.map((day) => {
                            const done = isLoggedOn(habit.id, day)
                            return (
                              <div
                                key={day.toISOString()}
                                title={format(day, 'MMM d')}
                                className="w-3 h-3 rounded-sm transition-smooth"
                                style={{
                                  backgroundColor: done ? habit.color : undefined,
                                  opacity: done ? 1 : undefined,
                                }}
                                {...(!done ? { className: 'w-3 h-3 rounded-sm bg-muted' } : {})}
                              />
                            )
                          })}
                        </div>

                        {/* Progress bar */}
                        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(daysLogged / 30) * 100}%`,
                              backgroundColor: habit.color,
                            }}
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
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
                <h2 className="text-lg font-serif font-bold text-foreground">New Habit</h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Habit name</Label>
                  <Input
                    placeholder="e.g. Morning meditation"
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
                  <Label>Color</Label>
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
                  {loading ? 'Creating...' : 'Create Habit'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
