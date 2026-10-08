# Launch · Emberhold

**Emberhold** is an original, server-authoritative multiplayer strategy game in the spirit of base-building raid games: build a persistent village, train an army, raid real players in real time, join clans and climb the ladder.
**Launch** is a real token launchpad on **Solana** (Token-2022 mints with on-chain metadata) and **Robinhood Chain** (ERC-20 on Robinhood's Arbitrum-based L2). Every launch is a transaction signed by the user's own wallet and verified on chain by the server before it is published.

Everything in this repository is real: PostgreSQL persistence, Redis-backed rate limits and locks, WebSocket battles simulated on the server, Ed25519 / EIP-191 wallet sign-in, live market data from DexScreener and chain explorers (or an explicit **"Data unavailable"**), Jupiter v2 swaps, and the official Robinhood Crypto Trading API. Nothing is mocked unless a test explicitly says so.

> Default networks are **Solana mainnet-beta** and **Robinhood Chain mainnet**. Token launches there cost real SOL / ETH from the user's wallet. Set `SOLANA_NETWORK=devnet` / `ROBINHOOD_CHAIN_NETWORK=testnet` (and the `NEXT_PUBLIC_*` twins) to run against test networks.

## Quick start

```bash
git clone <this repo> && cd launch
npm install
docker compose up -d postgres redis     # or point DATABASE_URL / REDIS_URL at your own
npm run setup                            # writes .env with generated secrets, builds, migrates, seeds
npm run dev                              # web :3000 · api :4000 · game server :4100
```

Open http://localhost:3000. The seed creates an admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` (default `admin@example.com` / `ChangeMe-Admin-123`).

Run the whole stack in containers instead: `docker compose --profile full up --build`.

## What you can do on day one

1. Create an account (email/password) or sign in with Phantom / Solflare / an EVM wallet (signature only; no seed phrases ever).
2. Build, move, upgrade, cancel and remove buildings in your village; collect from mines and collectors; speed up with crystals.
3. Train troops, research upgrades, and attack another player: matchmaking → scout → deploy tile by tile over WebSocket → server-computed result, loot, trophies, XP, achievements.
4. Create or join a clan, chat live, request and donate reinforcements, manage roles.
5. Launch a token: connect wallet → project details → logo → review → sign the real transaction → server verification → public project page with live metrics and explorer links.
6. Track your wallets and Robinhood crypto holdings in Portfolio; swap through Jupiter; link your official Robinhood Crypto API key in Settings.
7. Moderate everything from `/admin` (users, bans, villages, battle audits, clans, projects, tokens, reports, config, audit logs).

## Repository layout

```
apps/
  web/           Next.js 15 app (game UI, launchpad, wallet, portfolio, admin)
  api/           Fastify REST API (auth, game, clans, launchpad, swaps, portfolio, Robinhood, admin)
  game-server/   WebSocket server: authoritative battles, clan chat, notifications
packages/
  types/         shared DTOs + WebSocket protocol
  config/        validated env loading + chain constants
  database/      Prisma schema, migrations, seed
  game-engine/   pure game rules: buildings, troops, economy, placement, battle simulation
  game-core/     server-side game services on top of Prisma (used by api + game-server)
  solana/        Token-2022 launch builder, verification, balances, Jupiter v2, wallet auth
  evm/           Robinhood Chain config, LaunchToken.sol + compiled artifact, verification
  robinhood/     RobinhoodProvider: official Crypto Trading API client + capability matrix
programs/launchpad   Optional Anchor program (on-chain launch registry). Not required, not deployed.
scripts/       dev / setup / test runners
docs/          architecture, setup, API, websockets, game engine, Solana, launchpad, Robinhood, security, testing, deployment, mainnet
```

The other top-level folders (`payence`, `terminal`, `blendify-site`, `nomia-site`, `archive-2011`) are unrelated static projects that were already in this repository and are untouched.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | builds packages (watch), runs api + game-server + web |
| `npm test` | builds packages, generates Prisma client, runs every test suite (unit + integration against `DATABASE_URL_TEST`/Redis + read-only mainnet checks) |
| `npm run test:devnet` | additionally runs the live Solana devnet mint test and the Robinhood Chain testnet deploy test (needs funded keys, see docs/TESTING.md) |
| `npm run build` | production build of every package and app |
| `npm run db:migrate` / `db:migrate:dev` / `db:seed` / `db:reset` | Prisma migrations and seed |
| `npm run compile:evm` | recompiles `LaunchToken.sol` with solc-js |

See `docs/` for everything else.
