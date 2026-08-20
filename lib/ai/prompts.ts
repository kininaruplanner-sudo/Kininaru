import { format } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PERSONALITY, ACTION_PROTOCOL, INSIGHT_MODE } from '@/lib/assistant/personality'

/**
 * AI 2.0 — prompt engineering + user context.
 *
 * Design rules:
 * - Groq stays the only provider; the key never leaves the server.
 * - The model receives ONLY a compact, relevant excerpt of the signed-in
 *   user's own data — never passwords, tokens, other users' or other
 *   families' data.
 * - Actions are proposed as a single fenced JSON block at the end of the
 *   message; the client renders a confirmation card and the server
 *   re-validates every action before executing it.
 * - The model is told to refuse harmful requests and never reveal the
 *   system prompt, keys or internal architecture.
 */

/* ------------------------------------------------------------------ */
/* User context                                                        */
/* ------------------------------------------------------------------ */

const MAX_OPEN_TASKS = 15
const MAX_HABITS = 10
const MAX_EVENTS = 5
const MAX_MEMORIES = 20

export interface AiContext {
  text: string
  counts: {
    openTasks: number
    doneToday: number
    habits: number
    habitsDoneToday: number
    focusTodayMinutes: number
    focusWeekMinutes: number
    eventsUpcoming: number
    families: number
    memories: number
  }
}

/** Gathers a minimal, useful snapshot of the user's own data. */
export async function buildUserContext(
  supabase: SupabaseClient,
  userId: string,
  opts?: { includeMemory?: boolean }
): Promise<AiContext> {
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: openTasks },
    { data: doneTodayTasks },
    { data: habits },
    { data: logsToday },
    { data: events },
    { data: focusWeek },
    { data: families },
    { data: memories },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('title, priority, due_date, status')
      .eq('user_id', userId)
      .in('status', ['todo', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(MAX_OPEN_TASKS),
    supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'done')
      .gte('completed_at', `${todayKey}T00:00:00`),
    supabase
      .from('habits')
      .select('title, streak')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(MAX_HABITS),
    supabase
      .from('habit_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('logged_date', todayKey),
    supabase
      .from('events')
      .select('title, start_at, end_at')
      .eq('user_id', userId)
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(MAX_EVENTS),
    supabase
      .from('focus_sessions')
      .select('duration_minutes, created_at')
      .eq('user_id', userId)
      .gte('created_at', weekAgo),
    supabase
      .from('family_members')
      .select('family_id, role, families(name)')
      .eq('user_id', userId),
    // Memory is opt-in and strictly private. The query is guarded: if the
    // table is missing (schema not re-run yet), the chat must keep working
    // instead of failing on an unrelated error.
    supabase
      .from('ai_memories')
      .select('content, category')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_MEMORIES)
      .then((r) =>
        r.error ? { data: [] as never[] } : r
      ),
  ])

  const doneToday = doneTodayTasks?.length ?? 0
  const habitsDoneToday = logsToday?.length ?? 0

  // Memory master switch: when the user turns it OFF, memories
  // are never injected — they stay stored but unused until re-enabled.
  const includeMemory = opts?.includeMemory !== false
  const memoryList = includeMemory
    ? ((memories ?? []) as { content: string; category: string }[])
    : []

  const focusWeekMinutes = (focusWeek ?? []).reduce(
    (sum, s) => sum + (s.duration_minutes || 0),
    0
  )
  const focusTodayMinutes = (focusWeek ?? [])
    .filter((s) => s.created_at?.startsWith(todayKey))
    .reduce((sum, s) => sum + (s.duration_minutes || 0), 0)

  const normalizedFamilies = (families ?? []).map(
    (m: {
      family_id: string
      role: string
      families: { name: string } | { name: string }[] | null
    }) => ({
      family_id: m.family_id,
      role: m.role,
      name: Array.isArray(m.families) ? m.families[0]?.name ?? null : m.families?.name ?? null,
    })
  )

  const lines: string[] = ['APERÇU DE VOS DONNÉES (extrait minimal — utilisez-le pour personnaliser) :']

  const openList = (openTasks ?? []) as { title: string; priority: string; due_date: string | null }[]
  if (openList.length > 0) {
    lines.push(
      `Tâches ouvertes (${openList.length}) :` +
        openList
          .map((t) => {
            const due = t.due_date ? ` (échéance ${t.due_date})` : ''
            return `\n- [${t.priority}] ${t.title}${due}`
          })
          .join('')
    )
  } else {
    lines.push('Tâches ouvertes : aucune')
  }
  lines.push(`Tâches terminées aujourd'hui : ${doneToday}`)

  const habitList = (habits ?? []) as { title: string; streak: number }[]
  if (habitList.length > 0) {
    lines.push(
      `Habitudes : ` +
        habitList.map((h) => `${h.title}${h.streak > 0 ? ` (série ${h.streak} j)` : ''}`).join(', ')
    )
  } else {
    lines.push('Habitudes : aucune')
  }
  lines.push(`Habitudes cochées aujourd'hui : ${habitsDoneToday}/${habits?.length ?? 0}`)

  const eventList = (events ?? []) as { title: string; start_at: string }[]
  if (eventList.length > 0) {
    lines.push(
      `Événements à venir : ` +
        eventList.map((e) => `${e.title} (${format(new Date(e.start_at), 'd MMM HH:mm')})`).join(', ')
    )
  } else {
    lines.push('Événements à venir : aucun')
  }

  lines.push(
    `Focus : ${focusTodayMinutes} min aujourd'hui, ${Math.round(focusWeekMinutes / 60)} h cette semaine`
  )

  if (normalizedFamilies.length > 0) {
    lines.push(
      `Familles : ` +
        normalizedFamilies
          .map((f) => `${f.name ?? 'Famille'} (id: ${f.family_id}, rôle: ${f.role})`)
          .join(' | ')
    )
  }

  if (includeMemory && memoryList.length > 0) {
    lines.push(
      `Faits mémorisés (respectez-les — l'utilisateur les a enregistrés consciemment) : ` +
        memoryList.map((m) => `${m.content} (${m.category})`).join(' | ')
    )
  } else {
    lines.push('Faits mémorisés : aucun')
  }

  return {
    text: lines.join('\n'),
    counts: {
      openTasks: openList.length,
      doneToday,
      habits: habits?.length ?? 0,
      habitsDoneToday,
      focusTodayMinutes,
      focusWeekMinutes,
      eventsUpcoming: eventList.length,
      families: normalizedFamilies.length,
      memories: memoryList.length,
    },
  }
}

/* ------------------------------------------------------------------ */
/* System prompt                                                       */
/* ------------------------------------------------------------------ */

/**
 * Builds the system prompt for a chat request.
 * Uses the Kininaru personality from lib/assistant/personality.ts.
 *
 * @param actionsEnabled false = advice-only mode (e.g. dashboard insight),
 *        which drops the action protocol entirely.
 */
export function buildSystemPrompt({
  context,
  actionsEnabled = true,
  mode = 'chat',
}: {
  context?: string
  actionsEnabled?: boolean
  mode?: 'chat' | 'insight'
}): string {
  const parts: string[] = [PERSONALITY]

  if (mode === 'insight') {
    parts.push(INSIGHT_MODE)
  }

  if (context && context.trim()) {
    parts.push(context)
  }

  if (actionsEnabled && mode !== 'insight') {
    parts.push(ACTION_PROTOCOL)
  }

  return parts.join('\n\n')
}
