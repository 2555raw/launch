# FOUNDRY — Mine. Burn. Launch.

A Cookie-Clicker-style idle game where the whole community plays to decide the supply of a
commodity token before it launches on Solana.

```
CLICK → EARN → BUY CURSORS → AUTOMATE → UPGRADE → RAISE BURN POWER → TOKEN LAUNCH
```

Every unit a player produces becomes **burn power**. Community burn power runs through a
configurable formula that permanently removes tokens from the pre-allocated launch supply.
When the countdown ends the game freezes, the final supply is locked, and the server creates
the token on Solana, mints the initial supply, burns the community-decided amount on-chain and
revokes the mint authority. A public project page then shows the result from live RPC data.

Gameplay is off-chain and server-validated. Only launch-level events touch the chain.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · Node custom server with `ws` ·
PostgreSQL + Prisma · Redis (ioredis) · `@solana/web3.js` · `@solana/spl-token` (Token-2022 with
on-chain metadata) · Solana Wallet Adapter (Phantom, Solflare, Wallet Standard).

## Run it

Requirements: Node 20+, PostgreSQL, Redis.

```bash
cd foundry
cp .env.example .env            # set DATABASE_URL, REDIS_URL, ADMIN_PASSWORD
npm install
npx prisma db push              # creates the schema
npm run dev                     # http://localhost:3000  (custom server: Next + WebSocket + scheduler)
```

Production: `npm run build && npm start`, or the included `Dockerfile`.

Tests and checks: `npm test` (economy/burn formula), `npm run typecheck`.

## How a launch works

1. **Admin** (`/admin`): sign in with any account, enter `ADMIN_PASSWORD`. Configure token name,
   symbol, commodity theme, initial supply, max burn %, burn formula (`linear` or `asymptotic`),
   burn rate, community allocation %, decimals, launch duration, click/cursor/generator
   multipliers, anti-cheat click cap and offline cap. Press **Start countdown**.
2. **Players** create an account (name + password) or sign in with a wallet signature, click the
   deposit, buy cursors and generators, level buildings, buy upgrades, unlock achievements and
   climb the burn-power leaderboard. The global counter updates live over WebSocket.
3. When the countdown ends the scheduler **freezes** the project (every session is settled up to
   the freeze instant), flushes Redis to Postgres and **finalizes** the tokenomics into a `Launch`
   row. Admin can also freeze/finalize by hand.
4. Admin presses **Create token + burn on Solana**. The server's launch authority:
   - creates a Token-2022 mint with on-chain metadata (name, symbol, URI, and fields recording
     the initial/burned/final supply and burn %),
   - mints the full initial supply to a treasury account,
   - burns the finalized amount,
   - revokes the mint authority (optional, on by default) so the supply is fixed.
   Each step is recorded in `BlockchainTransaction` before and after it runs, so a failed step
   can be retried without repeating completed ones.
5. The project page (`/project/<slug>`) shows recorded and live on-chain numbers (supply, mint
   authority, holders, largest accounts, transactions, Explorer links) and the claim panel.
6. **Claims**: a configurable share of the final supply is reserved for players pro rata to their
   burn power. A player links a wallet (signed nonce, no keys), and the server transfers their
   allocation on-chain. One claim per player per launch.

### Burn formula

```
maxBurn      = initialSupply × maxBurnPercent / 100
linear:      burned = min(maxBurn, burnRate × totalBurnPower)
asymptotic:  burned = maxBurn × (1 − 2^(−totalBurnPower / burnHalfLife))
finalSupply  = initialSupply − burned        (always ≥ 0; burned is clamped to [0, maxBurn])
```

Burn power per player = Σ generator production × generator burn weight × burn efficiency
(upgrades), plus click power × burn efficiency per accepted click.

### Solana

Default cluster is **devnet** (`SOLANA_CLUSTER`, `SOLANA_RPC_URL`, and the `NEXT_PUBLIC_*`
twins for the browser). The launch authority keypair comes from `SOLANA_AUTHORITY_SECRET`
(JSON array or base58); if unset in development one is generated into `.secrets/authority.json`.
The authority needs a little SOL: on devnet the server asks the faucet for an airdrop before
executing; the public faucet is rate-limited, so if that fails fund the address shown in the
admin panel at <https://faucet.solana.com> and press the button again. Player keys are never
requested or stored.

For a fully local run: `solana-test-validator`, then start the app with
`SOLANA_RPC_URL=http://127.0.0.1:8899 SOLANA_CLUSTER=localnet`.

Market data (price, liquidity, volume) is fetched from DexScreener only on mainnet; on devnet
the page says plainly that no market exists. Nothing on-chain is simulated.

## Anti-cheat

The client never sends balances or production; it reports *how many times it clicked* and
*what it wants to buy*. The server:

- credits passive production from its own clock, capped by the offline limit;
- accepts at most `maxClicksPerSecond × elapsed + grace` clicks per batch, drops the rest and
  adds a suspicion strike (visible in the admin panel);
- validates every id, cost, unlock requirement and upgrade requirement, and rejects negative or
  non-integer values (zod);
- rate-limits auth, sync and purchase endpoints in Redis;
- serializes all mutations per session with a Redis lock;
- rejects gameplay after the freeze instant;
- makes achievements, finalization, on-chain steps and claims idempotent.

## Data flow

Hot session state lives in a Redis hash and is flushed to Postgres every 5 s (dirty set). Global
counters are Redis `INCRBYFLOAT`s, flushed to `GlobalStats` every 5 s and snapshotted to
`BurnEvent` every minute. Leaderboard is a Redis sorted set. The scheduler broadcasts the global
snapshot once a second over `/ws`; clients fall back to polling if the socket is unavailable.

## Layout

```
server.ts                 custom HTTP server: Next handler + /ws + scheduler
prisma/schema.prisma      User, Wallet, AuthSession, Project, GameSession, ClickBatch (aggregated
                          clicks), Generator/Upgrade/Achievement catalogs, Player* ownership,
                          PlayerStats, GlobalStats, BurnEvent, Launch, Token, BlockchainTransaction
src/lib/content/          generators, upgrades, achievements, commodity themes (data-driven)
src/lib/economy.ts        cost curves, rate derivation, burn formula (shared, pure, tested)
src/server/               engine (Redis-backed), global counters, launch lifecycle, solana, auth, ws
src/app/api/              auth, wallet, game, global, project, admin, claim route handlers
src/app/                  / (game), /project/[slug], /admin
src/components/           game UI, project page, admin panel
```

Cursors are generators in the `cursor` category (three tiers); the `Cursor` concept therefore
lives in `Generator`/`PlayerGenerator` rather than a separate table.
