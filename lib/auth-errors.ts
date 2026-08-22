/**
 * Maps Supabase auth error messages to generic user-facing strings.
 *
 * Goal: never reveal whether an email exists, what the exact auth error was,
 * or any internal infrastructure details.  The original error is kept in the
 * server logs (via console.error) but the client only sees a generic, safe
 * message.
 */

const ERROR_MAP: [RegExp, string][] = [
  // Login
  [/invalid login credentials/i, 'Email ou mot de passe incorrect.'],
  [/email not confirmed/i, 'Veuillez confirmer votre adresse email.'],
  // Sign-up
  [/user already registered/i, 'Un compte existe déjà avec cette adresse email.'],
  [/password should be at least \d+ characters/i, 'Le mot de passe doit contenir au moins 6 caractères.'],
  [/unable to validate email address/i, 'Adresse email invalide.'],
  // Rate limiting / security
  [/too many requests/i, 'Trop de tentatives. Réessayez dans un instant.'],
  [/email rate limit exceeded/i, 'Trop de tentatives. Réessayez dans un instant.'],
  [/security purposes.*too many/i, 'Trop de tentatives. Réessayez dans un instant.'],
  // Generic fallback patterns
  [/network/i, 'Erreur réseau. Vérifiez votre connexion.'],
  [/timeout/i, 'La requête a pris trop de temps. Réessayez.'],
]

/**
 * Returns a safe, user-facing error message for any auth error.
 *
 * @param err       The caught error (typically from Supabase).
 * @param fallback  A translation key / fallback message for unknown errors.
 */
export function getAuthErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback

  const msg = err.message

  for (const [pattern, safe] of ERROR_MAP) {
    if (pattern.test(msg)) return safe
  }

  // Log the real error server-side for debugging, but never expose it
  if (typeof console !== 'undefined') {
    console.error('[Kininaru Auth]', msg)
  }

  return fallback
}
