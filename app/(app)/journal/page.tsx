import { createClient } from '@/lib/supabase/server'
import { JournalClient } from './journal-client'

export default async function JournalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Load ALL entries (one per day, small rows): with a .limit() here, older
  // entries would be invisible in the sidebar AND an accidental save on an
  // older date could overwrite an existing entry with blank content.
  const { data: entries } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user!.id)
    .order('entry_date', { ascending: false })

  return <JournalClient entries={entries ?? []} userId={user!.id} />
}
