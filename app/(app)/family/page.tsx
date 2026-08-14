import { createClient } from '@/lib/supabase/server'
import { FamilyClient } from './family-client'

export default async function FamilyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Families the user belongs to (via the membership table).
  const { data: memberships } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)

  const familyIds = (memberships ?? []).map((m) => m.family_id)
  const fallbackId = ['00000000-0000-0000-0000-000000000000']
  const ids = familyIds.length ? familyIds : fallbackId

  const [familiesRes, membersRes, eventsRes, tasksRes] = await Promise.all([
    supabase.from('families').select('*').in('id', ids),
    supabase
      .from('family_members')
      .select('family_id, user_id, role, joined_at, profiles(display_name, email)')
      .in('family_id', ids),
    supabase
      .from('family_events')
      .select('*')
      .in('family_id', ids)
      .order('start_at', { ascending: true }),
    supabase
      .from('family_tasks')
      .select('*')
      .in('family_id', ids)
      .order('created_at', { ascending: false }),
  ])

  // The `profiles` embed can come back shaped as an array depending on
  // PostgREST's relation inference — normalize to a single row (or null) so
  // the client component always receives the same object shape.
  const members = (membersRes.data ?? []).map((m) => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : (m.profiles ?? null),
  }))

  return (
    <FamilyClient
      userId={user.id}
      families={familiesRes.data ?? []}
      members={members}
      events={eventsRes.data ?? []}
      tasks={tasksRes.data ?? []}
    />
  )
}
