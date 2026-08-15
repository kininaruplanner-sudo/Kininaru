import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getProvider } from '@/lib/calendar/providers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/calendar/:provider/disconnect
 *
 * Server-side disconnection: deletes the connection, its sync mapping and
 * the auto-imported events (all owned by the authenticated user). The
 * client only sends the connection id — it cannot delete or alter
 * connections directly (supabase/calendar-security.sql).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  if (!getProvider(provider)) {
    return Response.json({ error: "Fournisseur inconnu" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Connectez-vous d'abord." }, { status: 401 })
  }

  let body: { connectionId?: string } = {}
  try {
    body = (await req.json()) as { connectionId?: string }
  } catch {
    body = {}
  }
  if (!body.connectionId) {
    return Response.json({ error: "connectionId requis" }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: conn } = await service
    .from('calendar_connections')
    .select('id')
    .eq('id', body.connectionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!conn) {
    return Response.json({ error: "Connexion introuvable" }, { status: 404 })
  }

  const { data: synced } = await service
    .from('calendar_synced_events')
    .select('event_id')
    .eq('connection_id', conn.id)
  const eventIds = (synced ?? []).map((r) => r.event_id).filter(Boolean)
  if (eventIds.length > 0) {
    await service.from('events').delete().in('id', eventIds)
  }
  await service.from('calendar_synced_events').delete().eq('connection_id', conn.id)
  await service.from('calendar_connections').delete().eq('id', conn.id)

  return Response.json({ ok: true })
}
