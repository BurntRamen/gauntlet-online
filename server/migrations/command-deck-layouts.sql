-- Command Deck 2.1 account layouts. Review and apply separately; this file is
-- deliberately not applied by the application. Tests use an isolated database.
-- Existing accounts and game/progression/economy data are unchanged.
begin;

create table if not exists public.gauntlet_account_layouts (
  account_id uuid primary key references public.gauntlet_accounts(id) on delete cascade,
  revision bigint not null check (revision between 1 and 9007199254740991),
  preferences jsonb not null check (
    jsonb_typeof(preferences) = 'object'
    and preferences ? 'version'
    and preferences ? 'pages'
    and preferences->'version' = '1'::jsonb
    and jsonb_typeof(preferences->'pages') = 'object'
    and octet_length(preferences::text) <= 20000
  ),
  updated_at timestamptz not null default now()
);

-- Gauntlet uses its own server-issued account sessions, not Supabase user JWTs.
-- Only the trusted existing server service role can reach this table. No client
-- role may select another account's preferences or change ownership directly.
alter table public.gauntlet_account_layouts enable row level security;
revoke all on table public.gauntlet_account_layouts from public, anon, authenticated;
grant select, insert, update on table public.gauntlet_account_layouts to service_role;

comment on table public.gauntlet_account_layouts is
  'Private Command Deck page layouts; authenticated through the Gauntlet server; revision checked atomically on every update.';

commit;
