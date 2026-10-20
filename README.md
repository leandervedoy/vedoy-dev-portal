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
- `GET /v1/models`
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

## Selling Vedøy Credits

The portal supports fixed credit packs through Stripe-hosted Checkout. A signed-in owner chooses a project, the server creates a Checkout Session, and `POST /api/stripe-webhook` grants credits only after a signed paid event. Duplicate Stripe events and sessions are idempotent.

Required production settings are `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CREDITS_STARTER`, `STRIPE_PRICE_CREDITS_SCALE`, and `VEDOY_PUBLIC_URL`. Register `checkout.session.completed` and `checkout.session.async_payment_succeeded` at `https://vedoy-dev-portal.vercel.app/api/stripe-webhook`.

## Telnyx pricing

Customer usage is converted using the configured server-side pricing policy and credit-value setting. Number quotes use current Telnyx inventory costs and expire after ten minutes. SMS is disabled until an explicit provider cost is configured because destination and carrier fees vary.

Provider operations require an `Idempotency-Key`. Credits are reserved before Telnyx is called. Deterministic failures receive an automatic ledger refund; timeouts and provider 5xx responses are marked `unknown` for reconciliation rather than being retried blindly.

## Notify webhooks

Webhook destinations must be public HTTPS URLs; local and private-network targets are rejected. Each endpoint receives a unique HMAC signing secret when created. The secret is derived server-side from `VEDOY_WEBHOOK_SIGNING_SECRET`, is not stored in the database, and is returned only in the creation response. Delivery attempts, response status, a bounded response excerpt and manual retries are stored in PostgreSQL.

## Agents

Agent definitions and runs are project-scoped. The control plane stores instructions, model selection, status and a monthly budget guard. Runs fail closed as `blocked` with `agent_runner_not_configured` until a reviewed server-side runner and provider billing adapter are connected; the portal does not silently make an AI provider call.

See `openapi.yaml` for the complete current contract.

## Developer Room and external API lessons

The opening journey includes an original Three.js workspace animated with Anime.js. Scrolling in either direction moves the camera; Room, Phone, API and Events buttons jump between chapters. Reduced-motion preferences disable interpolated camera movement and continuous rotation. Models are loaded for the opening journey and released when leaving it.

The public homepage (`/` or `#landing`) starts with the original mission cards, then continues directly into the 3D room on the same scrollable page. A scroll-linked fade and lift transition reveals the room; scrolling back restores the cards. The room is part of this opening experience and is not listed as a separate documentation page. A compact action in the 3D stage opens the complete documentation portal, while the final room actions link to the portal overview, authentication/API keys and Learn. Legacy `#room` links redirect to `#landing`; the standalone card tour remains at `#missions`.

`responsive.css` is the final shared layout layer for narrow phones, tablet drawers, landscape screens and wide desktop layouts. `portal-motion.js` uses Anime.js `createScope().add()` with media queries for a mouse-following mission reticle and subtle card animations. Scope cleanup removes listeners and animations when preferences or content change; touch and reduced-motion users do not get pointer tracking.

The supplied laptop and phone models are converted to neutral, compressed GLB assets in `assets/models/`. To rebuild them, run `node scripts/convert-room-models.mjs <laptop.3dm> <phone.obj>`. Original model files are not modified. `npm run build` bundles `room-scene.js` with its dependencies.

`#public-apis` contains Dog CEO, Open-Meteo weather/marine/geocoding, ipify, IPinfo Lite, Scommetix football tips through RapidAPI, and an unofficial open-source World Cup 2026 JSON example. Try buttons make optional external GET requests; they do not use Vedøy keys or credits. Token-backed services show server-side examples instead of exposing credentials in the browser. Open-Meteo's hosted free API is for non-commercial use; check the linked plans and attribution requirements before commercial use. Sports predictions are informational and require local age, gambling and regional checks when used in a betting product.

For local interaction checks: run `npm run build`, `node scripts/serve-preview.mjs`, then `node scripts/verify-room.mjs` in another terminal (Chrome required). Set `VEDOY_VERIFY_ORIGIN` to check a deployed site.
