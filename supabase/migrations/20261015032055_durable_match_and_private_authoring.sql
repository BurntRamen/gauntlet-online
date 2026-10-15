-- Run after the account stats concurrency guard. Existing account data is untouched.
begin;
grant select on public.gauntlet_accounts to service_role;
grant update (stats, last_seen_at) on public.gauntlet_accounts to service_role;

-- The existing aggregate/journal adapter also needs its private durable table.
create table if not exists public.gauntlet_faction_stats (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.gauntlet_faction_stats enable row level security;
revoke all on public.gauntlet_faction_stats from public, anon, authenticated;
grant select, insert, update on public.gauntlet_faction_stats to service_role;
create table if not exists public.gauntlet_match_records (
  id uuid primary key,
  series_id uuid,
  mode text not null,
  rules_version text not null,
  content_version text not null,
  ranked boolean not null default false,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  completion_reason text not null,
  winner_player_num integer,
  participant_account_ids uuid[] not null default '{}'::uuid[],
  record jsonb not null
);

create index if not exists gauntlet_match_records_completed_idx
  on public.gauntlet_match_records (completed_at desc);

create index if not exists gauntlet_match_records_participants_idx
  on public.gauntlet_match_records using gin (participant_account_ids);

-- Lightweight discovery metadata for the immutable canonical record-v2 JSON
-- stored in the private `gauntlet-match-archives` Storage bucket. This index
-- is not authoritative match truth and intentionally excludes evidence,
-- replay frames, completion envelopes, and full match JSON.
create table if not exists public.gauntlet_match_archive_index (
  match_id uuid primary key,
  index_version text not null check (index_version = 'gauntlet.match-archive-index.v1'),
  record_version integer not null check (record_version = 2),
  completed_at timestamptz not null,
  participant_account_ids uuid[] not null default '{}'::uuid[],
  participants jsonb not null default '[]'::jsonb,
  mode text not null,
  ranked boolean not null default false,
  season jsonb,
  winner_player_num integer,
  completion_reason text not null,
  archive_object_key text not null unique,
  archive_sha256 text not null check (archive_sha256 ~ '^[0-9a-f]{64}$'),
  archive_byte_size bigint not null check (archive_byte_size > 0),
  archive_status text not null default 'archived' check (archive_status in ('archived', 'degraded')),
  archive_object_version text not null default 'record-v2' check (archive_object_version = 'record-v2'),
  indexed_at timestamptz not null default now()
);

create index if not exists gauntlet_match_archive_completed_idx
  on public.gauntlet_match_archive_index (completed_at desc);

create index if not exists gauntlet_match_archive_participants_idx
  on public.gauntlet_match_archive_index using gin (participant_account_ids);

create table if not exists public.gauntlet_match_events (
  match_id uuid not null references public.gauntlet_match_records(id) on delete cascade,
  sequence integer not null,
  turn integer not null,
  phase text not null,
  actor_player_num integer,
  event_type text not null,
  public_payload jsonb not null default '{}'::jsonb,
  server_timestamp timestamptz not null,
  state_checksum text,
  primary key (match_id, sequence)
);

-- One receipt per authoritative match/account pair. The pair is the durable
-- idempotency key for account statistics, deck records, campaign progress,
-- history, achievements, cosmetics, and earned booster credits.
create table if not exists public.gauntlet_match_consequence_receipts (
  match_id uuid not null references public.gauntlet_match_records(id) on delete cascade,
  account_id uuid not null references public.gauntlet_accounts(id) on delete cascade,
  result text not null check (result in ('win', 'loss', 'draw')),
  consequence jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now(),
  primary key (match_id, account_id)
);

create index if not exists gauntlet_match_consequence_receipts_account_idx
  on public.gauntlet_match_consequence_receipts (account_id, applied_at desc);

-- Supabase deployments should call this RPC for the final commit. The
-- application supplies the authoritative match, event rows, consequence
-- deltas, and prepared account projections. They are committed together;
-- the unique receipt insert makes retries and concurrent calls no-op.
drop function if exists public.finalize_gauntlet_match(jsonb, jsonb, jsonb);

create or replace function public.finalize_gauntlet_match(
  p_record jsonb,
  p_events jsonb default '[]'::jsonb,
  p_consequences jsonb default '[]'::jsonb,
  p_account_applications jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match_id uuid := (p_record->>'matchId')::uuid;
  v_consequence jsonb;
  v_application jsonb;
  v_account_id uuid;
  v_next_stats jsonb;
begin
  insert into public.gauntlet_match_records (
    id, series_id, mode, rules_version, content_version, ranked,
    started_at, completed_at, completion_reason, winner_player_num,
    participant_account_ids, record
  ) values (
    v_match_id,
    nullif(p_record->>'seriesId', '')::uuid,
    p_record->>'mode',
    p_record->>'rulesVersion',
    p_record->>'contentVersion',
    coalesce((p_record->>'ranked')::boolean, false),
    (p_record->>'startedAt')::timestamptz,
    (p_record->>'completedAt')::timestamptz,
    p_record->>'completionReason',
    nullif(p_record->>'winnerPlayerNum', '')::integer,
    coalesce(array(
      select (participant->>'accountId')::uuid
      from jsonb_array_elements(p_record->'participants') as participant
      where nullif(participant->>'accountId', '') is not null
    ), '{}'::uuid[]),
    p_record
  ) on conflict (id) do update set record = excluded.record;

  insert into public.gauntlet_match_events (
    match_id, sequence, turn, phase, actor_player_num, event_type,
    public_payload, server_timestamp, state_checksum
  )
  select v_match_id, sequence, turn, phase, actor_player_num, event_type,
         public_payload, server_timestamp, state_checksum
  from jsonb_to_recordset(coalesce(p_events, '[]'::jsonb)) as event(
    sequence integer,
    turn integer,
    phase text,
    actor_player_num integer,
    event_type text,
    public_payload jsonb,
    server_timestamp timestamptz,
    state_checksum text
  ) on conflict (match_id, sequence) do nothing;

  for v_application in select * from jsonb_array_elements(coalesce(p_account_applications, '[]'::jsonb)) loop
    v_account_id := (v_application->>'accountId')::uuid;
    v_consequence := coalesce(v_application->'consequence', '{}'::jsonb);
    v_next_stats := v_application->'nextStats';
    insert into public.gauntlet_match_consequence_receipts (match_id, account_id, result, consequence)
    values (v_match_id, v_account_id, v_application->>'result', v_consequence)
    on conflict (match_id, account_id) do nothing;
    if found and v_next_stats is not null then
      update public.gauntlet_accounts
      set stats = v_next_stats, last_seen_at = now()
      where id = v_account_id;
    end if;
  end loop;

  -- Keep this loop for compatibility with callers that already persisted
  -- receipt facts separately; account applications above are the atomic path.
  for v_consequence in select * from jsonb_array_elements(coalesce(p_consequences, '[]'::jsonb)) loop
    v_account_id := (v_consequence->>'accountId')::uuid;
    insert into public.gauntlet_match_consequence_receipts (match_id, account_id, result, consequence)
    values (v_match_id, v_account_id, v_consequence->>'result', v_consequence)
    on conflict (match_id, account_id) do nothing;
  end loop;

  return jsonb_build_object('matchId', v_match_id, 'status', 'finalized');
end;
$$;

create or replace function public.apply_gauntlet_account_consequence(
  p_match_id uuid,
  p_account_id uuid,
  p_result text,
  p_consequence jsonb,
  p_next_stats jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.gauntlet_match_consequence_receipts (match_id, account_id, result, consequence)
  values (p_match_id, p_account_id, p_result, p_consequence)
  on conflict (match_id, account_id) do nothing;
  if not found then
    return jsonb_build_object('alreadyApplied', true);
  end if;
  update public.gauntlet_accounts
  set stats = p_next_stats, last_seen_at = now()
  where id = p_account_id;
  return jsonb_build_object('alreadyApplied', false);
end;
$$;

alter table public.gauntlet_match_records enable row level security;
alter table public.gauntlet_match_archive_index enable row level security;
alter table public.gauntlet_match_events enable row level security;
alter table public.gauntlet_match_consequence_receipts enable row level security;

revoke all on public.gauntlet_match_records from public, anon, authenticated;
revoke all on public.gauntlet_match_archive_index from public, anon, authenticated;
revoke all on public.gauntlet_match_events from public, anon, authenticated;
revoke all on public.gauntlet_match_consequence_receipts from public, anon, authenticated;
grant select, insert, update, delete on public.gauntlet_match_records to service_role;
grant select, insert on public.gauntlet_match_archive_index to service_role;
grant select, insert, update, delete on public.gauntlet_match_events to service_role;
grant select, insert, update, delete on public.gauntlet_match_consequence_receipts to service_role;
revoke execute on function public.finalize_gauntlet_match(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.apply_gauntlet_account_consequence(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_gauntlet_match(jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.apply_gauntlet_account_consequence(uuid, uuid, text, jsonb, jsonb) to service_role;

-- One private, versioned authoring envelope. Publication still packages only
-- selected release assets; private notes and unused uploads never enter GitHub.
create table if not exists public.gauntlet_private_authoring (
  id text primary key check (id = 'shared'),
  revision bigint not null check (revision > 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.gauntlet_private_authoring enable row level security;
revoke all on public.gauntlet_private_authoring from public, anon, authenticated;
grant select, insert, update on public.gauntlet_private_authoring to service_role;

create or replace function public.save_gauntlet_private_authoring(p_expected_revision bigint, p_state jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_revision bigint;
begin
  if p_expected_revision is null or p_expected_revision < 0
    or p_state is null or jsonb_typeof(p_state) <> 'object'
    or p_state->>'schemaVersion' is distinct from 'gauntlet.content-store.v1'
    or octet_length(p_state::text) > 20 * 1024 * 1024 then
    raise exception 'Invalid private authoring envelope' using errcode = '22023';
  end if;
  insert into public.gauntlet_private_authoring(id, revision, state)
  select 'shared', 1, p_state where p_expected_revision = 0
  on conflict (id) do nothing returning revision into v_revision;
  if v_revision is null then
    update public.gauntlet_private_authoring set state = p_state, revision = revision + 1, updated_at = now()
      where id = 'shared' and revision = p_expected_revision returning revision into v_revision;
  end if;
  if v_revision is null then
    raise exception 'Private authoring changed; refresh before retrying' using errcode = '40001';
  end if;
  return v_revision;
end;
$$;
revoke execute on function public.save_gauntlet_private_authoring(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_gauntlet_private_authoring(bigint, jsonb) to service_role;

-- Do not create Storage metadata by SQL. Prepare the buckets through the
-- Storage API using scripts/prepare-durable-storage.js.
-- Restrictive policies also protect these private objects if a project has a
-- broader permissive policy for another application's public media.
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists gauntlet_private_runtime_objects on storage.objects';
    execute $policy$create policy gauntlet_private_runtime_objects on storage.objects
      as restrictive for all to anon, authenticated
      using (bucket_id not in ('gauntlet-runtime-backups', 'gauntlet-match-archives'))
      with check (bucket_id not in ('gauntlet-runtime-backups', 'gauntlet-match-archives'))$policy$;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
