import { createClient } from '@/lib/supabase/server'
import { FocusClient } from './focus-client'

export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string; task?: string; duration?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Coach prefill (§31): "Commencer" from the coach window opens Focus with a
  // task. The task is validated server-side (ownership via RLS) and marked
  // in_progress so the user can complete it right after the session.
  const params = await searchParams
  let initialTask: { id: string; title: string } | null = null
  if (params.taskId) {
    const { data: task } = await supabase
      .from('tasks')
      .select('id, title, status')
      .eq('id', params.taskId)
      .eq('user_id', user!.id)
      .maybeSingle()
    if (task) {
      initialTask = { id: task.id, title: task.title }
      if (task.status === 'todo') {
        await supabase
          .from('tasks')
          .update({ status: 'in_progress' })
          .eq('id', task.id)
          .eq('user_id', user!.id)
      }
    }
  }

  const rawDuration = params.duration ? Number(params.duration) : undefined
  const initialMinutes =
    typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0
      ? Math.round(rawDuration)
      : undefined

  const today = new Date().toISOString().split('T')[0]
  const { data: sessions } = await supabase
    .from('focus_sessions')
    .select('*')
    .eq('user_id', user!.id)
    .gte('created_at', today)
    .order('created_at', { ascending: false })

  const { data: allSessions } = await supabase
    .from('focus_sessions')
    .select('id, duration_minutes, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <FocusClient
      userId={user!.id}
      todaySessions={sessions ?? []}
      allSessions={allSessions ?? []}
      initialTask={initialTask}
      initialMinutes={initialMinutes}
    />
  )
}
