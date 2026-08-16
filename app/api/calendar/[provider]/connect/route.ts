import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getProvider } from '@/lib/calendar/providers'
import {
  googleOAuthConfig,
  microsoftOAuthConfig,
  googleAuthorizeUrl,
  microsoftAuthorizeUrl,
} from '@/lib/calendar/oauth'
import { createOAuthState } from '@/lib/oauth-state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/:provider/connect
 *
 * Starts the real OAuth flow for Google / Microsoft. A cryptographically
 * random `state` is generated server-side, stored in oauth_states bound
 * to the authenticated user (10-min TTL), and placed in the authorize URL
 * — the callback will consume it once (replay/CSRF-safe, see
 * lib/oauth-state.ts). Returns a redirect to the provider's authorize URL
 * — or an honest JSON error when credentials are missing (never a fake
 * button).
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
  // Optional internal path (e.g. /calendar) to return to after the
  // callback — sanitized server-side in createOAuthState.
  const returnTo = new URL(req.url).searchParams.get('returnTo') ?? undefined

  let clientId: string
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
    clientId = cfg.clientId
  } else if (p.id === 'microsoft') {
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
    clientId = cfg.clientId
  } else {
    return Response.json({ error: "Flux non implémenté" }, { status: 501 })
  }

  // One-time random state bound to this user (server-side). If the SQL
  // migration is not deployed, the flow cannot start safely — say so.
  const service = createServiceClient()
  const state = await createOAuthState(service, user.id, returnTo)
  if (!state) {
    return Response.json(
      {
        error:
          "Impossible de préparer la connexion OAuth — exécutez supabase/oauth-states.sql dans Supabase, puis réessayez.",
        guide: '/docs/calendar-integrations.md',
      },
      { status: 500 }
    )
  }

  if (p.id === 'google') {
    return Response.redirect(googleAuthorizeUrl(origin, clientId, state))
  }
  return Response.redirect(microsoftAuthorizeUrl(origin, clientId, state))
}
