import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AiSidePanelProvider } from '@/lib/ai-side-panel-context'
import { AiPageContent } from './ai-page-content'

export default async function AIPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  return (
    <AiSidePanelProvider>
      <AiPageContent displayName={profile?.display_name ?? 'friend'} />
    </AiSidePanelProvider>
  )
}
