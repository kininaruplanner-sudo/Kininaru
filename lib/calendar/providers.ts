/**
 * Calendar providers (§28) — extensible abstraction.
 *
 * Adding a provider = one entry in CALENDAR_PROVIDERS + the server-side sync
 * implementation behind `app/api/calendar/[provider]/*`. The UI, the SQL
 * schema (calendar_connections / calendar_synced_events in
 * supabase/calendar.sql) and the dedup strategy (unique external_event_id)
 * are provider-agnostic on purpose.
 *
 * Honest states: a provider shows "Configurer" when the app has no OAuth
 * credentials for it yet (the client id is public by design — OAuth client
 * ids are not secrets; the SECRET stays server-side), and "Connecter" only
 * once it can actually run the OAuth flow.
 *
 * The `configured` flag is NOT computed here (build-time env on the client
 * cannot see the server secret). It comes from the server at runtime via
 * GET /api/calendar/config — the single source of truth that checks BOTH
 * the client id and the secret.
 */

export type CalendarProviderId = 'google' | 'microsoft' | 'ics'

export interface CalendarProvider {
  id: CalendarProviderId
  label: string
  /** Short description of what the connection gives you. */
  description: string
  /** Public OAuth client id env var (public by nature — never the secret). */
  clientIdEnv: string
  /** Server-side config env var checked by /api/calendar/[provider]/connect. */
  serverConfigEnv: string
  /** Sync direction this provider currently supports. */
  defaultSyncMode: 'read' | 'read_write'
  /** How the user connects (OAuth URL or manual ICS URL). */
  kind: 'oauth' | 'subscription'
  docsUrl: string
}

export const CALENDAR_PROVIDERS: CalendarProvider[] = [
  {
    id: 'google',
    label: 'Google Calendar',
    description:
      'Vos événements Google apparaissent dans votre calendrier Kininaru (lecture seule par défaut).',
    clientIdEnv: 'NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID',
    serverConfigEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    defaultSyncMode: 'read',
    kind: 'oauth',
    docsUrl: '/docs/calendar-integrations.md',
  },
  {
    id: 'microsoft',
    label: 'Microsoft Outlook / 365',
    description:
      'Vos calendriers Outlook ou Microsoft 365 dans Kininaru, via le flux OAuth officiel Microsoft.',
    clientIdEnv: 'NEXT_PUBLIC_MICROSOFT_OAUTH_CLIENT_ID',
    serverConfigEnv: 'MICROSOFT_OAUTH_CLIENT_SECRET',
    defaultSyncMode: 'read',
    kind: 'oauth',
    docsUrl: '/docs/calendar-integrations.md',
  },
  {
    id: 'ics',
    label: 'Apple / iCloud · ICS',
    description:
      'Abonnement à un flux .ics (iCloud Calendrier, etc.) — la méthode officiellement compatible avec une PWA.',
    clientIdEnv: '',
    serverConfigEnv: '',
    defaultSyncMode: 'read',
    kind: 'subscription',
    docsUrl: '/docs/calendar-integrations.md',
  },
]

export function getProvider(id: string): CalendarProvider | undefined {
  return CALENDAR_PROVIDERS.find((p) => p.id === id)
}

/** Row shape of public.calendar_connections (safe fields only — tokens are
 *  never fetched client-side). */
export interface CalendarConnectionRow {
  id: string
  provider: CalendarProviderId
  display_name: string | null
  sync_mode: 'read' | 'read_write'
  enabled: boolean
  last_sync_at: string | null
  sync_error: string | null
  created_at: string
}
