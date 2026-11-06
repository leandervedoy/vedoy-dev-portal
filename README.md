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

For deployed number search and purchase, configure `TELNYX_API_KEY`, `DATABASE_URL`, and `VEDOY_GROSS_MARGIN_BPS=2000` in the server environment, then apply the migrations with `DATABASE_URL_UNPOOLED`. `GET /api/v1/health` reports whether Telnyx and the required database schema are ready. Number quotes are priced from Telnyx's current USD cost and expire after ten minutes; purchase charges the upfront cost plus the first month at the quoted customer price.

## Data residency

The API uses standard PostgreSQL through `pg`; it does not depend on Neon-specific database features. Neon can therefore be used for development or an interim deployment, and the same schema can later run on a managed PostgreSQL service in Norway. Set `DATABASE_PROVIDER=neon` or `DATABASE_PROVIDER=gigahost` so health responses expose the active host without exposing credentials.

Neon currently has no Norway database region. Do not describe a Frankfurt Neon database as Norwegian storage. Production traffic that requires Norwegian residency must use a verified Norwegian database host, including verified backups and object storage.

## API

Production base URL: `https://vedoy-dev-portal.vercel.app/api`

### Central pricing and content (public, read-only)

- `GET /v1/pricing` — published catalog; optional `category=studio|assist|growth|campaign` and `code=nettside-drift`
- `GET /v1/site-content` — published headlines and copy, optionally `content_key=home.hero`
- These endpoints use the existing API gateway function and Supabase RLS. Updates take place exclusively in Vedøy Manager with server-side authorization; callers cannot edit prices through these public routes.


- `GET /v1/health`
- `GET|POST /v1/projects`
- `POST /v1/projects/{projectId}/api-keys`
- `GET /v1/projects/{projectId}/api-keys`
- `DELETE /v1/projects/{projectId}/api-keys/{keyId}`
- `GET /v1/models`
- `POST /v1/chat/completions` (echo demo only)
- `POST /v1/embeddings` (random-vector demo only)
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

Account and control-plane routes use `Authorization: Bearer <Supabase access token>`.
Project API routes use `Authorization: Bearer <vdy_live_...>`; keep these keys on
trusted servers, never in browser or mobile bundles. JSON requests use
`Content-Type: application/json`. Number purchase, SMS send, and agent-run
requests require an `Idempotency-Key` header.

## Telnyx pricing

`VEDOY_GROSS_MARGIN_BPS=2000` targets a 20% gross margin. Customer price is calculated as provider cost divided by `0.80`, then rounded up to whole Vedøy Credits using `VEDOY_CREDIT_USD_MICROS` (default: USD 0.01 per Credit). This is a margin calculation, not a 20% markup. Number quotes use current Telnyx inventory costs and expire after ten minutes. SMS is disabled until an explicit provider cost is configured because destination and carrier fees vary.

Provider operations require an `Idempotency-Key`. Credits are reserved before Telnyx is called. Deterministic failures receive an automatic ledger refund; timeouts and provider 5xx responses are marked `unknown` for reconciliation rather than being retried blindly.

## Notify webhooks

Webhook destinations must be public HTTPS URLs; local and private-network targets are rejected. Each endpoint receives a unique HMAC signing secret when created. The secret is derived server-side from `VEDOY_WEBHOOK_SIGNING_SECRET`, is not stored in the database, and is returned only in the creation response. Delivery attempts, response status, a bounded response excerpt and manual retries are stored in PostgreSQL.

## Agents

Agent definitions and runs are project-scoped. The control plane stores instructions, model selection, status and a monthly budget guard. Runs fail closed as `blocked` with `agent_runner_not_configured` until a reviewed server-side runner and provider billing adapter are connected; the portal does not silently make an AI provider call.

See `openapi.yaml` for the complete current contract.

## Vedoy Deliver integrations (preview)

The developer API includes `GET /v1/deliver/providers`, `POST /v1/deliver/quotes`, and a deliberately disabled `POST /v1/deliver/orders`. All routes require a project-scoped Vedoy API key; keep this key server-side. A provider catalogue lists Wolt Drive, Bring, Helthjem, PostNord, Porterbuddy, nShift, foodora Partner API and Uber Direct with explicit readiness statuses.

Only Wolt Drive shipment promises have an upstream quote adapter. Set `WOLT_DRIVE_API_KEY` and `WOLT_DRIVE_VENUE_ID` from your merchant agreement. The default `WOLT_DRIVE_ENV=development` uses the official sandbox origin. For production quotes set `WOLT_DRIVE_ENV=production` and `WOLT_DRIVE_LIVE_QUOTES_ENABLED=true` deliberately. The Wolt provider response is an estimate in native minor currency units; this is **not** a customer checkout price, nor confirmation that a courier was booked. Provider billing, order persistence, reconciliation and tracking are not implemented. Quote and booking responses must never be treated as proof of dispatch.

All other provider adapters are documentation-only, even if credentials exist elsewhere. Bring food transport and any city-specific availability must be confirmed with the carrier. Uber Direct is not currently offered in Norway. Never collect a delivery payment or promise a courier through this API until approved booking and idempotency workflows are deployed.

## App Modules (2026-11-06 beta)

Open **Developer Portal → Platform APIs → App Modules** (`#app-modules`). Create a developer project in `#developer-api` first, then choose the project in the App Modules workspace. Each project owns its modules, selected games, API keys, metering and highscores.

**Setup:** 1) Register app/project. 2) Activate Game Library (included catalog metadata only). 3) Choose Chess, Tic-Tac-Toe, Connect Four, Word Guess, Snake, Sudoku Mini or 2048. 4) Activate Highscore API only after a manually verified active project subscription. 5) Generate a project API key through the Developer API console and keep it on your server. 6) Inspect the API list shown inside the module workspace.

**Public:** `GET /api/v1/modules`, `GET /api/v1/rewards/games` (catalogs; the playable game engines have not moved from Collective yet).

**User-scoped (Supabase sign-in):** `GET /api/v1/projects/{id}/modules`, `PUT|DELETE /api/v1/projects/{id}/modules/{moduleKey}`, `PUT|DELETE /api/v1/projects/{id}/games/{gameKey}`.

**Project API key (server only, subscription required):** `GET /api/v1/rewards/highscores?game=snake`, `POST /api/v1/rewards/highscores` using `Authorization: Bearer $VEDOY_API_KEY`, `Idempotency-Key` and JSON `{ "game":"snake", "playerAlias":"Player", "score":120 }`.

The Highscore API is **beta and unverified**. Scores supplied by a developer backend are not proof of game completion and do not grant Vedoy Coins. `Vedoy Credits` are a separate metered API billing unit, not a game reward. Premium activation fails closed when no project subscription record is active; there is no self-service Stripe checkout in this release. Manual subscriptions must be configured by an authorized operator. Existing production APIs are not automatically switched to this new entitlement system during the staged migration.

The app module database is provisioned through `migrations/004_app_modules.sql`, included in `npm run db:migrate`. No full Stripe Billing subscription lifecycle or game-engine SDK has been shipped. Exercise caution before presenting catalog entries as working hosted games.
