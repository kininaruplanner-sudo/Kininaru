-- =====================================================================
-- Kininaru — Chiffrement des tokens calendrier avec Supabase Vault
-- (OPTIONNEL — plans Supabase avec l'extension supabase_vault)
--
-- Contexte (audit de sécurité) : les colonnes access_token / refresh_token
-- de calendar_connections sont stockées en clair. La barrière de sécurité
-- ACTUELLE (et suffisante pour la bêta) est :
--   1. REVOKE total des tables pour anon/authenticated — le navigateur ne
--      peut JAMAIS lire les tokens, quoi qu'il demande
--      (supabase/calendar-security.sql) ;
--   2. toutes les lectures/écritures passent par les routes API serveur
--      avec la clé service_role.
-- Le chiffrement au repos (Vault) est un renfort supplémentaire,
-- disponible uniquement sur les plans Supabase qui activent
-- supabase_vault (Pro et supérieurs).
--
-- ⚠️ NE PAS exécuter ce fichier tant que le runtime applicatif ne lit pas
--    les secrets via Vault : la bascule (lib/calendar/oauth.ts et
--    app/api/calendar/[provider]/sync/route.ts écrivent/lisent via
--    vault.create_secret / vault.decrypted_secrets) doit être faite en
--    même temps, sinon la synchronisation lirait des colonnes vidées.
--    Ce fichier est une PRÉPARATION documentée, pas une migration à
--    appliquer isolément. Sur les plans gratuits (bêta), l'extension
--    n'est pas disponible : gardez l'architecture REVOKE + service role.
-- =====================================================================

-- Extension Vault (échoue proprement si le plan ne la permet pas).
create extension if not exists supabase_vault;

-- Colonne de liaison : id du secret Vault pour les tokens d'une connexion.
alter table public.calendar_connections
  add column if not exists vault_secret_id uuid;

-- Exemple de bascule (une fois le runtime prêt) :
--   with s as (
--     select vault.create_secret(
--       concat_ws('|', access_token, coalesce(refresh_token, '')),
--       'kininaru-cal:' || id::text
--     ) as secret_id
--     from public.calendar_connections
--     where access_token is not null
--   )
--   update public.calendar_connections cc
--   set vault_secret_id = s.secret_id
--   from s;
--
-- Exemple de lecture (côté serveur uniquement) :
--   select (vault.decrypted_secrets.decrypted_secret)::text
--   from vault.decrypted_secrets
--   where id = <vault_secret_id>;
