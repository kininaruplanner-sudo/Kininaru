-- =====================================================================
-- Kininaru Coach — conversations & messages (ÉTAPE 14, §16-18)
-- =====================================================================
-- FICHIER ADDITIF : à exécuter dans Supabase Dashboard → SQL Editor,
-- en complément de supabase/schema.sql (il ne supprime rien et ne touche
-- à aucune table existante). Peut être relancé sans risque.
--
-- Chaque conversation et chaque message appartiennent exclusivement à
-- l'utilisateur connecté (RLS : auth.uid() = user_id). Aucune donnée
-- d'une autre famille ou d'un autre utilisateur n'est accessible.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. coach_conversations — une conversation = une session de chat IA
-- ---------------------------------------------------------------------
create table if not exists public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nouvelle conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_conversations_user_idx
  on public.coach_conversations(user_id, updated_at desc);

alter table public.coach_conversations enable row level security;

create policy "coach_conversations: select own"
  on public.coach_conversations for select
  using (auth.uid() = user_id);

create policy "coach_conversations: insert own"
  on public.coach_conversations for insert
  with check (auth.uid() = user_id);

create policy "coach_conversations: update own"
  on public.coach_conversations for update
  using (auth.uid() = user_id);

create policy "coach_conversations: delete own"
  on public.coach_conversations for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. coach_messages — les messages d'une conversation
--    (cascade : supprimer la conversation supprime ses messages)
-- ---------------------------------------------------------------------
create table if not exists public.coach_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.coach_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_conv_idx
  on public.coach_messages(conversation_id, created_at asc);

alter table public.coach_messages enable row level security;

create policy "coach_messages: select own"
  on public.coach_messages for select
  using (auth.uid() = user_id);

create policy "coach_messages: insert own"
  on public.coach_messages for insert
  with check (auth.uid() = user_id);

-- Mise à jour réservée au streaming du message assistant en cours.
create policy "coach_messages: update own"
  on public.coach_messages for update
  using (auth.uid() = user_id);

create policy "coach_messages: delete own"
  on public.coach_messages for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Aide : les notifications in-app du coach réutilisent la table
-- `notifications` déjà présente dans schema.sql (type 'info').
-- ---------------------------------------------------------------------
