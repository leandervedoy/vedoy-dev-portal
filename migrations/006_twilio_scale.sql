-- Move active communications traffic to Twilio while keeping historical rows readable.
alter table developer_provider_quotes drop constraint if exists developer_provider_quotes_provider_check;
alter table developer_provider_quotes add constraint developer_provider_quotes_provider_check check (provider in ('twilio','telnyx'));
alter table developer_provider_operations drop constraint if exists developer_provider_operations_provider_check;
alter table developer_provider_operations add constraint developer_provider_operations_provider_check check (provider in ('twilio','telnyx'));
alter table developer_phone_numbers drop constraint if exists developer_phone_numbers_provider_check;
alter table developer_phone_numbers add constraint developer_phone_numbers_provider_check check (provider in ('twilio','telnyx'));
alter table developer_messages drop constraint if exists developer_messages_provider_check;
alter table developer_messages add constraint developer_messages_provider_check check (provider in ('twilio','telnyx'));
alter table developer_provider_webhooks drop constraint if exists developer_provider_webhooks_provider_check;
alter table developer_provider_webhooks add constraint developer_provider_webhooks_provider_check check (provider in ('twilio','telnyx'));

alter table developer_webhook_events drop constraint if exists developer_webhook_events_source_check;
alter table developer_webhook_events add constraint developer_webhook_events_source_check check (source in ('vedoy','twilio','agent'));

create index if not exists developer_usage_events_project_minute_idx on developer_usage_events (project_id, created_at desc);
create index if not exists developer_ledger_entries_project_idempotency_idx on developer_ledger_entries (project_id, idempotency_key) where idempotency_key is not null;
create index if not exists developer_messages_provider_status_idx on developer_messages (provider, status, updated_at desc);
create index if not exists developer_provider_operations_status_idx on developer_provider_operations (status, updated_at desc);
create index if not exists developer_checkout_sessions_status_idx on developer_checkout_sessions (payment_status, created_at desc);
