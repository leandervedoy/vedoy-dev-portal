# Vedoy Monetize — Developer Portal integration and settlement (proposal)

## Platform architecture
Developer Portal remains the control plane: project ownership, API keys, subscription status, module catalog, usage quotas, billing and permissions. Monetize marketing/docs remain on vedoystudio.no/monetize. The production data plane must enforce per-project module access on every request; a UI toggle alone grants nothing.

Inspired by Firebase and Azure, organize the developer journey as **Organization → Project → Environment → Products → API keys → Usage & Billing → Settings**. Add environment-scoped credentials, quota alerts, usage export, audit trail, documented API versions and service-health states. No redesign is claimed deployed by this document.

## Current availability
Games and Highscores are the only installable catalog modules. Statistics, Advertize, Monetize Reports and Coins are intentionally not installable until their API endpoints, permission checks, database schema and production tests exist. The existing Statistics API in Vedoy Studio is a separate early MVP.

## Metering and API margin
Charge only for defined billable successful requests or other published units; document free tier, refunds, provider costs, tax and price changes. Example **illustrative assumptions**: NOK 0.50 per 1,000 requests billed, NOK 0.20 per 1,000 requests variable cost, 100,000 requests/month = NOK 50 gross revenue, NOK 20 variable cost, NOK 30 gross contribution before fixed costs and taxes. This is NOT actual market pricing, observed traffic or a guarantee of profit. A paid API meter needs idempotent server-side ledger, authorization, quotas, abuse controls and reconciliation before launch.

## Advertising and settlement
Only recognize publisher payable from **actually received, cleared and reconciled advertiser payments**, net of refunds and payment-processing fees. Proposed share **25% Vedoy / 75% publisher** of net receipts, adjustable by contract. Example: NOK 1,000 received, NOK 30 payment fees => NOK 970 net, NOK 242.50 Vedoy share, NOK 727.50 publisher payable, before other costs/taxes. This is an example, not a live rate or guaranteed return.

Suggested contractual settlement hold: **up to 30 calendar days after cleared advertiser payment**, subject to verified impressions, fraud checks, disputes, applicable payment provider terms and law. The system must expose payout status: awaiting advertiser payment, clearing, verification, eligible, sent, reversed. Never promise a payout date without cash settlement. Store advertiser invoice, payment event, publisher split, hold date, payout destination and immutable adjustment history. Consult accounting/legal advice about tax, payout regulations and intermediary obligations.

## Data commercialisation
Never sell individual interest profiles, encrypted identities or pseudonymous identifiers as 'anonymous'. Offer only privacy-reviewed, thresholded aggregated insights with separate informed opt-in where required, small-cohort suppression and anti-reidentification checks. Data licensing must be reviewed independently from ad payouts; no data-sale or Rewards revenue should be represented as active.

## Release gates
1. Test and fix existing module selection races; ensure migration 004 is applied.
2. Implement project-scoped Monetize module APIs and storage before marking installable.
3. Add auditable consent configuration, visitor opt-in and withdrawal enforcement.
4. Add immutable billing/settlement ledgers and Stripe/webhook reconciliation; separate developer revenue from Vedoy revenue.
5. Add real aggregate operational dashboards (polling or realtime), with tenant isolation and no raw visitor data.
6. Verify legal terms, GDPR, VAT and provider agreements.
7. Run npm check/test, staging database integration tests and browser smoke tests before production.
