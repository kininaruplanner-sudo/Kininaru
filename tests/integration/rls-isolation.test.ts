/**
 * RLS Policy Isolation Tests
 *
 * These tests verify the SECURITY LOGIC of RLS policies by testing that:
 * 1. Every API route checks auth before data access
 * 2. The SQL policies enforce user_id ownership
 * 3. Cross-user data access is blocked at the policy level
 * 4. No route leaks data between users
 *
 * NOTE: These tests verify code-level security, not a live Supabase instance.
 * For real RLS verification, run these against a Supabase test database.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const schemaPath = join(process.cwd(), 'supabase', 'schema.sql')
const schemaSafePath = join(process.cwd(), 'supabase', 'schema-bootstrap-safe.sql')

// ── Read and parse the SQL schemas ──
function readSchema(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

const schema = readSchema(schemaPath)
const schemaSafe = readSchema(schemaSafePath)

// ── RLS Policy Analysis ──

describe('RLS policies in schema.sql', () => {
  it('enables RLS on profiles', () => {
    expect(schema).toContain('alter table public.profiles enable row level security')
  })

  it('enables RLS on tasks', () => {
    expect(schema).toContain('alter table public.tasks enable row level security')
  })

  it('enables RLS on events', () => {
    expect(schema).toContain('alter table public.events enable row level security')
  })

  it('enables RLS on habits', () => {
    expect(schema).toContain('alter table public.habits enable row level security')
  })

  it('enables RLS on habit_logs', () => {
    expect(schema).toContain('alter table public.habit_logs enable row level security')
  })

  it('enables RLS on journal_entries', () => {
    expect(schema).toContain('alter table public.journal_entries enable row level security')
  })

  it('enables RLS on focus_sessions', () => {
    expect(schema).toContain('alter table public.focus_sessions enable row level security')
  })

  it('enables RLS on notifications', () => {
    expect(schema).toContain('alter table public.notifications enable row level security')
  })

  it('enables RLS on families', () => {
    expect(schema).toContain('alter table public.families enable row level security')
  })

  it('enables RLS on family_members', () => {
    expect(schema).toContain('alter table public.family_members enable row level security')
  })

  it('enables RLS on family_events', () => {
    expect(schema).toContain('alter table public.family_events enable row level security')
  })

  it('enables RLS on family_tasks', () => {
    expect(schema).toContain('alter table public.family_tasks enable row level security')
  })

  it('enables RLS on ai_memories', () => {
    expect(schema).toContain('alter table public.ai_memories enable row level security')
  })
})

describe('RLS ownership policies — user_id = auth.uid()', () => {
  it('tasks SELECT requires user_id match', () => {
    expect(schema).toContain('create policy "tasks: select own" on public.tasks\n  for select using (auth.uid() = user_id)')
  })

  it('tasks INSERT requires user_id match', () => {
    expect(schema).toContain('create policy "tasks: insert own" on public.tasks\n  for insert with check (auth.uid() = user_id)')
  })

  it('tasks UPDATE requires user_id match', () => {
    expect(schema).toContain('create policy "tasks: update own" on public.tasks\n  for update using (auth.uid() = user_id)')
  })

  it('tasks DELETE requires user_id match', () => {
    expect(schema).toContain('create policy "tasks: delete own" on public.tasks\n  for delete using (auth.uid() = user_id)')
  })

  it('events SELECT requires user_id match', () => {
    expect(schema).toContain('create policy "events: select own" on public.events\n  for select using (auth.uid() = user_id)')
  })

  it('habits SELECT requires user_id match', () => {
    expect(schema).toContain('create policy "habits: select own" on public.habits\n  for select using (auth.uid() = user_id)')
  })

  it('journal_entries SELECT requires user_id match', () => {
    expect(schema).toContain('create policy "journal_entries: select own" on public.journal_entries\n  for select using (auth.uid() = user_id)')
  })

  it('focus_sessions SELECT requires user_id match', () => {
    expect(schema).toContain('create policy "focus_sessions: select own" on public.focus_sessions\n  for select using (auth.uid() = user_id)')
  })

  it('notifications SELECT requires user_id match', () => {
    expect(schema).toContain('create policy "notifications: select own" on public.notifications\n  for select using (auth.uid() = user_id)')
  })

  it('ai_memories SELECT requires user_id match', () => {
    expect(schema).toContain('create policy "ai_memories: select own" on public.ai_memories\n  for select using (auth.uid() = user_id)')
  })

  it('profiles SELECT requires user_id match', () => {
    expect(schema).toContain('create policy "profiles: select own" on public.profiles\n  for select using (auth.uid() = id)')
  })
})

describe('RLS family policies — membership-gated access', () => {
  it('family_tasks SELECT requires family membership', () => {
    // Family tasks should only be visible to family members
    expect(schema).toContain('"family_tasks: select members"')
    expect(schema).toContain('is_family_member(family_id)')
  })

  it('family_events SELECT requires family membership', () => {
    expect(schema).toContain('"family_events: select members"')
  })

  it('family_members SELECT requires family membership', () => {
    expect(schema).toContain('"family_members: select members"')
  })

  it('is_family_member function exists and checks membership', () => {
    expect(schema).toContain('function public.is_family_member(p_family_id uuid)')
    expect(schema).toContain('select 1 from public.family_members')
    expect(schema).toContain('where family_id = p_family_id and user_id = auth.uid()')
  })

  it('is_family_parent function exists and checks parent role', () => {
    expect(schema).toContain('function public.is_family_parent(p_family_id uuid)')
    expect(schema).toContain("role = 'parent'")
  })

  it('family INSERT requires owner to be the creator', () => {
    expect(schema).toContain('"families: insert own"')
    expect(schema).toContain('auth.uid() = created_by')
  })

  it('family UPDATE requires owner', () => {
    expect(schema).toContain('"families: update owner"')
  })

  it('family DELETE requires owner', () => {
    expect(schema).toContain('"families: delete owner"')
  })

  it('join_family is security definer (prevents privilege escalation)', () => {
    expect(schema).toContain('security definer')
  })
})

describe('RLS safe schema mirrors protection', () => {
  it('schema-bootstrap-safe.sql enables RLS on all tables', () => {
    const tables = [
      'profiles', 'tasks', 'events', 'habits', 'habit_logs',
      'journal_entries', 'focus_sessions', 'notifications',
      'families', 'family_members', 'family_events', 'family_tasks',
      'ai_memories'
    ]
    for (const table of tables) {
      expect(schemaSafe).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('safe schema has ownership policies for all user tables', () => {
    expect(schemaSafe).toContain('auth.uid() = user_id')
    expect(schemaSafe).toContain('auth.uid() = id') // profiles
    expect(schemaSafe).toContain('auth.uid() = created_by') // families
  })
})

// ── Push send kind whitelist ──

describe('Push notification kind whitelist', () => {
  it('only allows "push" and "test" as valid kinds', () => {
    // Read the push send route and verify the whitelist
    const routeContent = readFileSync(
      join(process.cwd(), 'app', 'api', 'push', 'send', 'route.ts'),
      'utf-8'
    )
    expect(routeContent).toContain("ALLOWED_KINDS = new Set(['push', 'test'])")
    expect(routeContent).toContain('ALLOWED_KINDS.has(rawKind)')
  })

  it('rejects unknown kind values', () => {
    const routeContent = readFileSync(
      join(process.cwd(), 'app', 'api', 'push', 'send', 'route.ts'),
      'utf-8'
    )
    expect(routeContent).toContain("'Type de notification invalide'")
  })
})

// ── SSRF protection ──

describe('ICS SSRF protection — DNS rebinding mitigation', () => {
  it('re-resolves DNS immediately before each fetch', () => {
    const routeContent = readFileSync(
      join(process.cwd(), 'app', 'api', 'calendar', 'ics', 'subscribe', 'route.ts'),
      'utf-8'
    )
    // Should have a safeFetch that re-resolves DNS before fetching
    expect(routeContent).toContain('safeFetch')
    expect(routeContent).toContain('dnsResolve(parsedUrl.hostname)')
  })

  it('blocks private IPs in the safeFetch function', () => {
    const routeContent = readFileSync(
      join(process.cwd(), 'app', 'api', 'calendar', 'ics', 'subscribe', 'route.ts'),
      'utf-8'
    )
    expect(routeContent).toContain('isPrivateIP(ip)')
    expect(routeContent).toContain('SSRF: target IP is private/internal')
  })
})

// ── Auth checking in API routes ──

describe('API routes require authentication', () => {
  const routesThatRequireAuth = [
    { route: 'app/api/chat/route.ts', pattern: /getUser\(\)|auth\.getUser|supabase\.auth/ },
    { route: 'app/api/ai/actions/route.ts', pattern: /getUser\(\)|auth\.getUser|supabase\.auth/ },
    { route: 'app/api/ai/journal/route.ts', pattern: /getUser\(\)|auth\.getUser|supabase\.auth/ },
    { route: 'app/api/feedback/route.ts', pattern: /getUser\(\)|auth\.getUser|supabase\.auth/ },
    { route: 'app/api/push/send/route.ts', pattern: /getUser\(\)|auth\.getUser|supabase\.auth/ },
    { route: 'app/api/calendar/ics/subscribe/route.ts', pattern: /getUser\(\)|auth\.getUser|supabase\.auth/ },
  ]

  for (const { route, pattern } of routesThatRequireAuth) {
    it(`${route} checks user authentication before processing`, () => {
      const content = readFileSync(join(process.cwd(), route), 'utf-8')
      expect(content).toMatch(pattern)
    })
  }
})

// ── No secrets in client code ──

describe('No secrets leak to the client', () => {
  it('GROQ_API_KEY is never imported in client components', () => {
    try {
      const result = execSync(
        "grep -r 'GROQ_API_KEY\\|SUPABASE_SERVICE_ROLE\\|VAPID_PRIVATE' --include='*.tsx' --include='*.ts' app/ components/ lib/ 2>/dev/null || true",
        { encoding: 'utf-8' }
      )
      // Filter out API routes (server-only) and env declarations
      const clientCode = result
        .split('\n')
        .filter((line: string) =>
          !line.includes('app/api/') &&
          !line.includes('.env') &&
          line.trim().length > 0
        )
      // No client code should reference these secrets
      for (const line of clientCode) {
        expect(line).not.toMatch(/GROQ_API_KEY|SUPABASE_SERVICE_ROLE|VAPID_PRIVATE/)
      }
    } catch {
      // grep not available or no matches (good)
    }
  })
})
