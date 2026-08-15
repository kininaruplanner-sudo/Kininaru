-- =====================================================================
-- Kininaru — Rappels temporels (boucle proactive : PLAN → REMIND → START)
--
-- Run this file in the Supabase SQL Editor (additive, safe to re-run).
--
-- tasks.scheduled_time : l'heure planifiée d'une tâche du jour
--   ("14:00 → réviser les maths"). Permet au cron / scheduler client
--   d'envoyer « Ton bloc commence dans 10 minutes » au bon moment.
-- push_send_log.reminder_key : déduplication des rappels temporels —
--   une seule notification par tâche et par jour, jamais de répétition.
--
-- Aucune RLS à ajouter : ces colonnes étendent des tables déjà protégées.
-- =====================================================================

alter table public.tasks add column if not exists scheduled_time time;

alter table public.push_send_log add column if not exists reminder_key text;

create index if not exists push_send_log_reminder_idx
  on public.push_send_log (user_id, reminder_key);
