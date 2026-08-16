-- =====================================================================
-- Kininaru — OAuth state (protection CSRF des flux Google / Microsoft)
--
-- Run in the Supabase SQL Editor (additive, safe to re-run).
--
-- Problème corrigé : le state OAuth contenait directement l'user id
-- (insuffisant contre le CSRF / le login CSRF : un attaquant pouvait
-- forger un état lié à SA victime sans avoir à le deviner).
--
-- Nouvelle architecture (lib/oauth-state.ts) :
--   * le state est une valeur aléatoire de 32 octets (base64url),
--     générée côté serveur uniquement ;
--   * elle est stockée ICI avec l'user_id et une expiration de 10 min ;
--   * le callback consomme l'état ATOMIQUEMENT (une seule UPDATE possible)
--     : replay impossible (consumed_at), état expiré refusé, état lié à
--     un autre utilisateur refusé ;
--   * la table est inaccessible au client (REVOKE anon/authenticated) —
--     seuls les routes API serveur (service role) écrivent/lisent.
--
-- Nettoyage : les états consommés/expirés sont purgés par le cron
-- quotidien (app/api/cron/daily/route.ts) — aucune accumulation.
--
-- `return_to` : chemin interne (jamais d'URL absolue) vers lequel le
-- callback redirige après connexion/déconnexion — validé et borné côté
-- serveur (voir lib/oauth-state.ts).
-- =====================================================================

create table if not exists public.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  return_to text
);

-- Additif : permet de revenir vers la page d'où l'utilisateur a lancé le
-- flux (ex. /calendar au lieu de /settings) après le callback OAuth.
alter table public.oauth_states add column if not exists return_to text;

alter table public.oauth_states enable row level security;

create index if not exists oauth_states_expires_idx
  on public.oauth_states (expires_at);

-- RLS activé sans politique + privilèges révoqués = refus par défaut pour
-- anon/authenticated. Seul le rôle de service (routes API) y accède.
revoke all on public.oauth_states from anon, authenticated;
