import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * ⚠️ SERVER-ONLY. Uses SUPABASE_SERVICE_ROLE_KEY, which bypasses every RLS
 * policy in the database — anything read or written through this client has
 * full, unrestricted access to every table.
 *
 * - `import 'server-only'` makes any accidental import from a Client
 *   Component fail the build instead of silently bundling this key into
 *   client-side JavaScript.
 * - Never rename SUPABASE_SERVICE_ROLE_KEY to something prefixed with
 *   NEXT_PUBLIC_ — that prefix is what tells Next.js to inline a variable
 *   into the browser bundle. This key must never carry that prefix.
 * - Nothing in this codebase currently needs this client: the two
 *   operations that would normally require service_role (deleting a user,
 *   admin-only writes) are instead handled by SECURITY DEFINER Postgres
 *   functions (see supabase/production_readiness.sql), which is the
 *   safer pattern — the privilege escalation is scoped to one specific,
 *   auditable SQL function instead of a whole server-side client. Reach
 *   for this file only if you add something that genuinely cannot be
 *   expressed as a SECURITY DEFINER function (e.g. Supabase Auth admin
 *   API calls like bulk-inviting users).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'createAdminClient() requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.'
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
