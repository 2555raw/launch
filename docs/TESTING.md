# Testing

`npm test` builds the packages, generates the Prisma client and runs every suite in order. Integration suites need Postgres (`DATABASE_URL_TEST`, migrated automatically by the suites' setup through `NODE_ENV=test`) and Redis.

| Suite | What it covers |
| --- | --- |
| `@launch/game-engine` | balance tables, placement, accrual, determinism, replay, pathing through walls, loot, trophies |
| `@launch/game-core` (Postgres + Redis) | village lifecycle, timers, construction cancel/remove, collection caps, training & housing, matchmaking locks, authoritative battle finalize + idempotency + notifications, clans (roles, donations, chat, leadership succession) |
| `@launch/solana` | token input validation, ed25519 sign-in in three encodings, DexScreener normalization, Jupiter v2 client, **live read-only mainnet** parse of a Token-2022 mint; live devnet mint test when `SOLANA_DEVNET_TESTS=1` |
| `@launch/evm` | chain ids, compiled artifact sanity, ERC-20 validation, EIP-191 verification; live Robinhood Chain testnet deploy when `EVM_TESTNET_TESTS=1` + `EVM_SERVER_PRIVATE_KEY` |
| `@launch/robinhood` | request signing known-answer (verified with the public key), key formats, client endpoints/headers/errors, capability matrix |
| `@launch/api` (Fastify inject) | health + security headers, auth required, register/login/refresh rotation + reuse detection, validation, Solana wallet sign-in + nonce replay rejection + bad signature, EVM wallet linking, village actions + cheats rejected, matchmaking requires army, resources hidden from other players, clan gating, launchpad draft/validation/prepare/metadata/submit failure path, admin RBAC + ban + audit + grant, login rate limiting |
| `@launch/game-server` (real WebSocket) | auth rejection, full battle: join → invalid deployments rejected → 20 deployments → streamed state → persisted result and trophies |

Live network tests: `npm run test:devnet`. The devnet airdrop faucet is rate limited per IP; provide `SOLANA_SERVER_KEYPAIR` (JSON byte array of a funded devnet key) if `requestAirdrop` fails, and `EVM_SERVER_PRIVATE_KEY` funded from the Robinhood Chain testnet faucet.
