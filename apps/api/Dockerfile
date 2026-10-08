# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/game-server/package.json apps/game-server/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/database/package.json packages/database/
COPY packages/game-engine/package.json packages/game-engine/
COPY packages/game-core/package.json packages/game-core/
COPY packages/solana/package.json packages/solana/
COPY packages/evm/package.json packages/evm/
COPY packages/robinhood/package.json packages/robinhood/
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm run generate -w @launch/database \
 && npm run build -w @launch/types -w @launch/config -w @launch/game-engine -w @launch/database -w @launch/game-core -w @launch/solana -w @launch/evm -w @launch/robinhood \
 && npm run build -w @launch/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app ./
WORKDIR /app/apps/api
EXPOSE 4000
# migrations run on boot so a fresh database is ready; remove if you migrate in CI instead
CMD ["sh", "-c", "node ../../packages/database/scripts/prisma.mjs migrate deploy && node dist/server.js"]
