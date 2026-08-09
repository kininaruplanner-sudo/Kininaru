import { createClient } from '@/lib/supabase/server'
import { CalendarClient } from './calendar-client'

export default async function CalendarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch ALL of the user's events so month/week/day navigation and creation
  // always have data — a narrower window previously hid events outside the
  // current month, making arrow navigation show empty calendars.
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', user!.id)
    .order('start_at', { ascending: true })

  return <CalendarClient events={events ?? []} userId={user!.id} />
}
