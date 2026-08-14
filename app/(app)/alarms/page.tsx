import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { AlarmClient, type AlarmRow } from './alarms-client'

export const metadata = {
  title: 'Alarmes — Kininaru',
  description:
    'Créneau quotidien avec son et vibration, distinct des rappels : il marque le début d’un moment, pas un « n’oublie pas ».',
}

export default async function AlarmsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: alarms } = await supabase
    .from('alarms')
    .select('*')
    .eq('user_id', user.id)
    .order('time', { ascending: true })
    .then(
      (r) => r,
      () => ({ data: null })
    )

  return (
    <div className="p-5 sm:p-6 lg:p-8 max-w-[980px] mx-auto space-y-5">
      <PageHeader
        title="Alarmes"
        subtitle="Un créneau qui sonne : révision, sport, dîner… différent d’un rappel."
      />
      <AlarmClient alarms={(alarms ?? []) as AlarmRow[]} userId={user.id} />
    </div>
  )
}
