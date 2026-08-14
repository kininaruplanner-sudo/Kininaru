-- =====================================================================
-- Kininaru — Alarmes (réveils) — distinctes des rappels
--
-- Run in the Supabase SQL Editor (additive, safe to re-run).
--
-- Une alarme est un créneau horaire quotidien (heure locale du device,
-- jours de la semaine) avec titre, son, vibration et snooze.
--
-- IMPORTANT (honnêteté technique, voir lib/alarms/scheduler.ts) :
--   Le déclenchement est planifié LOCALEMENT (navigateur ouvert, service
--   worker actif, ou notifications système autorisées). Une PWA ne peut
--   PAS garantir une alarme lorsque le navigateur est complètement fermé
--   (surtout iOS). Cette table est le stockage persistant des réglages ;
--   l'appareil qui les lit déclenche l'alarme à l'heure locale.
--
-- RLS : chaque utilisateur ne voit que ses propres alarmes.
-- =====================================================================

create table if not exists public.alarms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  -- Heure locale au format 'HH:MM' (ex. '18:30'). Interprétée dans le
  -- fuseau de l'appareil qui affiche l'alarme.
  time text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  -- Jours de la semaine où l'alarme sonne : 0 = dimanche … 6 = samedi.
  days integer[] not null default '{1,2,3,4,5}' check (array_length(days, 1) between 1 and 7),
  enabled boolean not null default true,
  sound boolean not null default true,
  vibrate boolean not null default true,
  snooze_minutes integer not null default 5 check (snooze_minutes between 1 and 60),
  last_fired_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.alarms enable row level security;

create index if not exists alarms_user_idx on public.alarms (user_id);

drop policy if exists "alarms: select own" on public.alarms;
create policy "alarms: select own"
  on public.alarms for select
  using (auth.uid() = user_id);

drop policy if exists "alarms: insert own" on public.alarms;
create policy "alarms: insert own"
  on public.alarms for insert
  with check (auth.uid() = user_id);

drop policy if exists "alarms: update own" on public.alarms;
create policy "alarms: update own"
  on public.alarms for update
  using (auth.uid() = user_id);

drop policy if exists "alarms: delete own" on public.alarms;
create policy "alarms: delete own"
  on public.alarms for delete
  using (auth.uid() = user_id);
