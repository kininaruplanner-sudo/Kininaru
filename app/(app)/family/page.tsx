import { createClient } from '@/lib/supabase/server'
import { FamilyClient } from '@/components/family/family-client'

export default async function FamilyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('family_members')
    .select('*')
    .eq('user_id', user!.id)
    .maybeSingle()

  if (!membership) {
    return (
      <FamilyClient
        userId={user!.id}
        family={null}
        currentRole={null}
        members={[]}
        events={[]}
        tasks={[]}
        goals={[]}
        notifications={[]}
      />
    )
  }

  const [
    { data: family },
    { data: memberRows },
    { data: events },
    { data: tasks },
    { data: goals },
    { data: notifications },
  ] = await Promise.all([
    supabase.from('families').select('*').eq('id', membership.family_id).single(),
    supabase
      .from('family_members')
      .select('*')
      .eq('family_id', membership.family_id)
      .order('joined_at', { ascending: true }),
    supabase
      .from('family_events')
      .select('*')
      .eq('family_id', membership.family_id)
      .order('start_at', { ascending: true }),
    supabase
      .from('family_tasks')
      .select('*')
      .eq('family_id', membership.family_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('family_goals')
      .select('*')
      .eq('family_id', membership.family_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('family_notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const memberIds = (memberRows ?? []).map((m) => m.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000'])

  const members = (memberRows ?? []).map((m) => ({
    ...m,
    display_name: profiles?.find((p) => p.id === m.user_id)?.display_name || 'Membre',
  }))

  return (
    <FamilyClient
      userId={user!.id}
      family={family ?? null}
      currentRole={membership.role}
      members={members}
      events={events ?? []}
      tasks={tasks ?? []}
      goals={goals ?? []}
      notifications={notifications ?? []}
    />
  )
}
