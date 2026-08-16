/**
 * OAuth state (CSRF / login-CSRF protection) — SERVER ONLY.
 *
 * NEVER import this module from client code: it manages the one-time
 * random state used by the Google / Microsoft calendar OAuth flows
 * (table `oauth_states`, see supabase/oauth-states.sql).
 *
 * Why a real state (and not the bare user id):
 *  - the state is a 128-bit random value an attacker cannot guess or
 *    forge (prevents login-CSRF: an attacker cannot start a flow "for"
 *    a victim and have the victim's callback bind the attacker's account);
 *  - it is consumed atomically (single UPDATE ... WHERE consumed_at IS NULL
 *    RETURNING), so a replayed callback is rejected;
 *  - it expires after 10 minutes and is bound to the authenticated user id
 *    server-side — nothing sensitive is ever placed in the OAuth URL.
 *
 * `return_to` is an optional INTERNAL path (e.g. `/calendar`) recorded at
 * connect time so the callback can bring the user back to the page where
 * they started the flow. It is sanitized server-side: only a same-origin
 * relative path is accepted, never an absolute URL.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export const OAUTH_STATE_TTL_MS = 10 * 60_000

/** Max length of the stored return path (generous but bounded). */
const MAX_RETURN_TO_LENGTH = 200

/**
 * Accepts ONLY a same-origin relative path: starts with a single "/",
 * never "//" (protocol-relative), no backslash, no control characters.
 * Returns null for anything else — the callback then falls back to
 * /settings.
 */
export function sanitizeReturnTo(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  if (raw.includes('\\')) return null
  if (/[\r\n]/.test(raw)) return null
  if (/[:?#]/.test(raw.slice(1))) return null // pas de scheme, host, query ni hash
  return raw.slice(0, MAX_RETURN_TO_LENGTH)
}

/**
 * Generates a random state, stores it (service role — the client can
 * never read oauth_states), and returns it for the authorize URL.
 * Returns null when the insert fails (e.g. SQL not deployed).
 */
export async function createOAuthState(
  service: SupabaseClient,
  userId: string,
  returnTo?: string
): Promise<string | null> {
  const state = randomBytes(32).toString('base64url')
  const { error } = await service.from('oauth_states').insert({
    state,
    user_id: userId,
    expires_at: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
    return_to: sanitizeReturnTo(returnTo),
  })
  if (error) {
    console.error('[Kininaru] createOAuthState failed:', error.message)
    return null
  }
  return state
}

/**
 * Atomically consumes a state: succeeds exactly once per state, only for
 * the right user and only before expiry. Replays and mismatches return
 * null (the callback must reject the flow). On success, returns the
 * recorded `return_to` (sanitized) so the callback can redirect there.
 */
export async function consumeOAuthState(
  service: SupabaseClient,
  state: string,
  userId: string
): Promise<{ return_to: string | null } | null> {
  const { data, error } = await service
    .from('oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state', state)
    .eq('user_id', userId)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('state, return_to')
    .maybeSingle()
  if (error) {
    console.error('[Kininaru] consumeOAuthState failed:', error.message)
    return null
  }
  if (!data) return null
  const stored = data as { state: string; return_to: string | null }
  return { return_to: sanitizeReturnTo(stored.return_to) }
}

/** Purges consumed/expired states older than 24 h (called by the daily cron). */
export async function cleanupOAuthStates(service: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await service
    .from('oauth_states')
    .delete()
    .lt('expires_at', cutoff)
    .select('state')
  return data?.length ?? 0
}
