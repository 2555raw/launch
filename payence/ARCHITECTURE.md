# Architecture

Payence is a stablecoin payment platform: people hold USDC, USDT or EURC and spend them in shops,
online and with each other. This document is the map of how that works, and, just as importantly,
where the seams are that a production deployment has to fill in.

## Layers

```
 Browser  ─┐
           │  Server Components (read)     app/(app), app/(merchant), app/(marketing)
           │  Server Actions (write)       app/**/actions.ts
           │  Route Handlers (merchant API) app/api/v1/*
           ▼
 ┌───────────────────────────────────────────────────────────────┐
 │  Services — the only place money moves                         │
 │  lib/services/{ledger,payments,merchants,limits,webhooks,...}  │
 └───────────────────────────────────────────────────────────────┘
           │                                   │
           ▼                                   ▼
 ┌───────────────────┐              ┌────────────────────────────┐
 │  Database         │              │  Providers (the seams)     │
 │  SQLite + Drizzle │              │  chain · rates · compliance│
 │  lib/db           │              │  notifications             │
 └───────────────────┘              └────────────────────────────┘
                                                  │
                                    Blockchains, rate feeds, KYC vendors,
                                    sanctions screening, email
```

Nothing in `app/` touches the database directly for a write. A page reads through a service; a form
posts to a server action, which validates and calls a service; the service owns the ledger.

## The ledger

`lib/services/ledger.ts` is the heart of the system, and the rules are short:

- **Money is integers.** Every amount is a `bigint` of the asset's base units, stored as a decimal
  string. A `USDC` balance of 12.50 is `12500000n`. No float ever touches a balance.
- **Every movement is double-entry.** A transaction carries a set of entries that must sum to zero
  per asset, applied inside one SQLite transaction. `applyEntries` refuses an unbalanced set.
- **Customers cannot go negative.** A user or merchant balance that would drop below zero raises
  `LedgerError("INSUFFICIENT_FUNDS")` and the whole transaction rolls back. The `external` and
  `platform` owners may go negative, because they stand for value outside the ledger (funds on a
  chain, liquidity) and for fee income.
- **Writes are idempotent.** A transaction carries an optional `idempotencyKey` with a unique index.
  A retry returns the original transaction and posts nothing, so a double-clicked button, a retried
  server action and a replayed API call cannot move money twice.
- **Two buckets.** `available` and `pending`. A withdrawal moves funds to `pending` while the chain
  confirms and clears them on success, or returns them in full on failure.

The invariant is tested: `tests/payments.test.ts` asserts that after a full run of deposits,
transfers, payments, refunds, withdrawals and conversions, every asset nets to exactly zero across
all owners.

## Provider seams

Each external dependency sits behind an interface in `lib/providers/types.ts`, chosen by environment
variable. Swapping the development implementation for a vendor is one file and one variable.

| Seam | Interface | Ships with | Production needs |
| --- | --- | --- | --- |
| Blockchain | `BlockchainProvider` | `SimulatedChain` (deterministic, no real funds) | `EvmChain` (viem) plus custody for the signing key |
| Exchange rates | `ExchangeRateProvider` | `FixedRates` | `FrankfurterRates` (ECB) or a market data feed |
| Compliance | `ComplianceProvider` | `BasicCompliance` (limits, geo blocks, review queue) | KYC vendor, sanctions and address-risk screening |
| Notifications | `NotificationProvider` | `ConsoleEmail` | `ResendEmail` or any transactional provider |

`SIMULATED_CHAIN` is surfaced in the UI: when the chain is simulated, a banner appears on every app
screen and the transaction receipt says the hash will not appear on any explorer. The app never
claims a settlement it did not make.

## Assets and networks

`lib/assets.ts` and `lib/networks.ts` are registries. Adding a stablecoin is one entry plus its
contract addresses per network; adding a network is one entry with its explorer, confirmation
profile and token map. Nothing else in the application hardcodes a symbol or a chain id, which is
why the landing page, the wallet, the withdrawal screen and the checkout all stay consistent.

## Request flow: paying a merchant

1. The merchant creates a payment request, in the dashboard or over `POST /api/v1/payment_requests`.
   It gets a short code, a QR and a hosted checkout URL, and expires after a window (default 30
   minutes) so a price is never paid at a stale rate.
2. The customer opens `/pay/<code>` (the QR target, a 307 to the checkout) or `/checkout/<code>`.
3. The checkout quotes the price in each asset the merchant accepts, shows the rate, the balance and
   a live countdown, and refuses to submit when the balance is short.
4. The server action re-validates everything — expiry, status, accepted asset, limits, compliance —
   because the client is not trusted, then calls `payRequest`.
5. `payRequest` posts one transaction: the payer is debited, the merchant credited net of the
   platform fee, and the fee posted to the platform account. The payment request is marked paid.
6. A `payment.completed` webhook is queued and the receipt is rendered.

## Authentication

- Sessions are random 32-byte tokens in an httpOnly, SameSite=Lax cookie. Only the SHA-256 of the
  token is stored, so a database leak does not yield live sessions.
- Passwords are salted scrypt (N=2^15). TOTP secrets are AES-256-GCM encrypted at rest under a key
  derived from `APP_SECRET`.
- `middleware.ts` redirects signed-out visitors with a real 307 before any rendering starts. That is
  a gate, not authorization: every protected page still calls `requireAuth()`, which verifies the
  session against the database.
- CSRF protection comes from SameSite=Lax plus Next's server actions, which carry their own origin
  check. The public API authenticates by bearer key instead and is exempt from the middleware.

## Testing

| Suite | Command | What it proves |
| --- | --- | --- |
| Unit | `npm test` | Money math, fees, conversion rounding, password hashing, TOTP, rate limiting, webhook signatures, and the full ledger with its zero-sum invariant |
| HTTP smoke | `npm run smoke` | Public pages, security headers, the auth gate, and every API endpoint including idempotency and error codes |
| User journey | `npm run journey` | A real browser: sign up, deposit, pay a checkout, read the receipt, refuse a double payment, mobile layout, sign out |
| Merchant journey | `npm run journey:merchant` | Onboarding, charge creation, QR, API key, taking a payment, refunding it, and the dashboard totals |
