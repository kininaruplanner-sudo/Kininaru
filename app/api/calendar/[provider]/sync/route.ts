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

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/calendar/:provider/sync
 *
 * Real server-side synchronization for Google Calendar, Microsoft Graph and
 * ICS subscriptions. Reads the connection (tokens included) via the service
 * role — the client can never touch tokens — refreshes the access token when
 * needed, imports/updates events with deduplication keyed by
 * (connection_id, external_event_id), and updates last_sync_at / sync_error
 * honestly. Returns structured errors (503 = configuration, 502 = upstream).
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

async function fetchGoogleEvents(accessToken: string): Promise<ExternalItem[]> {
  const timeMin = new Date()
  timeMin.setDate(timeMin.getDate() - 7)
  const timeMax = new Date()
  timeMax.setMonth(timeMax.getMonth() + 2)
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    maxResults: '250',
  })
  const data = (await fetchJson(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )) as {
    items?: {
      id?: string
      etag?: string
      summary?: string
      description?: string
      location?: string
      start?: { dateTime?: string; date?: string }
      end?: { dateTime?: string; date?: string }
    }[]
  }
  return (data.items ?? [])
    .map((it) => ({
      externalId: it.id ?? '',
      etag: it.etag ?? null,
      title: it.summary || '(sans titre)',
      description: it.description ?? null,
      location: it.location ?? null,
      startAt: new Date(it.start?.dateTime ?? it.start?.date ?? ''),
      endAt: new Date(it.end?.dateTime ?? it.end?.date ?? ''),
    }))
    .filter((e) => e.externalId && !Number.isNaN(e.startAt.getTime()))
}

async function fetchMicrosoftEvents(accessToken: string): Promise<ExternalItem[]> {
  const timeMin = new Date()
  timeMin.setDate(timeMin.getDate() - 7)
  const timeMax = new Date()
  timeMax.setMonth(timeMax.getMonth() + 2)
  const params = new URLSearchParams({
    startdatetime: timeMin.toISOString(),
    enddatetime: timeMax.toISOString(),
    $select: 'id,subject,bodyPreview,location,start,end,changeKey',
    $top: '250',
  })
  const data = (await fetchJson(
    `https://graph.microsoft.com/v1.0/me/calendarview?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )) as {
    value?: {
      id?: string
      subject?: string
      bodyPreview?: string
      location?: { displayName?: string }
      start?: { dateTime?: string }
      end?: { dateTime?: string }
      changeKey?: string
    }[]
  }
  return (data.value ?? [])
    .map((it) => ({
      externalId: it.id ?? '',
      etag: it.changeKey ?? null,
      title: it.subject || '(sans titre)',
      description: it.bodyPreview ?? null,
      location: it.location?.displayName ?? null,
      startAt: new Date(it.start?.dateTime ?? ''),
      endAt: new Date(it.end?.dateTime ?? ''),
    }))
    .filter((e) => e.externalId && !Number.isNaN(e.startAt.getTime()))
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

async function upsertExternalItems(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  connectionId: string,
  items: ExternalItem[]
): Promise<number> {
  const { data: existing } = await service
    .from('calendar_synced_events')
    .select('external_event_id, event_id')
    .eq('connection_id', connectionId)
  const map = new Map((existing ?? []).map((r) => [r.external_event_id, r.event_id]))
  const nowIso = new Date().toISOString()
  for (const item of items) {
    const eventId = map.get(item.externalId)
    if (eventId) {
      await service
        .from('events')
        .update({
          title: item.title,
          description: item.description,
          location: item.location,
          start_at: item.startAt.toISOString(),
          end_at: item.endAt.toISOString(),
        })
        .eq('id', eventId)
      await service
        .from('calendar_synced_events')
        .update({ external_etag: item.etag ?? null, last_synced_at: nowIso })
        .eq('connection_id', connectionId)
        .eq('external_event_id', item.externalId)
    } else {
      const { data: ev } = await service
        .from('events')
        .insert({
          user_id: userId,
          title: item.title,
          description: item.description,
          location: item.location,
          start_at: item.startAt.toISOString(),
          end_at: item.endAt.toISOString(),
          color: '#CDE9D2',
          category: 'external',
        })
        .select('id')
        .single()
      if (ev) {
        await service.from('calendar_synced_events').insert({
          user_id: userId,
          connection_id: connectionId,
          external_event_id: item.externalId,
          event_id: ev.id,
          external_etag: item.etag ?? null,
        })
      }
    }
  }
  return items.length
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

  if (p.kind === 'oauth' && !p.configured) {
    return Response.json(
      {
        error: `Synchronisation ${p.label} non disponible : configurez d'abord l'OAuth (voir docs/calendar-integrations.md).`,
        missing: p.clientIdEnv,
      },
      { status: 503 }
    )
  }

  let body: { connectionId?: string } = {}
  try {
    body = (await req.json()) as { connectionId?: string }
  } catch {
    body = {}
  }

  const service = createServiceClient()
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

    let items: ExternalItem[] = []
    if (provider === 'ics') {
      const url = conn.external_account_id
      if (!url || !/^https:\/\//i.test(url)) {
        throw new Error("URL ICS invalide (https requis)")
      }
      const { data: profile } = await service
        .from('profiles')
        .select('timezone')
        .eq('id', user.id)
        .maybeSingle()
      const userTz = (profile?.timezone as string | undefined) ?? 'UTC'
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      let raw: string
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'text/calendar' },
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
          ? await fetchGoogleEvents(accessToken)
          : await fetchMicrosoftEvents(accessToken)
    }

    const imported = await upsertExternalItems(service, user.id, conn.id, items)
    await service
      .from('calendar_connections')
      .update({ last_sync_at: new Date().toISOString(), sync_error: null })
      .eq('id', conn.id)

    return Response.json({ ok: true, imported })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue"
    await service
      .from('calendar_connections')
      .update({ sync_error: message.slice(0, 300) })
      .eq('provider', provider)
      .eq('user_id', user.id)
    return Response.json({ error: message }, { status: 502 })
  }
}
