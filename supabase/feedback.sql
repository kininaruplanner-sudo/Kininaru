-- =====================================================================
-- Kininaru — Retours utilisateurs (version BÊTA)
--
-- FICHIER ADDITIF : à exécuter dans Supabase Dashboard → SQL Editor,
-- en complément de supabase/schema.sql (il ne supprime rien et ne touche
-- à aucune table existante). Peut être relancé sans risque.
--
-- La table `feedback` reçoit les bugs et suggestions envoyés depuis
-- Paramètres → Aider à améliorer Kininaru. Une seule table pour les deux
-- flux (bug / suggestion), distingués par la colonne `kind`.
--
-- SÉCURITÉ (RLS) :
--   - insert : l'utilisateur connecté ne peut créer que SES retours
--              (auth.uid() = user_id). Aucun insert anonyme.
--   - select : un utilisateur ne peut consulter QUE ses propres retours.
--   - Aucune politique update/delete : personne (ni l'auteur) ne peut
--     modifier ou supprimer un retour depuis l'application — les retours
--     sont immuables et uniquement lus par l'administrateur via la
--     service-role (Supabase Dashboard / Table Editor).
-- =====================================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  -- null = retour anonyme (colonne prévue ; l'API actuelle exige une session)
  user_id uuid references auth.users(id) on delete set null,
  -- 'bug' | 'suggestion' — le flux qui a produit le retour
  kind text not null check (kind in ('bug', 'suggestion')),
  -- Sous-catégorie (voir whitelist côté serveur, /api/feedback) :
  --   bug        : bug | feature-not-working | display | login | ai | other
  --   suggestion : new-feature | improvement | design | ai | performance | other
  category text not null,
  description text not null,
  steps_to_reproduce text,
  -- 'low' | 'medium' | 'high' | 'blocking' (bugs uniquement)
  severity text check (severity in ('low', 'medium', 'high', 'blocking')),
  page_url text,
  app_version text,
  browser text,
  device text,
  -- 'new' | 'read' | 'in_progress' | 'done' (suivi par l'équipe)
  status text not null default 'new' check (status in ('new', 'read', 'in_progress', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_status_idx
  on public.feedback (status, created_at desc);

create index if not exists feedback_user_idx
  on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

-- L'utilisateur crée uniquement ses propres retours (jamais anonyme côté API).
create policy "feedback: insert own"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- L'utilisateur peut consulter uniquement ses propres retours.
create policy "feedback: select own"
  on public.feedback for select
  using (auth.uid() = user_id);

-- Pas de politique update ni delete : les retours sont immuables.
-- L'équipe les traite via la clé service_role (Dashboard / Table Editor).

-- ---------------------------------------------------------------------
-- Consultation administrateur (rien de public) — exemple de requête à
-- lancer dans Supabase → SQL Editor avec le rôle service (Dashboard) :
--
--   select * from public.feedback order by created_at desc limit 50;
--
-- Ou via Table Editor → feedback.
-- ---------------------------------------------------------------------
