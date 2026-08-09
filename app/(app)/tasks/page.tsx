import { createClient } from '@/lib/supabase/server'
import { TasksClient } from './tasks-client'

export default async function TasksPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return <TasksClient tasks={tasks ?? []} userId={user!.id} />
}
