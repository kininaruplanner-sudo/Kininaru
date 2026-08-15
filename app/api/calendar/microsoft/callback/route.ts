import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  microsoftOAuthConfig,
  exchangeMicrosoftCode,
  microsoftAccountInfo,
} from '@/lib/calendar/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/microsoft/callback
 *
 * Real Microsoft OAuth callback (Graph): code exchange, account resolution,
 * connection stored via the service role — tokens never readable by the
 * client — then back to /settings?calendar=connected.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const fail = (msg: string) =>
    Response.redirect(
      `${origin}/settings?calendar=error&reason=${encodeURIComponent(msg)}`
    )

  if (url.searchParams.get('error') || !code) {
    return fail("Autorisation refusée par Microsoft")
  }

  const cfg = microsoftOAuthConfig()
  if (!cfg) {
    return fail("OAuth Microsoft non configuré côté serveur")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || (state && state !== user.id)) {
    return fail("Session expirée — reconnectez-vous et réessayez")
  }

  try {
    const tokens = await exchangeMicrosoftCode(
      code,
      cfg.clientId,
      cfg.secret,
      `${origin}/api/calendar/microsoft/callback`
    )
    const account = await microsoftAccountInfo(tokens.access_token)
    const service = createServiceClient()
    await service.from('calendar_connections').upsert(
      {
        user_id: user.id,
        provider: 'microsoft',
        external_account_id: account.id,
        display_name: account.name,
        scopes: ['offline_access', 'Calendars.Read'],
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expires_at.toISOString(),
        enabled: true,
        sync_mode: 'read',
        sync_error: null,
      },
      { onConflict: 'user_id,provider,external_account_id' }
    )
    return Response.redirect(`${origin}/settings?calendar=connected`)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue"
    return fail(`Connexion Microsoft impossible : ${message}`)
  }
}
