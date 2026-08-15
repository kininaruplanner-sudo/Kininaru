import { createClient } from '@/lib/supabase/server'
import { GoalsClient } from './goals-client'

export default async function GoalsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: goals }, { data: tasks }] = await Promise.all([
    supabase
      .from('goals')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('tasks')
      .select('id, title, status, goal_id')
      .eq('user_id', user!.id)
      .not('goal_id', 'is', null),
  ])

  return (
    <GoalsClient
      goals={goals ?? []}
      tasks={tasks ?? []}
      userId={user!.id}
    />
  )
}
