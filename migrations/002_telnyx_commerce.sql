alter table developer_ledger_entries drop constraint if exists developer_ledger_entries_entry_type_check;
alter table developer_ledger_entries add constraint developer_ledger_entries_entry_type_check
  check (entry_type in (
    'signup_credit', 'usage', 'adjustment', 'refund', 'purchase',
    'provider_reservation', 'provider_refund', 'provider_adjustment'
  ));

create table if not exists developer_provider_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references developer_projects (id) on delete cascade,
  provider text not null check (provider in ('telnyx')),
  product_type text not null check (product_type in ('phone_number')),
  provider_reference text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider_upfront_micros bigint not null default 0 check (provider_upfront_micros >= 0),
  provider_recurring_micros bigint not null default 0 check (provider_recurring_micros >= 0),
  customer_upfront_micros bigint not null default 0 check (customer_upfront_micros >= 0),
  customer_recurring_micros bigint not null default 0 check (customer_recurring_micros >= 0),
  gross_margin_bps integer not null check (gross_margin_bps between 0 and 9000),
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists developer_provider_quotes_project_idx
  on developer_provider_quotes (project_id, expires_at desc);

create table if not exists developer_provider_operations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references developer_projects (id) on delete cascade,
  api_key_id uuid references developer_api_keys (id) on delete set null,
  quote_id uuid references developer_provider_quotes (id) on delete set null,
  provider text not null check (provider in ('telnyx')),
  operation_type text not null check (operation_type in ('number_purchase', 'message_send')),
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'unknown')),
  customer_charge_micros bigint not null default 0 check (customer_charge_micros >= 0),
  provider_cost_micros bigint check (provider_cost_micros is null or provider_cost_micros >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  provider_request_id text,
  provider_resource_id text,
  response_payload jsonb,
  error_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

create index if not exists developer_provider_operations_project_idx
  on developer_provider_operations (project_id, created_at desc);

create table if not exists developer_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references developer_projects (id) on delete cascade,
  provider text not null check (provider in ('telnyx')),
  provider_number_id text,
  provider_order_id text,
  phone_number text not null,
  status text not null default 'pending',
  country_code text,
  number_type text,
  currency text not null default 'USD',
  customer_monthly_micros bigint not null default 0,
  provider_monthly_micros bigint not null default 0,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, phone_number)
);

create index if not exists developer_phone_numbers_project_idx
  on developer_phone_numbers (project_id, created_at desc);

create table if not exists developer_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references developer_projects (id) on delete cascade,
  provider text not null check (provider in ('telnyx')),
  provider_message_id text,
  from_number text not null,
  to_number text not null,
  direction text not null default 'outbound',
  status text not null default 'queued',
  customer_charge_micros bigint not null default 0,
  provider_cost_micros bigint,
  currency text not null default 'USD',
  parts integer,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists developer_messages_project_idx
  on developer_messages (project_id, created_at desc);
create unique index if not exists developer_messages_provider_id_idx
  on developer_messages (provider, provider_message_id) where provider_message_id is not null;

create table if not exists developer_provider_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('telnyx')),
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table developer_messages add column if not exists provider_payload jsonb not null default '{}'::jsonb;
alter table developer_provider_webhooks add column if not exists processing_error text;

