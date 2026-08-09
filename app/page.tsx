import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Landing } from '@/components/landing/landing'

export const metadata: Metadata = {
  title: 'Kininaru — Organisez votre vie avec curiosité',
  description:
    'Le planificateur chaleureux qui réunit tâches, habitudes, focus, journal, espace famille et un coach IA — pour avancer chaque jour, seul ou en famille.',
  openGraph: {
    title: 'Kininaru — Organisez votre vie avec curiosité',
    description:
      'Tâches, habitudes, focus, journal, famille et coach IA dans un seul espace chaleureux.',
    type: 'website',
    siteName: 'Kininaru',
    images: ['/icon-512x512.png'],
  },
}

export default async function HomePage() {
  // The landing page is public and must render even when Supabase env vars
  // are missing or unreachable (e.g. .env.local not created yet). Auth pages
  // will surface a clear configuration error instead.
  let user: { id: string } | null = null
  try {
    const supabase = await createClient()
    const {
      data: { user: u },
    } = await supabase.auth.getUser()
    user = u
  } catch {
    user = null
  }

  // Signed-in users go straight to their dashboard; everyone else sees the
  // marketing landing page.
  if (user) {
    redirect('/dashboard')
  }

  return <Landing />
}
