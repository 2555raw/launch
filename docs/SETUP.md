# Setup

## Requirements

* Node.js ≥ 20 (22 recommended), npm ≥ 10
* PostgreSQL 16 and Redis 7 — via `docker compose up -d postgres redis` or your own instances
* A Solana wallet (Phantom / Solflare) and/or an EVM wallet (MetaMask) in the browser to test launches

## Steps

```bash
npm install
docker compose up -d postgres redis
npm run setup        # copies .env.example → .env (generated JWT + encryption secrets), builds packages, prisma generate, migrate deploy, seed
npm run dev
```

`npm run dev` builds the shared packages, keeps them in `tsc --watch`, and starts the API (4000), the game server (4100) and Next.js (3000).

## Environment variables

See `.env.example`; every variable is documented inline. The important ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DATABASE_URL_TEST` | Postgres for dev and for `npm test` |
| `REDIS_URL` | rate limits, matchmaking locks, nonces, pub/sub |
| `JWT_SECRET` | access tokens (≥32 chars) |
| `CREDENTIALS_ENCRYPTION_KEY` | 32-byte hex key for user-linked Robinhood credentials |
| `SOLANA_NETWORK`, `SOLANA_RPC_URL` | `mainnet-beta` by default. Use a dedicated RPC provider in production |
| `ROBINHOOD_CHAIN_NETWORK`, `ROBINHOOD_CHAIN_RPC_URL` | `mainnet` (4663) by default; `testnet` (46630) |
| `JUPITER_API_URL`, `JUPITER_API_KEY` | Swap API v2 (keyless works at low rate limits) |
| `NEXT_PUBLIC_*` | values baked into the browser bundle; keep them in sync with the server ones |

## Docker

`docker compose --profile full up --build` runs Postgres, Redis, API, game server and web. The API container runs `prisma migrate deploy` on boot.

## Troubleshooting

* `Invalid environment configuration` on boot → the message lists the offending variable.
* `No opponent available` → there is only one player; register a second account in a private window.
* Public Solana mainnet RPC returns 429 → set `SOLANA_RPC_URL` to a provider endpoint.
