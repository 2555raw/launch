#!/usr/bin/env bash
# Levanta un Supabase local mínimo (Postgres + GoTrue + PostgREST + Storage)
# sin la CLI de Supabase. Pensado para Linux/CI con Docker y PostgreSQL 16
# instalados. En tu ordenador es más cómodo usar `supabase start`
# (ver README).
#
# Deja las claves en .local-stack/env para pegarlas en .env.local.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
STATE="${STACK_STATE_DIR:-/tmp/hdm-local-stack}"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="$STATE/pg"
DB_PORT=54322
REST_PORT=54330
AUTH_PORT=54331
STORAGE_PORT=54332
GATEWAY_PORT=54321
SMTP_PORT=54325
SITE_URL="${SITE_URL:-http://localhost:3000}"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"
ANON_KEY="$(node "$DIR/jwt.mjs" "$JWT_SECRET" anon)"
SERVICE_KEY="$(node "$DIR/jwt.mjs" "$JWT_SECRET" service_role)"
GOTRUE_IMAGE="${GOTRUE_IMAGE:-ghcr.io/supabase/gotrue:v2.177.0}"
POSTGREST_IMAGE="${POSTGREST_IMAGE:-ghcr.io/supabase/postgrest:v12.2.12}"
STORAGE_IMAGE="${STORAGE_IMAGE:-ghcr.io/supabase/storage-api:v1.25.7}"

mkdir -p "$STATE" "$STATE/storage" "$STATE/mail"
chmod 777 "$STATE"

psql_su() { "$PGBIN/psql" -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -p "$DB_PORT" -U postgres -d postgres "$@"; }

wait_for() {
  local name="$1" url="$2"
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then echo "  $name listo"; return 0; fi
    sleep 1
  done
  echo "  $name no responde en $url" >&2
  return 1
}

echo "> PostgreSQL"
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  mkdir -p "$PGDATA"
  chown postgres "$PGDATA"
  runuser -u postgres -- "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
  FRESH=1
else
  FRESH=0
fi
if ! runuser -u postgres -- "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  runuser -u postgres -- "$PGBIN/pg_ctl" -D "$PGDATA" -l "$STATE/postgres.log" \
    -o "-p $DB_PORT -k /tmp -c listen_addresses=127.0.0.1" -w start >/dev/null
fi
psql_su -f "$DIR/bootstrap.sql"

echo "> SMTP de pruebas"
if ! curl -s "telnet://127.0.0.1:$SMTP_PORT" --max-time 1 >/dev/null 2>&1; then
  MAIL_DIR="$STATE/mail" SMTP_PORT=$SMTP_PORT nohup node "$DIR/smtp-sink.mjs" >"$STATE/smtp.log" 2>&1 &
fi

echo "> GoTrue (auth)"
docker rm -f hdm-auth >/dev/null 2>&1 || true
docker run -d --name hdm-auth --network host \
  -e GOTRUE_API_HOST=127.0.0.1 -e PORT=$AUTH_PORT \
  -e API_EXTERNAL_URL="http://127.0.0.1:$GATEWAY_PORT/auth/v1" \
  -e GOTRUE_DB_DRIVER=postgres \
  -e DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:$DB_PORT/postgres?sslmode=disable" \
  -e GOTRUE_SITE_URL="$SITE_URL" \
  -e GOTRUE_URI_ALLOW_LIST="$SITE_URL/**" \
  -e GOTRUE_JWT_SECRET="$JWT_SECRET" -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated \
  -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
  -e GOTRUE_MAILER_AUTOCONFIRM="${MAILER_AUTOCONFIRM:-true}" \
  -e GOTRUE_SMTP_HOST=127.0.0.1 -e GOTRUE_SMTP_PORT=$SMTP_PORT -e GOTRUE_SMTP_ADMIN_EMAIL=no-reply@hambredemas.local \
  -e GOTRUE_SMTP_SENDER_NAME="Hambre de Más" \
  -e GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify -e GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify \
  -e GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 \
  "$GOTRUE_IMAGE" >/dev/null
wait_for auth "http://127.0.0.1:$AUTH_PORT/health"

echo "> Storage"
docker rm -f hdm-storage >/dev/null 2>&1 || true
docker run -d --name hdm-storage --network host \
  -e SERVER_PORT=$STORAGE_PORT -e PORT=$STORAGE_PORT \
  -e ANON_KEY="$ANON_KEY" -e SERVICE_KEY="$SERVICE_KEY" \
  -e AUTH_JWT_SECRET="$JWT_SECRET" -e PGRST_JWT_SECRET="$JWT_SECRET" \
  -e POSTGREST_URL="http://127.0.0.1:$REST_PORT" \
  -e DATABASE_URL="postgres://supabase_storage_admin:postgres@127.0.0.1:$DB_PORT/postgres" \
  -e FILE_SIZE_LIMIT=52428800 -e STORAGE_BACKEND=file -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage \
  -e TENANT_ID=stub -e REGION=local -e GLOBAL_S3_BUCKET=stub -e ENABLE_IMAGE_TRANSFORMATION=false \
  -v "$STATE/storage:/var/lib/storage" \
  "$STORAGE_IMAGE" >/dev/null
wait_for storage "http://127.0.0.1:$STORAGE_PORT/status"
# Supabase concede estos permisos por defecto sobre las tablas de storage.
for _ in $(seq 1 20); do
  if psql_su -tAc "select 1 from pg_tables where schemaname='storage' and tablename='objects'" | grep -q 1; then break; fi
  sleep 1
done
psql_su -c "grant usage on schema storage to anon, authenticated, service_role; grant all on all tables in schema storage to anon, authenticated, service_role; grant all on all sequences in schema storage to anon, authenticated, service_role;"

if [ "$FRESH" = "1" ] || [ "${RESET:-0}" = "1" ]; then
  echo "> Migraciones"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "  $(basename "$f")"
    psql_su -f "$f"
  done
  echo "> Datos de demostración"
  psql_su -f "$ROOT/supabase/seed.sql"
fi

echo "> PostgREST"
docker rm -f hdm-rest >/dev/null 2>&1 || true
docker run -d --name hdm-rest --network host \
  -e PGRST_DB_URI="postgres://authenticator:postgres@127.0.0.1:$DB_PORT/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="$JWT_SECRET" -e PGRST_SERVER_PORT=$REST_PORT \
  -e PGRST_DB_USE_LEGACY_GUCS=false \
  "$POSTGREST_IMAGE" >/dev/null
wait_for rest "http://127.0.0.1:$REST_PORT/"

echo "> Pasarela"
pkill -f "$DIR/gateway.mjs" 2>/dev/null || true
GATEWAY_PORT=$GATEWAY_PORT AUTH_PORT=$AUTH_PORT REST_PORT=$REST_PORT STORAGE_PORT=$STORAGE_PORT \
  nohup node "$DIR/gateway.mjs" >"$STATE/gateway.log" 2>&1 &
sleep 1

cat >"$STATE/env" <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$GATEWAY_PORT
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
DATABASE_URL=postgres://postgres@127.0.0.1:$DB_PORT/postgres
MAIL_DIR=$STATE/mail
ENV
echo
echo "Supabase local listo en http://127.0.0.1:$GATEWAY_PORT"
echo "Variables en $STATE/env"
