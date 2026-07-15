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

alter table gauntlet_match_records enable row level security;
alter table gauntlet_match_events enable row level security;

revoke all on gauntlet_match_records from anon, authenticated;
revoke all on gauntlet_match_events from anon, authenticated;
grant select, insert, update, delete on gauntlet_match_records to service_role;
grant select, insert, update, delete on gauntlet_match_events to service_role;
