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
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export const OAUTH_STATE_TTL_MS = 10 * 60_000

/**
 * Generates a random state, stores it (service role — the client can
 * never read oauth_states), and returns it for the authorize URL.
 * Returns null when the insert fails (e.g. SQL not deployed).
 */
export async function createOAuthState(
  service: SupabaseClient,
  userId: string
): Promise<string | null> {
  const state = randomBytes(32).toString('base64url')
  const { error } = await service.from('oauth_states').insert({
    state,
    user_id: userId,
    expires_at: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
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
 * false (the callback must reject the flow).
 */
export async function consumeOAuthState(
  service: SupabaseClient,
  state: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await service
    .from('oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state', state)
    .eq('user_id', userId)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('state')
    .maybeSingle()
  if (error) {
    console.error('[Kininaru] consumeOAuthState failed:', error.message)
    return false
  }
  return Boolean(data)
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
