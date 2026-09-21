# Payence runs as a Node server: it has a database, server actions and an API,
# so it cannot be exported as static files.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 compiles from source when no prebuilt binary matches the image.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# The SQLite file must live on a mounted volume, or every deploy loses the ledger.
VOLUME ["/app/data"]
ENV DATABASE_URL=/app/data/payence.db

EXPOSE 3000
# Seed runs first and is a no-op once the database has users, so a restart does
# not pile up demo data. PORT is provided by the host; 3000 is the fallback.
CMD ["sh", "-c", "npm run seed && npx next start -p ${PORT:-3000}"]
