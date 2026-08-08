import { createClient } from '@/lib/supabase/server'
import { AchievementsClient } from './achievements-client'

export default async function AchievementsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [profileRes, tasksRes, focusRes, habitsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('tasks').select('status, created_at').eq('user_id', user!.id),
    supabase.from('focus_sessions').select('duration_minutes').eq('user_id', user!.id),
    supabase.from('habits').select('streak, best_streak').eq('user_id', user!.id),
  ])

  return (
    <AchievementsClient
      profile={profileRes.data}
      tasks={tasksRes.data ?? []}
      focusSessions={focusRes.data ?? []}
      habits={habitsRes.data ?? []}
    />
  )
}
