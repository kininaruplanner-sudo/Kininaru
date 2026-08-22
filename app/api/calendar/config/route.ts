import { googleOAuthConfig } from '@/lib/calendar/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/config
 *
 * Server-side truth about which calendar providers can actually run an
 * OAuth flow right now. The UI uses this to distinguish:
 *   - "Non configuré"  → client id and/or secret missing (setup required);
 *   - "Configuré"      → client id + secret present (Connect button works);
 *   - "Connecté"       → an external account is linked (from the RPC);
 *   - "Erreur"         → a connection exists but its last sync failed.
 *
 * Only booleans and env-var NAMES are returned — never secrets.
 */
export async function GET() {
  const google = googleOAuthConfig()
  return Response.json({
    providers: {
      google: {
        configured: google !== null,
        missing: ['NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'].filter(
          (k) => !process.env[k]
        ),
      },
      ics: { configured: true, missing: [] as string[] },
    },
  })
}
