import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getProvider } from '@/lib/calendar/providers'
import {
  googleOAuthConfig,
  microsoftOAuthConfig,
  refreshGoogleToken,
  refreshMicrosoftToken,
} from '@/lib/calendar/oauth'
import { parseIcs } from '@/lib/calendar/ics'
import { localToUtcDate } from '@/lib/time'
import { isPrivateIP, dnsResolve } from '@/lib/ssrf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/calendar/:provider/sync
 *
 * Real server-side synchronization for Google Calendar, Microsoft Graph and
 * ICS subscriptions. Reads the connection (tokens included) via the service
 * role — the client can never touch tokens — refreshes the access token when
 * needed, imports/updates events with deduplication keyed by
 * (connection_id, external_event_id) inside a SINGLE PostgreSQL transaction
 * (RPC calendar_import_events, supabase/calendar-sync-rpc.sql), deletes
 * events that disappeared from the provider within the sync window, and
 * updates last_sync_at / sync_error honestly.
 *
 * Pagination is followed (5 pages max per provider), all-day events are
 * anchored at local noon in the USER's timezone so they land on the right
 * date wherever the user is, and recurring series are expanded by the
 * providers themselves (singleEvents / calendarview). Idempotent: re-syncing
 * never creates duplicates.
 */
interface ExternalItem {
  externalId: string
  etag?: string | null
  title: string
  description?: string | null
  location?: string | null
  startAt: Date
  endAt: Date
}

const FETCH_TIMEOUT_MS = 15_000
const MAX_PAGES = 5
const WINDOW_PAST_DAYS = 7
const WINDOW_FUTURE_MONTHS = 2

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) throw new Error(`Réponse ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

interface GoogleItem {
  id?: string
  etag?: string
  summary?: string
  description?: string
  location?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

interface MsItem {
  id?: string
  subject?: string
  bodyPreview?: string
  location?: { displayName?: string }
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  changeKey?: string
}

function windowBounds(): { min: Date; max: Date } {
  const timeMin = new Date()
  timeMin.setDate(timeMin.getDate() - WINDOW_PAST_DAYS)
  const timeMax = new Date()
  timeMax.setMonth(timeMax.getMonth() + WINDOW_FUTURE_MONTHS)
  return { min: timeMin, max: timeMax }
}

/**
 * All-day events (start.date without start.dateTime) are anchored at local
 * noon in the user's timezone: whatever the user's offset, the event stays
 * on the right calendar day. Timed events keep their exact instant.
 */
function toInstants(
  start: { dateTime?: string; date?: string } | undefined,
  end: { dateTime?: string; date?: string } | undefined,
  userTz: string
): { startAt: Date; endAt: Date } {
  const allDay = Boolean(start?.date && !start?.dateTime)
  if (allDay) {
    const dateKey = start?.date ?? ''
    const endKey = end?.date || dateKey
    const startAt = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
      ? localToUtcDate(dateKey, '12:00', userTz)
      : new Date(Number.NaN)
    let endAt = /^\d{4}-\d{2}-\d{2}$/.test(endKey)
      ? localToUtcDate(endKey, '12:00', userTz)
      : new Date(Number.NaN)
    if (Number.isNaN(endAt.getTime())) {
      endAt = Number.isNaN(startAt.getTime())
        ? new Date(Number.NaN)
        : new Date(startAt.getTime() + 24 * 60 * 60 * 1000)
    }
    return { startAt, endAt }
  }
  return {
    startAt: new Date(start?.dateTime ?? ''),
    endAt: new Date(end?.dateTime ?? start?.dateTime ?? ''),
  }
}

async function fetchGoogleEvents(
  accessToken: string,
  calendarId: string | null,
  userTz: string
): Promise<ExternalItem[]> {
  const { min, max } = windowBounds()
  const out: ExternalItem[] = []
  let pageToken: string | null = null
  const cal = calendarId || 'primary'
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      timeMin: min.toISOString(),
      timeMax: max.toISOString(),
      singleEvents: 'true',
      maxResults: '250',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const data = (await fetchJson(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )) as { items?: GoogleItem[]; nextPageToken?: string }
    for (const it of data.items ?? []) {
      if (!it.id) continue
      const { startAt, endAt } = toInstants(it.start, it.end, userTz)
      if (Number.isNaN(startAt.getTime())) continue
      out.push({
        externalId: it.id,
        etag: it.etag ?? null,
        title: it.summary || '(sans titre)',
        description: it.description ?? null,
        location: it.location ?? null,
        startAt,
        endAt,
      })
    }
    pageToken = data.nextPageToken ?? null
    if (!pageToken) break
  }
  return out
}

async function fetchMicrosoftEvents(accessToken: string, userTz: string): Promise<ExternalItem[]> {
  const { min, max } = windowBounds()
  const out: ExternalItem[] = []
  const base = 'https://graph.microsoft.com/v1.0/me/calendarview'
  let url: string | null =
    `${base}?` +
    new URLSearchParams({
      startdatetime: min.toISOString(),
      enddatetime: max.toISOString(),
      $select: 'id,subject,bodyPreview,location,start,end,changeKey',
      $top: '250',
    }).toString()
  for (let page = 0; page < MAX_PAGES && url; page++) {
    const data = (await fetchJson(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })) as { value?: MsItem[]; '@odata.nextLink'?: string }
    for (const it of data.value ?? []) {
      if (!it.id) continue
      const { startAt, endAt } = toInstants(it.start, it.end, userTz)
      if (Number.isNaN(startAt.getTime())) continue
      out.push({
        externalId: it.id,
        etag: it.changeKey ?? null,
        title: it.subject || '(sans titre)',
        description: it.bodyPreview ?? null,
        location: it.location?.displayName ?? null,
        startAt,
        endAt,
      })
    }
    url = data['@odata.nextLink'] ?? null
  }
  return out
}

interface ConnectionRow {
  id: string
  provider: string
  external_account_id: string | null
  display_name: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  enabled: boolean
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const p = getProvider(provider)
  if (!p) {
    return Response.json({ error: "Fournisseur inconnu" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Connectez-vous d'abord." }, { status: 401 })
  }

  if (p.kind === 'oauth') {
    const cfgOk =
      provider === 'google' ? googleOAuthConfig() !== null : microsoftOAuthConfig() !== null
    if (!cfgOk) {
      return Response.json(
        {
          error: `Synchronisation ${p.label} non disponible : configurez d'abord l'OAuth (voir docs/calendar-integrations.md).`,
          missing: p.clientIdEnv,
        },
        { status: 503 }
      )
    }
  }

  let body: { connectionId?: string } = {}
  try {
    body = (await req.json()) as { connectionId?: string }
  } catch {
    body = {}
  }

  const service = createServiceClient()
  // Which connection we are actually syncing — used to scope the error write
  // below, so a failure on one connection never marks the user's OTHER
  // connections (same provider) with a bogus sync_error.
  let syncingConnectionId: string | null = null
  try {
    let query = service
      .from('calendar_connections')
      .select(
        'id, provider, external_account_id, display_name, access_token, refresh_token, token_expires_at, enabled'
      )
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('enabled', true)
    if (body.connectionId) query = query.eq('id', body.connectionId)
    const { data: conns, error: connErr } = await query
    if (connErr) throw connErr
    const conn = (conns?.[0] ?? null) as ConnectionRow | null
    if (!conn) {
      return Response.json({ error: "Aucune connexion à synchroniser" }, { status: 404 })
    }
    syncingConnectionId = conn.id

    // User timezone — all-day events are anchored to local noon in it.
    const { data: profile } = await service
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .maybeSingle()
    const userTz = (profile?.timezone as string | undefined) ?? 'UTC'

    let items: ExternalItem[] = []
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - WINDOW_PAST_DAYS)

    if (provider === 'ics') {
      const url = conn.external_account_id
      if (!url || !/^https:\/\//i.test(url)) {
        throw new Error("URL ICS invalide (https requis)")
      }
      // SSRF re-validation: DNS may have changed since initial subscribe.
      const icsUrl = new URL(url)
      const ips = await dnsResolve(icsUrl.hostname)
      for (const ip of ips) {
        if (isPrivateIP(ip)) {
          throw new Error("L'URL pointe vers un réseau interne — synchronisation refusée")
        }
      }
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      let raw: string
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'text/calendar' },
          redirect: 'follow',
        })
        if (!res.ok) throw new Error(`Flux ICS inaccessible (${res.status})`)
        raw = await res.text()
      } finally {
        clearTimeout(t)
      }
      if (!raw.includes('BEGIN:VCALENDAR')) {
        throw new Error("Le flux ne contient pas de calendrier ICS valide")
      }
      items = parseIcs(raw, userTz).map((e) => ({
        externalId: e.uid,
        title: e.summary,
        description: e.description,
        location: e.location,
        startAt: e.startAt,
        endAt: e.endAt,
      }))
    } else {
      let accessToken = conn.access_token
      const refreshToken = conn.refresh_token
      const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null
      if (!accessToken) throw new Error("Aucun token enregistré — reconnectez le compte")
      if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60_000) {
        if (!refreshToken) throw new Error("Token expiré sans refresh — reconnectez le compte")
        const refresh = refreshToken
        const refreshed = await (provider === 'google'
          ? (async () => {
              const cfg = googleOAuthConfig()
              if (!cfg) throw new Error("OAuth Google non configuré côté serveur")
              return refreshGoogleToken(refresh, cfg.clientId, cfg.secret)
            })()
          : (async () => {
              const cfg = microsoftOAuthConfig()
              if (!cfg) throw new Error("OAuth Microsoft non configuré côté serveur")
              return refreshMicrosoftToken(refresh, cfg.clientId, cfg.secret)
            })())
        accessToken = refreshed.access_token
        await service
          .from('calendar_connections')
          .update({
            access_token: refreshed.access_token,
            token_expires_at: refreshed.expires_at.toISOString(),
          })
          .eq('id', conn.id)
      }
      items =
        provider === 'google'
          ? await fetchGoogleEvents(accessToken, conn.external_account_id, userTz)
          : await fetchMicrosoftEvents(accessToken, userTz)
    }

    // Atomic import: single PostgreSQL transaction (event + mapping upserts
    // and window-scoped deletion of events missing from the feed).
    const rpcItems = items.map((i) => ({
      external_id: i.externalId,
      etag: i.etag ?? null,
      title: i.title,
      description: i.description ?? null,
      location: i.location ?? null,
      start_at: i.startAt.toISOString(),
      end_at: i.endAt.toISOString(),
    }))
    const rpc = (await service.rpc('calendar_import_events', {
      p_user_id: user.id,
      p_connection_id: conn.id,
      p_items: rpcItems,
      p_delete_missing: true,
      p_window_start:
        provider === 'ics' ? new Date(0).toISOString() : windowStart.toISOString(),
    })) as { data: number | null; error: { message: string; code?: string } | null }
    if (rpc.error) {
      if (
        rpc.error.code === 'PGRST202' ||
        /could not find the function/i.test(rpc.error.message)
      ) {
        throw new Error(
          "Synchronisation impossible : exécutez supabase/calendar-sync-rpc.sql dans Supabase, puis réessayez."
        )
      }
      throw rpc.error
    }
    const imported = Number(rpc.data ?? items.length)

    await service
      .from('calendar_connections')
      .update({ last_sync_at: new Date().toISOString(), sync_error: null })
      .eq('id', conn.id)

    return Response.json({ ok: true, imported })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue"
    // Scope the error to the connection being synced (never to the user's
    // other connections of the same provider).
    const errQuery = service
      .from('calendar_connections')
      .update({ sync_error: message.slice(0, 300) })
      .eq('user_id', user.id)
    if (syncingConnectionId) errQuery.eq('id', syncingConnectionId)
    else errQuery.eq('provider', provider)
    await errQuery
    // Never expose internal error details to the client.
    return Response.json({ error: "Erreur de synchronisation" }, { status: 502 })
  }
}
