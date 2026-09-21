# Payence runs as a Node server: it has a database, server actions and an API,
# so it cannot be exported as static files.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 is compiled from source when no prebuilt binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY package.json next.config.mjs ./
# The SQLite file must live on a mounted volume, or every deploy loses the ledger.
VOLUME ["/app/data"]
ENV DATABASE_URL=/app/data/payence.db
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
