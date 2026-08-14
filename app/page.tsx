import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/site-url'
import { Landing } from '@/components/landing/landing'

export const metadata: Metadata = {
  title: 'Kininaru — Ton coach pour savoir quoi faire maintenant',
  description:
    "Tu as déjà une liste de choses à faire. Kininaru t'aide à choisir laquelle faire maintenant — tâches, habitudes, focus, journal, famille et un coach IA qui guide ta journée.",
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Kininaru',
    title: 'Kininaru — Ton coach pour savoir quoi faire maintenant',
    description:
      'Choisis quoi faire maintenant : tâches, habitudes, focus, journal, famille et un coach IA qui observe tes vraies données.',
    // Image 1200×630 dédiée (app/opengraph-image.tsx) — résolue en URL absolue
    // publique via metadataBase (racine), cf. lib/site-url.ts.
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Kininaru — Ton coach pour savoir quoi faire maintenant' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kininaru — Ton coach pour savoir quoi faire maintenant',
    description:
      'Choisis quoi faire maintenant : tâches, habitudes, focus, journal, famille et un coach IA qui guide ta journée.',
    images: ['/opengraph-image'],
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
