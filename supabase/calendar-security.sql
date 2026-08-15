-- =====================================================================
-- Kininaru — Sécurité des tokens calendrier
--
-- Run in the Supabase SQL Editor (additive, safe to re-run).
--
-- Problème corrigé : les colonnes `access_token` / `refresh_token` de
-- calendar_connections étaient lisibles par le client navigateur via RLS
-- (« select own »). Même si le frontend ne sélectionnait que des champs
-- sûrs, la garantie doit venir de la base : un client ne PEUT PAS lire
-- ces colonnes, quoi qu'il demande.
--
-- Nouvelle architecture :
--   * REVOKE total sur les tables sensibles pour anon/authenticated
--     (les tokens ne sortent jamais du serveur) ;
--   * une fonction SECURITY DEFINER `my_calendar_connections()` qui ne
--     renvoie QUE les champs sûrs (aucun token, aucune scope) ;
--   * toutes les mutations (connecter, synchroniser, déconnecter,
--     s'abonner à un flux ICS) passent par les routes API serveur
--     (app/api/calendar/*) qui utilisent le service role.
-- =====================================================================

-- 1. Le client n'a plus AUCUN accès direct aux tables de connexion.
revoke all on public.calendar_connections from anon, authenticated;
revoke all on public.calendar_synced_events from anon, authenticated;

-- Les anciennes politiques RLS n'ont plus d'effet (privilèges révoqués)
-- mais on les supprime pour éviter toute confusion à la relecture.
drop policy if exists "calendar_connections: select own" on public.calendar_connections;
drop policy if exists "calendar_connections: insert own" on public.calendar_connections;
drop policy if exists "calendar_connections: update own" on public.calendar_connections;
drop policy if exists "calendar_connections: delete own" on public.calendar_connections;

drop policy if exists "calendar_synced_events: select own" on public.calendar_synced_events;
drop policy if exists "calendar_synced_events: insert own" on public.calendar_synced_events;
drop policy if exists "calendar_synced_events: update own" on public.calendar_synced_events;
drop policy if exists "calendar_synced_events: delete own" on public.calendar_synced_events;

-- 2. Lecture client : uniquement les champs sûrs, via une fonction
--    SECURITY DEFINER qui filtre par auth.uid() et ne projette JAMAIS
--    access_token / refresh_token / token_expires_at / scopes.
create or replace function public.my_calendar_connections()
returns table (
  id uuid,
  provider text,
  display_name text,
  sync_mode text,
  enabled boolean,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select cc.id,
         cc.provider,
         cc.display_name,
         cc.sync_mode,
         cc.enabled,
         cc.last_sync_at,
         cc.sync_error,
         cc.created_at
  from public.calendar_connections cc
  where cc.user_id = auth.uid()
  order by cc.created_at asc;
$$;

revoke all on function public.my_calendar_connections() from public;
grant execute on function public.my_calendar_connections() to authenticated;

-- 3. La table de configuration serveur (utilisée par supabase/scheduler.sql)
--    est elle aussi inaccessible au client : aucun secret ne peut en sortir.
create table if not exists public.app_config (
  key text primary key,
  value text not null
);

alter table public.app_config enable row level security;
-- RLS activé sans politique + privilèges révoqués = refus par défaut pour
-- anon/authenticated. Seul le rôle de service (cron, SQL Editor) y accède.
revoke all on public.app_config from anon, authenticated;
