import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { parseIcs } from '@/lib/calendar/ics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/calendar/ics/subscribe
 *
 * Real ICS subscription (iCloud public calendar, Google public address,
 * Outlook web publish): validates the URL (https), fetches the feed,
 * parses it (must contain a valid VCALENDAR), stores the subscription via
 * the service role and returns the connection id. No fake button: an
 * invalid URL or unreadable feed is an explicit error.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Connectez-vous d'abord." }, { status: 401 })
  }

  let body: { url?: string; name?: string }
  try {
    body = (await req.json()) as { url?: string; name?: string }
  } catch {
    return Response.json({ error: "Corps JSON invalide" }, { status: 400 })
  }

  const raw = body.url?.trim()
  if (!raw) {
    return Response.json({ error: "URL ICS requise" }, { status: 400 })
  }
  // webcal:// is the common scheme in calendar apps — normalize to https.
  const normalized = raw.replace(/^webcal:\/\//i, 'https://')
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return Response.json({ error: "URL invalide" }, { status: 400 })
  }
  if (parsed.protocol !== 'https:') {
    return Response.json(
      { error: "Seules les URLs HTTPS sont acceptées (pas de données en clair)" },
      { status: 400 }
    )
  }

  const { data: profile } = await createServiceClient()
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()
  const userTz = (profile?.timezone as string | undefined) ?? 'UTC'

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 10_000)
  let rawText: string
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { Accept: 'text/calendar' },
    })
    if (!res.ok) throw new Error(`Flux ICS inaccessible (${res.status})`)
    rawText = await res.text()
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur réseau"
    return Response.json({ error: `Impossible de lire le flux : ${message}` }, { status: 502 })
  } finally {
    clearTimeout(t)
  }

  if (!rawText.includes('BEGIN:VCALENDAR')) {
    return Response.json(
      { error: "Ce flux ne contient pas de calendrier ICS valide" },
      { status: 400 }
    )
  }
  const events = parseIcs(rawText, userTz)
  if (events.length === 0) {
    return Response.json(
      { error: "Le flux est valide mais ne contient aucun événement" },
      { status: 400 }
    )
  }

  const service = createServiceClient()
  const { data: conn, error: connErr } = await service
    .from('calendar_connections')
    .upsert(
      {
        user_id: user.id,
        provider: 'ics',
        external_account_id: parsed.toString(),
        display_name: body.name?.trim().slice(0, 120) || parsed.hostname,
        enabled: true,
        sync_mode: 'read',
        sync_error: null,
      },
      { onConflict: 'user_id,provider,external_account_id' }
    )
    .select('id')
    .single()
  if (connErr || !conn) {
    return Response.json(
      { error: "Enregistrement de l'abonnement impossible" },
      { status: 500 }
    )
  }

  return Response.json({ ok: true, id: conn.id, events: events.length })
}
