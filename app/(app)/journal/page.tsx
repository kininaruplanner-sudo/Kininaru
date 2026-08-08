import { createClient } from '@/lib/supabase/server'
import { JournalClient } from './journal-client'

export default async function JournalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: entries } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user!.id)
    .order('entry_date', { ascending: false })
    .limit(30)

  return <JournalClient entries={entries ?? []} userId={user!.id} />
}
