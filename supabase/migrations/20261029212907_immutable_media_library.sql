begin;
create table if not exists public.gauntlet_media_capacity(id text primary key check(id='library'), max_bytes bigint not null check(max_bytes between 1048576 and 1099511627776));
create table if not exists public.gauntlet_media_objects(
  sha256 text primary key check(sha256 ~ '^[a-f0-9]{64}$'),
  bytes bigint not null check(bytes between 1 and 16777216),
  media_type text not null check(media_type in ('image/webp','audio/wav')),
  reserved_at timestamptz not null default now()
);
alter table public.gauntlet_media_capacity enable row level security;
alter table public.gauntlet_media_objects enable row level security;
revoke all on public.gauntlet_media_capacity,public.gauntlet_media_objects from public,anon,authenticated;
grant select,insert,update on public.gauntlet_media_capacity to service_role;
grant select,insert on public.gauntlet_media_objects to service_role;
create or replace function public.reserve_gauntlet_media(p_sha256 text,p_bytes bigint,p_media_type text,p_limit bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare budget bigint; used bigint; prior public.gauntlet_media_objects%rowtype;
begin
  if p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_bytes is null or p_bytes not between 1 and 16777216
    or p_media_type is null or p_media_type not in ('image/webp','audio/wav') or p_limit is null or p_limit not between 1048576 and 1099511627776 then
    raise exception 'Invalid media reservation' using errcode='22023';
  end if;
  insert into public.gauntlet_media_capacity values('library',p_limit) on conflict do nothing;
  select max_bytes into budget from public.gauntlet_media_capacity where id='library' for update;
  if budget <> p_limit then raise exception 'Media capacity configuration changed; reconcile the library budget' using errcode='22023'; end if;
  select * into prior from public.gauntlet_media_objects where sha256=p_sha256;
  if found and (prior.bytes <> p_bytes or prior.media_type <> p_media_type) then raise exception 'Immutable media identity mismatch' using errcode='22023'; end if;
  select coalesce(sum(bytes),0) into used from public.gauntlet_media_objects;
  if prior.sha256 is null then
    if used+p_bytes > budget then raise exception 'Media library capacity exhausted; no retained object was removed' using errcode='54000'; end if;
    insert into public.gauntlet_media_objects(sha256,bytes,media_type) values(p_sha256,p_bytes,p_media_type);
    used := used+p_bytes;
  end if;
  return jsonb_build_object('reservedBytes',used,'maxBytes',budget,'remainingBytes',budget-used);
end;
$$;
revoke all on function public.reserve_gauntlet_media(text,bigint,text,bigint) from public,anon,authenticated;
grant execute on function public.reserve_gauntlet_media(text,bigint,text,bigint) to service_role;
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists gauntlet_private_media_objects on storage.objects';
    execute $policy$create policy gauntlet_private_media_objects on storage.objects as restrictive for all to anon,authenticated
      using(bucket_id <> 'gauntlet-admin-media') with check(bucket_id <> 'gauntlet-admin-media')$policy$;
  end if;
end $$;
notify pgrst,'reload schema';
commit;
