import { createClient } from '@/lib/supabase/server'
import { AnalyticsClient } from './analytics-client'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const dateStr = ninetyDaysAgo.toISOString().split('T')[0]

  const [tasksRes, focusRes, habitsRes, habitLogsRes, journalRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', user!.id).gte('created_at', dateStr),
    supabase.from('focus_sessions').select('*').eq('user_id', user!.id).gte('created_at', dateStr),
    supabase.from('habits').select('*').eq('user_id', user!.id),
    supabase.from('habit_logs').select('*').eq('user_id', user!.id).gte('logged_date', dateStr),
    supabase.from('journal_entries').select('mood, entry_date').eq('user_id', user!.id).gte('entry_date', dateStr),
  ])

  return (
    <AnalyticsClient
      tasks={tasksRes.data ?? []}
      focusSessions={focusRes.data ?? []}
      habits={habitsRes.data ?? []}
      habitLogs={habitLogsRes.data ?? []}
      journalEntries={journalRes.data ?? []}
    />
  )
}
