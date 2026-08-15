-- =====================================================================
-- Kininaru — Scheduler Supabase (pg_cron + pg_net), compatible Vercel Hobby
--
-- Pourquoi : le plan Vercel Hobby n'autorise qu'UNE exécution de cron par
-- jour (±59 min). Kininaru a besoin du brief du soir, du brief hebdo et de
-- rappels temporels toutes les 15 min. Ces fréquences ne passent pas par
-- les crons Vercel Hobby — elles sont planifiées ICI, dans la base
-- Supabase (incluse dans le plan gratuit), qui exécute du PostgreSQL avec
-- pg_cron et appelle les endpoints Vercel via pg_net (net.http_post).
--
-- ▶ CONFIGURATION (une seule fois, dans le SQL Editor) :
--   La table serveur public.app_config (créée par calendar-security.sql,
--   inaccessible au client) contient DEUX valeurs :
--     - app_url     : domaine de production, ex. https://kininaru-planner.vercel.app
--     - cron_secret : la VRAIE valeur de votre variable CRON_SECRET (Vercel)
--   👉 Exécutez après ce fichier :
--        update public.app_config set value = 'https://votre-domaine.vercel.app'
--          where key = 'app_url';
--        update public.app_config set value = 'VOTRE_VRAI_SECRET'
--          where key = 'cron_secret';
--   ⚠️ NE COMMITTEZ JAMAIS le secret réel : ce fichier est versionné, seuls
--   les placeholders y figurent. Le secret ne sort jamais du serveur.
--
-- ▶ Sécurité : chaque job envoie l'en-tête `x-cron-secret`. Les endpoints
--   Vercel répondent 401 sans lui et 503 s'il n'est pas configuré.
--
-- ▶ Coût : chaque exécution appelle une Serverless Function Vercel.
--   - rappels : 96 appels/jour ≈ 2 900/mois
--   - briefs soir + hebdo : ~90/mois
--   Le plan Vercel Hobby inclut des centaines de milliers d'invocations :
--   total largement dans les limites.
--
-- ▶ Redondance : si pg_cron n'est pas configuré, le produit continue de
--   fonctionner en dégradé : brief du matin via le cron Vercel unique,
--   briefs soir/hebdo et rappels via le scheduler client quand l'app est
--   ouverte (lib/coach/scheduler.ts). La déduplication par type/jour
--   (push_send_log) empêche tout double envoi si deux sources se chevauchent.
--
-- ▶ Idempotent : `cron.unschedule` avant `cron.schedule` rend ce fichier
--   relançable sans doublon de jobs.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Valeurs par défaut (placeholders — À REMPLACER dans le SQL Editor, voir
-- le bloc CONFIGURATION ci-dessus). `on conflict do nothing` préserve une
-- valeur déjà renseignée à la relecture.
insert into public.app_config (key, value)
values ('app_url', 'https://kininaru-planner.vercel.app')
on conflict (key) do nothing;

insert into public.app_config (key, value)
values ('cron_secret', 'CHANGE_ME_CRON_SECRET')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Brief du soir — tous les jours à 20:00 UTC
-- ---------------------------------------------------------------------
select cron.unschedule('kininaru-evening-brief') where exists (
  select 1 from cron.job where jobname = 'kininaru-evening-brief'
);
select cron.schedule(
  'kininaru-evening-brief',
  '0 20 * * *',
  $$
  select net.http_post(
    url := (select value from public.app_config where key = 'app_url') || '/api/cron/briefs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_config where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------
-- Brief hebdomadaire — lundi à 08:00 UTC
-- ---------------------------------------------------------------------
select cron.unschedule('kininaru-weekly-brief') where exists (
  select 1 from cron.job where jobname = 'kininaru-weekly-brief'
);
select cron.schedule(
  'kininaru-weekly-brief',
  '0 8 * * 1',
  $$
  select net.http_post(
    url := (select value from public.app_config where key = 'app_url') || '/api/cron/briefs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_config where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------
-- Rappels temporels (PLAN → REMIND) — toutes les 15 minutes
-- ---------------------------------------------------------------------
select cron.unschedule('kininaru-reminders') where exists (
  select 1 from cron.job where jobname = 'kininaru-reminders'
);
select cron.schedule(
  'kininaru-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select value from public.app_config where key = 'app_url') || '/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_config where key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- =====================================================================
-- Correctif : la cloche in-app accepte désormais les rappels temporels
-- (le scheduler client insère `type: 'reminder'` — la contrainte initiale
-- ne le permettait pas, les rappels in-app échouaient silencieusement).
-- =====================================================================
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('info', 'family', 'task', 'habit', 'achievement', 'reminder'));
