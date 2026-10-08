# Architecture

## Overview

```
                 ┌──────────────┐  REST/JSON   ┌──────────────┐
  Browser ─────▶ │  apps/web    │ ───────────▶ │  apps/api    │──▶ PostgreSQL (Prisma)
  (Next.js)      │  Next.js 15  │              │  Fastify 5   │──▶ Redis (rate limits, locks, pub/sub)
                 └──────────────┘              └──────────────┘──▶ Solana RPC · Robinhood Chain RPC
                        │ WebSocket                     ▲          DexScreener · Blockscout · Jupiter
                        ▼                               │          Robinhood Crypto Trading API
                 ┌──────────────────┐   Redis pub/sub    │
                 │ apps/game-server │◀───────────────────┘
                 │ ws + simulation  │──▶ PostgreSQL (same schema, via @launch/game-core)
                 └──────────────────┘
  Wallets: Phantom / Solflare (wallet-adapter) · MetaMask & injected EVM wallets (wagmi) — sign only, keys never leave the wallet
```

### Why this split

* **API** owns everything request/response: auth, village actions, clans, launchpad, swaps, admin. Stateless, horizontally scalable.
* **Game server** owns anything that needs a live loop: battle simulation at 10 ticks/second, clan chat fan-out, push notifications. Battle rooms are in-memory; results go through the same `@launch/game-core` services the API uses, so rules live in one place.
* **game-engine** is pure, deterministic TypeScript (no I/O). The same code powers the live simulation, the API's replay audit and the browser's placement preview. A battle can always be re-simulated from `(seed, defender snapshot, army, deployment log)`.
* **game-core** = engine + Prisma. All resource mutations go through an append-only `ResourceLedger` with a `(playerId, reason, refId)` unique key, which is what makes rewards idempotent and auditable.
* **Blockchain packages** (`solana`, `evm`, `robinhood`) are framework-free and run both in Node and in the browser (`solana` builds the launch transaction client-side so the user's wallet signs it; the API only verifies).

### Off-chain vs on-chain

| Off-chain (PostgreSQL) | On-chain |
| --- | --- |
| village, buildings, timers, resources, troops, battles, clans, progression, matchmaking | token creation (Token-2022 mint / ERC-20 deploy), swaps (Jupiter), transfers, balances |

The game never writes to a chain and chain state never changes game state. They share identity (a user can hold linked wallets) and the UI.

### Request lifecycle for a game action

1. Client sends an intent (`POST /game/buildings/:id/upgrade`).
2. `withPlayer()` opens a transaction, **syncs** elapsed timers (constructions, training, research), then runs the action with full validation (Town Hall gating, counts, placement, cost, builder availability).
3. Resource changes are written through the ledger. The response returns the fresh village DTO.
4. Clients re-render from the DTO. There is no client-side authority over any number.

### Battle lifecycle

1. `POST /game/battles/find`: matchmaking by trophy range, excludes same clan / shielded / recently attacked; takes a Redis lock on the defender (5 min TTL); snapshots the defender village including lootable amounts (`distributeLoot`).
2. Client connects to the game server and sends `battle:join`. The server marks the battle ACTIVE and **consumes the army**.
3. Each `battle:deploy` is validated (troop available, outside the deployment exclusion zone, battle still running). The simulation runs server-side; snapshots stream every 250 ms.
4. On end (100 %, timeout, no troops left, or `battle:end`), `finalizeBattle` applies loot (capped by storage), Elo-style trophies, XP, stats, shield, achievements, clan trophies, and a notification. Idempotent.
5. `GET /game/battles/:id/replay` and `GET /admin/battles/:id/audit` re-run the simulation and compare.

### Launchpad lifecycle

1. Draft project (validated: name/symbol/decimals/supply limits for the chain).
2. Logo upload → stored under `apps/api/uploads` and served by the API (swap for S3/IPFS via `UPLOADS_DRIVER`).
3. `prepare` writes the metadata JSON, requires a linked wallet of the right chain, returns everything the wallet needs.
4. The browser builds and signs the transaction (Solana: `buildCreateTokenTransaction`; Robinhood Chain: `walletClient.deployContract` with the compiled `LaunchToken` artifact).
5. `submit` → the API fetches the transaction and the resulting mint/contract from RPC, checks the fee payer/deployer is a wallet linked to the user and that decimals/supply/symbol match, records `Token` + `Transaction`, publishes.
6. Metrics: DexScreener (`token-pairs/v1/{chain}/{address}`) + holder counts (Solana `getProgramAccounts` where the RPC allows, Blockscout for Robinhood Chain), refreshed lazily (60 s) and by a background loop. Missing data is `null` → "Data unavailable".

### Robinhood

* **Robinhood Chain** (EVM L2, chain id 4663 mainnet / 46630 testnet) is a first-class launch target through standard JSON-RPC.
* **Robinhood Crypto Trading API** (official) is implemented in `@launch/robinhood` with the documented Ed25519 request signing; users link their own API key, stored encrypted (AES-256-GCM).
* Stock/ETF/options trading and brokerage reads have **no public API**; `RobinhoodProvider` exposes a capability matrix and typed "unavailable" errors instead of fake data. See `docs/ROBINHOOD.md`.

## Technology

Node 22 · TypeScript 5 · Next.js 15 / React 19 / Tailwind 3 · Fastify 5 · Prisma 6 / PostgreSQL 16 · ioredis / Redis 7 · ws · zod · argon2 · jsonwebtoken · @solana/web3.js 1.x · @solana/spl-token 0.4 (Token-2022) · wallet-adapter · viem 2 / wagmi 3 · solc-js 0.8 · vitest 3.
