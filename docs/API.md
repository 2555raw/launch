# API

Base URL `http://localhost:4000`. JSON everywhere. Auth = `Authorization: Bearer <accessToken>` (15 min) + refresh via the `launch_rt` httpOnly cookie (or `refreshToken` in the body for clients without cookies). Errors: `{ "error": { "code", "message", "details?" } }`. Global rate limit 300 req/min per user/IP; auth routes 10/min; stricter limits on sensitive routes.

## Auth
| Method | Path | Body |
| --- | --- | --- |
| POST | /auth/register | email, password, username |
| POST | /auth/login | email, password |
| POST | /auth/refresh | (cookie) or refreshToken |
| POST | /auth/logout | |
| GET | /auth/me | |
| POST | /auth/wallet/nonce | chain (SOLANA/ROBINHOOD), address → nonce + message |
| POST | /auth/wallet/verify | chain, address, nonce, signature → session (creates an account on first use) |

## Wallets
GET /wallets · POST /wallets/link (same payload as verify, + label) · DELETE /wallets/:id · PATCH /wallets/:id/primary

## Game
| Path | Notes |
| --- | --- |
| GET /game/catalog | buildings, troops, achievements, xp table |
| GET /game/village | village DTO + per-Town-Hall catalog |
| POST /game/buildings {type,x,y} · PATCH /game/buildings/:id/move {x,y} · POST …/upgrade · …/cancel · …/collect · …/skip · DELETE /game/buildings/:id | |
| GET /game/army · POST /game/army/train {troopType,count} · DELETE /game/army/training/:jobId · POST /game/army/research {troopType} | |
| POST /game/battles/find · POST /game/battles/:id/abandon · GET /game/battles/history · GET /game/battles/:id · GET /game/battles/:id/replay | battles are played over WebSocket (docs/WEBSOCKETS.md) |
| GET /game/player/me · GET /game/players/:id · GET /game/players/search?q= · POST /game/achievements/:key/claim | |
| GET /game/leaderboard/players?cursor&limit · GET /game/leaderboard/clans | |
| GET /game/notifications · POST /game/notifications/read {ids?} | |

## Clans
GET /game/clans?q · GET /game/clans/mine · POST /game/clans · GET /game/clans/:id · POST /game/clans/:id/join · POST /game/clans/leave · PATCH /game/clans · POST /game/clans/invite {playerId} · POST /game/clans/invites/:id/respond {accept} · POST /game/clans/members/:playerId/role {role} · DELETE /game/clans/members/:playerId · POST /game/clans/messages {content} · POST /game/clans/requests {message} · POST /game/clans/requests/:id/donate {troopType,count}

## Launchpad
| Path | Notes |
| --- | --- |
| GET /launchpad/config | networks + compiled ERC-20 ABI/bytecode |
| GET /launchpad/projects?sort=new|trending|volume|liquidity|marketcap|holders&chain&q&cursor&limit | published projects with cached metrics |
| GET /launchpad/projects/:slug | project + fresh metrics + transactions |
| POST /launchpad/projects/:slug/refresh-metrics | |
| GET /launchpad/mine · POST /launchpad/projects · PATCH /launchpad/projects/:id · DELETE /launchpad/projects/:id | drafts |
| POST /launchpad/projects/:id/logo | multipart `file` (png/jpg/webp/svg ≤ 2 MB) |
| POST /launchpad/projects/:id/prepare | writes metadata JSON, returns metadataUri + chain params |
| POST /launchpad/projects/:id/submit {signature, address} | on-chain verification → PUBLISHED |
| GET /transactions | the user's recorded transactions |

## Swaps (Jupiter v2)
GET /swap/config · GET /swap/quote?inputMint&outputMint&amount&taker&slippageBps · POST /swap/execute {signedTransaction, requestId, inputMint, outputMint, taker}

## Portfolio & Robinhood
GET /portfolio · GET /robinhood/capabilities · POST /robinhood/keypair · GET/POST/DELETE /robinhood/connection · GET /robinhood/account · /holdings · /pairs · /quotes?symbols · GET/POST /robinhood/orders · POST /robinhood/orders/:id/cancel

## Admin (roles ADMIN / MODERATOR / DEVELOPER)
GET /admin/stats · GET /admin/users · POST /admin/users/:id/ban|unban|role · GET /admin/villages/:playerId · POST /admin/villages/:playerId/grant · GET /admin/battles · GET /admin/battles/:id/audit · GET/DELETE /admin/clans · GET /admin/projects · POST /admin/projects/:id/unpublish · GET /admin/tokens · GET /admin/transactions · GET /admin/reports · POST /admin/reports/:id/resolve · GET /admin/config · PUT /admin/config/:key · GET /admin/audit-logs · POST /reports (any user)
