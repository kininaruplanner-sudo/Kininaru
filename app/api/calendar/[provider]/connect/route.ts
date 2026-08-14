import { getProvider } from '@/lib/calendar/providers'

export const runtime = 'nodejs'

/**
 * GET /api/calendar/:provider/connect
 *
 * Starts the OAuth flow for an external calendar provider (§28).
 * Honest scaffolding: once the public client id AND the server-side secret
 * are configured (see docs/calendar-integrations.md), this route redirects
 * to the provider's official authorize URL. Until then it answers 501 with
 * the exact reason — it never fakes a working connection.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const p = getProvider(provider)
  if (!p) {
    return Response.json({ error: 'Fournisseur inconnu' }, { status: 400 })
  }
  if (p.kind !== 'oauth') {
    return Response.json(
      { error: 'Ce fournisseur utilise un abonnement, pas OAuth. Voir le guide.' },
      { status: 400 }
    )
  }

  const clientId = process.env[p.clientIdEnv]
  const secret = process.env[p.serverConfigEnv]
  if (!clientId || !secret) {
    return Response.json(
      {
        error: `OAuth non configuré pour ${p.label}`,
        missing: [p.clientIdEnv, p.serverConfigEnv].filter((k) => !process.env[k]),
        guide: '/docs/calendar-integrations.md',
      },
      { status: 501 }
    )
  }

  const redirectUri = `${new URL(_req.url).origin}/api/calendar/${p.id}/callback`

  if (p.id === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    // calendar.readonly: afficher les événements (jamais plus que nécessaire).
    url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    return Response.redirect(url.toString())
  }

  if (p.id === 'microsoft') {
    const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', 'offline_access Calendars.Read')
    url.searchParams.set('response_type', 'code')
    return Response.redirect(url.toString())
  }

  return Response.json({ error: 'Flux non implémenté' }, { status: 501 })
}
