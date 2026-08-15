import { runDueBriefs } from '@/lib/web-push/briefs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/briefs
 *
 * Envoie les briefs dus (matin / soir / hebdo) à tous les utilisateurs
 * opt-in. Le type de brief est déduit de l'heure UTC courante
 * (voir lib/web-push/briefs.ts — dueBriefType), avec déduplication par
 * type et par jour : le même endpoint peut donc être appelé plusieurs
 * fois par jour sans jamais envoyer deux fois le même brief.
 *
 * Trigger (architectures compatibles Vercel Hobby — voir README) :
 *  - Vercel Cron : UNE seule exécution par jour max sur Hobby → le cron
 *    unique `0 7 * * *` pointe sur /api/cron/daily (brief du matin +
 *    maintenance). Ce route reste disponible pour les schedulers externes.
 *  - Supabase pg_cron (gratuit) : brief du soir 20:00 UTC, hebdo lundi
 *    08:00 UTC, rappels toutes les 15 min (supabase/scheduler.sql).
 *  - Tout autre cron externe : même protocole.
 *
 * Sécurité : uniquement avec `x-cron-secret: <CRON_SECRET>` (ou en-tête
 * Authorization: Bearer <CRON_SECRET>) — jamais exécutable librement.
 */

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
    const result = await runDueBriefs()
    return Response.json({ ok: true, ...result })
  } catch (err) {
    console.error('[Kininaru] cron briefs failed:', err)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
