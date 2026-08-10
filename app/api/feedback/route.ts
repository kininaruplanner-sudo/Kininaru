import { createClient } from '@/lib/supabase/server'
import { notifyAdminOfFeedback } from '@/lib/feedback/admin-notify'
import { APP_VERSION } from '@/lib/version'

export const runtime = 'nodejs'

/**
 * POST /api/feedback
 *
 * Reçoit un retour utilisateur (bug ou suggestion) depuis
 * Paramètres → Aider à améliorer Kininaru.
 *
 * Sécurité :
 * - Session obligatoire (le formulaire n'existe que côté connecté).
 * - `user_id` est TOUJOURS posé depuis la session serveur — jamais lu dans
 *   le payload client. L'insertion passe ensuite par RLS (auth.uid()).
 * - Chaque champ est validé contre une whitelist stricte + limites de
 *   longueur (aucune donnée arbitraire ne peut entrer dans la table).
 * - `app_version` est posé côté serveur (lib/version), jamais par le client.
 * - Notification admin : après l'insertion, un email fire-and-forget est
 *   envoyé via SendGrid (`SENDGRID_API_KEY`) à `ADMIN_FEEDBACK_EMAIL`
 *   (contenu + catégories + infos de diagnostic non sensibles). La clé
 *   SendGrid ne quitte jamais le serveur. Une erreur d'envoi n'empêche
 *   JAMAIS l'enregistrement du retour.
 * - Notifications webhook optionnelles : si `ADMIN_FEEDBACK_WEBHOOK_URL`
 *   est défini, un POST fire-and-forget est envoyé à cette URL en plus.
 */

const MAX_TEXT = 2000
const MAX_STEPS = 2000
const MAX_URL = 500
const MAX_UA = 200

const BUG_CATEGORIES = new Set(['bug', 'feature-not-working', 'display', 'login', 'ai', 'other'])
const SUGGESTION_CATEGORIES = new Set(['new-feature', 'improvement', 'design', 'ai', 'performance', 'other'])
const SEVERITIES = new Set(['low', 'medium', 'high', 'blocking'])

interface FeedbackBody {
  kind?: unknown
  category?: unknown
  description?: unknown
  steps_to_reproduce?: unknown
  severity?: unknown
  page_url?: unknown
  browser?: unknown
  device?: unknown
}

function cleanText(v: unknown, max: number, required = false): { value?: string; error?: string } {
  if (v === undefined || v === null) {
    return required ? { error: 'Contenu manquant' } : { value: '' }
  }
  if (typeof v !== 'string') return { error: 'Contenu invalide' }
  const trimmed = v.trim()
  if (required && trimmed.length === 0) return { error: 'Contenu manquant' }
  if (trimmed.length > max) return { error: 'Contenu trop long' }
  return { value: trimmed }
}

function cleanPageUrl(v: unknown): { value?: string | null; error?: string } {
  if (v === undefined || v === null || v === '') return { value: null }
  if (typeof v !== 'string' || v.length > MAX_URL) return { error: 'Page invalide' }
  const trimmed = v.trim()
  if (!trimmed.startsWith('/')) return { error: 'Page invalide' }
  return { value: trimmed.slice(0, MAX_URL) }
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

    const body = (await req.json().catch(() => ({}))) as FeedbackBody

    const kind = body.kind
    if (kind !== 'bug' && kind !== 'suggestion') {
      return Response.json({ error: 'Type de retour invalide' }, { status: 400 })
    }

    const categorySet = kind === 'bug' ? BUG_CATEGORIES : SUGGESTION_CATEGORIES
    const category = typeof body.category === 'string' ? body.category : ''
    if (!categorySet.has(category)) {
      return Response.json({ error: 'Catégorie invalide' }, { status: 400 })
    }

    const description = cleanText(body.description, MAX_TEXT, true)
    if (description.error) {
      return Response.json({ error: description.error }, { status: 400 })
    }

    const steps = cleanText(body.steps_to_reproduce, MAX_STEPS)
    if (steps.error) {
      return Response.json({ error: steps.error }, { status: 400 })
    }

    let severity: string | undefined
    if (body.severity !== undefined && body.severity !== null && body.severity !== '') {
      if (typeof body.severity !== 'string' || !SEVERITIES.has(body.severity)) {
        return Response.json({ error: 'Gravité invalide' }, { status: 400 })
      }
      severity = body.severity
    }

    const pageUrl = cleanPageUrl(body.page_url)
    if (pageUrl.error) {
      return Response.json({ error: pageUrl.error }, { status: 400 })
    }

    const browser = cleanText(body.browser, MAX_UA)
    if (browser.error) return Response.json({ error: browser.error }, { status: 400 })

    const device = cleanText(body.device, MAX_UA)
    if (device.error) return Response.json({ error: device.error }, { status: 400 })

    const { error: insertError } = await supabase.from('feedback').insert({
      user_id: user.id, // depuis la session, jamais du client
      kind,
      category,
      description: description.value,
      steps_to_reproduce: steps.value || null,
      severity: severity ?? null,
      page_url: pageUrl.value ?? null,
      app_version: APP_VERSION, // posé côté serveur
      browser: browser.value || null,
      device: device.value || null,
      status: 'new',
    })

    if (insertError) {
      console.error('[Kininaru] feedback insert failed:', insertError.message)
      return Response.json({ error: 'Impossible d’envoyer le retour' }, { status: 500 })
    }

    // Notification admin — email via SendGrid (fire-and-forget : un échec
    // d'envoi ne fait jamais échouer l'enregistrement du retour).
    void notifyAdminOfFeedback({
      kind,
      category,
      description: description.value || '',
      steps_to_reproduce: steps.value || null,
      severity: severity ?? null,
      page_url: pageUrl.value ?? null,
      app_version: APP_VERSION,
      browser: browser.value || null,
      device: device.value || null,
      user_id: user.id,
      created_at: new Date().toISOString(),
    })

    // Notification webhook optionnelle (en plus de l'email).
    const webhook = process.env.ADMIN_FEEDBACK_WEBHOOK_URL
    if (webhook) {
      void fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          category,
          description: description.value,
          steps_to_reproduce: steps.value || undefined,
          severity: severity || undefined,
          page_url: pageUrl.value || undefined,
          app_version: APP_VERSION,
          browser: browser.value || undefined,
          device: device.value || undefined,
          created_at: new Date().toISOString(),
        }),
      }).catch(() => {
        // Fire-and-forget : un webhook injoignable ne doit jamais faire
        // échouer l'enregistrement du retour.
      })
    }

    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Service indisponible' }, { status: 500 })
  }
}
