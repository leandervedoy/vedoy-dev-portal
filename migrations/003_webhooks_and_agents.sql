-- Delivery infrastructure for Vedøy Notify and configuration records for agents.
-- Secrets are derived at delivery time from VEDOY_WEBHOOK_SIGNING_SECRET and
-- are never stored in the database.

create table if not exists developer_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references developer_projects (id) on delete cascade,
  url text not null check (url ~ '^https://'),
  events text[] not null default array['*']::text[] check (cardinality(events) between 1 and 50),
  enabled boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists developer_webhook_endpoints_project_idx
  on developer_webhook_endpoints (project_id, created_at desc);

create table if not exists developer_webhook_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references developer_projects (id) on delete cascade,
  event_type text not null check (event_type ~ '^[a-z0-9_.-]{3,120}$'),
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'vedoy' check (source in ('vedoy', 'telnyx', 'agent')),
  created_at timestamptz not null default now()
);

create index if not exists developer_webhook_events_project_created_idx
  on developer_webhook_events (project_id, created_at desc);

create table if not exists developer_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references developer_webhook_events (id) on delete cascade,
  endpoint_id uuid not null references developer_webhook_endpoints (id) on delete cascade,
  attempt integer not null default 1 check (attempt between 1 and 25),
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  response_status integer,
  response_excerpt text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists developer_webhook_deliveries_attempt_idx
  on developer_webhook_deliveries (event_id, endpoint_id, attempt);
create index if not exists developer_webhook_deliveries_endpoint_idx
  on developer_webhook_deliveries (endpoint_id, created_at desc);

create table if not exists developer_agents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references developer_projects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  instructions text not null default '' check (char_length(instructions) <= 16000),
  model text not null default 'vedoy/router',
  monthly_budget_microunits bigint not null default 0 check (monthly_budget_microunits >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists developer_agents_project_idx
  on developer_agents (project_id, created_at desc);

create table if not exists developer_agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references developer_agents (id) on delete cascade,
  project_id uuid not null references developer_projects (id) on delete cascade,
  idempotency_key text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'blocked')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  error_message text,
  cost_microunits bigint not null default 0 check (cost_microunits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

create index if not exists developer_agent_runs_agent_idx
  on developer_agent_runs (agent_id, created_at desc);
