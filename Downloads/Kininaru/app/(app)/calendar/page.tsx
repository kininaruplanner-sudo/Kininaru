import { createClient } from '@/lib/supabase/server'
import { CalendarClient } from './calendar-client'

export default async function CalendarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const endOfMonth = new Date(startOfMonth)
  endOfMonth.setMonth(endOfMonth.getMonth() + 2)

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', user!.id)
    .gte('start_at', startOfMonth.toISOString())
    .lte('start_at', endOfMonth.toISOString())
    .order('start_at', { ascending: true })

  return <CalendarClient events={events ?? []} userId={user!.id} />
}
