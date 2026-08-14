import { createClient } from '@/lib/supabase/server'
import {
  sendPushNotification,
  parsePushPrefs,
  isQuietHours,
  buildActionsForLink,
  type PushSubscriptionRow,
} from '@/lib/web-push/server'

export const runtime = 'nodejs'

/**
 * POST /api/push/send
 *
 * Sends a real Web Push to every device the authenticated user subscribed
 * on. Respectful rules (ÉTAPE 15.5 §10):
 * - `kind: 'test'`   → always sent (explicit user gesture, never counted).
 * - `kind: 'push'`   → gated by quiet hours + a daily cap (durable
 *   push_send_log), so the server can never spam.
 * Dead subscriptions (HTTP 404/410) are deleted automatically.
 */

const MAX_TITLE = 120
const MAX_BODY = 500
const MAX_LINK = 200
const MAX_KIND = 10
const DAILY_PUSH_CAP = 6

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
      title?: unknown
      body?: unknown
      link?: unknown
      kind?: unknown
    }

    const title = typeof body.title === 'string' ? body.title.trim().slice(0, MAX_TITLE) : ''
    if (!title) return Response.json({ error: 'Titre manquant' }, { status: 400 })

    const kind = typeof body.kind === 'string' ? body.kind.slice(0, MAX_KIND) : 'push'
    const isTest = kind === 'test'
    const message =
      typeof body.body === 'string' ? body.body.trim().slice(0, MAX_BODY) : undefined
    const link =
      typeof body.link === 'string' && body.link.startsWith('/')
        ? body.link.slice(0, MAX_LINK)
        : undefined

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key, prefs')
      .eq('user_id', user.id)

    if (error) return Response.json({ error: 'Lecture impossible' }, { status: 500 })
    const subs = (subscriptions ?? []) as unknown as PushSubscriptionRow[]
    if (subs.length === 0) {
      return Response.json({ error: 'Aucun appareil abonné' }, { status: 404 })
    }

    // Respectful rules for real notifications (test bypasses them).
    if (!isTest) {
      const prefs = parsePushPrefs(subs[0]?.prefs)
      if (isQuietHours(new Date(), prefs.quietStart, prefs.quietEnd)) {
        return Response.json(
          { error: 'Heures silencieuses : notification non envoyée.' },
          { status: 429 }
        )
      }
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('push_send_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('kind', 'push')
        .gte('sent_at', dayStart.toISOString())
      if ((count ?? 0) >= DAILY_PUSH_CAP) {
        return Response.json(
          { error: 'Limite quotidienne de notifications atteinte.' },
          { status: 429 }
        )
      }
    }

    // Instant, actionable notifications: every push carries the action
    // buttons matching its deep link (Commencer / Plus tard / Ouvrir), so
    // the OS shows them immediately and the SW routes the tap (§14).
    const actions = buildActionsForLink(link)
    const payload = {
      title,
      body: message,
      link,
      tag: 'kininaru',
      actions,
      // Subtle haptic pulse on devices that support it (never intrusive).
      vibrate: [80, 60, 80],
    }
    let sent = 0
    let failed = 0

    for (const sub of subs) {
      const result = await sendPushNotification(sub, payload)
      if (result === 'sent') {
        sent++
      } else if (result === 'gone') {
        // Dead subscription — clean it up.
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        failed++
      }
    }

    // Log the send (durable daily cap; test rows are never counted).
    await supabase.from('push_send_log').insert({ user_id: user.id, kind })

    return Response.json({ ok: true, sent, failed })
  } catch {
    return Response.json({ error: 'Service indisponible' }, { status: 500 })
  }
}
