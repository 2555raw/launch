# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app

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
RUN npm ci --no-audit --no-fund --ignore-scripts

FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
ARG NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
ARG NEXT_PUBLIC_ROBINHOOD_CHAIN_NETWORK=mainnet
ARG NEXT_PUBLIC_ROBINHOOD_CHAIN_RPC_URL=https://rpc.mainnet.chain.robinhood.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL NEXT_PUBLIC_SOLANA_NETWORK=$NEXT_PUBLIC_SOLANA_NETWORK NEXT_PUBLIC_SOLANA_RPC_URL=$NEXT_PUBLIC_SOLANA_RPC_URL NEXT_PUBLIC_ROBINHOOD_CHAIN_NETWORK=$NEXT_PUBLIC_ROBINHOOD_CHAIN_NETWORK NEXT_PUBLIC_ROBINHOOD_CHAIN_RPC_URL=$NEXT_PUBLIC_ROBINHOOD_CHAIN_RPC_URL NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN npm run build -w @launch/types -w @launch/config -w @launch/game-engine -w @launch/solana && npm run build -w @launch/web

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
