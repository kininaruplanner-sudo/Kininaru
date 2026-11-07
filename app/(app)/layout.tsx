import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { ConfigurationNotice } from '@/components/configuration-notice'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fail with instructions rather than a blank 500 when the environment is
  // missing its Supabase credentials (fresh clone, new deployment target).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return <ConfigurationNotice />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  return (
    <AppShell displayName={profile?.display_name ?? user.email?.split('@')[0]}>
      {children}
    </AppShell>
  )
}
