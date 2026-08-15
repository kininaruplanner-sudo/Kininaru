import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/calendar/providers'
import {
  googleOAuthConfig,
  microsoftOAuthConfig,
  googleAuthorizeUrl,
  microsoftAuthorizeUrl,
} from '@/lib/calendar/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/:provider/connect
 *
 * Starts the real OAuth flow for Google / Microsoft. The authenticated
 * user id is embedded in `state` so the callback can bind the connection
 * to the right account (and reject mismatches). Returns a redirect to the
 * provider's authorize URL — or an honest JSON error when credentials are
 * missing (never a fake button).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const p = getProvider(provider)
  if (!p) {
    return Response.json({ error: "Fournisseur inconnu" }, { status: 400 })
  }
  if (p.kind !== 'oauth') {
    return Response.json(
      { error: "Ce fournisseur utilise un abonnement, pas OAuth." },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Connectez-vous d'abord." }, { status: 401 })
  }

  const origin = new URL(req.url).origin

  if (p.id === 'google') {
    const cfg = googleOAuthConfig()
    if (!cfg) {
      return Response.json(
        {
          error: `OAuth Google non configuré pour ${p.label}`,
          missing: ['NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'].filter(
            (k) => !process.env[k]
          ),
          guide: '/docs/calendar-integrations.md',
        },
        { status: 503 }
      )
    }
    return Response.redirect(googleAuthorizeUrl(origin, cfg.clientId, user.id))
  }

  if (p.id === 'microsoft') {
    const cfg = microsoftOAuthConfig()
    if (!cfg) {
      return Response.json(
        {
          error: `OAuth Microsoft non configuré pour ${p.label}`,
          missing: ['NEXT_PUBLIC_MICROSOFT_OAUTH_CLIENT_ID', 'MICROSOFT_OAUTH_CLIENT_SECRET'].filter(
            (k) => !process.env[k]
          ),
          guide: '/docs/calendar-integrations.md',
        },
        { status: 503 }
      )
    }
    return Response.redirect(microsoftAuthorizeUrl(origin, cfg.clientId, user.id))
  }

  return Response.json({ error: "Flux non implémenté" }, { status: 501 })
}
