create extension if not exists pgcrypto with schema extensions;

create table if not exists public.developer_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  organization text not null check (char_length(btrim(organization)) between 2 and 120),
  website text check (website is null or (char_length(website) <= 500 and website ~* '^https?://')),
  products text[] not null default '{}',
  use_case text not null check (char_length(btrim(use_case)) between 30 and 3000),
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'approved', 'declined', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.developer_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  rate_limit_per_minute integer not null default 60 check (rate_limit_per_minute between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table if not exists public.developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.developer_projects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  key_prefix text not null,
  key_hash text not null unique check (char_length(key_hash) = 64),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.developer_wallets (
  project_id uuid primary key references public.developer_projects (id) on delete cascade,
  currency text not null default 'VDY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.developer_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.developer_projects (id) on delete cascade,
  amount_microunits bigint not null check (amount_microunits <> 0),
  entry_type text not null check (entry_type in ('signup_credit', 'usage', 'adjustment', 'refund', 'purchase')),
  description text not null,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

create table if not exists public.developer_usage_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.developer_projects (id) on delete cascade,
  api_key_id uuid references public.developer_api_keys (id) on delete set null,
  route text not null,
  method text not null,
  status_code integer not null default 200,
  cost_microunits bigint not null default 0 check (cost_microunits >= 0),
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index if not exists developer_access_requests_user_created_idx on public.developer_access_requests (user_id, created_at desc);
create unique index if not exists developer_access_requests_one_open_per_user_idx on public.developer_access_requests (user_id) where status in ('submitted', 'in_review');
create index if not exists developer_api_keys_project_idx on public.developer_api_keys (project_id, created_at desc);
create index if not exists developer_usage_events_project_created_idx on public.developer_usage_events (project_id, created_at desc);
create index if not exists developer_usage_events_api_key_idx on public.developer_usage_events (api_key_id);
create index if not exists developer_ledger_entries_project_created_idx on public.developer_ledger_entries (project_id, created_at desc);

create or replace function public.developer_create_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.developer_wallets (project_id) values (new.id) on conflict do nothing;
  insert into public.developer_ledger_entries (project_id, amount_microunits, entry_type, description, idempotency_key)
  values (new.id, 200000000, 'signup_credit', 'Developer welcome credit', 'welcome-credit')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists developer_projects_create_wallet on public.developer_projects;
create trigger developer_projects_create_wallet after insert on public.developer_projects
for each row execute function public.developer_create_wallet();

create or replace view public.developer_wallet_balances
with (security_invoker = true)
as
select w.project_id, coalesce(sum(l.amount_microunits), 0)::bigint as balance_microunits, max(l.created_at) as updated_at
from public.developer_wallets w
left join public.developer_ledger_entries l on l.project_id = w.project_id
group by w.project_id;

create or replace function public.developer_authorize_api_key(
  p_api_key text,
  p_route text,
  p_method text,
  p_cost_microunits bigint default 0,
  p_idempotency_key text default null
)
returns table (allowed boolean, reason text, project_id uuid, remaining_requests integer, balance_microunits bigint, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.developer_api_keys%rowtype;
  v_project public.developer_projects%rowtype;
  v_count integer;
  v_balance bigint;
begin
  select * into v_key from public.developer_api_keys
  where key_hash = encode(extensions.digest(p_api_key, 'sha256'), 'hex')
    and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then return query select false, 'invalid_api_key', null::uuid, 0, 0::bigint, 0; return; end if;

  select * into v_project from public.developer_projects where id = v_key.project_id and status = 'active';
  if not found then return query select false, 'project_inactive', v_key.project_id, 0, 0::bigint, 0; return; end if;

  perform pg_advisory_xact_lock(hashtext(v_project.id::text));
  select count(*)::integer into v_count from public.developer_usage_events
  where project_id = v_project.id and created_at >= date_trunc('minute', now());
  if v_count >= v_project.rate_limit_per_minute then
    return query select false, 'rate_limit_exceeded', v_project.id, 0, 0::bigint, greatest(1, extract(seconds from (date_trunc('minute', now()) + interval '1 minute' - now()))::integer); return;
  end if;

  select coalesce(sum(amount_microunits), 0)::bigint into v_balance from public.developer_ledger_entries where project_id = v_project.id;
  if p_cost_microunits > v_balance then return query select false, 'insufficient_credits', v_project.id, v_project.rate_limit_per_minute - v_count, v_balance, 0; return; end if;

  insert into public.developer_usage_events (project_id, api_key_id, route, method, cost_microunits, idempotency_key)
  values (v_project.id, v_key.id, left(p_route, 300), left(upper(p_method), 12), p_cost_microunits, p_idempotency_key);
  if p_cost_microunits > 0 then
    insert into public.developer_ledger_entries (project_id, amount_microunits, entry_type, description, idempotency_key, metadata)
    values (v_project.id, -p_cost_microunits, 'usage', 'API usage: ' || left(p_route, 200), p_idempotency_key, jsonb_build_object('route', p_route, 'method', p_method))
    on conflict (project_id, idempotency_key) do nothing;
  end if;
  update public.developer_api_keys set last_used_at = now() where id = v_key.id;
  return query select true, 'ok', v_project.id, greatest(0, v_project.rate_limit_per_minute - v_count - 1), v_balance - p_cost_microunits, 0;
end;
$$;

alter table public.developer_access_requests enable row level security;
alter table public.developer_projects enable row level security;
alter table public.developer_api_keys enable row level security;
alter table public.developer_wallets enable row level security;
alter table public.developer_ledger_entries enable row level security;
alter table public.developer_usage_events enable row level security;

revoke all on public.developer_access_requests, public.developer_projects, public.developer_api_keys, public.developer_wallets, public.developer_ledger_entries, public.developer_usage_events from anon, public;
grant select, insert on public.developer_access_requests, public.developer_projects, public.developer_api_keys to authenticated;
grant select on public.developer_wallets, public.developer_ledger_entries, public.developer_usage_events, public.developer_wallet_balances to authenticated;

drop policy if exists "Users can read their developer access requests" on public.developer_access_requests;
drop policy if exists "Users can submit their own developer access requests" on public.developer_access_requests;
drop policy if exists "Users read own access requests" on public.developer_access_requests;
create policy "Users read own access requests" on public.developer_access_requests for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create own access requests" on public.developer_access_requests;
create policy "Users create own access requests" on public.developer_access_requests for insert to authenticated with check ((select auth.uid()) = user_id and status = 'submitted');

drop policy if exists "Owners read projects" on public.developer_projects;
create policy "Owners read projects" on public.developer_projects for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Owners create projects" on public.developer_projects;
create policy "Owners create projects" on public.developer_projects for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners read keys" on public.developer_api_keys;
create policy "Owners read keys" on public.developer_api_keys for select to authenticated using (exists (select 1 from public.developer_projects p where p.id = project_id and p.owner_id = (select auth.uid())));
drop policy if exists "Owners create keys" on public.developer_api_keys;
create policy "Owners create keys" on public.developer_api_keys for insert to authenticated with check (exists (select 1 from public.developer_projects p where p.id = project_id and p.owner_id = (select auth.uid())));

drop policy if exists "Owners read wallets" on public.developer_wallets;
create policy "Owners read wallets" on public.developer_wallets for select to authenticated using (exists (select 1 from public.developer_projects p where p.id = project_id and p.owner_id = (select auth.uid())));
drop policy if exists "Owners read ledger" on public.developer_ledger_entries;
create policy "Owners read ledger" on public.developer_ledger_entries for select to authenticated using (exists (select 1 from public.developer_projects p where p.id = project_id and p.owner_id = (select auth.uid())));
drop policy if exists "Owners read usage" on public.developer_usage_events;
create policy "Owners read usage" on public.developer_usage_events for select to authenticated using (exists (select 1 from public.developer_projects p where p.id = project_id and p.owner_id = (select auth.uid())));

revoke all on function public.developer_create_wallet() from public, anon, authenticated;
revoke all on function public.developer_authorize_api_key(text, text, text, bigint, text) from public, authenticated;
grant execute on function public.developer_authorize_api_key(text, text, text, bigint, text) to anon;
