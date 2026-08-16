/**
 * Distributed AI rate limiter — SERVER ONLY.
 *
 * The old limiter was a per-instance in-memory Map: on a horizontally
 * scaled platform (Vercel) it could not enforce a true global quota per
 * user. This version stores buckets in Supabase
 * (supabase/ai-rate-limit.sql) and increments them ATOMICALLY
 * (INSERT ... ON CONFLICT DO UPDATE count+1 RETURNING), so concurrent
 * requests all count.
 *
 * The client cannot read or reset its own counters: the table is revoked
 * from anon/authenticated and only the service role writes (the routes
 * that call this module are authenticated server routes).
 *
 * Fallback: if the SQL migration is not deployed yet, the previous
 * in-memory behavior applies so the chat never hard-fails.
 */

import { createServiceClient } from '@/lib/supabase/service'

const inMemoryBuckets = new Map<string, number[]>()

function inMemoryLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs
  const timestamps = (inMemoryBuckets.get(key) ?? []).filter((t) => t > cutoff)
  if (timestamps.length >= max) {
    inMemoryBuckets.set(key, timestamps)
    return true
  }
  timestamps.push(now)
  inMemoryBuckets.set(key, timestamps)
  return false
}

/**
 * Returns true when `scope` + userId has exceeded `max` calls in the
 * rolling `windowMs`. Bounded memory: buckets are keyed by minute, so a
 * long-lived instance never grows unboundedly for a fixed user set.
 */
export async function isRateLimited(
  scope: string,
  userId: string,
  max: number,
  windowMs = 60_000
): Promise<boolean> {
  const now = Date.now()
  const bucket = Math.floor(now / windowMs)

  try {
    const supabase = createServiceClient()
    const rpc = (await supabase.rpc('ai_rate_limit_incr', {
      p_scope: scope,
      p_user_id: userId,
      p_bucket: bucket,
    })) as { data: number | null; error: { message: string; code?: string } | null }
    if (rpc.error) {
      // Function/table missing → SQL not deployed → in-memory fallback.
      if (
        rpc.error.code === 'PGRST202' ||
        /could not find the function/i.test(rpc.error.message)
      ) {
        return inMemoryLimited(`${scope}:${userId}`, max, windowMs)
      }
      console.error('[Kininaru] ai_rate_limit_incr failed:', rpc.error.message)
      return inMemoryLimited(`${scope}:${userId}`, max, windowMs)
    }
    return (rpc.data ?? 0) > max
  } catch {
    // Service role not configured etc. — degrade to the local limiter.
    return inMemoryLimited(`${scope}:${userId}`, max, windowMs)
  }
}

/** Purges buckets older than 48 h (called by the daily cron). */
export async function cleanupRateLimits(): Promise<number> {
  try {
    const supabase = createServiceClient()
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('ai_rate_limits')
      .delete()
      .lt('updated_at', cutoff)
      .select('user_id')
    return data?.length ?? 0
  } catch {
    return 0
  }
}
