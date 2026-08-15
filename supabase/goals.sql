-- =====================================================================
-- Kininaru — Objectifs (progression personnelle proactive)
--
-- Run this file in the Supabase SQL Editor (additive, safe to re-run).
--
-- goals : une direction durable pour les tâches du quotidien.
--   - status : 'active' | 'done' | 'archived'
--   - target_date : date visée (optionnelle, jamais imposée)
-- tasks.goal_id : rattache une tâche (et ses sous-tâches) à un objectif,
--   ce qui permet de calculer une vraie progression (faites / total).
--
-- RLS : chaque objectif appartient à un seul utilisateur. Aucun contournement.
-- =====================================================================

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  target_date date,
  status text not null default 'active'
    check (status in ('active', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create index if not exists goals_user_id_idx on public.goals (user_id);

drop policy if exists "goals: select own" on public.goals;
create policy "goals: select own" on public.goals
  for select using (auth.uid() = user_id);
drop policy if exists "goals: insert own" on public.goals;
create policy "goals: insert own" on public.goals
  for insert with check (auth.uid() = user_id);
drop policy if exists "goals: update own" on public.goals;
create policy "goals: update own" on public.goals
  for update using (auth.uid() = user_id);
drop policy if exists "goals: delete own" on public.goals;
create policy "goals: delete own" on public.goals
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- tasks.goal_id — relie les actions à leur direction (on delete set null :
-- supprimer un objectif ne supprime jamais de tâche).
-- ---------------------------------------------------------------------
alter table public.tasks add column if not exists goal_id uuid
  references public.goals(id) on delete set null;

create index if not exists tasks_goal_id_idx on public.tasks (goal_id);
