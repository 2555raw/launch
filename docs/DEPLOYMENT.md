# Deployment

| Component | Recommended | Notes |
| --- | --- | --- |
| Web | Vercel (root `apps/web`, build `npm run build:packages && npm run build -w @launch/web` from the repo root) or the `apps/web/Dockerfile` (standalone output) | set `NEXT_PUBLIC_*` at build time |
| API | Railway / Fly.io / AWS via `apps/api/Dockerfile` | exposes 4000, runs migrations on boot, needs a persistent volume or S3 for `/uploads` |
| Game server | same, `apps/game-server/Dockerfile`, port 4100, WebSocket-capable load balancer with sticky sessions (battle rooms are in-memory per instance; chat/notifications fan out through Redis so multiple instances work) | |
| PostgreSQL | managed (Neon, RDS, Railway) | `DATABASE_URL` with `sslmode=require` |
| Redis | managed (Upstash, ElastiCache, Railway) | |
| RPC | Helius / Triton / QuickNode for Solana; Alchemy for Robinhood Chain (`https://robinhood-mainnet.g.alchemy.com/v2/{KEY}`) | public endpoints are rate limited |

Checklist: `NODE_ENV=production`, strong `JWT_SECRET` and `CREDENTIALS_ENCRYPTION_KEY`, `CORS_ORIGINS` = web origin, `API_PUBLIC_URL` = public API URL (it is embedded in metadata URIs), `WEB_PUBLIC_URL` = web origin (used in sign-in messages), HTTPS everywhere (refresh cookie is `Secure; SameSite=None`), `JUPITER_API_KEY` for production swap rate limits, metadata/logo storage on durable object storage.

`docker compose --profile full up --build` reproduces the production topology locally.
