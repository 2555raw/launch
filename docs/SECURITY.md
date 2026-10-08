# Security

* **Authentication**: argon2id password hashing; 15-minute JWT access tokens (issuer/audience checked); rotating refresh tokens stored hashed with family-based reuse detection (a reused token revokes the whole family); httpOnly cookie scoped to `/auth` (`SameSite=None; Secure` in production).
* **Wallet auth**: server-issued single-use nonces (Redis, 5 min TTL) inside a human-readable message with domain and timestamp; ed25519 (Solana) / EIP-191 `personal_sign` (EVM) verification; wallets are unique per chain+address and can only be linked to one account. No seed phrases or private keys ever transit the system.
* **Authorization**: roles USER / DEVELOPER / MODERATOR / ADMIN; route guards (`requireRole`), clan role hierarchy enforced server-side, project edits restricted to the owner, admin actions audited.
* **Server authority / anti-cheat**: every game number is computed server-side; clients send intents only. Timers are server timestamps; speed-ups cost gems computed server-side. Placement, counts, Town Hall gating, costs and builder availability are validated in a transaction. Battles are simulated on the game server, deployments are validated against the exclusion mask and the locked army, and any battle can be re-simulated from its seed and log (`/replay`, admin `/audit`). Rewards are idempotent through the `ResourceLedger` unique key. Matchmaking uses Redis locks to prevent concurrent attacks on one defender.
* **Launchpad**: the server never signs; it verifies on chain that the fee payer/deployer is a wallet linked to the account and that decimals/supply/symbol match before publishing. Metrics come from RPC/explorers/DexScreener or are shown as unavailable.
* **Input validation**: zod on every body/query; file uploads limited to 2 MB and image MIME types; body limit 1 MB; WebSocket payloads 16 kB and 60 msgs/10 s.
* **Rate limiting**: Redis-backed global 300/min; 10/min on register/login; per-route limits on swaps, orders, matchmaking, uploads.
* **Headers / CORS**: helmet, explicit `CORS_ORIGINS`, credentials only for listed origins.
* **Secrets**: `.env` is git-ignored; `npm run setup` generates `JWT_SECRET` and `CREDENTIALS_ENCRYPTION_KEY`; user Robinhood credentials are AES-256-GCM encrypted at rest; logs never include tokens or keys.
* **Audit trail**: `AuditLog` for auth events, wallet links, launches, Robinhood orders and every admin action, with IP.
* **Bans**: banning revokes all refresh sessions; banned users cannot log in or connect to the game server.
