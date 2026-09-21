# Payence

A stablecoin payment platform. People hold digital euros and dollars and spend them in shops,
online and with each other; merchants take those payments with a QR code, a link or an API call.

The point of this build is that the payments are real operations against a real double-entry ledger,
not a clickable mock. What is simulated is the blockchain settlement underneath, and the app says so
on every screen where it matters.

```bash
npm install
cp .env.example .env
npm run seed          # demo accounts, a merchant, balances and history
npm run dev           # http://localhost:3000
```

The seed prints two sign-ins, a merchant API key and an open charge to pay:

```
alex@example.com / payence-demo-2026    funded personal account
sam@example.com  / payence-demo-2026    owns the merchant
```

## What actually works

Everything in this list runs end to end against the ledger, is covered by a test, and does what its
button says.

- **Accounts**: sign-up, sign-in, sessions, sign-out, device list and revocation, password change
  (which signs out every other device), TOTP two-factor with a QR to scan.
- **Wallet**: balances per asset with a fiat equivalent, deposit addresses per network, withdrawals
  with a network fee and a pending hold, conversion between assets at the reference rate.
- **Payments**: send to another account by handle, pay a merchant from a QR or a link, hosted
  checkout with a live expiry countdown, receipts with fee, rate, network and hash.
- **Merchants**: onboarding, charge creation, QR and payment links, transaction list, partial and
  full refunds, revenue and fee totals, accepted and settlement asset settings.
- **Developers**: API keys (hashed, shown once), webhooks with signed deliveries and retry backoff,
  and a REST API for payment requests, refunds, transactions and balance.
- **Guardrails**: tiered limits per transaction, per day and per month; a self-imposed daily cap;
  rate limiting on sign-in, sign-up, payments and the API; an append-only audit log.

## What is simulated, and what a real deployment needs

| Area | Here | To go live |
| --- | --- | --- |
| Blockchain settlement | `SimulatedChain`: deterministic addresses and hashes, no funds move | Set `CHAIN_PROVIDER=evm` with an RPC URL. The viem implementation is written; the signing key must move to custody (see below) |
| Deposit detection | Credited by a demo button, clearly labelled | Run the chain watcher against `watchDeposits` as a worker |
| Exchange rates | Fixed constants | `RATE_PROVIDER=frankfurter` (ECB, no key) or a market data feed |
| Identity verification | Opens a review case; nothing is auto-approved | Sumsub, Persona or Onfido behind `ComplianceProvider.startKyc` |
| Sanctions and address risk | Not implemented | ComplyAdvantage, Chainalysis or TRM behind `screenTransaction` |
| Email and push | Logged to the console | `EMAIL_PROVIDER=resend`, or any transactional provider |
| Fiat payout to a bank | Not implemented | A licensed off-ramp partner; this is a regulated activity |
| Tap to pay / NFC | Not implemented | A native app with secure element access, plus a card issuing partner |

Nothing in the UI claims a capability from the right-hand column. The developers page lists each one
with its real status.

## Before processing real money

1. **Get licensed.** Holding customer funds and converting them is a regulated activity. This build
   is not authorised anywhere and says so in its footer.
2. **Move the signing key.** `HOT_WALLET_PRIVATE_KEY` in an environment variable is a development
   shape. Production needs an HSM, a KMS or a custody provider, a hot wallet float small enough to
   lose, and sweeps to cold storage.
3. **Move the database.** SQLite is right for one process. Multiple instances need Postgres; the
   schema is dialect-neutral, so it is a driver change, not a data-model change.
4. **Move the rate limiter and the webhook queue out of process.** Both are in-memory today and
   protect a single instance only. Redis for the first, a real queue for the second.
5. **Replace the legal copy.** The terms and privacy policy are templates and say so at the top.
6. **Add monitoring.** Error reporting, alerting on failed webhooks and stuck withdrawals, and a
   reconciliation job that checks the ledger against on-chain balances.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests: money, ledger, auth, webhooks |
| `npm run smoke` | HTTP smoke test against a running server |
| `npm run journey` | Browser test of the customer journey |
| `npm run journey:merchant` | Browser test of the merchant journey |
| `npm run seed` | Reset and seed demo data |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Regenerate migrations from the schema |

The browser tests need a Chromium binary; set `CHROMIUM` if it is not at the default path. The end
to end suites run against a server started with `npm start`, which refuses to boot in production
without `APP_SECRET` set: that guard is deliberate, so export one first.

`GET /api/health` reports the database, the chain provider and whether settlement is simulated.

## Layout

```
app/
  (marketing)/        landing, developers, API reference, legal
  (auth)/             sign-in, sign-up, two-factor
  (app)/              wallet, payments, activity, settings
  (merchant)/         merchant dashboard, charges, refunds, keys
  checkout/[code]/    the hosted checkout
  pay/[code]/         the QR target, a redirect to checkout
  api/v1/             the merchant API
components/
  ui/                 buttons, fields, states, icons, money display
  app/                shells, navigation, transaction list, QR
  landing/            marketing sections
lib/
  money.ts            integer money, fees, conversion
  assets.ts           the asset registry
  networks.ts         the network registry
  db/                 schema and client
  auth/               passwords, sessions, TOTP, crypto, rate limiting
  providers/          the external seams
  services/           the ledger and everything that moves money
```

`ARCHITECTURE.md` explains the ledger rules, the provider seams and the payment flow in detail.

## A note on fonts

Type is loaded from Google Fonts with a plain `<link>`, so the build never depends on reaching
Google at build time. For a payment product that would rather not make a third-party request on
every page load, self-host the two families and drop the link from `app/layout.tsx`.
