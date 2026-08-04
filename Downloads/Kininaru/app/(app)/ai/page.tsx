import { createClient } from '@/lib/supabase/server'
import { AIAssistantClient } from './ai-client'

export default async function AIPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user!.id)
    .single()

  return <AIAssistantClient displayName={profile?.display_name ?? 'friend'} />
}
