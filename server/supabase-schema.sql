-- Gauntlet Online Supabase schema
-- Run this in the Supabase SQL editor before wiring Render env vars.

create table if not exists gauntlet_accounts (
  id uuid primary key,
  name text not null,
  name_key text not null unique,
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  last_seen_at timestamptz,
  stats jsonb not null default '{}'::jsonb
);

create table if not exists gauntlet_friends (
  account_id uuid not null references gauntlet_accounts(id) on delete cascade,
  friend_id uuid not null references gauntlet_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, friend_id),
  constraint no_self_friend check (account_id <> friend_id)
);

create table if not exists gauntlet_friend_messages (
  id uuid primary key,
  from_id uuid not null references gauntlet_accounts(id) on delete cascade,
  to_id uuid not null references gauntlet_accounts(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists gauntlet_friend_messages_pair_idx
  on gauntlet_friend_messages (from_id, to_id, created_at);

create table if not exists gauntlet_faction_stats (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists gauntlet_match_records (
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
  on gauntlet_match_records (completed_at desc);

create index if not exists gauntlet_match_records_participants_idx
  on gauntlet_match_records using gin (participant_account_ids);

-- Lightweight discovery metadata for the immutable canonical record-v2 JSON
-- stored in the private `gauntlet-match-archives` Storage bucket. This index
-- is not authoritative match truth and intentionally excludes evidence,
-- replay frames, completion envelopes, and full match JSON.
create table if not exists gauntlet_match_archive_index (
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
  on gauntlet_match_archive_index (completed_at desc);

create index if not exists gauntlet_match_archive_participants_idx
  on gauntlet_match_archive_index using gin (participant_account_ids);

create table if not exists gauntlet_match_events (
  match_id uuid not null references gauntlet_match_records(id) on delete cascade,
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
create table if not exists gauntlet_match_consequence_receipts (
  match_id uuid not null references gauntlet_match_records(id) on delete cascade,
  account_id uuid not null references gauntlet_accounts(id) on delete cascade,
  result text not null check (result in ('win', 'loss', 'draw')),
  consequence jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now(),
  primary key (match_id, account_id)
);

create index if not exists gauntlet_match_consequence_receipts_account_idx
  on gauntlet_match_consequence_receipts (account_id, applied_at desc);

-- Supabase deployments should call this RPC for the final commit. The
-- application supplies the authoritative match, event rows, consequence
-- deltas, and prepared account projections. They are committed together;
-- the unique receipt insert makes retries and concurrent calls no-op.
drop function if exists finalize_gauntlet_match(jsonb, jsonb, jsonb);

create or replace function finalize_gauntlet_match(
  p_record jsonb,
  p_events jsonb default '[]'::jsonb,
  p_consequences jsonb default '[]'::jsonb,
  p_account_applications jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid := (p_record->>'matchId')::uuid;
  v_consequence jsonb;
  v_application jsonb;
  v_account_id uuid;
  v_next_stats jsonb;
begin
  insert into gauntlet_match_records (
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

  insert into gauntlet_match_events (
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
    insert into gauntlet_match_consequence_receipts (match_id, account_id, result, consequence)
    values (v_match_id, v_account_id, v_application->>'result', v_consequence)
    on conflict (match_id, account_id) do nothing;
    if found and v_next_stats is not null then
      update gauntlet_accounts
      set stats = v_next_stats, last_seen_at = now()
      where id = v_account_id;
    end if;
  end loop;

  -- Keep this loop for compatibility with callers that already persisted
  -- receipt facts separately; account applications above are the atomic path.
  for v_consequence in select * from jsonb_array_elements(coalesce(p_consequences, '[]'::jsonb)) loop
    v_account_id := (v_consequence->>'accountId')::uuid;
    insert into gauntlet_match_consequence_receipts (match_id, account_id, result, consequence)
    values (v_match_id, v_account_id, v_consequence->>'result', v_consequence)
    on conflict (match_id, account_id) do nothing;
  end loop;

  return jsonb_build_object('matchId', v_match_id, 'status', 'finalized');
end;
$$;

create or replace function apply_gauntlet_account_consequence(
  p_match_id uuid,
  p_account_id uuid,
  p_result text,
  p_consequence jsonb,
  p_next_stats jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into gauntlet_match_consequence_receipts (match_id, account_id, result, consequence)
  values (p_match_id, p_account_id, p_result, p_consequence)
  on conflict (match_id, account_id) do nothing;
  if not found then
    return jsonb_build_object('alreadyApplied', true);
  end if;
  update gauntlet_accounts
  set stats = p_next_stats, last_seen_at = now()
  where id = p_account_id;
  return jsonb_build_object('alreadyApplied', false);
end;
$$;

alter table gauntlet_match_records enable row level security;
alter table gauntlet_match_archive_index enable row level security;
alter table gauntlet_match_events enable row level security;
alter table gauntlet_match_consequence_receipts enable row level security;

revoke all on gauntlet_match_records from public, anon, authenticated;
revoke all on gauntlet_match_archive_index from public, anon, authenticated;
revoke all on gauntlet_match_events from anon, authenticated;
revoke all on gauntlet_match_consequence_receipts from anon, authenticated;
grant select, insert, update, delete on gauntlet_match_records to service_role;
grant select, insert on gauntlet_match_archive_index to service_role;
grant select, insert, update, delete on gauntlet_match_events to service_role;
grant select, insert, update, delete on gauntlet_match_consequence_receipts to service_role;
revoke execute on function finalize_gauntlet_match(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function apply_gauntlet_account_consequence(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function finalize_gauntlet_match(jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function apply_gauntlet_account_consequence(uuid, uuid, text, jsonb, jsonb) to service_role;
