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

  // 15 weeks so the heatmap reads as a proper GitHub-style grid, not a single row
  const heatmapStart = new Date()
  heatmapStart.setDate(heatmapStart.getDate() - 104)

  const { data: logs } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('user_id', user!.id)
    .gte('logged_date', heatmapStart.toISOString().split('T')[0])
    .order('logged_date', { ascending: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, level')
    .eq('id', user!.id)
    .single()

  return <HabitsClient habits={habits ?? []} logs={logs ?? []} userId={user!.id} profile={profile} />
}
