-- =====================================================================
-- Kininaru Planner — Supabase schema (DEVELOPMENT ONLY)
-- =====================================================================
-- ⚠️  WARNING: This file DESTROYS all data in the listed tables.
--
-- NEVER run this file against a production database.
-- NEVER run this file against a database with real user data.
--
-- For production deployments, use schema-bootstrap-safe.sql instead.
-- =====================================================================
--
-- Supprime les anciennes tables puis recrée tout ce dont l'app a besoin.
-- À exécuter dans Supabase Dashboard → SQL Editor (dev uniquement).
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
  memory_enabled boolean not null default true,
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
  v_owner uuid;
begin
  -- Security: verify the habit belongs to the authenticated user
  select user_id into v_owner from public.habits where id = p_habit_id;
  if v_owner is null then
    raise exception 'Habitude introuvable';
  end if;
  if v_owner != auth.uid() then
    raise exception 'Accès refusé';
  end if;

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

-- ---------------------------------------------------------------------
-- 8. notifications — centre de notifications in-app
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'info' check (type in ('info', 'family', 'task', 'habit', 'achievement')),
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_read_idx on public.notifications(read);

alter table public.notifications enable row level security;

create policy "notifications: select own" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications: insert own" on public.notifications
  for insert with check (auth.uid() = user_id);
create policy "notifications: update own" on public.notifications
  for update using (auth.uid() = user_id);
create policy "notifications: delete own" on public.notifications
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 9. families — groupes familiaux partagés
--    Ordre imposé par PostgreSQL : tables → fonctions → policies
--    (les fonctions et policies référencent les tables et sont validées
--    à la création).
-- ---------------------------------------------------------------------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create index families_created_by_idx on public.families(created_by);

alter table public.families enable row level security;

create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('parent', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index family_members_user_id_idx on public.family_members(user_id);

alter table public.family_members enable row level security;

-- Helpers security-definer : les policies RLS qui vérifient l'appartenance
-- appellent ces fonctions au lieu de se référencer elles-mêmes (évite la
-- récursion infinie de RLS et centralise la logique d'appartenance).
create function public.is_family_member(p_family_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = auth.uid()
  );
$$;

create function public.is_family_parent(p_family_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = auth.uid() and role = 'parent'
  );
$$;

-- Un membre voit les membres de ses familles.
create policy "family_members: select members" on public.family_members
  for select using (public.is_family_member(family_id));
-- Le créateur d'une famille devient automatiquement parent.
create policy "family_members: insert owner" on public.family_members
  for insert with check (
    auth.uid() = user_id and role = 'parent' and
    exists (select 1 from public.families f where f.id = family_id and f.created_by = auth.uid())
  );
-- Un parent peut retirer un membre ; un membre peut quitter lui-même.
create policy "family_members: delete parent" on public.family_members
  for delete using (auth.uid() = user_id or public.is_family_parent(family_id));

-- Une famille est visible par son créateur et par ses membres.
create policy "families: select members" on public.families
  for select using (auth.uid() = created_by or public.is_family_member(id));
create policy "families: insert own" on public.families
  for insert with check (auth.uid() = created_by);
create policy "families: update owner" on public.families
  for update using (auth.uid() = created_by);
create policy "families: delete owner" on public.families
  for delete using (auth.uid() = created_by);

-- Rejoindre une famille par code d'invitation (sécurisé : vérifie le code,
-- crée l'appartenance et notifie le créateur). Les codes d'invitation ne sont
-- jamais exposés en lecture.
create function public.join_family(p_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_family public.families;
begin
  select * into v_family from public.families where invite_code = p_code;
  if not found then
    raise exception 'Code d''invitation invalide';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (v_family.id, auth.uid(), 'member')
  on conflict (family_id, user_id) do nothing;

  if exists (select 1 from public.family_members fm where fm.family_id = v_family.id and fm.user_id = auth.uid()) then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      v_family.created_by,
      'family',
      'Nouveau membre dans ' || v_family.name,
      (select coalesce(display_name, 'Quelqu''un') from public.profiles where id = auth.uid()) || ' a rejoint votre famille.',
      '/family'
    );
  end if;

  return v_family.id;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. family_events — calendrier partagé
-- ---------------------------------------------------------------------
create table public.family_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  color text not null default '#CDE9D2',
  created_at timestamptz not null default now()
);

create index family_events_family_id_idx on public.family_events(family_id);

alter table public.family_events enable row level security;

create policy "family_events: select members" on public.family_events
  for select using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_id and fm.user_id = auth.uid()
    )
  );
create policy "family_events: insert members" on public.family_events
  for insert with check (
    auth.uid() = user_id and
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_id and fm.user_id = auth.uid()
    )
  );
create policy "family_events: update members" on public.family_events
  for update using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_id and fm.user_id = auth.uid()
    )
  );
create policy "family_events: delete members" on public.family_events
  for delete using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_id and fm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 12. family_tasks — tâches partagées avec assignation optionnelle
-- ---------------------------------------------------------------------
create table public.family_tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assignee_id uuid references auth.users(id) on delete set null,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index family_tasks_family_id_idx on public.family_tasks(family_id);

alter table public.family_tasks enable row level security;

create policy "family_tasks: select members" on public.family_tasks
  for select using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_id and fm.user_id = auth.uid()
    )
  );
create policy "family_tasks: insert members" on public.family_tasks
  for insert with check (
    auth.uid() = user_id and
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_id and fm.user_id = auth.uid()
    )
  );
create policy "family_tasks: update members" on public.family_tasks
  for update using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_id and fm.user_id = auth.uid()
    )
  );
create policy "family_tasks: delete members" on public.family_tasks
  for delete using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_id and fm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 13. ai_memories — mémoire de l'assistant (opt-in, strictement privée)
--     Conçue pour l'ÉTAPE 12 (mémoire persistante) : uniquement des faits
--     durables que l'utilisateur a explicitement choisi de mémoriser via
--     une proposition IA confirmée, ou ajoutés à la main dans Paramètres.
--     Jamais de contenu automatique : aucune donnée n'est écrite sans
--     action explicite de l'utilisateur.
-- ---------------------------------------------------------------------
create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  category text not null default 'fact'
    check (category in ('fact', 'goal', 'preference', 'habit', 'other')),
  created_at timestamptz not null default now()
);

create index ai_memories_user_id_idx on public.ai_memories(user_id, created_at desc);

alter table public.ai_memories enable row level security;

create policy "ai_memories: select own" on public.ai_memories
  for select using (auth.uid() = user_id);
create policy "ai_memories: insert own" on public.ai_memories
  for insert with check (auth.uid() = user_id);
create policy "ai_memories: update own" on public.ai_memories
  for update using (auth.uid() = user_id);
create policy "ai_memories: delete own" on public.ai_memories
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- Fin du schéma.
-- =====================================================================
