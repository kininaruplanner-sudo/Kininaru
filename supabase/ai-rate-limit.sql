-- =====================================================================
-- Kininaru — Rate limit IA distribué (chat / actions / journal)
--
-- Run in the Supabase SQL Editor (additive, safe to re-run).
--
-- Problème corrigé : les limites d'appel IA (20/min chat, 40/min actions,
-- 10/min journal) étaient tenues dans un Map mémoire par instance
-- serverless. Sur Vercel (plusieurs instances, redémarrages), deux
-- requêtes concurrentes d'un même utilisateur pouvaient toutes deux
-- passer la limite — pas de vraie protection globale du quota Groq.
--
-- Nouvelle architecture (lib/ai/rate-limit.ts) :
--   * chaque « bucket » est une ligne (scope, user_id, bucket_minute) ;
--   * l'incrément est ATOMIQUE (INSERT ... ON CONFLICT DO UPDATE count+1
--     RETURNING) — deux requêtes simultanées comptent toutes les deux ;
--   * la table est inaccessible au client (REVOKE anon/authenticated) :
--     l'utilisateur ne peut pas réinitialiser son propre compteur ;
--   * si la table n'existe pas encore (SQL non exécuté), le fallback
--     mémoire local reste actif — le chat continue de fonctionner.
--
-- Nettoyage : les buckets de plus de 48 h sont purgés par le cron
-- quotidien (app/api/cron/daily/route.ts).
-- =====================================================================

create table if not exists public.ai_rate_limits (
  scope text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_minute bigint not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, user_id, bucket_minute)
);

alter table public.ai_rate_limits enable row level security;

create index if not exists ai_rate_limits_updated_idx
  on public.ai_rate_limits (updated_at);

-- RLS activé sans politique + privilèges révoqués = refus par défaut pour
-- anon/authenticated. Seuls les routes API serveur (service role) écrivent.
revoke all on public.ai_rate_limits from anon, authenticated;

-- Incrément atomique : retourne le compteur APRÈS incrément. Le serveur
-- compare ce retour à la limite — pas de fenêtre de course.
create or replace function public.ai_rate_limit_incr(
  p_scope text,
  p_user_id uuid,
  p_bucket bigint
)
returns integer
language sql
set search_path = public
as $$
  insert into public.ai_rate_limits (scope, user_id, bucket_minute, count)
  values (p_scope, p_user_id, p_bucket, 1)
  on conflict (scope, user_id, bucket_minute)
  do update set count = public.ai_rate_limits.count + 1,
                updated_at = now()
  returning count;
$$;

revoke all on function public.ai_rate_limit_incr(text, uuid, bigint) from public;
grant execute on function public.ai_rate_limit_incr(text, uuid, bigint) to service_role;
