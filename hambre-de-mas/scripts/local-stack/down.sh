#!/usr/bin/env bash
# Para el Supabase local levantado con up.sh. Con PURGE=1 borra también los datos.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
STATE="${STACK_STATE_DIR:-/tmp/hdm-local-stack}"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
docker rm -f hdm-auth hdm-rest hdm-storage >/dev/null 2>&1
pkill -f "$DIR/gateway.mjs" 2>/dev/null
pkill -f "$DIR/smtp-sink.mjs" 2>/dev/null
runuser -u postgres -- "$PGBIN/pg_ctl" -D "$STATE/pg" -m fast stop >/dev/null 2>&1
if [ "${PURGE:-0}" = "1" ]; then rm -rf "$STATE"; fi
echo "Supabase local parado"
