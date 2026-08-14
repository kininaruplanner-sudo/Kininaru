import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: profile },
    { data: tasks },
    { data: events },
    { data: habits },
    { data: habitLogs },
    { data: focusSessions },
    { data: memberships },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('tasks').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
    supabase
      .from('events')
      .select('*')
      .eq('user_id', user!.id)
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(5),
    supabase.from('habits').select('*').eq('user_id', user!.id),
    supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', user!.id)
      .gte('logged_date', new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', user!.id)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('family_members')
      .select('family_id, role, families(name)')
      .eq('user_id', user!.id),
  ])

  // The `families` embed can come back shaped as an array depending on
  // PostgREST's relation inference — normalize to a single row (or null).
  const families = (memberships ?? []).map((m) => ({
    ...m,
    families: Array.isArray(m.families) ? (m.families[0] ?? null) : (m.families ?? null),
  }))

  return (
    <DashboardClient
      profile={profile}
      tasks={tasks ?? []}
      events={events ?? []}
      habits={habits ?? []}
      habitLogs={habitLogs ?? []}
      focusSessions={focusSessions ?? []}
      families={families}
      userId={user!.id}
    />
  )
}
