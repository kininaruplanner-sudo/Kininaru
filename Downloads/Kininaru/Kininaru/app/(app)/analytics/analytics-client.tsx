'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO, eachDayOfInterval, subDays } from 'date-fns'
import {
  CheckSquare, Timer, Repeat2, BookOpen, TrendingUp,
  Award, Target, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  tasks: any[]
  focusSessions: any[]
  habits: any[]
  habitLogs: any[]
  journalEntries: any[]
}

const COLORS = ['#B9A7FF', '#CDE9D2', '#FFC8B8', '#EA8EB8', '#BFDFFF']

function BarChart({ data, color = '#B9A7FF' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            initial={{ scaleY: 0, originY: 1 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.03, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="w-full rounded-t-sm origin-bottom min-h-[3px]"
            style={{
              height: `${Math.max((d.value / max) * 100, 4)}%`,
              backgroundColor: color,
              opacity: 0.8,
            }}
          />
          <span className="text-[9px] text-muted-foreground rotate-45 translate-x-1">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function MoodLine({ data }: { data: { date: string; mood: number }[] }) {
  if (!data.length) return <p className="text-xs text-muted-foreground text-center py-6">No mood data yet</p>
  const max = 5
  const width = 100 / (data.length - 1 || 1)
  const points = data.map((d, i) => `${i * width},${100 - (d.mood / max) * 80}`)

  return (
    <div className="relative h-28 w-full">
      <svg viewBox={`0 0 100 100`} className="w-full h-full" preserveAspectRatio="none">
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="#FFC8B8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((d, i) => (
          <circle key={i} cx={i * width} cy={100 - (d.mood / max) * 80} r="3" fill="#FFC8B8" />
        ))}
      </svg>
    </div>
  )
}

export function AnalyticsClient({ tasks, focusSessions, habits, habitLogs, journalEntries }: Props) {
  const last30Days = useMemo(
    () => eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() }),
    []
  )

  const tasksByDay = useMemo(() =>
    last30Days.slice(-14).map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const completed = tasks.filter(
        (t) => t.status === 'done' && t.completed_at?.startsWith(dateStr)
      ).length
      return { label: format(day, 'dd'), value: completed }
    }), [tasks, last30Days])

  const focusByDay = useMemo(() =>
    last30Days.slice(-14).map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const mins = focusSessions
        .filter((s) => s.created_at?.startsWith(dateStr))
        .reduce((a, s) => a + (s.duration_minutes ?? 0), 0)
      return { label: format(day, 'dd'), value: mins }
    }), [focusSessions, last30Days])

  const moodData = useMemo(() =>
    journalEntries
      .filter((e) => e.mood)
      .map((e) => ({ date: e.entry_date, mood: e.mood }))
      .slice(0, 14)
      .reverse(),
    [journalEntries])

  const habitsByDay = useMemo(() =>
    last30Days.slice(-14).map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const done = habitLogs.filter((l) => l.logged_date === dateStr).length
      return { label: format(day, 'dd'), value: done }
    }), [habitLogs, last30Days])

  const totalFocusHours = Math.round(focusSessions.reduce((a, s) => a + (s.duration_minutes ?? 0), 0) / 60)
  const completedTasks = tasks.filter((t) => t.status === 'done').length
  const totalHabitLogs = habitLogs.length
  const avgMood = journalEntries.length
    ? (journalEntries.reduce((a, e) => a + (e.mood ?? 3), 0) / journalEntries.length).toFixed(1)
    : '—'

  const fadeUp = { hidden: { opacity: 0, y: 14 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.28 } }) }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground">Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Last 30 days overview</p>
        </div>
        <BarChart3 className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Focus Hours', value: totalFocusHours, icon: Timer, color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Tasks Done', value: completedTasks, icon: CheckSquare, color: 'text-[#CDE9D2]', bg: 'bg-[#CDE9D2]/10' },
              { label: 'Habit Logs', value: totalHabitLogs, icon: Repeat2, color: 'text-accent', bg: 'bg-accent/10' },
              { label: 'Avg Mood', value: `${avgMood}/5`, icon: BookOpen, color: 'text-secondary-foreground', bg: 'bg-secondary/50' },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="bg-card border border-border rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                  <div className={cn('p-1.5 rounded-lg', kpi.bg)}>
                    <kpi.icon className={cn('w-3.5 h-3.5', kpi.color)} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Tasks Completed</h3>
                <span className="ml-auto text-xs text-muted-foreground">Last 14 days</span>
              </div>
              <BarChart data={tasksByDay} color="#B9A7FF" />
            </motion.div>

            <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Timer className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Focus Time (min)</h3>
                <span className="ml-auto text-xs text-muted-foreground">Last 14 days</span>
              </div>
              <BarChart data={focusByDay} color="#CDE9D2" />
            </motion.div>

            <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible" className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Repeat2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Habits Completed</h3>
                <span className="ml-auto text-xs text-muted-foreground">Last 14 days</span>
              </div>
              <BarChart data={habitsByDay} color="#FFC8B8" />
            </motion.div>

            <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible" className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Mood Trend</h3>
                <span className="ml-auto text-xs text-muted-foreground">Scale 1–5</span>
              </div>
              <MoodLine data={moodData} />
            </motion.div>
          </div>

          {/* Productivity heatmap */}
          <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible" className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">30-Day Productivity Heatmap</h3>
            </div>
            <div className="flex gap-1 flex-wrap">
              {last30Days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const taskCount = tasks.filter((t) => t.status === 'done' && t.completed_at?.startsWith(dateStr)).length
                const focusMins = focusSessions.filter((s) => s.created_at?.startsWith(dateStr)).reduce((a, s) => a + (s.duration_minutes ?? 0), 0)
                const habitCount = habitLogs.filter((l) => l.logged_date === dateStr).length
                const score = taskCount + Math.floor(focusMins / 25) + habitCount
                const intensity = score === 0 ? 0 : score < 2 ? 0.25 : score < 4 ? 0.5 : score < 6 ? 0.75 : 1
                return (
                  <div
                    key={dateStr}
                    title={`${format(day, 'MMM d')}: ${score} activities`}
                    className="w-6 h-6 rounded-sm transition-smooth hover:scale-110 cursor-default"
                    style={{
                      backgroundColor: intensity === 0 ? undefined : `rgba(52,73,104,${intensity})`,
                    }}
                    {...(intensity === 0 ? { className: 'w-6 h-6 rounded-sm bg-muted' } : {})}
                  />
                )
              })}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">Less</span>
              {[0.15, 0.35, 0.55, 0.75, 1].map((o) => (
                <div key={o} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(52,73,104,${o})` }} />
              ))}
              <span className="text-xs text-muted-foreground">More</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
