import { createServiceClient } from '@/lib/supabase/service'
import { buildCoachContext } from '@/lib/coach/context'
import {
  sendPushNotification,
  parsePushPrefs,
  isQuietHours,
  type PushSubscriptionRow,
} from '@/lib/web-push/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/briefs
 *
 * Server-side, scheduled Morning / Evening / Weekly briefs (ÉTAPE 15.5 §14).
 *
 * Honest architecture — this endpoint does NOT pretend to run on its own.
 * It must be triggered by an external scheduler:
 *   - Vercel Cron (see vercel.json) or
 *   - any external cron hitting POST /api/cron/briefs with the header
 *     `x-cron-secret: <CRON_SECRET>`.
 *
 * It sends REAL data-driven briefs via Web Push to users who opted in, and
 * respects: quiet hours, per-type daily dedupe, the daily cap, and dead
 * subscription cleanup. Requires (server env): SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY,
 * CRON_SECRET.
 */

const DAILY_PUSH_CAP = 6

/**
 * FUSEAUX HORAIRES : Vercel exécute les crons en UTC (vercel.json : 07:00,
 * 20:00 et lundi 08:00 UTC). Le serveur tourne donc en UTC : `getHours()`
 * ci-dessous reflète l'heure UTC, et les fenêtres sont alignées sur ces
 * créneaux (matin 5-11h UTC, soir ≥19h UTC, hebdo lundi ≥8h UTC).
 * Aucune timezone utilisateur n'est gérée pour l'instant — les briefs
 * partent à l'heure UTC, quelle que soit la timezone du destinataire.
 */
function dueBriefType(now = new Date(), prefs: ReturnType<typeof parsePushPrefs>) {
  const h = now.getHours()
  const day = now.getDay()
  if (h >= 5 && h <= 11 && prefs.morning) return 'morning' as const
  if (h >= 19 && prefs.evening) return 'evening' as const
  if (day === 1 && h >= 8 && prefs.weekly) return 'weekly' as const
  return null
}

export async function POST(req: Request) {
  // Gate: only the configured secret can trigger scheduled sends.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json(
      { error: 'CRON_SECRET non configuré — planification désactivée.' },
      { status: 503 }
    )
  }
  const header =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (header !== secret) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const now = new Date()
    const dayStart = now.toISOString().slice(0, 10) + 'T00:00:00.000Z'

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth_key, prefs')

    if (!subs || subs.length === 0) {
      return Response.json({ ok: true, users: 0, sent: 0, skipped: 0 })
    }

    const byUser = new Map<string, PushSubscriptionRow[]>()
    for (const s of subs as (PushSubscriptionRow & { user_id: string })[]) {
      const list = byUser.get(s.user_id) ?? []
      list.push(s)
      byUser.set(s.user_id, list)
    }

    let users = 0
    let sent = 0
    let skipped = 0

    for (const [userId, userSubs] of byUser) {
      const prefs = parsePushPrefs(userSubs[0]?.prefs)
      const briefType = dueBriefType(now, prefs)
      if (!briefType) {
        skipped++
        continue
      }
      if (isQuietHours(now, prefs.quietStart, prefs.quietEnd)) {
        skipped++
        continue
      }

      // Per-type daily dedupe (the scheduler may fire more than once).
      const { count: todayCount } = await supabase
        .from('push_send_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('kind', 'push')
        .gte('sent_at', dayStart)
      if ((todayCount ?? 0) >= DAILY_PUSH_CAP) {
        skipped++
        continue
      }
      const { data: already } = await supabase
        .from('push_send_log')
        .select('id')
        .eq('user_id', userId)
        .eq('kind', 'push')
        .eq('brief_type', briefType)
        .gte('sent_at', dayStart)
        .limit(1)
      if (already && already.length > 0) {
        skipped++
        continue
      }

      // Real data, real user — never invented.
      const ctx = await buildCoachContext(supabase, userId)
      let title: string
      let body: string
      let link: string
      if (briefType === 'morning') {
        const bits: string[] = []
        if (ctx.priorityTasksRemaining > 0)
          bits.push(`${ctx.priorityTasksRemaining} priorité${ctx.priorityTasksRemaining > 1 ? 's' : ''}`)
        if (ctx.eventsToday > 0)
          bits.push(`${ctx.eventsToday} événement${ctx.eventsToday > 1 ? 's' : ''}`)
        if (ctx.habitsTotal > 0)
          bits.push(`${ctx.habitsTotal} habitude${ctx.habitsTotal > 1 ? 's' : ''}`)
        title = '☀️ Bonjour !'
        body =
          bits.length > 0
            ? `Aujourd’hui : ${bits.join(', ')}.`
            : 'Rien de prévu aujourd’hui. Une belle page blanche.'
        link = '/dashboard'
      } else if (briefType === 'evening') {
        const bits: string[] = []
        if (ctx.tasksCompleted > 0)
          bits.push(`${ctx.tasksCompleted} tâche${ctx.tasksCompleted > 1 ? 's' : ''} terminée${ctx.tasksCompleted > 1 ? 's' : ''}`)
        if (ctx.focusMinutesToday > 0) bits.push(`${ctx.focusMinutesToday} min de Focus`)
        if (ctx.habitsDoneToday > 0)
          bits.push(`${ctx.habitsDoneToday} habitude${ctx.habitsDoneToday > 1 ? 's' : ''}`)
        title = '🌙 Bilan de ta journée'
        body =
          bits.length > 0
            ? `${bits.join(', ')}. Demain se prépare maintenant.`
            : 'Une journée douce. Demain se prépare maintenant.'
        link = '/journal'
      } else {
        title = '📊 Ta semaine'
        body = ctx.tasksCompleted > 0 || ctx.focusMinutesToday > 0
          ? 'Tes statistiques t’attendent. Garde le cap cette semaine.'
          : 'Planifie ta semaine avec le coach et garde le cap.'
        link = '/ai'
      }

      let userSent = 0
      for (const sub of userSubs) {
        const result = await sendPushNotification(sub, {
          title,
          body,
          link,
          tag: `kininaru-brief-${briefType}`,
        })
        if (result === 'sent') userSent++
        else if (result === 'gone') {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }

      await supabase.from('push_send_log').insert({
        user_id: userId,
        kind: 'push',
        brief_type: briefType,
      })

      if (userSent > 0) {
        users++
        sent += userSent
      } else {
        skipped++
      }
    }

    return Response.json({ ok: true, users, sent, skipped })
  } catch (err) {
    console.error('[Kininaru] cron briefs failed:', err)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
