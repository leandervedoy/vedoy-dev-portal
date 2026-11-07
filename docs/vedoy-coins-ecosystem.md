# Vedoy Coins: ecosystem-wide purchase and earn model (proposal)

## Purpose
A single Vedoy ID wallet supports earning coins in eligible Vedoy projects and spending them on eligible Vedoy products and services. This is a **proposed architecture**, not a live balance or payment instrument.

## Earning
- Earn through verified, voluntary tasks, eligible purchases, quizzes and partner campaigns.
- Never reward passive tracking or force marketing consent as a condition of ordinary access.
- Every earning event requires server-side validation, idempotency key, anti-abuse checks, reward cap and immutable ledger entry.
- Provide a user-facing transaction history and reversal procedure.

## Spending
- Coins can be used toward eligible checkout in Studio, Collective, Spotlight, Phone and Developer Portal, subject to applicable platform, tax and payment restrictions.
- Allow mixed Coins + NOK checkout when supported; avoid claiming universal acceptance before integrations exist.
- API usage is metered in Vedoy Credits and may later be paid for with Coins through a documented conversion and invoice settlement.
- The illustrative 1 Coin = NOK 1 conversion is NOT active and must be approved with terms, pricing and legal review. Coins purchased for NOK create liabilities until redeemed/expired according to applicable rules.

## Architecture
Vedoy ID -> wallet service -> append-only double-entry ledger -> earn authorization -> checkout reservation -> capture/release/refund -> project billing integration. Store purchased and promotional balances separately to support refunds, expiration rules and accounting. Use atomic transactions, per-currency precision, unique event IDs, reconciliation and fraud limits.

## Legal and risk
A cross-service prepaid balance may raise e-money/payment-services questions in Norway/EEA; obtain legal assessment before selling coins, allowing transfer or third-party redemption. Do not market Coins as crypto, investment, cash equivalent or redeemable for fiat. Protect minors and handle refunds, VAT, consumer rights and app-store rules.

## Rollout
1. Internal reward-only sandbox; no purchased Coins.
2. Single-merchant checkout pilots after legal review.
3. Multi-product wallet and documented Credits conversion.
4. Purchased Coins and broader marketplace acceptance only after compliance approval.
