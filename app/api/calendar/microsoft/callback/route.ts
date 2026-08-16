import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  microsoftOAuthConfig,
  exchangeMicrosoftCode,
  microsoftAccountInfo,
} from '@/lib/calendar/oauth'
import { consumeOAuthState } from '@/lib/oauth-state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/microsoft/callback
 *
 * Real Microsoft OAuth callback (Graph): consumes the one-time state
 * (CSRF/replay-safe), code exchange, account resolution via /me (stable
 * object id), connection stored via the service role — tokens never
 * readable by the client — then back to the page the user came from
 * (return_to stored with the OAuth state) with ?calendar=connected.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const backTo = (path?: string | null) => {
    const target = new URL(`${origin}${path && path.startsWith('/') && !path.startsWith('//') ? path : '/settings'}`)
    return target
  }
  const fail = (msg: string, path?: string | null) => {
    const target = backTo(path)
    target.searchParams.set('calendar', 'error')
    target.searchParams.set('reason', msg)
    return Response.redirect(target.toString())
  }

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
  if (!user) {
    return fail("Session expirée — reconnectez-vous et réessayez")
  }
  if (!state) {
    return fail("Réponse OAuth invalide (state manquant)")
  }

  // Consume the one-time state (single use, bound to this user, 10 min TTL).
  const service = createServiceClient()
  const consumed = await consumeOAuthState(service, state, user.id)
  if (!consumed) {
    return fail("Connexion refusée : état OAuth invalide, expiré ou déjà utilisé — réessayez")
  }
  const back = consumed.return_to ?? '/settings'

  try {
    const tokens = await exchangeMicrosoftCode(
      code,
      cfg.clientId,
      cfg.secret,
      `${origin}/api/calendar/microsoft/callback`
    )
    const account = await microsoftAccountInfo(tokens.access_token)
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
    const target = backTo(back)
    target.searchParams.set('calendar', 'connected')
    return Response.redirect(target.toString())
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue"
    return fail(`Connexion Microsoft impossible : ${message}`, back)
  }
}
