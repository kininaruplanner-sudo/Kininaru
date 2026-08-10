/**
 * Kininaru — notification email administrateur à chaque nouveau retour.
 *
 * Serveur uniquement (jamais importé côté client). Envoie un email à
 * l'adresse administrateur (`ADMIN_FEEDBACK_EMAIL`) via SendGrid
 * (`SENDGRID_API_KEY`) avec le contenu du retour et les informations
 * de diagnostic NON sensibles (page, navigateur, appareil, version).
 *
 * Sécurité :
 * - La clé SendGrid ne quitte jamais le serveur (variable d'environnement).
 * - L'adresse destinataire est configurée via env, jamais codée en dur.
 * - Aucune donnée privée n'est envoyée : uniquement ce que l'utilisateur
 *   a explicitement soumis dans le formulaire + métadonnées techniques.
 * - Ne lève JAMAIS : une erreur d'envoi ne doit pas faire échouer
 *   l'enregistrement du retour dans Supabase.
 */

import sgMail from '@sendgrid/mail'

export interface AdminFeedbackEmail {
  kind: 'bug' | 'suggestion'
  category: string
  description: string
  steps_to_reproduce?: string | null
  severity?: string | null
  page_url?: string | null
  app_version?: string | null
  browser?: string | null
  device?: string | null
  user_id?: string | null
  created_at: string
}

const KIND_LABELS: Record<'bug' | 'suggestion', { emoji: string; label: string }> = {
  bug: { emoji: '🐛', label: 'Bug signalé' },
  suggestion: { emoji: '💡', label: 'Suggestion' },
}

const CATEGORY_LABELS: Record<string, string> = {
  // bug
  bug: 'Bug',
  'feature-not-working': 'Fonctionnalité qui ne fonctionne pas',
  display: "Problème d'affichage",
  login: 'Problème de connexion',
  ai: "Problème avec l'IA",
  other: 'Autre',
  // suggestion
  'new-feature': 'Nouvelle fonctionnalité',
  improvement: 'Amélioration',
  design: 'Design',
  performance: 'Performance',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Importante',
  blocking: 'Bloquante',
}

function esc(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\n', '<br>')
}

function buildHtml(f: AdminFeedbackEmail): string {
  const meta = KIND_LABELS[f.kind]
  const severity = f.severity ? SEVERITY_LABELS[f.severity] ?? f.severity : null

  const rows: string[] = []
  const addRow = (label: string, value: string) =>
    rows.push(`<tr><td style="padding:6px 0;color:#64748b;width:180px;vertical-align:top">${label}</td><td style="padding:6px 0;color:#0f172a">${value}</td></tr>`)

  addRow('Type', `${meta.emoji} ${meta.label}`)
  addRow('Catégorie', esc(CATEGORY_LABELS[f.category] ?? f.category))
  if (severity) addRow('Gravité', esc(severity))
  addRow('Description', esc(f.description))
  if (f.steps_to_reproduce) addRow('Étapes pour reproduire', esc(f.steps_to_reproduce))
  if (f.page_url) addRow('Page', esc(f.page_url))
  if (f.app_version) addRow('Version', esc(f.app_version))
  if (f.browser) addRow('Navigateur', esc(f.browser))
  if (f.device) addRow('Appareil', esc(f.device))
  if (f.user_id) addRow('Utilisateur (id)', `<code style="font-size:12px">${esc(f.user_id)}</code>`)
  addRow('Date', esc(new Date(f.created_at).toLocaleString('fr-FR')))

  return `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
    <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:16px">
      Kininaru — Nouveau retour utilisateur
    </div>
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
      ${rows.join('')}
    </table>
    <p style="color:#94a3b8;font-size:12px;margin-top:16px">
      Reçu via le formulaire bêta (Paramètres → Aider à améliorer Kininaru). Consultable dans Supabase → Table Editor → feedback.
    </p>
  </div>`
}

/**
 * Envoie l'email admin via SendGrid. Fire-and-forget côté appelant :
 * cette fonction capture toutes les erreurs et ne lève jamais.
 * Renvoie `true` si l'email a été envoyé, `false` sinon (config absente
 * ou erreur réseau — un message est journalisé côté serveur).
 */
export async function notifyAdminOfFeedback(f: AdminFeedbackEmail): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY
  const to = process.env.ADMIN_FEEDBACK_EMAIL

  if (!apiKey || !to) {
    // Pas de blocage : sans configuration, le retour reste dans Supabase
    // (source de vérité) — on journalise pour le diagnostic serveur.
    if (!apiKey) console.warn('[Kininaru] SENDGRID_API_KEY non configurée — email admin non envoyé.')
    if (!to) console.warn('[Kininaru] ADMIN_FEEDBACK_EMAIL non configurée — email admin non envoyé.')
    return false
  }

  // Expéditeur : vérifié dans SendGrid (Single Sender). On privilégie
  // ADMIN_FEEDBACK_FROM_EMAIL si défini, sinon on réutilise la boîte
  // destinataire vérifiée. Aucune adresse personnelle codée en dur.
  const from = process.env.ADMIN_FEEDBACK_FROM_EMAIL || to

  try {
    sgMail.setApiKey(apiKey)
    await sgMail.send({
      to,
      from,
      subject: `${KIND_LABELS[f.kind].emoji} [Kininaru] ${KIND_LABELS[f.kind].label} — ${f.category}`,
      text: [
        `${KIND_LABELS[f.kind].emoji} Kininaru — ${KIND_LABELS[f.kind].label}`,
        `Catégorie : ${f.category}`,
        f.severity ? `Gravité : ${f.severity}` : '',
        '',
        f.description,
        f.steps_to_reproduce ? `\nÉtapes pour reproduire :\n${f.steps_to_reproduce}` : '',
        f.page_url ? `\nPage : ${f.page_url}` : '',
        f.app_version ? `Version : ${f.app_version}` : '',
        f.browser ? `Navigateur : ${f.browser}` : '',
        f.device ? `Appareil : ${f.device}` : '',
        `Date : ${new Date(f.created_at).toLocaleString('fr-FR')}`,
      ]
        .filter(Boolean)
        .join('\n'),
      html: buildHtml(f),
    })
    return true
  } catch (err) {
    console.error('[Kininaru] Échec de l’envoi de l’email admin :', err)
    return false
  }
}
