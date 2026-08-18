/**
 * Kininaru Assistant — Read Tools
 *
 * Safe, read-only queries. These tools execute directly without confirmation
 * because they never modify data.
 */

import { format } from 'date-fns'
import { registerTool, type ToolContext, type ToolResult } from './tools'

/* ------------------------------------------------------------------ */
/* get_today_tasks                                                    */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'get_today_tasks',
    description: 'Récupère les tâches de l\'utilisateur pour aujourd\'hui et les tâches ouvertes avec échéance proche. Retourne les tâches avec leur priorité, statut et date d\'échéance.',
    category: 'read',
    requiresConfirmation: false,
    params: [
      { name: 'include_done', type: 'boolean', required: false, description: 'Inclure les tâches terminées aujourd\'hui (défaut: false)' },
    ],
  },
  async (ctx: ToolContext, params: Record<string, unknown>): Promise<ToolResult> => {
    const includeDone = params.include_done === true
    const todayKey = format(new Date(), 'yyyy-MM-dd')

    const [todayRes, overdueRes, upcomingRes] = await Promise.all([
      ctx.supabase
        .from('tasks')
        .select('id, title, priority, status, due_date, scheduled_time, tags')
        .eq('user_id', ctx.userId)
        .eq('due_date', todayKey)
        .order('scheduled_time', { ascending: true, nullsFirst: true }),
      ctx.supabase
        .from('tasks')
        .select('id, title, priority, due_date')
        .eq('user_id', ctx.userId)
        .neq('status', 'done')
        .lt('due_date', todayKey)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .limit(5),
      ctx.supabase
        .from('tasks')
        .select('id, title, priority, due_date')
        .eq('user_id', ctx.userId)
        .in('status', ['todo', 'in_progress'])
        .gte('due_date', todayKey)
        .order('due_date', { ascending: true })
        .limit(10),
    ])

    let doneToday: { id: string; title: string }[] = []
    if (includeDone) {
      const { data } = await ctx.supabase
        .from('tasks')
        .select('id, title')
        .eq('user_id', ctx.userId)
        .eq('status', 'done')
        .gte('completed_at', `${todayKey}T00:00:00`)
        .limit(20)
      doneToday = data ?? []
    }

    const todayTasks = (todayRes.data ?? []).filter(t => t.status !== 'done')
    const overdueTasks = overdueRes.data ?? []
    const upcomingTasks = (upcomingRes.data ?? []).filter(
      t => !todayTasks.some(tt => tt.id === t.id) && !overdueTasks.some(ot => ot.id === t.id)
    )

    return {
      ok: true,
      data: {
        today: todayTasks,
        overdue: overdueTasks,
        upcoming: upcomingTasks,
        doneToday: doneToday.length,
      },
      summary: todayTasks.length > 0
        ? `${todayTasks.length} tâche${todayTasks.length > 1 ? 's' : ''} prévue${todayTasks.length > 1 ? 's' : ''} aujourd'hui` +
          (overdueTasks.length > 0 ? `, ${overdueTasks.length} en retard` : '') +
          (includeDone ? `, ${doneToday.length} terminée${doneToday.length > 1 ? 's' : ''}` : '')
        : 'Aucune tâche prévue aujourd\'hui',
    }
  }
)

/* ------------------------------------------------------------------ */
/* get_upcoming_events                                                */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'get_upcoming_events',
    description: 'Récupère les événements à venir de l\'utilisateur (aujourd\'hui et les prochains jours). Utile pour comprendre le planning.',
    category: 'read',
    requiresConfirmation: false,
    params: [
      { name: 'days', type: 'number', required: false, description: 'Nombre de jours à prospecter (défaut: 7)' },
    ],
  },
  async (ctx: ToolContext, params: Record<string, unknown>): Promise<ToolResult> => {
    const days = typeof params.days === 'number' ? Math.min(params.days, 30) : 7
    const now = new Date()
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const { data: events } = await ctx.supabase
      .from('events')
      .select('id, title, start_at, end_at, category')
      .eq('user_id', ctx.userId)
      .gte('start_at', now.toISOString())
      .lte('start_at', end.toISOString())
      .order('start_at', { ascending: true })
      .limit(20)

    const eventList = events ?? []

    return {
      ok: true,
      data: { events: eventList, days },
      summary: eventList.length > 0
        ? `${eventList.length} événement${eventList.length > 1 ? 's' : ''} dans les ${days} prochains jours`
        : `Aucun événement prévu dans les ${days} prochains jours`,
    }
  }
)

/* ------------------------------------------------------------------ */
/* get_habits                                                         */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'get_habits',
    description: 'Récupère les habitudes de l\'utilisateur avec leur série actuelle et le statut du jour (cochée ou non). Utile pour connaître les routines.',
    category: 'read',
    requiresConfirmation: false,
    params: [],
  },
  async (ctx: ToolContext): Promise<ToolResult> => {
    const todayKey = format(new Date(), 'yyyy-MM-dd')

    const [habitsRes, logsRes] = await Promise.all([
      ctx.supabase
        .from('habits')
        .select('id, title, streak, best_streak')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: true }),
      ctx.supabase
        .from('habit_logs')
        .select('habit_id')
        .eq('user_id', ctx.userId)
        .eq('logged_date', todayKey),
    ])

    const habits = (habitsRes.data ?? []).map(h => ({
      ...h,
      done_today: (logsRes.data ?? []).some(l => l.habit_id === h.id),
    }))

    const doneCount = habits.filter(h => h.done_today).length

    return {
      ok: true,
      data: { habits, doneToday: doneCount, total: habits.length },
      summary: habits.length > 0
        ? `${doneCount}/${habits.length} habitude${habits.length > 1 ? 's' : ''} cochée${habits.length > 1 ? 's' : ''} aujourd'hui`
        : 'Aucune habitude définie',
    }
  }
)

/* ------------------------------------------------------------------ */
/* get_focus_sessions                                                 */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'get_focus_sessions',
    description: 'Récupère les sessions de focus de l\'utilisateur (aujourd\'hui et cette semaine). Utile pour mesurer la concentration.',
    category: 'read',
    requiresConfirmation: false,
    params: [],
  },
  async (ctx: ToolContext): Promise<ToolResult> => {
    const todayKeyUtc = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: sessions } = await ctx.supabase
      .from('focus_sessions')
      .select('id, duration_minutes, created_at')
      .eq('user_id', ctx.userId)
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(50)

    const allSessions = sessions ?? []
    const todaySessions = allSessions.filter(s => s.created_at?.startsWith(todayKeyUtc))
    const todayMinutes = todaySessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
    const weekMinutes = allSessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)

    return {
      ok: true,
      data: {
        todayMinutes,
        weekMinutes,
        todaySessions: todaySessions.length,
        weekSessions: allSessions.length,
      },
      summary: todayMinutes > 0
        ? `${todayMinutes} minutes de focus aujourd'hui, ${Math.round(weekMinutes / 60)}h cette semaine`
        : weekMinutes > 0
        ? `Pas de focus aujourd'hui, ${Math.round(weekMinutes / 60)}h cette semaine`
        : 'Aucune session de focus enregistrée',
    }
  }
)

/* ------------------------------------------------------------------ */
/* get_goals                                                          */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'get_goals',
    description: 'Récupère les objectifs actifs de l\'utilisateur avec leur progression. Utile pour comprendre les grandes directions.',
    category: 'read',
    requiresConfirmation: false,
    params: [],
  },
  async (ctx: ToolContext): Promise<ToolResult> => {
    const { data: goals } = await ctx.supabase
      .from('goals')
      .select('id, title, target_date, status')
      .eq('user_id', ctx.userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10)

    const goalList = goals ?? []

    // Fetch task counts for each goal to calculate progression
    const goalsWithProgress = await Promise.all(
      goalList.map(async (goal) => {
        const { data: tasks } = await ctx.supabase
          .from('tasks')
          .select('id, status')
          .eq('user_id', ctx.userId)
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

    return {
      ok: true,
      data: { goals: goalsWithProgress },
      summary: goalList.length > 0
        ? `${goalList.length} objectif${goalList.length > 1 ? 's' : ''} actif${goalList.length > 1 ? 's' : ''}`
        : 'Aucun objectif actif',
    }
  }
)

/* ------------------------------------------------------------------ */
/* get_daily_progress                                                 */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'get_daily_progress',
    description: 'Calcule la progression globale de la journée : tâches terminées, habitudes cochées, minutes de focus, événements passés. Utile pour un résumé de fin de journée.',
    category: 'read',
    requiresConfirmation: false,
    params: [],
  },
  async (ctx: ToolContext): Promise<ToolResult> => {
    const todayKey = format(new Date(), 'yyyy-MM-dd')
    const startOfDay = `${todayKey}T00:00:00`
    const now = new Date().toISOString()
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [
      { data: tasksDone },
      { data: tasksRemaining },
      { data: habits },
      { data: habitLogs },
      { data: focusToday },
      { data: eventsToday },
    ] = await Promise.all([
      ctx.supabase
        .from('tasks')
        .select('id')
        .eq('user_id', ctx.userId)
        .eq('status', 'done')
        .gte('completed_at', startOfDay),
      ctx.supabase
        .from('tasks')
        .select('id')
        .eq('user_id', ctx.userId)
        .in('status', ['todo', 'in_progress']),
      ctx.supabase
        .from('habits')
        .select('id')
        .eq('user_id', ctx.userId),
      ctx.supabase
        .from('habit_logs')
        .select('id')
        .eq('user_id', ctx.userId)
        .eq('logged_date', todayKey),
      ctx.supabase
        .from('focus_sessions')
        .select('duration_minutes')
        .eq('user_id', ctx.userId)
        .gte('created_at', `${todayKey}T00:00:00`),
      ctx.supabase
        .from('events')
        .select('id')
        .eq('user_id', ctx.userId)
        .lte('end_at', now)
        .gte('start_at', startOfDay),
    ])

    const tasksDoneCount = tasksDone?.length ?? 0
    const tasksRemainingCount = tasksRemaining?.length ?? 0
    const habitsTotal = habits?.length ?? 0
    const habitsDone = habitLogs?.length ?? 0
    const focusMinutes = (focusToday ?? []).reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
    const eventsPast = eventsToday?.length ?? 0

    return {
      ok: true,
      data: {
        tasksDone: tasksDoneCount,
        tasksRemaining: tasksRemainingCount,
        habitsDone,
        habitsTotal,
        focusMinutes,
        eventsPast,
      },
      summary: [
        `${tasksDoneCount} tâche${tasksDoneCount > 1 ? 's' : ''} terminée${tasksDoneCount > 1 ? 's' : ''}`,
        `${habitsDone}/${habitsTotal} habitude${habitsTotal > 1 ? 's' : ''}`,
        `${focusMinutes} min de focus`,
        `${eventsPast} événement${eventsPast > 1 ? 's' : ''} passé${eventsPast > 1 ? 's' : ''}`,
      ].join(', '),
    }
  }
)
