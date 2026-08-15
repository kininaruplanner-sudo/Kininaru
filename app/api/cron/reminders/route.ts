import { createServiceClient } from '@/lib/supabase/service'
import {
  sendPushNotification,
  parsePushPrefs,
  isQuietHours,
  buildActionsForLink,
  PUSH_DAILY_CAP,
  type PushSubscriptionRow,
} from '@/lib/web-push/server'
import { localDateKey, localToUtcDate, minutesBetween } from '@/lib/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/reminders
 *
 * Boucle proactive PLAN → REMIND — côté serveur.
 *
 * Trigger : Supabase pg_cron toutes les 15 min (supabase/scheduler.sql,
 * gratuit, compatible Vercel Hobby — Vercel ne permet qu'un cron/jour sur
 * Hobby) ou tout cron externe avec l'en-tête `x-cron-secret: <CRON_SECRET>`.
 *
 * Pour chaque appareil abonné au push (opt-in), on regarde les données RÉELLES
 * du jour :
 *   - tâches planifiées (due_date = aujourd'hui LOCAL de l'utilisateur,
 *     scheduled_time renseigné, non terminées) dont l'heure est dans les
 *     10 prochaines minutes (« commence dans 10 minutes ») ou dépassée de
 *     moins de 35 min (« était prévue à HH:MM ») ;
 *   - événements commençant dans les 15 prochaines minutes.
 *
 * FUSEAUX HORAIRES (cf. lib/time.ts) : scheduled_time est une heure mur
 * « HH:MM » dans le fuseau de l'utilisateur (profiles.timezone, nom IANA).
 * La conversion en instant UTC exact se fait via localToUtcDate — jamais
 * de comparaison naïve getHours()/getUTCHours(). Tant que profiles.timezone
 * est NULL (SQL timezone.sql pas appliqué, ou utilisateur jamais passé sur
 * l'app), le serveur retombe sur UTC (comportement historique documenté).
 *
 * Anti-spam identique au reste du produit : heures silencieuses, cap
 * journalier (selon la fréquence choisie), déduplication par tâche/jour
 * (push_send_log.reminder_key), nettoyage des abonnements morts.
 */

const BATCH = 200
const LEAD_MINUTES = 10
const LATE_WINDOW_MINUTES = 35

interface ReminderCandidate {
  kind: 'task' | 'event'
  id: string
  title: string
  body: string
  link: string
  reminderKey: string
}

function buildCandidates(
  tasks: unknown[],
  events: unknown[],
  now: Date,
  todayKey: string,
  tz: string
): ReminderCandidate[] {
  const out: ReminderCandidate[] = []

  for (const raw of tasks as {
    id: string
    title: string
    status: string
    due_date: string | null
    scheduled_time: string | null
  }[]) {
    if (raw.status === 'done' || raw.due_date !== todayKey || !raw.scheduled_time) continue
    const target = localToUtcDate(todayKey, raw.scheduled_time, tz)
    if (Number.isNaN(target.getTime())) continue
    const diff = minutesBetween(now, target)
    if (diff < -LEAD_MINUTES || diff > LATE_WINDOW_MINUTES) continue
    const hhmm = raw.scheduled_time.slice(0, 5)
    out.push({
      kind: 'task',
      id: raw.id,
      title:
        diff < 0
          ? `🎯 « ${raw.title} » commence dans ${Math.abs(diff)} min`
          : `⏰ ${raw.title} était prévu·e à ${hhmm}`,
      body: diff < 0 ? "Prêt·e à t'y mettre ?" : "On commence maintenant ou on le déplace ?",
      link: `/focus?taskId=${raw.id}&task=${encodeURIComponent(raw.title)}`,
      reminderKey: `task:${raw.id}:${todayKey}`,
    })
  }

  for (const raw of events as { id: string; title: string; start_at: string }[]) {
    const diff = minutesBetween(now, new Date(raw.start_at))
    if (diff < 0 || diff > LEAD_MINUTES + 5) continue
    out.push({
      kind: 'event',
      id: raw.id,
      title: `📅 ${raw.title} commence dans ${diff <= 1 ? 'quelques instants' : `${Math.round(diff)} min`}`,
      body: 'Le coach peut t’aider à préparer la suite.',
      link: '/calendar',
      reminderKey: `event:${raw.id}:${localDateKey(tz, now)}`,
    })
  }
  return out
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json(
      { error: 'CRON_SECRET non configuré — planification désactivée.' },
      { status: 503 }
    )
  }
  if (req.headers.get('x-cron-secret') !== secret) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()

  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key, prefs, user_id')
    .limit(BATCH)

  if (subsErr) {
    return Response.json({ error: 'Lecture des abonnements impossible' }, { status: 500 })
  }
  const subscriptions = (subs ?? []) as unknown as (PushSubscriptionRow & { user_id: string })[]
  if (subscriptions.length === 0) {
    return Response.json({ ok: true, checked: 0, sent: 0 })
  }

  // Fuseau horaire explicite de chaque utilisateur (IANA), si renseigné.
  const ids = [...new Set(subscriptions.map((s) => s.user_id))]
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, timezone')
    .in('id', ids)
  const tzByUser = new Map<string, string>(
    (profs ?? []).map((p) => [p.id as string, (p.timezone as string | null) ?? 'UTC'])
  )

  let sent = 0
  let skipped = 0

  for (const sub of subscriptions) {
    const prefs = parsePushPrefs(sub.prefs)
    // Opt-in coach : si l'utilisateur a désactivé les notifications coach,
    // les rappels temporels ne partent pas non plus.
    if (!prefs.coach) {
      skipped++
      continue
    }
    if (isQuietHours(new Date(), prefs.quietStart, prefs.quietEnd)) {
      skipped++
      continue
    }

    const tz = tzByUser.get(sub.user_id) ?? 'UTC'
    const todayKey = localDateKey(tz, now)

    // Données réelles du jour (service role, jamais de données d'autrui).
    const [{ data: tasks }, { data: events }] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, status, due_date, scheduled_time')
        .eq('user_id', sub.user_id)
        .eq('due_date', todayKey)
        .in('status', ['todo', 'in_progress']),
      supabase
        .from('events')
        .select('id, title, start_at')
        .eq('user_id', sub.user_id)
        .gte('start_at', now.toISOString())
        .lte('start_at', new Date(Date.now() + 20 * 60_000).toISOString()),
    ])

    const candidates = buildCandidates(tasks ?? [], events ?? [], now, todayKey, tz)
    if (candidates.length === 0) {
      skipped++
      continue
    }

    // Déduplication : une seule notification par tâche/événement et par jour.
    const keys = candidates.map((c) => c.reminderKey)
    const { data: already } = await supabase
      .from('push_send_log')
      .select('reminder_key')
      .eq('user_id', sub.user_id)
      .in('reminder_key', keys)
    const seen = new Set((already ?? []).map((r) => r.reminder_key))
    const due = candidates.filter((c) => !seen.has(c.reminderKey))
    if (due.length === 0) {
      skipped++
      continue
    }

    // Cap journalier (compte les 'push' du jour, briefs inclus).
    const dayStart = new Date()
    dayStart.setUTCHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('push_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sub.user_id)
      .eq('kind', 'push')
      .gte('sent_at', dayStart.toISOString())
    if ((count ?? 0) >= PUSH_DAILY_CAP[prefs.frequency]) {
      skipped++
      continue
    }

    // Une seule notification par tick — les tâches passent avant les
    // événements, et parmi elles la plus imminente.
    const pick = due.sort((a, b) => {
      const ta = a.kind === 'task' ? 0 : 1
      const tb = b.kind === 'task' ? 0 : 1
      return ta - tb || a.title.localeCompare(b.title)
    })[0]
    const payload = {
      title: pick.title.slice(0, 120),
      body: pick.body.slice(0, 500),
      link: pick.link,
      tag: `kininaru-${pick.kind}-${pick.id}`,
      actions: buildActionsForLink(pick.link),
      vibrate: [80, 60, 80],
    }

    const result = await sendPushNotification(sub, payload)
    if (result === 'sent') {
      sent++
      await supabase.from('push_send_log').insert({
        user_id: sub.user_id,
        kind: 'push',
        brief_type: 'reminder',
        reminder_key: pick.reminderKey,
      })
    } else if (result === 'gone') {
      await supabase.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }

  return Response.json({ ok: true, checked: subscriptions.length, sent, skipped })
}
