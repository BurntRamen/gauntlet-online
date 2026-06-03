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
