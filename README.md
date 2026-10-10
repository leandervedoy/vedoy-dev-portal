# Vedøy Developer Portal

The canonical developer site and API surface for Vedøy. Vedøy Phone is separate client software that authenticates a user and calls the APIs published here.

## What is included

- Static responsive developer portal and documentation
- Supabase account sign-in during the identity transition
- `/api/v1` Vercel Function API
- Developer projects and one-time API key creation
- PostgreSQL-backed rate limits, usage events and Vedøy Credits ledger
- Vedøy Notify webhook endpoints, signed delivery attempts and explicit retry history
- Stored agent definitions, budget guards and run history with a fail-closed provider boundary
- Portable PostgreSQL schema for Neon now and Norwegian hosting later
- OpenAPI 3.1 contract in `openapi.yaml`

Telnyx number search, number purchase and outbound SMS are implemented behind Vedøy API keys. They activate when the server has Telnyx credentials and the production migration has run. Payment, AI and maritime provider operations remain unavailable until their adapters are enabled.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the public Supabase values used for the existing login.
3. Add a pooled `DATABASE_URL` and a direct `DATABASE_URL_UNPOOLED` from Neon or another PostgreSQL host.
4. Run `npm run db:migrate` once with the direct connection.
5. Configure `TELNYX_API_KEY`, the Telnyx webhook public key and the messaging profile ID on the server.
6. Configure `TELNYX_SMS_PROVIDER_USD_MICROS` from the applicable Telnyx tariff before enabling SMS.
7. Set `VEDOY_WEBHOOK_SIGNING_SECRET` to a random server-only value of at least 32 characters before creating webhooks.
8. Run `npx vercel dev` so the static frontend and `/api` functions share one origin.
9. Run `npm run check` before committing.

The browser receives only the Supabase publishable key. PostgreSQL credentials stay in Vercel Functions. Never commit database URLs, service-role keys, carrier credentials or provider secrets.

## Data residency

The API uses standard PostgreSQL through `pg`; it does not depend on Neon-specific database features. Neon can therefore be used for development or an interim deployment, and the same schema can later run on a managed PostgreSQL service in Norway. Set `DATABASE_PROVIDER=neon` or `DATABASE_PROVIDER=gigahost` so health responses expose the active host without exposing credentials.

Neon currently has no Norway database region. Do not describe a Frankfurt Neon database as Norwegian storage. Production traffic that requires Norwegian residency must use a verified Norwegian database host, including verified backups and object storage.

## API

Production base URL: `https://vedoy-dev-portal.vercel.app/api`

- `GET /v1/health`
- `GET|POST /v1/projects`
- `POST /v1/projects/{projectId}/api-keys`
- `GET /v1/projects/{projectId}/api-keys`
- `DELETE /v1/projects/{projectId}/api-keys/{keyId}`
- `GET /v1/models`
<<<<<<< Updated upstream
- `GET /v1/numbers/available`
- `GET /v1/numbers`
- `POST /v1/numbers/purchase`
- `POST /v1/messages`
- `GET|POST /v1/webhooks/endpoints`
- `GET /v1/webhooks/deliveries`
- `POST /v1/webhooks/deliveries/{deliveryId}/retry`
- `GET|POST /v1/agents`
- `GET|POST /v1/agents/{agentId}/runs`
- `GET /v1/usage`
- `GET /v1/credits/balance`
- `GET /v1/credits/transactions`
- `GET /v1/rate-limits`

## Telnyx pricing

`VEDOY_GROSS_MARGIN_BPS=2000` targets a 20% gross margin. Customer price is calculated as provider cost divided by `0.80`, then rounded up to whole Vedøy Credits using `VEDOY_CREDIT_USD_MICROS` (default: USD 0.01 per Credit). This is a margin calculation, not a 20% markup. Number quotes use current Telnyx inventory costs and expire after ten minutes. SMS is disabled until an explicit provider cost is configured because destination and carrier fees vary.

Provider operations require an `Idempotency-Key`. Credits are reserved before Telnyx is called. Deterministic failures receive an automatic ledger refund; timeouts and provider 5xx responses are marked `unknown` for reconciliation rather than being retried blindly.

## Notify webhooks

Webhook destinations must be public HTTPS URLs; local and private-network targets are rejected. Each endpoint receives a unique HMAC signing secret when created. The secret is derived server-side from `VEDOY_WEBHOOK_SIGNING_SECRET`, is not stored in the database, and is returned only in the creation response. Delivery attempts, response status, a bounded response excerpt and manual retries are stored in PostgreSQL.

## Agents

Agent definitions and runs are project-scoped. The control plane stores instructions, model selection, status and a monthly budget guard. Runs fail closed as `blocked` with `agent_runner_not_configured` until a reviewed server-side runner and provider billing adapter are connected; the portal does not silently make an AI provider call.

See `openapi.yaml` for the complete current contract.
