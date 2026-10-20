alter table developer_ledger_entries drop constraint if exists developer_ledger_entries_entry_type_check;
alter table developer_ledger_entries add constraint developer_ledger_entries_entry_type_check
  check (entry_type in ('signup_credit','usage','adjustment','refund','purchase','provider_reservation','provider_refund','provider_adjustment','stripe_purchase'));

create table if not exists developer_billing_customers (
  project_id uuid primary key references developer_projects (id) on delete cascade,
  stripe_customer_id text unique, email text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists developer_checkout_sessions (
  stripe_session_id text primary key, project_id uuid not null references developer_projects (id) on delete cascade,
  product_slug text not null, credits_microunits bigint not null check (credits_microunits > 0), amount_minor bigint,
  currency text, payment_status text not null default 'open', created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists developer_checkout_sessions_project_idx on developer_checkout_sessions (project_id, created_at desc);
create table if not exists developer_stripe_events (
  stripe_event_id text primary key, event_type text not null, processed_at timestamptz not null default now()
);
