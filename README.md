# Vedøy Developer Portal

The canonical developer site and API surface for Vedøy. Vedøy Phone is separate client software that authenticates a user and calls the APIs published here.

## What is included

- Static responsive developer portal and documentation
- Supabase account sign-in and protected access requests
- `/api/v1` Vercel Function API
- Developer projects and one-time API key creation
- Database-backed rate limits, usage events and Vedøy Credits ledger
- OpenAPI 3.1 contract in `openapi.yaml`

Provider-backed phone, payment, AI and maritime operations return an explicit `501 capability_not_configured` until their production credentials and adapters are enabled.

## Local setup

1. Copy `.env.example` to `.env.local` and add the public Supabase values.
2. Run `npx vercel dev` so the static frontend and `/api` functions share one origin.
3. Run `npm run check` before committing.

The browser receives only the Supabase publishable key. Never commit service-role keys, carrier credentials or provider secrets.

## API

Production base URL: `https://vedoy-dev-portal.vercel.app/api`

- `GET /v1/health`
- `GET|POST /v1/projects`
- `POST /v1/projects/{projectId}/api-keys`
- `GET /v1/models`
- `GET /v1/usage`
- `GET /v1/credits/balance`

See `openapi.yaml` for the complete current contract.
