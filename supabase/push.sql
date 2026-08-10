-- =====================================================================
-- Kininaru — Web Push (ÉTAPE 15.5 §9-10, §14, §21)
--
-- Run this file in the Supabase SQL Editor (additive, safe to re-run).
--
-- push_subscriptions : one row per browser/device the user opted in on.
-- push_send_log      : durable log used by the server to enforce the
--                      "respectful notifications" rules (daily cap) even
--                      across instances / cron runs.
--
-- RLS: every table is strictly user-scoped. The cron route uses the
-- service-role key (server-side only) to read subscriptions of users who
-- opted in — it never touches rows it doesn't need.
-- =====================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  -- JSONB user preferences: { morning, evening, weekly, coach, quietStart, quietEnd }
  prefs jsonb not null default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

drop policy if exists "push_subscriptions: select own" on public.push_subscriptions;
create policy "push_subscriptions: select own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "push_subscriptions: insert own" on public.push_subscriptions;
create policy "push_subscriptions: insert own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions: update own" on public.push_subscriptions;
create policy "push_subscriptions: update own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

drop policy if exists "push_subscriptions: delete own" on public.push_subscriptions;
create policy "push_subscriptions: delete own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------

create table if not exists public.push_send_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'push' (coach / brief) or 'test' (never counted toward the daily cap)
  kind text not null default 'push',
  -- 'morning' | 'evening' | 'weekly' | null — lets the cron dedupe per day
  brief_type text,
  sent_at timestamptz not null default now()
);

-- Additive for databases where the table already exists without the column.
alter table public.push_send_log add column if not exists brief_type text;

alter table public.push_send_log enable row level security;

create index if not exists push_send_log_user_day_idx
  on public.push_send_log (user_id, sent_at);

drop policy if exists "push_send_log: select own" on public.push_send_log;
create policy "push_send_log: select own"
  on public.push_send_log for select
  using (auth.uid() = user_id);

drop policy if exists "push_send_log: insert own" on public.push_send_log;
create policy "push_send_log: insert own"
  on public.push_send_log for insert
  with check (auth.uid() = user_id);
