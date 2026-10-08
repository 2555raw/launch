#!/bin/bash
# Boots PostgreSQL + Redis on the volume, applies the schema, starts FOUNDRY.
set -euo pipefail
DATA="${DATA_DIR:-/app/data}/foundry"
PGDATA="$DATA/pg"
PGBIN=/usr/lib/postgresql/15/bin
PGPASS="${PG_PASSWORD:-foundry}"
mkdir -p "$PGDATA" "$DATA/redis"
chown -R postgres:postgres "$DATA"
chmod 700 "$PGDATA"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[start] initializing postgres cluster"
  echo "$PGPASS" > /tmp/pgpass
  chown postgres /tmp/pgpass
  su postgres -s /bin/bash -c "$PGBIN/initdb -D '$PGDATA' -U foundry --pwfile=/tmp/pgpass -A scram-sha-256 >/dev/null"
  rm -f /tmp/pgpass
fi
su postgres -s /bin/bash -c "$PGBIN/pg_ctl -D '$PGDATA' -l '$DATA/pg.log' -w -o '-c listen_addresses=127.0.0.1 -c port=5432 -c shared_buffers=32MB -c max_connections=40' start"
PGPASSWORD="$PGPASS" $PGBIN/createdb -h 127.0.0.1 -U foundry foundry 2>/dev/null || true

redis-server --daemonize yes --bind 127.0.0.1 --port 6379 --dir "$DATA/redis" --save 60 1 --appendonly no --maxmemory 128mb --maxmemory-policy noeviction

export DATABASE_URL="${DATABASE_URL:-postgresql://foundry:${PGPASS}@127.0.0.1:5432/foundry}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
echo "[start] applying schema"
npx prisma db push --skip-generate
echo "[start] launching app on port ${PORT:-3000}"
exec npm start
