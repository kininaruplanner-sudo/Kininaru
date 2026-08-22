import { createClient } from '@/lib/supabase/server'
import { isRateLimited } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'

/**
 * POST /api/coach/notify
 *
 * Inserts an in-app notification (the sidebar bell) for the signed-in user.
 * Used by the daily/weekly briefs. The browser Notification API is fired
 * client-side (permission-gated); this endpoint only persists the bell row,
 * which RLS scopes to the authenticated user.
 */

const MAX_TITLE = 120
const MAX_BODY = 500
const RATE_LIMIT_MAX = 30

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (await isRateLimited('coach-notify', user.id, RATE_LIMIT_MAX)) {
      return Response.json({ error: 'Trop de requêtes. Réessaie dans un instant.' }, { status: 429 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: unknown
      body?: unknown
      link?: unknown
    }

    if (typeof body.title !== 'string' || !body.title.trim()) {
      return Response.json({ error: 'Titre manquant' }, { status: 400 })
    }
    const title = body.title.trim().slice(0, MAX_TITLE)
    const message =
      typeof body.body === 'string' ? body.body.trim().slice(0, MAX_BODY) : null
    const link =
      typeof body.link === 'string' && body.link.startsWith('/') ? body.link.slice(0, 200) : null

    const { data, error } = await supabase
      .from('notifications')
      .insert({ user_id: user.id, type: 'info', title, body: message, link })
      .select('id')
      .single()

    if (error) {
      return Response.json({ error: 'Insertion impossible' }, { status: 500 })
    }

    return Response.json({ ok: true, id: (data as { id: string }).id })
  } catch {
    return Response.json({ error: 'Service indisponible' }, { status: 500 })
  }
}
