import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/push/subscribe
 *
 * Stores the authenticated user's PushSubscription (endpoint + keys) in
 * push_subscriptions (RLS-scoped). Upserts on the unique endpoint so
 * re-subscribing never duplicates rows. Every field is validated and
 * length-capped server-side.
 */

const MAX_ENDPOINT = 500
const MAX_KEY = 512
const MAX_PREFS = 10_000

function sanitizePrefs(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (typeof raw !== 'object' || raw === null) return out
  const r = raw as Record<string, unknown>
  for (const key of ['morning', 'evening', 'weekly', 'coach']) {
    if (typeof r[key] === 'boolean') out[key] = r[key]
  }
  for (const key of ['quietStart', 'quietEnd']) {
    const n = typeof r[key] === 'number' && Number.isFinite(r[key]) ? r[key] : undefined
    if (typeof n === 'number') out[key] = Math.max(0, Math.min(23, Math.round(n)))
  }
  return out
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      endpoint?: unknown
      keys?: unknown
      prefs?: unknown
    }

    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
    if (!endpoint.startsWith('https://') || endpoint.length > MAX_ENDPOINT) {
      return Response.json({ error: 'Endpoint invalide' }, { status: 400 })
    }

    const keys =
      typeof body.keys === 'object' && body.keys !== null
        ? (body.keys as Record<string, unknown>)
        : {}
    const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : ''
    const authKey = typeof keys.auth === 'string' ? keys.auth : ''
    if (!p256dh || p256dh.length > MAX_KEY || !authKey || authKey.length > MAX_KEY) {
      return Response.json({ error: 'Clés de poussée invalides' }, { status: 400 })
    }

    const rawPrefs = body.prefs ?? {}
    const prefs = sanitizePrefs(rawPrefs)
    if (JSON.stringify(prefs).length > MAX_PREFS) {
      return Response.json({ error: 'Préférences invalides' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth_key: authKey,
        prefs,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

    if (error) {
      return Response.json({ error: 'Abonnement impossible' }, { status: 500 })
    }
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Service indisponible' }, { status: 500 })
  }
}
