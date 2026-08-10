import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — SERVER ONLY (cron / admin tasks).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (the service_role key from Supabase →
 * Settings → API). It bypasses RLS, so it must NEVER be used from the client
 * or from user-facing request handlers that forward client input into it
 * unchecked. It is used exclusively by the cron brief endpoint to read the
 * push subscriptions of users who opted in and to write the send log.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase service-role non configuré : définissez SUPABASE_SERVICE_ROLE_KEY.'
    )
  }
  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
