-- =====================================================================
-- Kininaru — Calendriers externes (Google / Microsoft / ICS)
--
-- Run in the Supabase SQL Editor (additive, safe to re-run).
--
-- calendar_connections    : un compte de calendrier externe connecté
--                           (OAuth Google/Microsoft, ou abonnement ICS).
-- calendar_synced_events  : mappage événement externe <-> événement
--                           Kininaru — base de la déduplication (§28.6) :
--                           unique (connection_id, external_event_id)
--                           garantit qu'un événement externe n'est jamais
--                           importé deux fois.
--
-- SÉCURITÉ :
--   * Aucun mot de passe n'est stocké (OAuth uniquement).
--   * Les tokens OAuth (access/refresh) sont sensibles : en production ils
--     doivent être chiffrés (Supabase Vault) — les colonnes existent pour
--     le schéma, mais l'API serveur ne les renvoie JAMAIS au client et
--     n'y écrit que via le service role.
--   * RLS : chaque utilisateur ne voit que ses propres connexions.
-- =====================================================================

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'ics')),
  -- Identifiant stable du compte externe (ex. adresse email du compte Google).
  external_account_id text,
  display_name text,
  scopes text[] not null default '{}',
  -- Tokens OAuth — côté serveur uniquement (Vault recommandé en production).
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  enabled boolean not null default true,
  -- 'read' (affichage) ou 'read_write' (bidirectionnel, activé seulement si
  -- les permissions et la résolution de conflits sont vérifiées).
  sync_mode text not null default 'read' check (sync_mode in ('read', 'read_write')),
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz not null default now(),
  unique (user_id, provider, external_account_id)
);

alter table public.calendar_connections enable row level security;

create index if not exists calendar_connections_user_idx
  on public.calendar_connections (user_id);

drop policy if exists "calendar_connections: select own" on public.calendar_connections;
create policy "calendar_connections: select own"
  on public.calendar_connections for select
  using (auth.uid() = user_id);

drop policy if exists "calendar_connections: insert own" on public.calendar_connections;
create policy "calendar_connections: insert own"
  on public.calendar_connections for insert
  with check (auth.uid() = user_id);

drop policy if exists "calendar_connections: update own" on public.calendar_connections;
create policy "calendar_connections: update own"
  on public.calendar_connections for update
  using (auth.uid() = user_id);

drop policy if exists "calendar_connections: delete own" on public.calendar_connections;
create policy "calendar_connections: delete own"
  on public.calendar_connections for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- calendar_synced_events — déduplication et suivi de synchronisation
-- ---------------------------------------------------------------------
create table if not exists public.calendar_synced_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,
  -- Identifiant stable de l'événement côté fournisseur (clé de dédup).
  external_event_id text not null,
  -- Événement Kininaru lié (créé lors de l'import).
  event_id uuid references public.events(id) on delete cascade,
  -- ETag / version côté fournisseur pour détecter les modifications.
  external_etag text,
  last_synced_at timestamptz not null default now(),
  unique (connection_id, external_event_id)
);

alter table public.calendar_synced_events enable row level security;

create index if not exists calendar_synced_events_user_idx
  on public.calendar_synced_events (user_id);
create index if not exists calendar_synced_events_conn_idx
  on public.calendar_synced_events (connection_id);

drop policy if exists "calendar_synced_events: select own" on public.calendar_synced_events;
create policy "calendar_synced_events: select own"
  on public.calendar_synced_events for select
  using (auth.uid() = user_id);

drop policy if exists "calendar_synced_events: insert own" on public.calendar_synced_events;
create policy "calendar_synced_events: insert own"
  on public.calendar_synced_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "calendar_synced_events: update own" on public.calendar_synced_events;
create policy "calendar_synced_events: update own"
  on public.calendar_synced_events for update
  using (auth.uid() = user_id);

drop policy if exists "calendar_synced_events: delete own" on public.calendar_synced_events;
create policy "calendar_synced_events: delete own"
  on public.calendar_synced_events for delete
  using (auth.uid() = user_id);
