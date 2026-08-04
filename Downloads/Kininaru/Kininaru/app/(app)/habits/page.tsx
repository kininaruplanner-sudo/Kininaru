import { createClient } from '@/lib/supabase/server'
import { HabitsClient } from './habits-client'

export default async function HabitsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: habits } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true })

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: logs } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('user_id', user!.id)
    .gte('logged_date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('logged_date', { ascending: true })

  return <HabitsClient habits={habits ?? []} logs={logs ?? []} userId={user!.id} />
}
