import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/push/unsubscribe
 *
 * Removes the authenticated user's subscription row for the given endpoint
 * (RLS-scoped to their own rows). Deleting an already-absent row is a
 * successful no-op — the endpoint is idempotent.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { endpoint?: unknown }
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
    if (!endpoint.startsWith('https://') || endpoint.length > 500) {
      return Response.json({ error: 'Endpoint invalide' }, { status: 400 })
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', user.id)

    if (error) {
      return Response.json({ error: 'Désabonnement impossible' }, { status: 500 })
    }
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Service indisponible' }, { status: 500 })
  }
}
