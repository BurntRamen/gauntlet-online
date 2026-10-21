-- All existing writers, including match consequence functions, pass the stats
-- they read. Reject stale copies instead of overwriting purchases or rewards.
-- Existing rows start at revision zero. A rejected statement also rolls back
-- any consequence receipt inserted in the same transaction.
begin;
create or replace function public.guard_gauntlet_account_stats()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare previous_revision bigint;
begin
  previous_revision := coalesce((old.stats->>'_accountRevision')::bigint, 0);
  if coalesce((new.stats->>'_accountRevision')::bigint, 0) <> previous_revision then
    raise exception 'Account data changed. Refresh and retry; no changes were saved.' using errcode = '40001';
  end if;
  new.stats := jsonb_set(coalesce(new.stats, '{}'::jsonb), '{_accountRevision}', to_jsonb(previous_revision + 1));
  return new;
end;
$$;
drop trigger if exists gauntlet_account_stats_revision on public.gauntlet_accounts;
create trigger gauntlet_account_stats_revision before update of stats on public.gauntlet_accounts
for each row execute function public.guard_gauntlet_account_stats();
create or replace function public.gauntlet_account_write_capability()
returns integer language sql stable security invoker set search_path = '' as $$
  select case when exists (select 1 from pg_catalog.pg_trigger where tgname = 'gauntlet_account_stats_revision'
    and tgrelid = 'public.gauntlet_accounts'::regclass and tgenabled = 'O') then 1 else 0 end;
$$;
revoke all on function public.guard_gauntlet_account_stats() from public, anon, authenticated;
revoke all on function public.gauntlet_account_write_capability() from public, anon, authenticated;
grant execute on function public.gauntlet_account_write_capability() to service_role;
commit;
