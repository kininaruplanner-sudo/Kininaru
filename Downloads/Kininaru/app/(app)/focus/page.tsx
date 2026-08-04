import { createClient } from '@/lib/supabase/server'
import { FocusClient } from './focus-client'

export default async function FocusPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
    .limit(50)

  return (
    <FocusClient
      userId={user!.id}
      todaySessions={sessions ?? []}
      allSessions={allSessions ?? []}
    />
  )
}
