/**
 * Kininaru — retours utilisateurs (bêta).
 *
 * Client-side helpers: types partagés, collecte automatique d'informations
 * d'environnement (page, navigateur, appareil) et envoi vers l'API
 * serveur `/api/feedback` (validation stricte côté serveur, user_id posé
 * depuis la session — jamais depuis le payload client).
 */

export type FeedbackKind = 'bug' | 'suggestion'

/** Catégories du formulaire « Signaler un bug ». */
export const BUG_CATEGORIES = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature-not-working', label: 'Fonctionnalité qui ne fonctionne pas' },
  { value: 'display', label: "Problème d'affichage" },
  { value: 'login', label: 'Problème de connexion' },
  { value: 'ai', label: "Problème avec l'IA" },
  { value: 'other', label: 'Autre' },
] as const

/** Catégories du formulaire « Envoyer une suggestion ». */
export const SUGGESTION_CATEGORIES = [
  { value: 'new-feature', label: 'Nouvelle fonctionnalité' },
  { value: 'improvement', label: 'Amélioration' },
  { value: 'design', label: 'Design' },
  { value: 'ai', label: 'IA' },
  { value: 'performance', label: 'Performance' },
  { value: 'other', label: 'Autre' },
] as const

/** Gravités du formulaire bug. */
export const SEVERITIES = [
  { value: 'low', label: 'Faible' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'high', label: 'Importante' },
  { value: 'blocking', label: 'Bloquante' },
] as const

export type BugCategory = (typeof BUG_CATEGORIES)[number]['value']
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number]['value']
export type Severity = (typeof SEVERITIES)[number]['value']

export interface FeedbackPayload {
  kind: FeedbackKind
  category: BugCategory | SuggestionCategory
  description: string
  steps_to_reproduce?: string
  severity?: Severity
}

/* ------------------------------------------------------------------ */
/* Informations automatiques (envoyées avec chaque retour)             */
/* ------------------------------------------------------------------ */

export interface EnvironmentInfo {
  page_url: string | null
  app_version: string | null
  browser: string | null
  device: string | null
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\/|Opera/.test(ua)) return 'Opera'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'Inconnu'
}

function detectDevice(ua: string): string {
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua)
  const os =
    /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : 'Inconnu'
  return mobile ? `${os} mobile` : `${os} (ordinateur)`
}

/**
 * Collecte les informations utiles pour reproduire un problème, sans
 * jamais toucher au contenu privé (journal, conversations, mots de passe…).
 * Uniquement : page courante, version, navigateur, type d'appareil.
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  if (typeof window === 'undefined') {
    return { page_url: null, app_version: null, browser: null, device: null }
  }
  const ua = window.navigator.userAgent || ''
  const page = window.location.pathname + window.location.search
  return {
    page_url: page.slice(0, 500) || null,
    app_version: null, // posé côté serveur (lib/version) — source unique
    browser: detectBrowser(ua),
    device: detectDevice(ua),
  }
}

/* ------------------------------------------------------------------ */
/* Envoi                                                               */
/* ------------------------------------------------------------------ */

/**
 * Envoie un retour vers /api/feedback. Le serveur authentifie la session,
 * valide chaque champ (whitelist + limites), pose user_id depuis la
 * session et stocke dans la table `feedback` (RLS).
 */
export async function submitFeedback(payload: FeedbackPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const env = getEnvironmentInfo()
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ...env }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      return { ok: false, error: data.error ?? 'Impossible d’envoyer le retour.' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Impossible d’envoyer le retour. Vérifie ta connexion et réessaie.' }
  }
}
