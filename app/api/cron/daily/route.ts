import { runDueBriefs } from '@/lib/web-push/briefs'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/daily — le cron Vercel UNIQUE, compatible Hobby.
 *
 * Vercel Hobby autorise au maximum UNE exécution de cron par jour
 * (±59 min de précision). Tout le travail « une fois par jour » passe donc
 * par cet endpoint unique, déclaré dans vercel.json :
 *
 *   { "path": "/api/cron/daily", "schedule": "0 7 * * *" }   (07:00 UTC)
 *
 * Il fait, dans l'ordre :
 *  1. les briefs dus à cette heure (matin, 5-11h UTC) — même logique que
 *     /api/cron/briefs, dédupliquée par type/jour ;
 *  2. la maintenance légère : purge des logs push et de la file de sync
 *     de plus de 30 jours, et des notifications Lues de plus de 30 jours.
 *     Jamais de donnée utilisateur : tâches, objectifs, habitudes, journal
 *     et mémoires ne sont jamais touchés.
 *
 * Les besoins horaires (brief du soir, brief hebdo, rappels temporels)
 * sont couverts par Supabase pg_cron (gratuit, sans limite Hobby) via
 * `supabase/scheduler.sql` — voir README → « Architecture des crons ».
 *
 * Sécurité : uniquement avec `x-cron-secret: <CRON_SECRET>`.
 */

const LOG_RETENTION_DAYS = 30

async function runMaintenance() {
  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const purged: Record<string, number> = {}

  // Logs d'envoi push (déduplication) — purge des anciennes entrées.
  const { data: pushRows } = await supabase
    .from('push_send_log')
    .delete()
    .lt('sent_at', cutoff)
    .select('id')
  purged.push_send_log = pushRows?.length ?? 0

  // File de synchronisation hors ligne — les opérations réglées sont
  // archivées côté serveur ; on ne garde que les 30 derniers jours.
  const { data: syncRows } = await supabase
    .from('sync_queue')
    .delete()
    .lt('created_at', cutoff)
    .select('id')
  purged.sync_queue = syncRows?.length ?? 0

  // Notifications Lues anciennes (la cloche n'a plus besoin de les montrer).
  const { data: notifRows } = await supabase
    .from('notifications')
    .delete()
    .eq('read', true)
    .lt('created_at', cutoff)
    .select('id')
  purged.notifications = notifRows?.length ?? 0

  return purged
}

export async function POST(req: Request) {
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
    const [briefs, maintenance] = await Promise.all([runDueBriefs(), runMaintenance()])
    return Response.json({ ok: true, briefs, maintenance })
  } catch (err) {
    console.error('[Kininaru] cron daily failed:', err)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
