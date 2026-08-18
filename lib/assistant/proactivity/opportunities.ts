/**
 * Kininaru Assistant — Opportunity Detector
 *
 * Detects situations that merit a proactive intervention.
 * Each opportunity has a type, priority score, and suggested message.
 *
 * Design principles:
 * - Deterministic: no AI calls for detection
 * - Data-driven: based on real user data from Supabase
 * - Bounded: max N opportunities per check
 * - Failure-tolerant: if data is missing, skip silently
 */

import { format } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type OpportunityType =
  | 'task_urgent'           // High-priority task approaching deadline
  | 'task_overdue'          // Task past its due date
  | 'empty_day'             // Little planned for today
  | 'missed_focus'          // Focus session planned but not started
  | 'habit_pending'         // Habit not done yet today
  | 'evening_review'        // End of day, time for a brief
  | 'goal_progress'         // Goal with progress to celebrate
  | 'morning_brief'         // Start of day, summarize what's ahead

export interface Opportunity {
  type: OpportunityType
  priority: number          // 0-100, higher = more important
  title: string             // Short title for the suggestion
  message: string           // Full message to display
  actionLabel?: string      // Button label (e.g. "Commencer")
  actionHref?: string       // Link target (e.g. "/focus?taskId=...")
  metadata?: Record<string, string>  // Extra data for the handler
}

/* ------------------------------------------------------------------ */
/* Detection Functions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Detects all opportunities from the user's current context.
 * Returns opportunities sorted by priority (highest first).
 */
export async function detectOpportunities(
  supabase: SupabaseClient,
  userId: string
): Promise<Opportunity[]> {
  const now = new Date()
  const todayKey = format(now, 'yyyy-MM-dd')
  const tomorrowKey = format(new Date(now.getTime() + 86_400_000), 'yyyy-MM-dd')
  const hour = now.getHours()

  // Fetch all needed data in parallel
  const [
    { data: todayTasks },
    { data: overdueTasks },
    { data: habits },
    { data: habitLogs },
    { data: focusToday },
    { data: eventsToday },
    { data: goals },
    { data: doneToday },
  ] = await Promise.all([
    // Tasks due today (open)
    supabase
      .from('tasks')
      .select('id, title, priority, due_date, scheduled_time')
      .eq('user_id', userId)
      .eq('due_date', todayKey)
      .neq('status', 'done')
      .order('scheduled_time', { ascending: true, nullsFirst: true })
      .limit(10),
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
    // Habits
    supabase
      .from('habits')
      .select('id, title')
      .eq('user_id', userId)
      .limit(10),
    // Habit logs today
    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', userId)
      .eq('logged_date', todayKey),
    // Focus today
    supabase
      .from('focus_sessions')
      .select('id, duration_minutes')
      .eq('user_id', userId)
      .gte('created_at', `${todayKey}T00:00:00`),
    // Events today
    supabase
      .from('events')
      .select('id, title, start_at')
      .eq('user_id', userId)
      .gte('start_at', `${todayKey}T00:00:00`)
      .lt('start_at', `${tomorrowKey}T00:00:00`)
      .order('start_at', { ascending: true }),
    // Active goals
    supabase
      .from('goals')
      .select('id, title')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(5),
    // Done today count
    supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'done')
      .gte('completed_at', `${todayKey}T00:00:00`),
  ])

  const opportunities: Opportunity[] = []

  // A. Urgent task approaching
  const urgentTasks = (todayTasks ?? []).filter(
    t => t.priority === 'urgent' || t.priority === 'high'
  )
  if (urgentTasks.length > 0) {
    const task = urgentTasks[0]
    opportunities.push({
      type: 'task_urgent',
      priority: 90,
      title: task.title,
      message: `Ta tâche prioritaire « ${task.title} » est prévue aujourd'hui. Commence maintenant pour avancer sereinement.`,
      actionLabel: 'Commencer',
      actionHref: `/focus?taskId=${task.id}&task=${encodeURIComponent(task.title)}`,
    })
  }

  // B. Overdue task
  if ((overdueTasks ?? []).length > 0) {
    const task = overdueTasks![0]
    const daysOverdue = Math.floor(
      (now.getTime() - new Date(task.due_date!).getTime()) / 86_400_000
    )
    opportunities.push({
      type: 'task_overdue',
      priority: 85,
      title: task.title,
      message: `« ${task.title} » est en retard${daysOverdue > 1 ? ` de ${daysOverdue} jours` : ''}. On la re-planifie ?`,
      actionLabel: 'Voir la tâche',
      actionHref: '/tasks',
    })
  }

  // C. Empty day
  const tasksToday = (todayTasks ?? []).length
  const eventsTodayCount = (eventsToday ?? []).length
  if (tasksToday === 0 && eventsTodayCount === 0 && hour >= 8 && hour <= 17) {
    // Check if there are any goals to work on
    const goalList = goals ?? []
    if (goalList.length > 0) {
      opportunities.push({
        type: 'empty_day',
        priority: 40,
        title: goalList[0].title,
        message: `Ta journée est libre. Tu pourrais avancer sur « ${goalList[0].title} » — une session de 25 minutes serait un bon début.`,
        actionLabel: 'Commencer 25 min',
        actionHref: '/focus',
      })
    } else {
      opportunities.push({
        type: 'empty_day',
        priority: 30,
        title: 'Page blanche',
        message: 'Ta journée est assez libre. C\'est le moment idéal pour créer une tâche ou planifier quelque chose.',
        actionLabel: 'Créer une tâche',
        actionHref: '/tasks',
      })
    }
  }

  // D. Missed focus session
  const focusMinutes = (focusToday ?? []).reduce(
    (sum, s) => sum + (s.duration_minutes ?? 0), 0
  )
  if (focusMinutes === 0 && hour >= 10 && hour <= 18 && tasksToday > 0) {
    opportunities.push({
      type: 'missed_focus',
      priority: 50,
      title: 'Session de focus',
      message: 'Tu n\'as pas encore fait de session aujourd\'hui. 25 minutes de concentration pourraient faire la différence.',
      actionLabel: 'Commencer 25 min',
      actionHref: '/focus',
    })
  }

  // E. Habits pending
  const habitsList = habits ?? []
  const logsToday = habitLogs ?? []
  const pendingHabits = habitsList.filter(
    h => !logsToday.some(l => l.habit_id === h.id)
  )
  if (pendingHabits.length > 0 && pendingHabits.length <= 3 && hour >= 8 && hour <= 20) {
    const habit = pendingHabits[0]
    opportunities.push({
      type: 'habit_pending',
      priority: 45,
      title: habit.title,
      message: `Tu n'as pas encore fait « ${habit.title} » aujourd'hui. Un petit moment suffit.`,
      actionLabel: 'Cocher',
      actionHref: '/habits',
    })
  }

  // F. Evening review (after 19h, if there was activity today)
  if (hour >= 19 && hour <= 23) {
    const doneCount = (doneToday ?? []).length
    if (doneCount > 0 || focusMinutes > 0) {
      opportunities.push({
        type: 'evening_review',
        priority: 35,
        title: 'Bilan de la journée',
        message: `${doneCount} tâche${doneCount > 1 ? 's' : ''} terminée${doneCount > 1 ? 's' : ''}${focusMinutes > 0 ? `, ${focusMinutes} min de focus` : ''}. Un petit bilan ?`,
        actionLabel: 'Voir l\'analyse',
        actionHref: '/analytics',
      })
    }
  }

  // G. Goal with progress to celebrate
  const goalsList = goals ?? []
  for (const goal of goalsList.slice(0, 2)) {
    const { data: goalTasks } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('user_id', userId)
      .eq('goal_id', goal.id)

    const total = (goalTasks ?? []).length
    const done = (goalTasks ?? []).filter(t => t.status === 'done').length
    if (total > 0 && done === total && done > 0) {
      opportunities.push({
        type: 'goal_progress',
        priority: 70,
        title: goal.title,
        message: `Objectif « ${goal.title} » atteint ! Toutes les étapes sont terminées. Bravo.`,
        actionLabel: 'Voir les objectifs',
        actionHref: '/tasks',
      })
    }
  }

  // Sort by priority (highest first)
  opportunities.sort((a, b) => b.priority - a.priority)

  return opportunities
}
