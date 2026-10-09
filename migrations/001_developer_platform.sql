create extension if not exists pgcrypto;

create table if not exists developer_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  rate_limit_per_minute integer not null default 60 check (rate_limit_per_minute between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table if not exists developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references developer_projects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  key_prefix text not null,
  key_hash text not null unique check (char_length(key_hash) = 64),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists developer_wallets (
  project_id uuid primary key references developer_projects (id) on delete cascade,
  currency text not null default 'VDY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists developer_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references developer_projects (id) on delete cascade,
  amount_microunits bigint not null check (amount_microunits <> 0),
  entry_type text not null check (entry_type in ('signup_credit', 'usage', 'adjustment', 'refund', 'purchase')),
  description text not null,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

create table if not exists developer_usage_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references developer_projects (id) on delete cascade,
  api_key_id uuid references developer_api_keys (id) on delete set null,
  route text not null,
  method text not null,
  status_code integer not null default 200,
  cost_microunits bigint not null default 0 check (cost_microunits >= 0),
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index if not exists developer_api_keys_project_idx on developer_api_keys (project_id, created_at desc);
create index if not exists developer_usage_events_project_created_idx on developer_usage_events (project_id, created_at desc);
create index if not exists developer_usage_events_api_key_idx on developer_usage_events (api_key_id);
create unique index if not exists developer_usage_events_idempotency_idx
  on developer_usage_events (project_id, idempotency_key) where idempotency_key is not null;
create index if not exists developer_ledger_entries_project_created_idx on developer_ledger_entries (project_id, created_at desc);

create or replace function developer_create_wallet()
returns trigger language plpgsql as $$
begin
  insert into developer_wallets (project_id) values (new.id) on conflict do nothing;
  insert into developer_ledger_entries (project_id, amount_microunits, entry_type, description, idempotency_key)
  values (new.id, 200000000, 'signup_credit', 'Developer welcome credit', 'welcome-credit')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists developer_projects_create_wallet on developer_projects;
create trigger developer_projects_create_wallet after insert on developer_projects
for each row execute function developer_create_wallet();

create or replace view developer_wallet_balances as
select w.project_id, coalesce(sum(l.amount_microunits), 0)::bigint as balance_microunits,
       max(l.created_at) as updated_at
from developer_wallets w
left join developer_ledger_entries l on l.project_id = w.project_id
group by w.project_id;

