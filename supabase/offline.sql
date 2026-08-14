-- =====================================================================
-- Kininaru — File de synchronisation hors ligne (offline-first)
--
-- Run in the Supabase SQL Editor (additive, safe to re-run).
--
-- sync_queue : opérations créées localement pendant que l'appareil est
-- hors ligne. Quand la connexion revient, le client rejoue chaque op
-- (via son propre client Supabase, donc RLS appliquée) puis la marque
-- 'applied'. Les conflits sont détectés côté client (doublon, ligne
-- supprimée ailleurs) et stockés dans `conflict` — JAMAIS écrasés
-- silencieusement (§10 : résolution de conflits documentée).
--
-- `device_id` est un identifiant stable généré par le navigateur
-- (crypto.randomUUID, stocké en localStorage) : chaque appareil a sa
-- propre file, la même file peut être rejouée sur plusieurs onglets.
--
-- RLS : chaque utilisateur ne voit que ses propres opérations.
-- =====================================================================

create table if not exists public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  op_type text not null check (op_type in ('create', 'update', 'delete')),
  table_name text not null
    check (table_name in ('tasks', 'habits', 'events', 'journal_entries', 'habit_logs')),
  -- Id généré LOCALEMENT à la création (permet de rattacher la réponse
  -- serveur à l'enregistrement local et de réjouer sans dupliquer).
  record_id uuid not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'applied', 'failed')),
  conflict jsonb,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sync_queue enable row level security;

create index if not exists sync_queue_user_status_idx
  on public.sync_queue (user_id, status);
create index if not exists sync_queue_device_idx
  on public.sync_queue (device_id);

drop policy if exists "sync_queue: select own" on public.sync_queue;
create policy "sync_queue: select own"
  on public.sync_queue for select
  using (auth.uid() = user_id);

drop policy if exists "sync_queue: insert own" on public.sync_queue;
create policy "sync_queue: insert own"
  on public.sync_queue for insert
  with check (auth.uid() = user_id);

drop policy if exists "sync_queue: update own" on public.sync_queue;
create policy "sync_queue: update own"
  on public.sync_queue for update
  using (auth.uid() = user_id);

drop policy if exists "sync_queue: delete own" on public.sync_queue;
create policy "sync_queue: delete own"
  on public.sync_queue for delete
  using (auth.uid() = user_id);
