import { createServiceClient } from '@/lib/supabase/service'
import { buildCoachContext } from '@/lib/coach/context'
import {
  sendPushNotification,
  parsePushPrefs,
  isQuietHours,
  PUSH_DAILY_CAP,
  type PushSubscriptionRow,
} from './server'

/**
 * Briefs matin / soir / hebdo — logique partagée.
 *
 * Utilisée par :
 *  - POST /api/cron/briefs  (appelé par les schedulers externes — Vercel Cron
 *    ou pg_cron Supabase — aux heures voulues) ;
 *  - POST /api/cron/daily   (cron Vercel Hobby unique, 07:00 UTC) qui déclenche
 *    aussi la maintenance quotidienne.
 *
 * Le type de brief est déduit de l'heure UTC courante (dueBriefType) :
 * matin 5-11h, soir >=19h, hebdo lundi >=8h. La déduplication par type et par
 * jour (push_send_log) garantit qu'une seule notification part, même si deux
 * schedulers se chevauchent. Rien n'est jamais inventé : chaque brief est
 * construit depuis le contexte RÉEL de l'utilisateur (buildCoachContext).
 */

export type BriefType = 'morning' | 'evening' | 'weekly'

/** Fuseaux alignés sur les créneaux des schedulers (UTC). */
export function dueBriefType(now = new Date(), prefs: ReturnType<typeof parsePushPrefs>) {
  const h = now.getHours()
  const day = now.getDay()
  if (h >= 5 && h <= 11 && prefs.morning) return 'morning' as const
  if (h >= 19 && prefs.evening) return 'evening' as const
  if (day === 1 && h >= 8 && prefs.weekly) return 'weekly' as const
  return null
}

export interface BriefRunResult {
  users: number
  sent: number
  skipped: number
}

/** Envoie les briefs dus en ce moment à tous les utilisateurs opt-in. */
export async function runDueBriefs(now = new Date()): Promise<BriefRunResult> {
  const supabase = createServiceClient()
  const dayStart = now.toISOString().slice(0, 10) + 'T00:00:00.000Z'

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth_key, prefs')

  if (!subs || subs.length === 0) {
    return { users: 0, sent: 0, skipped: 0 }
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

    // Cap quotidien + déduplication par type (le scheduler peut tirer plusieurs fois).
    const { count: todayCount } = await supabase
      .from('push_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', 'push')
      .gte('sent_at', dayStart)
    if ((todayCount ?? 0) >= PUSH_DAILY_CAP[prefs.frequency]) {
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

    // Données réelles, jamais inventées.
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

  return { users, sent, skipped }
}
