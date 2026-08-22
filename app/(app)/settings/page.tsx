import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Guard: session may expire between layout auth check and page render.
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // AI memory (opt-in, strictly private). Guarded: if the table is missing
  // (schema not re-run yet), the page still renders with an empty list.
  const { data: memories } = await supabase
    .from('ai_memories')
    .select('id, content, category, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <SettingsClient
      profile={profile}
      user={{ email: user.email ?? '' }}
      userId={user.id}
      memories={(memories as { id: string; content: string; category: string; created_at: string }[] | null) ?? []}
    />
  )
}
