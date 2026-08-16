-- =====================================================================
-- Kininaru — Import de synchronisation calendrier ATOMIQUE
--
-- Run in the Supabase SQL Editor (additive, safe to re-run).
--
-- Problème corrigé : la route de synchronisation enchaînait des inserts
-- Supabase successifs (événement créé → mapping inséré). Si le mapping
-- échouait, un événement orphelin restait en base ; pire, un événement
-- modifié pouvait être mis à jour sans son mapping. Tout est désormais
-- fait dans UNE transaction PostgreSQL (une seule fonction plpgsql) :
--  - upsert de l'événement + du mapping (déduplication par
--    (connection_id, external_event_id)) ;
--  - suppression des événements importés qui ont disparu chez le
--    fournisseur, SCOPÉE à la fenêtre synchronisée (un événement sorti
--    de la fenêtre n'est jamais supprimé — on ne détruit pas l'historique) ;
--  - garde d'appartenance : la connexion doit appartenir à l'utilisateur,
--    et (si appelée par un client RLS) chaque ligne reste soumise aux
--    politiques — aucune donnée d'autrui n'est accessible.
--
-- Exécution : idempotent (create or replace), les tokens OAuth ne sont
-- jamais lus ni écrits par cette fonction.
-- =====================================================================

create or replace function public.calendar_import_events(
  p_user_id uuid,
  p_connection_id uuid,
  p_items jsonb,
  p_delete_missing boolean default true,
  p_window_start timestamptz default '-infinity'::timestamptz
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer := 0;
  v_item jsonb;
  v_ext_id text;
  v_event_id uuid;
  v_existing uuid;
  v_ext_ids text[] := '{}'::text[];
begin
  -- La connexion doit appartenir à l'utilisateur (jamais de cross-tenant).
  if not exists (
    select 1 from public.calendar_connections
    where id = p_connection_id and user_id = p_user_id
  ) then
    raise exception 'CONNECTION_NOT_FOUND';
  end if;

  select coalesce(array_agg((x.value->>'external_id')), '{}'::text[])
    into v_ext_ids
    from jsonb_array_elements(p_items) x
    where (x.value->>'external_id') is not null;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_ext_id := v_item->>'external_id';
    if v_ext_id is null or v_ext_id = '' then
      continue;
    end if;

    select cse.event_id into v_existing
      from public.calendar_synced_events cse
      where cse.connection_id = p_connection_id
        and cse.external_event_id = v_ext_id
      limit 1;

    if v_existing is not null then
      update public.events e
        set title       = coalesce(nullif(v_item->>'title', ''), '(sans titre)'),
            description = v_item->>'description',
            location    = v_item->>'location',
            start_at    = (v_item->>'start_at')::timestamptz,
            end_at      = (v_item->>'end_at')::timestamptz
        where e.id = v_existing
          and e.user_id = p_user_id;
      update public.calendar_synced_events cse
        set external_etag = v_item->>'etag',
            last_synced_at = now()
        where cse.connection_id = p_connection_id
          and cse.external_event_id = v_ext_id;
    else
      insert into public.events (
        user_id, title, description, location, start_at, end_at, color, category
      ) values (
        p_user_id,
        coalesce(nullif(v_item->>'title', ''), '(sans titre)'),
        v_item->>'description',
        v_item->>'location',
        (v_item->>'start_at')::timestamptz,
        (v_item->>'end_at')::timestamptz,
        '#CDE9D2',
        'external'
      )
      returning id into v_event_id;

      insert into public.calendar_synced_events (
        user_id, connection_id, external_event_id, event_id, external_etag
      ) values (
        p_user_id, p_connection_id, v_ext_id, v_event_id, v_item->>'etag'
      );
    end if;
    v_count := v_count + 1;
  end loop;

  -- Événements disparus chez le fournisseur : suppression scoped à la
  -- fenêtre (le mapping est supprimé par cascade sur events.id).
  if p_delete_missing and v_ext_ids is not null and cardinality(v_ext_ids) > 0 then
    delete from public.events e
    using public.calendar_synced_events cse
    where cse.connection_id = p_connection_id
      and cse.event_id = e.id
      and e.user_id = p_user_id
      and e.start_at >= p_window_start
      and not (cse.external_event_id = any(v_ext_ids));
  end if;

  return v_count;
end;
$$;

revoke all on function public.calendar_import_events(uuid, uuid, jsonb, boolean, timestamptz) from public;
grant execute on function public.calendar_import_events(uuid, uuid, jsonb, boolean, timestamptz) to authenticated, service_role;
