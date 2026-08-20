/**
 * Kininaru Assistant — Context Builder
 *
 * Builds a compact, relevant snapshot of the user's data to inject into
 * the AI system prompt. The context is designed to help the model give
 * a single clear next-action recommendation.
 *
 * Design principles:
 * - Only include data the model actually needs
 * - Never send the entire database
 * - Prioritize actionable information
 * - Compute "next action" suggestion server-side
 */

import { format } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatMemoriesForContext } from './memory-selector'
import { buildTemporalContext, selectNextAction } from './planning'
import { retrieveRelevantMemories, formatRetrievedMemories } from './memory'
import type { Memory, MemoryQuery } from './memory'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EnrichedContext {
  /** Human-readable context text for the system prompt */
  text: string
  /** Structured data for programmatic use */
  data: ContextData
  /** Suggested next action (computed server-side) */
  nextAction: NextAction | null
}

export interface ContextData {
  tasks: {
    today: TaskInfo[]
    overdue: TaskInfo[]
    upcoming: TaskInfo[]
    doneToday: number
  }
  habits: {
    total: number
    doneToday: number
    list: HabitInfo[]
  }
  focus: {
    todayMinutes: number
    weekMinutes: number
  }
  events: {
    today: EventInfo[]
    upcoming: EventInfo[]
  }
  goals: GoalInfo[]
  journal: {
    thisWeek: number
  }
  progress: {
    tasksDone: number
    habitsDone: number
    focusMinutes: number
  }
}

export interface TaskInfo {
  id: string
  title: string
  priority: string
  due_date: string | null
  scheduled_time: string | null
  status: string
}

export interface HabitInfo {
  id: string
  title: string
  streak: number
  done_today: boolean
}

export interface EventInfo {
  id: string
  title: string
  start_at: string
  end_at: string
}

export interface GoalInfo {
  id: string
  title: string
  target_date: string | null
  tasksTotal: number
  tasksDone: number
  progress: number
}

export interface NextAction {
  title: string
  taskId: string
  reason: string
}

/* ------------------------------------------------------------------ */
/* Context Builder                                                     */
/* ------------------------------------------------------------------ */

const MAX_TASKS = 15
const MAX_HABITS = 10
const MAX_EVENTS = 5
const MAX_GOALS = 5

export async function buildEnrichedContext(
  supabase: SupabaseClient,
  userId: string,
  opts?: { includeMemory?: boolean; userMessage?: string }
): Promise<EnrichedContext> {
  const now = new Date()
  const todayKey = format(now, 'yyyy-MM-dd')
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const tomorrow = format(new Date(now.getTime() + 86_400_000), 'yyyy-MM-dd')

  // Parallel queries — minimal, indexed, scoped to this user via RLS
  const [
    { data: todayTasks },
    { data: overdueTasks },
    { data: doneTodayTasks },
    { data: habits },
    { data: habitLogs },
    { data: upcomingEvents },
    { data: todayEvents },
    { data: focusWeek },
    { data: journalWeek },
    { data: goals },
    { data: memories },
  ] = await Promise.all([
    // Tasks due today (open only)
    supabase
      .from('tasks')
      .select('id, title, priority, due_date, scheduled_time, status')
      .eq('user_id', userId)
      .eq('due_date', todayKey)
      .neq('status', 'done')
      .order('scheduled_time', { ascending: true, nullsFirst: true })
      .limit(MAX_TASKS),
    // Overdue tasks
    supabase
      .from('tasks')
      .select('id, title, priority, due_date')
      .eq('user_id', userId)
      .neq('status', 'done')
      .lt('due_date', todayKey)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
      .limit(5),
    // Tasks completed today
    supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'done')
      .gte('completed_at', `${todayKey}T00:00:00`),
    // Habits
    supabase
      .from('habits')
      .select('id, title, streak')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(MAX_HABITS),
    // Habit logs today
    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', userId)
      .eq('logged_date', todayKey),
    // Upcoming events (next 7 days)
    supabase
      .from('events')
      .select('id, title, start_at, end_at')
      .eq('user_id', userId)
      .gte('start_at', now.toISOString())
      .order('start_at', { ascending: true })
      .limit(MAX_EVENTS),
    // Today's events
    supabase
      .from('events')
      .select('id, title, start_at, end_at')
      .eq('user_id', userId)
      .gte('start_at', `${todayKey}T00:00:00`)
      .lt('start_at', `${tomorrow}T00:00:00`)
      .order('start_at', { ascending: true }),
    // Focus sessions this week
    supabase
      .from('focus_sessions')
      .select('duration_minutes, created_at')
      .eq('user_id', userId)
      .gte('created_at', weekAgo),
    // Journal entries this week
    supabase
      .from('journal_entries')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', weekAgo)
      .limit(50),
    // Active goals
    supabase
      .from('goals')
      .select('id, title, target_date')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(MAX_GOALS),
    // Memories (opt-in)
    supabase
      .from('ai_memories')
      .select('content, category')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(r => r.error ? { data: [] as never[] } : r),
  ])

  // Compute focus minutes
  const focusSessions = (focusWeek ?? []) as { duration_minutes: number; created_at: string }[]
  const focusTodayMinutes = focusSessions
    .filter(s => s.created_at?.startsWith(todayKey))
    .reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
  const focusWeekMinutes = focusSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)

  // Compute habits
  const habitList = (habits ?? []).map(h => ({
    ...h,
    done_today: (habitLogs ?? []).some(l => l.habit_id === h.id),
  }))
  const habitsDoneToday = habitList.filter(h => h.done_today).length

  // Compute goals with progress
  const goalsWithProgress = await Promise.all(
    (goals ?? []).map(async (goal) => {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('user_id', userId)
        .eq('goal_id', goal.id)

      const total = (tasks ?? []).length
      const done = (tasks ?? []).filter(t => t.status === 'done').length

      return {
        ...goal,
        tasksTotal: total,
        tasksDone: done,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
      }
    })
  )

  // Build structured data
  const contextData: ContextData = {
    tasks: {
      today: (todayTasks ?? []) as TaskInfo[],
      overdue: (overdueTasks ?? []) as TaskInfo[],
      upcoming: [],
      doneToday: (doneTodayTasks ?? []).length,
    },
    habits: {
      total: habitList.length,
      doneToday: habitsDoneToday,
      list: habitList,
    },
    focus: {
      todayMinutes: focusTodayMinutes,
      weekMinutes: focusWeekMinutes,
    },
    events: {
      today: (todayEvents ?? []) as EventInfo[],
      upcoming: (upcomingEvents ?? []) as EventInfo[],
    },
    goals: goalsWithProgress,
    journal: {
      thisWeek: (journalWeek ?? []).length,
    },
    progress: {
      tasksDone: (doneTodayTasks ?? []).length,
      habitsDone: habitsDoneToday,
      focusMinutes: focusTodayMinutes,
    },
  }

  // Build temporal context
  const temporal = buildTemporalContext({
    events: (todayEvents ?? []).map(e => ({ start_at: e.start_at, end_at: e.end_at })),
    tasksToday: (todayTasks ?? []).length,
    tasksOverdue: (overdueTasks ?? []).length,
    habitsTotal: habitList.length,
    habitsDone: habitsDoneToday,
    focusTodayMinutes,
    urgentTasks: (todayTasks ?? []).filter(t => t.priority === 'urgent' || t.priority === 'high').length,
  })

  // Compute next action suggestion using the planning engine
  const nextActionResult = selectNextAction(contextData, temporal, goalsWithProgress)
  const nextAction = nextActionResult ? {
    title: nextActionResult.candidate.title,
    taskId: nextActionResult.candidate.id,
    reason: nextActionResult.explanation,
  } : null

  // Build context text for the system prompt
  const allMemories = opts?.includeMemory !== false ? (memories ?? []) as { content: string; category: string }[] : []
  const text = buildContextText(contextData, allMemories, opts?.userMessage)

  return { text, data: contextData, nextAction }
}

/* ------------------------------------------------------------------ */
/* Next Action Computation                                             */
/* ------------------------------------------------------------------ */

function _computeNextAction(data: ContextData, now: Date): NextAction | null {
  const hour = now.getHours()

  // 1. Overdue tasks — highest priority
  if (data.tasks.overdue.length > 0) {
    const task = data.tasks.overdue[0]
    return {
      title: task.title,
      taskId: task.id,
      reason: `En retard depuis le ${task.due_date}`,
    }
  }

  // 2. High/urgent priority tasks due today
  const urgentToday = data.tasks.today.filter(
    t => t.priority === 'urgent' || t.priority === 'high'
  )
  if (urgentToday.length > 0) {
    const task = urgentToday[0]
    return {
      title: task.title,
      taskId: task.id,
      reason: task.scheduled_time
        ? `Planifié à ${task.scheduled_time}`
        : 'Priorité haute ou urgente',
    }
  }

  // 3. Any task due today with a scheduled time that's approaching
  const scheduledTasks = data.tasks.today
    .filter(t => t.scheduled_time)
    .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))

  if (scheduledTasks.length > 0) {
    const next = scheduledTasks.find(t => {
      if (!t.scheduled_time) return false
      const [h, m] = t.scheduled_time.split(':').map(Number)
      return h >= hour || (h === hour - 1 && m > 0)
    })
    if (next) {
      return {
        title: next.title,
        taskId: next.id,
        reason: `Planifié à ${next.scheduled_time}`,
      }
    }
  }

  // 4. Unfinished habits
  const unfinishedHabits = data.habits.list.filter(h => !h.done_today)
  if (unfinishedHabits.length > 0 && hour >= 7 && hour <= 21) {
    return {
      title: unfinishedHabits[0].title,
      taskId: unfinishedHabits[0].id,
      reason: 'Habitude du jour non cochée',
    }
  }

  // 5. Remaining tasks for today
  if (data.tasks.today.length > 0) {
    const task = data.tasks.today[0]
    return {
      title: task.title,
      taskId: task.id,
      reason: 'Tâche prévue pour aujourd\'hui',
    }
  }

  // 6. Focus session suggestion (if no focus today and time allows)
  if (data.focus.todayMinutes === 0 && hour >= 9 && hour <= 17) {
    return {
      title: 'Démarrer une session de focus',
      taskId: '',
      reason: 'Aucun focus aujourd\'hui — un moment de concentration peut aider',
    }
  }

  return null
}

/* ------------------------------------------------------------------ */
/* Context Text Builder                                               */
/* ------------------------------------------------------------------ */

function buildContextText(data: ContextData, allMemories: { content: string; category: string }[], userMessage?: string): string {
  const lines: string[] = [
    'CONTEXTE DE L\'UTILISATEUR (extrait minimal — utilise-le pour personnaliser tes réponses) :',
    '',
    'PRINCIPE CLÉ : Ta prochaine recommandation doit être UNE SEULE action claire et prioritaire, pas une liste.',
  ]

  // Time context
  const now = new Date()
  const hour = now.getHours()
  const period = hour < 12 ? 'matin' : hour < 18 ? 'après-midi' : 'soir'
  lines.push(`Moment de la journée : ${period} (${hour}h)`)
  lines.push('')

  // Tasks
  if (data.tasks.today.length > 0) {
    lines.push(`TÂCHES DU JOUR (${data.tasks.today.length}) :`)
    data.tasks.today.forEach(t => {
      const scheduled = t.scheduled_time ? ` à ${t.scheduled_time}` : ''
      const priority = t.priority !== 'medium' ? ` [${t.priority}]` : ''
      lines.push(`  • ${t.title}${priority}${scheduled}`)
    })
  } else {
    lines.push('TÂCHES DU JOUR : aucune')
  }

  if (data.tasks.overdue.length > 0) {
    lines.push(`⚠️ EN RETARD (${data.tasks.overdue.length}) :`)
    data.tasks.overdue.forEach(t => {
      lines.push(`  • ${t.title} (échéance ${t.due_date})`)
    })
  }

  lines.push(`Terminées aujourd'hui : ${data.tasks.doneToday}`)

  // Habits
  lines.push('')
  if (data.habits.total > 0) {
    lines.push(`HABITUDES : ${data.habits.doneToday}/${data.habits.total} cochées`)
    data.habits.list.forEach(h => {
      const status = h.done_today ? '✓' : '○'
      const streak = h.streak > 0 ? ` (série ${h.streak}j)` : ''
      lines.push(`  ${status} ${h.title}${streak}`)
    })
  } else {
    lines.push('HABITUDES : aucune définie')
  }

  // Focus
  lines.push('')
  lines.push(`FOCUS : ${data.focus.todayMinutes} min aujourd'hui, ${Math.round(data.focus.weekMinutes / 60)}h cette semaine`)

  // Events
  if (data.events.today.length > 0) {
    lines.push('')
    lines.push(`ÉVÉNEMENTS AUJOURD'HUI (${data.events.today.length}) :`)
    data.events.today.forEach(e => {
      const start = format(new Date(e.start_at), 'HH:mm')
      lines.push(`  • ${e.title} (${start})`)
    })
  }

  if (data.events.upcoming.length > 0) {
    lines.push('')
    lines.push(`PROCHAINS ÉVÉNEMENTS (${data.events.upcoming.length}) :`)
    data.events.upcoming.forEach(e => {
      const start = format(new Date(e.start_at), 'd MMM HH:mm')
      lines.push(`  • ${e.title} (${start})`)
    })
  }

  // Goals
  if (data.goals.length > 0) {
    lines.push('')
    lines.push(`OBJECTIFS ACTIFS (${data.goals.length}) :`)
    data.goals.forEach(g => {
      const target = g.target_date ? ` (échéance ${g.target_date})` : ''
      const progress = g.tasksTotal > 0 ? ` — ${g.tasksDone}/${g.tasksTotal} étapes` : ''
      lines.push(`  • ${g.title}${target}${progress}`)
    })
  }

  // Journal
  if (data.journal.thisWeek > 0) {
    lines.push('')
    lines.push(`JOURNAL : ${data.journal.thisWeek} entrée${data.journal.thisWeek > 1 ? 's' : ''} cette semaine`)
  }

  // Memories — select only relevant ones based on the user message
  // Phase 10: Use the new memory retrieval system with relevance scoring
  if (allMemories.length > 0) {
    // Convert to Memory type for the new retrieval system
    const typedMemories: Memory[] = allMemories.map((m, idx) => ({
      id: `ctx-${idx}`,
      content: m.content,
      category: (m.category as Memory['category']) ?? 'fact',
      importance: 'medium' as Memory['importance'],
      source: 'conversation' as Memory['source'],
      confidence: 0.7,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      keywords: [],
    }))

    if (userMessage) {
      // Use Phase 10 relevance-based retrieval
      const query: MemoryQuery = {
        userMessage,
        limit: 5,
        respectExpiration: true,
        excludeSuperseded: true,
      }

      const scored = retrieveRelevantMemories(typedMemories, query)
      if (scored.length > 0) {
        lines.push('')
        lines.push(formatRetrievedMemories(scored, false))
      }
    } else {
      // Fallback: use existing selection without a query
      const relevantMemories = allMemories.slice(0, 5)
      if (relevantMemories.length > 0) {
        lines.push('')
        lines.push(formatMemoriesForContext(relevantMemories))
      }
    }
  }

  return lines.join('\n')
}
