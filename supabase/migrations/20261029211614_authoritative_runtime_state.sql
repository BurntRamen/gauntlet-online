-- Server-only runtime authority. CAS and request receipts commit together.
begin;
create table if not exists public.gauntlet_runtime_states (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{0,63}$'),
  revision bigint not null default 0 check (revision >= 0),
  contract text not null,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);
create table if not exists public.gauntlet_runtime_commits (
  store_id text not null references public.gauntlet_runtime_states(id),
  request_id uuid not null,
  revision bigint not null,
  fingerprint text not null,
  committed_at timestamptz not null default now(),
  primary key (store_id, request_id),
  unique (store_id, revision)
);
alter table public.gauntlet_runtime_states enable row level security;
alter table public.gauntlet_runtime_commits enable row level security;
revoke all on public.gauntlet_runtime_states, public.gauntlet_runtime_commits from public, anon, authenticated;
grant select, insert, update on public.gauntlet_runtime_states to service_role;
grant select, insert on public.gauntlet_runtime_commits to service_role;

create or replace function public.commit_gauntlet_runtime(
  p_id text, p_expected_revision bigint, p_request_id uuid, p_contract text, p_state jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.gauntlet_runtime_states%rowtype;
  prior public.gauntlet_runtime_commits%rowtype;
  fingerprint text;
begin
  if p_id is null or p_id !~ '^[a-z][a-z0-9-]{0,63}$' or p_expected_revision is null or p_expected_revision < 0
    or p_request_id is null or p_contract is null or length(p_contract) not between 1 and 512
    or p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 67108864 then
    raise exception 'Invalid runtime envelope' using errcode='22023';
  end if;
  fingerprint := encode(sha256(convert_to(jsonb_build_array(p_expected_revision,p_contract,p_state)::text,'UTF8')),'hex');
  insert into public.gauntlet_runtime_states(id,contract,state) values(p_id,p_contract,'{}') on conflict do nothing;
  select * into current_row from public.gauntlet_runtime_states where id=p_id for update;
  select * into prior from public.gauntlet_runtime_commits where store_id=p_id and request_id=p_request_id;
  if found then
    if prior.fingerprint <> fingerprint then raise exception 'Runtime request identity reused' using errcode='22023'; end if;
    return jsonb_build_object('revision',prior.revision,'duplicate',true,'committedAt',prior.committed_at);
  end if;
  if current_row.revision <> p_expected_revision then raise exception 'Runtime revision conflict' using errcode='40001'; end if;
  if current_row.contract <> p_contract then raise exception 'Runtime contract mismatch' using errcode='22023'; end if;
  update public.gauntlet_runtime_states set state=p_state, revision=revision+1, updated_at=now() where id=p_id returning * into current_row;
  insert into public.gauntlet_runtime_commits(store_id,request_id,revision,fingerprint)
    values(p_id,p_request_id,current_row.revision,fingerprint);
  return jsonb_build_object('revision',current_row.revision,'duplicate',false,'committedAt',current_row.updated_at);
end;
$$;
revoke all on function public.commit_gauntlet_runtime(text,bigint,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.commit_gauntlet_runtime(text,bigint,uuid,text,jsonb) to service_role;
commit;
