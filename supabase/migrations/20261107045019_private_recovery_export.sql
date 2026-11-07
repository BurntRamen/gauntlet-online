begin;

-- A single STABLE call reads one PostgreSQL statement snapshot. Credentials,
-- private drafts and receipts are never exposed to client database roles.
create or replace function public.export_gauntlet_recovery()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  names text[] := array['gauntlet_accounts','gauntlet_friends','gauntlet_friend_messages','gauntlet_account_layouts','gauntlet_faction_stats','gauntlet_match_records',
    'gauntlet_match_events','gauntlet_match_consequence_receipts','gauntlet_match_archive_index',
    'gauntlet_private_authoring','gauntlet_runtime_states','gauntlet_runtime_commits',
    'gauntlet_media_capacity','gauntlet_media_objects'];
  name text; rows jsonb; columns jsonb; result jsonb := '{}'::jsonb;
begin
  foreach name in array names loop
    select jsonb_agg(jsonb_build_object('name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod)) order by a.attnum)
      into columns from pg_catalog.pg_attribute a
      where a.attrelid=pg_catalog.to_regclass('public.'||name) and a.attnum>0 and not a.attisdropped and a.attgenerated='';
    if columns is null then raise exception 'Recovery table missing: %',name; end if;
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)),''[]''::jsonb) from public.%I t',name) into rows;
    result := result || jsonb_build_object(name,jsonb_build_object('columns',columns,'rows',rows));
  end loop;
  if pg_column_size(result)>134217728 then raise exception 'Recovery export exceeds 128 MiB; use a database dump and object export'; end if;
  return jsonb_build_object('schemaVersion','gauntlet.project-recovery.v1','tables',result);
end;
$$;
revoke all on function public.export_gauntlet_recovery() from public,anon,authenticated;
grant execute on function public.export_gauntlet_recovery() to service_role;

create table if not exists public.gauntlet_recovery_receipts (
  id uuid primary key, fingerprint text not null, restored_at timestamptz not null default now()
);
alter table public.gauntlet_recovery_receipts enable row level security;
revoke all on public.gauntlet_recovery_receipts from public,anon,authenticated;
grant select,insert on public.gauntlet_recovery_receipts to service_role;

-- Only accepts a completely empty, schema-compatible destination. No upsert,
-- truncate, DELETE, UPDATE, role change or trigger bypass is available.
create or replace function public.restore_gauntlet_recovery(p_id uuid,p_snapshot jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  names text[] := array['gauntlet_accounts','gauntlet_friends','gauntlet_friend_messages','gauntlet_account_layouts','gauntlet_faction_stats','gauntlet_match_records',
    'gauntlet_match_events','gauntlet_match_consequence_receipts','gauntlet_match_archive_index',
    'gauntlet_private_authoring','gauntlet_runtime_states','gauntlet_runtime_commits',
    'gauntlet_media_capacity','gauntlet_media_objects'];
  name text; occupied boolean; columns jsonb; column_sql text; prior text;
  fingerprint text := md5(p_snapshot::text);
begin
  if p_id is null or p_snapshot->>'schemaVersion' is distinct from 'gauntlet.project-recovery.v1'
    or jsonb_typeof(p_snapshot->'tables') is distinct from 'object' or pg_column_size(p_snapshot)>134217728
    or (select array_agg(key order by key) from jsonb_object_keys(p_snapshot->'tables') key)
      is distinct from (select array_agg(n order by n) from unnest(names) n) then
    raise exception 'Unsupported recovery snapshot';
  end if;
  -- Lock all destinations before checking emptiness; concurrent restores/writers
  -- cannot interleave with this transaction.
  lock table public.gauntlet_recovery_receipts in exclusive mode;
  select r.fingerprint into prior from public.gauntlet_recovery_receipts r where r.id=p_id;
  if found then
    if prior<>fingerprint then raise exception 'Recovery identity reused for different data'; end if;
    return jsonb_build_object('restored',true,'duplicate',true);
  end if;
  foreach name in array names loop
    execute format('lock table public.%I in exclusive mode',name);
    execute format('select exists(select 1 from public.%I)',name) into occupied;
    if occupied then raise exception 'Destination is not empty: %. Nothing was replaced.',name; end if;
    select jsonb_agg(jsonb_build_object('name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod)) order by a.attnum),
      string_agg(quote_ident(a.attname),',' order by a.attnum)
      into columns,column_sql from pg_catalog.pg_attribute a
      where a.attrelid=pg_catalog.to_regclass('public.'||name) and a.attnum>0 and not a.attisdropped and a.attgenerated='';
    if columns is distinct from p_snapshot->'tables'->name->'columns'
      or jsonb_typeof(p_snapshot->'tables'->name->'rows') is distinct from 'array' then
      raise exception 'Destination schema differs: %',name;
    end if;
    if exists(select 1 from jsonb_array_elements(p_snapshot->'tables'->name->'rows') row
      where (select array_agg(key order by key) from jsonb_object_keys(row) key)
        is distinct from (select array_agg(c->>'name' order by c->>'name') from jsonb_array_elements(columns) c)) then
      raise exception 'Unknown or missing recovery columns: %',name;
    end if;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1)',name,column_sql,column_sql,name)
      using p_snapshot->'tables'->name->'rows';
  end loop;
  insert into public.gauntlet_recovery_receipts(id,fingerprint) values(p_id,fingerprint);
  return jsonb_build_object('restored',true,'duplicate',false);
end;
$$;
-- The normal application credential keeps its immutable-table restrictions.
-- EXCLUSIVE locks require database-owner privileges. Import is an offline owner
-- operation, never a public/privileged REST operation on the running service.
revoke all on function public.restore_gauntlet_recovery(uuid,jsonb) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
