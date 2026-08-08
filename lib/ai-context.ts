type SupabaseLike = {
  from: (table: string) => any
}

export interface ProductivityContext {
  tasks: Array<{
    id: string
    title: string
    description?: string | null
    priority: string
    status: string
    due_date?: string | null
    tags?: string[] | null
    created_at?: string | null
  }>
  habits: Array<{
    id: string
    title: string
    streak: number
    best_streak: number
  }>
  events: Array<{
    id: string
    title: string
    start_at: string
    end_at: string
    category?: string | null
  }> 
  focusSummary: {
    totalMinutes: number
    recentSessions: Array<{ duration_minutes: number; created_at: string }>
  }
  journal: Array<{
    entry_date: string
    content?: string | null
    mood?: number | null
    gratitude?: string | null
  }>
}

export async function getUserProductivityContext(supabase: SupabaseLike, userId: string): Promise<ProductivityContext> {
  const now = new Date().toISOString()

  const [{ data: tasksData }, { data: habitsData }, { data: eventsData }, { data: focusData }, { data: journalData }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id,title,description,priority,status,due_date,tags,created_at,completed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('habits')
      .select('id,title,streak,best_streak')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12),

    supabase
      .from('events')
      .select('id,title,start_at,end_at,category')
      .eq('user_id', userId)
      .gte('start_at', now)
      .order('start_at', { ascending: true })
      .limit(8),

    supabase
      .from('focus_sessions')
      .select('duration_minutes,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),

    supabase
      .from('journal_entries')
      .select('entry_date,content,mood,gratitude')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .limit(3),
  ])

  const tasks = (tasksData ?? []).map((task: any) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    due_date: task.due_date,
    tags: task.tags ?? [],
    created_at: task.created_at,
  }))

  const habits = (habitsData ?? []).map((habit: any) => ({
    id: habit.id,
    title: habit.title,
    streak: habit.streak ?? 0,
    best_streak: habit.best_streak ?? 0,
  }))

  const events = (eventsData ?? []).map((event: any) => ({
    id: event.id,
    title: event.title,
    start_at: event.start_at,
    end_at: event.end_at,
    category: event.category,
  }))

  const focusSessions = (focusData ?? []).map((session: any) => ({
    duration_minutes: session.duration_minutes,
    created_at: session.created_at,
  }))

  const totalMinutes = focusSessions.reduce((sum: number, session: { duration_minutes: number; created_at: string }) => sum + Number(session.duration_minutes ?? 0), 0)

  return {
    tasks,
    habits,
    events,
    focusSummary: {
      totalMinutes,
      recentSessions: focusSessions,
    },
    journal: (journalData ?? []).map((entry: any) => ({
      entry_date: entry.entry_date,
      content: entry.content,
      mood: entry.mood,
      gratitude: entry.gratitude,
    })),
  }
}

export function buildProductivityContextPrompt(context: ProductivityContext): string {
  const openTasks = context.tasks.filter((task) => task.status !== 'done').slice(0, 8)
  const overdueOrDueSoon = openTasks
    .filter((task) => task.due_date)
    .slice(0, 6)

  const taskLines = openTasks.length
    ? openTasks.map((task) => `- [${task.priority}] ${task.title}${task.due_date ? ` — échéance ${task.due_date}` : ''}${task.status ? ` — ${task.status}` : ''}`).join('\n')
    : '- Aucune tâche ouverte en cours.'

  const habitLines = context.habits.length
    ? context.habits.slice(0, 6).map((habit) => `- ${habit.title} (streak ${habit.streak}, meilleur ${habit.best_streak})`).join('\n')
    : '- Aucune habitude enregistrée.'

  const eventLines = context.events.length
    ? context.events.slice(0, 6).map((event) => `- ${event.title} — ${event.start_at}`).join('\n')
    : '- Aucun événement à venir.'

  const focusLine = context.focusSummary.totalMinutes > 0
    ? `- ${context.focusSummary.totalMinutes} minutes de focus enregistrés récemment.`
    : '- Pas encore de sessions de focus enregistrées.'

  const journalLine = context.journal.length
    ? context.journal.slice(0, 2).map((entry) => `- ${entry.entry_date}: ${entry.content ?? 'sans contenu'}`).join('\n')
    : '- Aucune entrée de journal récente.'

  return [
    'Contexte productivité disponible :',
    'Tâches ouvertes :',
    taskLines,
    '',
    'Échéances proches :',
    overdueOrDueSoon.length ? overdueOrDueSoon.map((task) => `- ${task.title} — ${task.due_date}`).join('\n') : '- Aucune échéance proche détectée.',
    '',
    'Habitudes :',
    habitLines,
    '',
    'Événements à venir :',
    eventLines,
    '',
    'Focus :',
    focusLine,
    '',
    'Journal récent :',
    journalLine,
  ].join('\n')
}
