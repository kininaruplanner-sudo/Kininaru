import { format } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Coach daily context — ÉTAPE 14.
 *
 * The floating coach never receives the user's raw database. It works from a
 * tiny, computed summary of the signed-in user's OWN data (RLS-enforced), so:
 * - no Groq call is needed for everyday observations (deterministic rules);
 * - nothing sensitive (passwords, tokens, other users / families) is read;
 * - the payload is tiny and cheap to build (10 indexed queries in parallel).
 */

export type CoachPage =
  | 'dashboard'
  | 'tasks'
  | 'habits'
  | 'calendar'
  | 'journal'
  | 'focus'
  | 'family'
  | 'analytics'
  | 'settings'
  | 'ai'
  | 'other'

export const COACH_PAGES: ReadonlySet<string> = new Set([
  'dashboard',
  'tasks',
  'habits',
  'calendar',
  'journal',
  'focus',
  'family',
  'analytics',
  'settings',
  'ai',
])

export function parseCoachPage(raw: unknown): CoachPage {
  return typeof raw === 'string' && COACH_PAGES.has(raw) ? (raw as CoachPage) : 'other'
}

export interface NextPriorityTask {
  id: string
  title: string
}

export interface CoachContext {
  /** Local hour (0-23) — drives morning / afternoon / evening rules. */
  hour: number
  /** Tasks with a due date today (any status). */
  tasksToday: number
  /** Tasks completed since midnight. */
  tasksCompleted: number
  /** Open tasks with a due date in the past. */
  tasksOverdue: number
  /** Open tasks flagged high/urgent (top source of "what matters now"). */
  priorityTasksRemaining: number
  /** The most urgent open priority task, if any. */
  nextPriorityTask: NextPriorityTask | null
  habitsTotal: number
  habitsDoneToday: number
  /** Events whose start falls within today (local midnight → tomorrow). */
  eventsToday: number
  focusMinutesToday: number
  /** Journal entries written in the last 7 days. */
  journalThisWeek: number
  hasFamily: boolean
}

const HIGH_PRIORITIES = ['high', 'urgent'] as const

export async function buildCoachContext(
  supabase: SupabaseClient,
  userId: string
): Promise<CoachContext> {
  const now = new Date()
  const todayKey = format(now, 'yyyy-MM-dd')
  const startOfDay = `${todayKey}T00:00:00`
  const tomorrowKey = format(new Date(now.getTime() + 86_400_000), 'yyyy-MM-dd')
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: tasksDueToday },
    { data: tasksCompletedToday },
    { data: tasksOverdue },
    { data: priorityTasks },
    { data: habits },
    { data: habitLogs },
    { data: events },
    { data: focusWeek },
    { data: journalWeek },
    { data: familyMemberships },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('due_date', todayKey)
      .limit(1),
    supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'done')
      .gte('completed_at', startOfDay)
      .limit(50),
    supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .neq('status', 'done')
      .lt('due_date', todayKey)
      .not('due_date', 'is', null)
      .limit(50),
    supabase
      .from('tasks')
      .select('id, title, due_date')
      .eq('user_id', userId)
      .in('status', ['todo', 'in_progress'])
      .in('priority', HIGH_PRIORITIES)
      .order('due_date', { ascending: true, nullsFirst: true })
      .limit(3),
    supabase.from('habits').select('id').eq('user_id', userId).limit(100),
    supabase
      .from('habit_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('logged_date', todayKey)
      .limit(100),
    supabase
      .from('events')
      .select('id')
      .eq('user_id', userId)
      .gte('start_at', startOfDay)
      .lt('start_at', `${tomorrowKey}T00:00:00`)
      .limit(50),
    supabase
      .from('focus_sessions')
      .select('duration_minutes, created_at')
      .eq('user_id', userId)
      .gte('created_at', weekAgo),
    supabase
      .from('journal_entries')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', weekAgo)
      .limit(50),
    supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', userId)
      .limit(1),
  ])

  const sessions = (focusWeek ?? []) as { duration_minutes: number; created_at: string }[]
  const focusMinutesToday = sessions
    .filter((s) => s.created_at?.startsWith(todayKey))
    .reduce((sum, s) => sum + (s.duration_minutes || 0), 0)

  const priorityList = (priorityTasks ?? []) as { id: string; title: string }[]

  return {
    hour: now.getHours(),
    tasksToday: tasksDueToday?.length ?? 0,
    tasksCompleted: tasksCompletedToday?.length ?? 0,
    tasksOverdue: tasksOverdue?.length ?? 0,
    priorityTasksRemaining: priorityList.length,
    nextPriorityTask: priorityList[0] ?? null,
    habitsTotal: habits?.length ?? 0,
    habitsDoneToday: habitLogs?.length ?? 0,
    eventsToday: events?.length ?? 0,
    focusMinutesToday,
    journalThisWeek: journalWeek?.length ?? 0,
    hasFamily: (familyMemberships?.length ?? 0) > 0,
  }
}
