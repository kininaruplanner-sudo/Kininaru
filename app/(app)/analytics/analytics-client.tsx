'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, eachDayOfInterval, subDays, isSameMonth, subMonths } from 'date-fns'
import {
  CheckSquare, Timer, Repeat2, BookOpen, TrendingUp,
  BarChart3, ArrowUp, ArrowDown, CalendarDays, CalendarRange,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { cn } from '@/lib/utils'
import { cardVariants } from '@/components/ui/card'

interface RawTask { status?: string; completed_at?: string | null }
interface RawFocusSession { created_at?: string; duration_minutes?: number }
interface RawHabit { id: string; title: string; color: string }
interface RawHabitLog { habit_id: string; logged_date: string }
interface RawJournalEntry { mood?: number | null; entry_date: string }

interface Props {
  tasks: RawTask[]
  focusSessions: RawFocusSession[]
  habits: RawHabit[]
  habitLogs: RawHabitLog[]
  journalEntries: RawJournalEntry[]
}

type RangeOption = 7 | 30 | 90

// ---------------------------------------------------------------------
// Trend badge — % change vs the equal-length previous period
// ---------------------------------------------------------------------
function TrendBadge({ change }: { change: number | null }) {
  if (change === null) return null
  if (change === 0) return <span className="text-[10px] text-muted-foreground font-medium">flat</span>
  const up = change > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', up ? 'text-kin-sage' : 'text-destructive')}>
      {up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {Math.abs(change)}%
    </span>
  )
}

// ---------------------------------------------------------------------
// Interactive bar chart — hover shows exact value
// ---------------------------------------------------------------------
function BarChart({ data, color = 'var(--kt-violet)', suffix = '' }: { data: { label: string; value: number }[]; color?: string; suffix?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 flex flex-col items-center gap-1 relative"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover((h) => (h === i ? null : h))}
        >
          <AnimatePresence>
            {hover === i && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="absolute -top-7 z-10 px-2 py-1 rounded-lg bg-foreground text-background text-[10px] font-medium whitespace-nowrap shadow-kin-hover pointer-events-none"
              >
                {d.value}{suffix}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            initial={{ scaleY: 0, originY: 1 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.02, duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="w-full rounded-t-sm origin-bottom min-h-[3px] transition-smooth cursor-default"
            style={{
              height: `${Math.max((d.value / max) * 100, 4)}%`,
              backgroundColor: color,
              opacity: hover === i ? 1 : 0.8,
            }}
          />
          <span className="text-[9px] text-muted-foreground whitespace-nowrap">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// Interactive mood line — hover a point for date + value
// ---------------------------------------------------------------------
function MoodLine({ data }: { data: { date: string; mood: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (!data.length) return <p className="text-xs text-muted-foreground text-center py-6">No mood data yet</p>
  const max = 5
  const width = 100 / (data.length - 1 || 1)
  const points = data.map((d, i) => `${i * width},${100 - (d.mood / max) * 80}`)

  return (
    <div className="relative h-28 w-full">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <polyline points={points.join(' ')} fill="none" stroke="var(--kt-coral)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={i * width}
            cy={100 - (d.mood / max) * 80}
            r={hover === i ? 5 : 3}
            fill="var(--kt-coral)"
            className="transition-all duration-150 cursor-pointer"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
      </svg>
      <AnimatePresence>
        {hover !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute px-2 py-1 rounded-lg bg-foreground text-background text-[10px] font-medium whitespace-nowrap shadow-kin-hover pointer-events-none -translate-x-1/2 -translate-y-full"
            style={{ left: `${hover * width}%`, top: `${100 - (data[hover].mood / max) * 80}%` }}
          >
            {format(parseISO(data[hover].date), 'MMM d')}: {data[hover].mood}/5
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------
// GitHub-style contribution heatmap — weeks as columns, Mon–Sun rows
// ---------------------------------------------------------------------
function buildWeeks(days: Date[]) {
  if (days.length === 0) return [] as (Date | null)[][]
  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = []
  const firstDow = (days[0].getDay() + 6) % 7
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

function ActivityHeatmap({ days, getScore }: { days: Date[]; getScore: (d: Date) => number }) {
  const weeks = buildWeeks(days)
  const cell = 13
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
                const score = getScore(day)
                const intensity = score === 0 ? 0 : score < 2 ? 0.3 : score < 4 ? 0.55 : score < 6 ? 0.8 : 1
                return (
                  <div
                    key={di}
                    title={`${format(day, 'MMM d')}: ${score} activities`}
                    style={{
                      width: cell,
                      height: cell,
                      backgroundColor: intensity > 0 ? 'var(--kt-primary)' : undefined,
                      opacity: intensity > 0 ? 0.15 + intensity * 0.85 : undefined,
                    }}
                    className={cn('rounded-sm transition-smooth hover:scale-110 cursor-default', intensity === 0 && 'bg-muted')}
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

export function AnalyticsClient({ tasks, focusSessions, habits, habitLogs, journalEntries }: Props) {
  const [range, setRange] = useState<RangeOption>(30)
  const [habitFilter, setHabitFilter] = useState<string>('all')

  const filteredHabitLogs = useMemo(
    () => (habitFilter === 'all' ? habitLogs : habitLogs.filter((l) => l.habit_id === habitFilter)),
    [habitLogs, habitFilter]
  )
  const selectedHabit = habits.find((h) => h.id === habitFilter) ?? null

  const allDays = useMemo(() => eachDayOfInterval({ start: subDays(new Date(), 89), end: new Date() }), [])
  const rangeDays = useMemo(() => allDays.slice(-range), [allDays, range])
  const hasPrevPeriod = allDays.length >= range * 2
  const prevRangeDays = useMemo(
    () => (hasPrevPeriod ? allDays.slice(-(range * 2), -range) : []),
    [allDays, range, hasPrevPeriod]
  )

  const tasksValueForDay = useCallback(
    (d: Date) => {
      const s = format(d, 'yyyy-MM-dd')
      return tasks.filter((t) => t.status === 'done' && t.completed_at?.startsWith(s)).length
    },
    [tasks]
  )
  const focusValueForDay = useCallback(
    (d: Date) => {
      const s = format(d, 'yyyy-MM-dd')
      return focusSessions.filter((f) => f.created_at?.startsWith(s)).reduce((a, f) => a + (f.duration_minutes ?? 0), 0)
    },
    [focusSessions]
  )
  const habitsValueForDay = useCallback(
    (d: Date) => {
      const s = format(d, 'yyyy-MM-dd')
      return filteredHabitLogs.filter((l) => l.logged_date === s).length
    },
    [filteredHabitLogs]
  )

  /** Daily bars for 7d/30d ranges; weekly-summed buckets for 90d so the chart stays readable. */
  const bucketedSeries = useCallback(
    (days: Date[], valueForDay: (d: Date) => number) => {
      if (range <= 30) {
        return days.map((d) => ({ label: format(d, range === 7 ? 'EEE' : 'd'), value: valueForDay(d) }))
      }
      const buckets: { label: string; value: number }[] = []
      for (let i = 0; i < days.length; i += 7) {
        const chunk = days.slice(i, i + 7)
        buckets.push({ label: format(chunk[0], 'MMM d'), value: chunk.reduce((a, d) => a + valueForDay(d), 0) })
      }
      return buckets
    },
    [range]
  )

  const tasksByDay = useMemo(() => bucketedSeries(rangeDays, tasksValueForDay), [bucketedSeries, tasksValueForDay, rangeDays])
  const focusByDay = useMemo(() => bucketedSeries(rangeDays, focusValueForDay), [bucketedSeries, focusValueForDay, rangeDays])
  const habitsByDay = useMemo(() => bucketedSeries(rangeDays, habitsValueForDay), [bucketedSeries, habitsValueForDay, rangeDays])

  const moodData = useMemo(() => {
    const rangeSet = new Set(rangeDays.map((d) => format(d, 'yyyy-MM-dd')))
    return journalEntries
      .filter((e) => e.mood && rangeSet.has(e.entry_date))
      .map((e) => ({ date: e.entry_date, mood: e.mood as number }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-20)
  }, [journalEntries, rangeDays])

  // ---- Period metrics + trend vs previous equal-length period ----
  const metricsFor = useCallback(
    (days: Date[]) => {
      const set = new Set(days.map((d) => format(d, 'yyyy-MM-dd')))
      const focusMins = focusSessions.filter((f) => f.created_at && set.has(f.created_at.slice(0, 10))).reduce((a, f) => a + (f.duration_minutes ?? 0), 0)
      const tasksDone = tasks.filter((t) => t.status === 'done' && t.completed_at && set.has(t.completed_at.slice(0, 10))).length
      const habitCount = filteredHabitLogs.filter((l) => set.has(l.logged_date)).length
      const moods = journalEntries.filter((e) => e.mood && set.has(e.entry_date))
      const avgMood = moods.length ? moods.reduce((a, e) => a + (e.mood ?? 0), 0) / moods.length : null
      return { focusMins, tasksDone, habitCount, avgMood }
    },
    [tasks, focusSessions, filteredHabitLogs, journalEntries]
  )

  const current = useMemo(() => metricsFor(rangeDays), [metricsFor, rangeDays])
  const previous = useMemo(() => (hasPrevPeriod ? metricsFor(prevRangeDays) : null), [metricsFor, prevRangeDays, hasPrevPeriod])

  const pctChange = (curr: number, prev: number | null | undefined) => {
    if (prev === null || prev === undefined) return null
    if (prev === 0) return curr > 0 ? 100 : null
    return Math.round(((curr - prev) / prev) * 100)
  }

  // ---- Weekly report: this week vs last week (rolling 7 days) ----
  const thisWeek = metricsFor(allDays.slice(-7))
  const lastWeek = allDays.length >= 14 ? metricsFor(allDays.slice(-14, -7)) : null

  // ---- Monthly report: this calendar month vs last, within the fetched window ----
  const thisMonthDays = allDays.filter((d) => isSameMonth(d, new Date()))
  const lastMonthRef = subMonths(new Date(), 1)
  const lastMonthDays = allDays.filter((d) => isSameMonth(d, lastMonthRef))
  const thisMonth = metricsFor(thisMonthDays)
  const lastMonthMetrics = lastMonthDays.length ? metricsFor(lastMonthDays) : null

  const fadeUp = { hidden: { opacity: 0, y: 14 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.25 } }) }

  const kpis = [
    {
      label: 'Focus Hours', value: Math.round(current.focusMins / 60), change: pctChange(current.focusMins, previous?.focusMins),
      icon: Timer, color: 'text-primary', bg: 'bg-primary/10',
    },
    {
      label: 'Tasks Done', value: current.tasksDone, change: pctChange(current.tasksDone, previous?.tasksDone),
      icon: CheckSquare, color: 'text-kin-sage', bg: 'bg-kin-sage/10',
    },
    {
      label: 'Habit Logs', value: current.habitCount, change: pctChange(current.habitCount, previous?.habitCount),
      icon: Repeat2, color: 'text-accent', bg: 'bg-accent/10',
    },
    {
      label: 'Avg Mood', value: current.avgMood !== null ? `${current.avgMood.toFixed(1)}/5` : '—',
      change: current.avgMood !== null ? pctChange(current.avgMood, previous?.avgMood) : null,
      icon: BookOpen, color: 'text-secondary-foreground', bg: 'bg-secondary/50',
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={BarChart3}
        title="Analyses"
        subtitle={`Aperçu des ${range} derniers jours${selectedHabit ? ` · ${selectedHabit.title}` : ''}`}
        actions={
          <>
            {habits.length > 0 && (
              <div className="relative">
                <Repeat2 className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={habitFilter}
                  onChange={(e) => setHabitFilter(e.target.value)}
                  className="h-8 pl-8 pr-3 text-xs bg-muted rounded-full border-none focus:outline-none focus:ring-2 focus:ring-ring transition-smooth appearance-none cursor-pointer"
                >
                  <option value="all">Toutes les habitudes</option>
                  {habits.map((h) => (
                    <option key={h.id} value={h.id}>{h.title}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              {([7, 30, 90] as RangeOption[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-smooth',
                    range === r ? 'bg-card shadow-kin text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {r} j
                </button>
              ))}
            </div>
          </>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className={cardVariants({ padding: 'sm' })}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                  <div className={cn('p-1.5 rounded-lg', kpi.bg)}>
                    <kpi.icon className={cn('w-3.5 h-3.5', kpi.color)} />
                  </div>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  <TrendBadge change={kpi.change} />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className={cardVariants({ padding: 'md' })}>
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Tasks Completed</h3>
                <span className="ml-auto text-xs text-muted-foreground">{range <= 30 ? `Last ${range} days` : 'Last 13 weeks'}</span>
              </div>
              <BarChart data={tasksByDay} />
            </motion.div>

            <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className={cardVariants({ padding: 'md' })}>
              <div className="flex items-center gap-2 mb-4">
                <Timer className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Focus Time</h3>
                <span className="ml-auto text-xs text-muted-foreground">minutes</span>
              </div>
              <BarChart data={focusByDay} color="var(--kt-sage)" suffix="m" />
            </motion.div>

            <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible" className={cardVariants({ padding: 'md' })}>
              <div className="flex items-center gap-2 mb-4">
                <Repeat2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Habits Completed{selectedHabit ? ` — ${selectedHabit.title}` : ''}
                </h3>
              </div>
              <BarChart data={habitsByDay} color="var(--kt-coral)" />
            </motion.div>

            <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible" className={cardVariants({ padding: 'md' })}>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Mood Trend</h3>
                <span className="ml-auto text-xs text-muted-foreground">Scale 1–5</span>
              </div>
              <MoodLine data={moodData} />
            </motion.div>
          </div>

          {/* Productivity heatmap — always the full fetched window, independent of the range filter */}
          <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible" className={cardVariants({ padding: 'md' })}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Productivity Heatmap{selectedHabit ? ` — ${selectedHabit.title}` : ''}
              </h3>
              <span className="ml-auto text-xs text-muted-foreground">Last 90 days</span>
            </div>
            <ActivityHeatmap
              days={allDays}
              getScore={(day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const taskCount = tasks.filter((t) => t.status === 'done' && t.completed_at?.startsWith(dateStr)).length
                const focusMins = focusSessions.filter((s) => s.created_at?.startsWith(dateStr)).reduce((a, s) => a + (s.duration_minutes ?? 0), 0)
                const habitCount = filteredHabitLogs.filter((l) => l.logged_date === dateStr).length
                return taskCount + Math.floor(focusMins / 25) + habitCount
              }}
            />
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">Less</span>
              {[0.15, 0.35, 0.55, 0.75, 1].map((o) => (
                <div key={o} className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--kt-primary)', opacity: o }} />
              ))}
              <span className="text-xs text-muted-foreground">More</span>
            </div>
          </motion.div>

          {/* Weekly & Monthly reports */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div custom={9} variants={fadeUp} initial="hidden" animate="visible" className={cardVariants({ padding: 'md' })}>
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Weekly Report</h3>
                <span className="ml-auto text-xs text-muted-foreground">vs last week</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Focus', curr: `${Math.round(thisWeek.focusMins / 60)}h`, change: pctChange(thisWeek.focusMins, lastWeek?.focusMins) },
                  { label: 'Tasks done', curr: thisWeek.tasksDone, change: pctChange(thisWeek.tasksDone, lastWeek?.tasksDone) },
                  { label: 'Habit logs', curr: thisWeek.habitCount, change: pctChange(thisWeek.habitCount, lastWeek?.habitCount) },
                  {
                    label: 'Avg mood', curr: thisWeek.avgMood !== null ? `${thisWeek.avgMood.toFixed(1)}/5` : '—',
                    change: thisWeek.avgMood !== null ? pctChange(thisWeek.avgMood, lastWeek?.avgMood) : null,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{row.curr}</span>
                      <TrendBadge change={row.change} />
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div custom={10} variants={fadeUp} initial="hidden" animate="visible" className={cardVariants({ padding: 'md' })}>
              <div className="flex items-center gap-2 mb-4">
                <CalendarRange className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Monthly Report</h3>
                <span className="ml-auto text-xs text-muted-foreground">{format(new Date(), 'MMMM')} vs {format(lastMonthRef, 'MMMM')}</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Focus', curr: `${Math.round(thisMonth.focusMins / 60)}h`, change: pctChange(thisMonth.focusMins, lastMonthMetrics?.focusMins) },
                  { label: 'Tasks done', curr: thisMonth.tasksDone, change: pctChange(thisMonth.tasksDone, lastMonthMetrics?.tasksDone) },
                  { label: 'Habit logs', curr: thisMonth.habitCount, change: pctChange(thisMonth.habitCount, lastMonthMetrics?.habitCount) },
                  {
                    label: 'Avg mood', curr: thisMonth.avgMood !== null ? `${thisMonth.avgMood.toFixed(1)}/5` : '—',
                    change: thisMonth.avgMood !== null ? pctChange(thisMonth.avgMood, lastMonthMetrics?.avgMood) : null,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{row.curr}</span>
                      <TrendBadge change={row.change} />
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {habits.length === 0 && tasks.length === 0 && focusSessions.length === 0 && habitLogs.length === 0 && journalEntries.length === 0 && (
            <div className="text-center py-16">
              <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-foreground font-medium">No data yet</p>
              <p className="text-sm text-muted-foreground mt-1">Start using Tasks, Focus, or Habits and your trends will show up here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
