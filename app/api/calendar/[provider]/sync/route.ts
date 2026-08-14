import { getProvider } from '@/lib/calendar/providers'

export const runtime = 'nodejs'

/**
 * POST /api/calendar/:provider/sync
 *
 * Triggers a server-side sync of the user's connected calendars (§28.4).
 * Honest scaffolding: the sync engine (Google/Microsoft Graph/ICS import)
 * requires the OAuth credentials to be configured first. This route reports
 * the exact missing configuration instead of pretending to work.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const p = getProvider(provider)
  if (!p) {
    return Response.json({ error: 'Fournisseur inconnu' }, { status: 400 })
  }
  if (p.kind === 'oauth' && !p.configured) {
    return Response.json(
      {
        error: `Synchronisation ${p.label} non disponible : configurez d'abord l'OAuth (voir docs/calendar-integrations.md).`,
        missing: p.clientIdEnv,
      },
      { status: 501 }
    )
  }
  // ICS subscriptions and configured OAuth providers plug in here.
  return Response.json(
    {
      error: 'Moteur de synchronisation à implémenter — voir docs/calendar-integrations.md.',
    },
    { status: 501 }
  )
}
