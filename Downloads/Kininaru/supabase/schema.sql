-- =====================================================================
-- Kininaru Planner — Supabase schema
-- Supprime les anciennes tables puis recrée tout ce dont l'app a besoin.
-- À exécuter dans Supabase Dashboard → SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nettoyage : supprime les anciennes tables (et tout ce qui en dépend)
-- ---------------------------------------------------------------------
drop table if exists public.habit_logs cascade;
drop table if exists public.habits cascade;
drop table if exists public.journal_entries cascade;
drop table if exists public.focus_sessions cascade;
drop table if exists public.events cascade;
drop table if exists public.tasks cascade;
drop table if exists public.profiles cascade;

drop function if exists public.update_habit_streak(uuid) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;

-- ---------------------------------------------------------------------
-- 1. profiles — un profil par utilisateur auth.users
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  xp integer not null default 0,
  level integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

-- Crée automatiquement un profil à l'inscription
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. tasks
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  due_date date,
  tags text[] not null default '{}',
  color text not null default '#CDE9D2',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index tasks_user_id_idx on public.tasks(user_id);
create index tasks_parent_id_idx on public.tasks(parent_id);
create index tasks_status_idx on public.tasks(status);

alter table public.tasks enable row level security;

create policy "tasks: select own" on public.tasks
  for select using (auth.uid() = user_id);
create policy "tasks: insert own" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks: update own" on public.tasks
  for update using (auth.uid() = user_id);
create policy "tasks: delete own" on public.tasks
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3. events (calendrier)
-- ---------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  color text not null default '#CDE9D2',
  category text not null default 'default',
  created_at timestamptz not null default now()
);

create index events_user_id_idx on public.events(user_id);
create index events_start_at_idx on public.events(start_at);

alter table public.events enable row level security;

create policy "events: select own" on public.events
  for select using (auth.uid() = user_id);
create policy "events: insert own" on public.events
  for insert with check (auth.uid() = user_id);
create policy "events: update own" on public.events
  for update using (auth.uid() = user_id);
create policy "events: delete own" on public.events
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4. habits
-- ---------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  color text not null default '#F6B7D2',
  streak integer not null default 0,
  best_streak integer not null default 0,
  created_at timestamptz not null default now()
);

create index habits_user_id_idx on public.habits(user_id);

alter table public.habits enable row level security;

create policy "habits: select own" on public.habits
  for select using (auth.uid() = user_id);
create policy "habits: insert own" on public.habits
  for insert with check (auth.uid() = user_id);
create policy "habits: update own" on public.habits
  for update using (auth.uid() = user_id);
create policy "habits: delete own" on public.habits
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 5. habit_logs — un check-in par habitude et par jour
-- ---------------------------------------------------------------------
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, logged_date)
);

create index habit_logs_user_id_idx on public.habit_logs(user_id);
create index habit_logs_habit_id_idx on public.habit_logs(habit_id);
create index habit_logs_logged_date_idx on public.habit_logs(logged_date);

alter table public.habit_logs enable row level security;

create policy "habit_logs: select own" on public.habit_logs
  for select using (auth.uid() = user_id);
create policy "habit_logs: insert own" on public.habit_logs
  for insert with check (auth.uid() = user_id);
create policy "habit_logs: update own" on public.habit_logs
  for update using (auth.uid() = user_id);
create policy "habit_logs: delete own" on public.habit_logs
  for delete using (auth.uid() = user_id);

-- Recalcule streak / best_streak d'une habitude à partir de ses logs
create function public.update_habit_streak(p_habit_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_current_streak integer := 0;
  v_best_streak integer := 0;
  v_cursor date := current_date;
begin
  -- Compte les jours consécutifs (en remontant depuis aujourd'hui ou hier)
  if not exists (select 1 from public.habit_logs where habit_id = p_habit_id and logged_date = current_date) then
    v_cursor := current_date - 1;
  end if;

  while exists (select 1 from public.habit_logs where habit_id = p_habit_id and logged_date = v_cursor) loop
    v_current_streak := v_current_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  select coalesce(best_streak, 0) into v_best_streak from public.habits where id = p_habit_id;
  if v_current_streak > v_best_streak then
    v_best_streak := v_current_streak;
  end if;

  update public.habits
  set streak = v_current_streak,
      best_streak = v_best_streak
  where id = p_habit_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. journal_entries — une entrée par jour et par utilisateur
-- ---------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  mood integer check (mood between 1 and 5),
  content text,
  gratitude text,
  goals text,
  created_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index journal_entries_user_id_idx on public.journal_entries(user_id);
create index journal_entries_entry_date_idx on public.journal_entries(entry_date);

alter table public.journal_entries enable row level security;

create policy "journal_entries: select own" on public.journal_entries
  for select using (auth.uid() = user_id);
create policy "journal_entries: insert own" on public.journal_entries
  for insert with check (auth.uid() = user_id);
create policy "journal_entries: update own" on public.journal_entries
  for update using (auth.uid() = user_id);
create policy "journal_entries: delete own" on public.journal_entries
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 7. focus_sessions (Pomodoro / sessions de concentration)
-- ---------------------------------------------------------------------
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  duration_minutes integer not null,
  created_at timestamptz not null default now()
);

create index focus_sessions_user_id_idx on public.focus_sessions(user_id);
create index focus_sessions_created_at_idx on public.focus_sessions(created_at);

alter table public.focus_sessions enable row level security;

create policy "focus_sessions: select own" on public.focus_sessions
  for select using (auth.uid() = user_id);
create policy "focus_sessions: insert own" on public.focus_sessions
  for insert with check (auth.uid() = user_id);
create policy "focus_sessions: delete own" on public.focus_sessions
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- Fin du schéma.
-- =====================================================================
