#!/usr/bin/env bash
# Builds both program variants, runs the main suite on a fresh local validator,
# then the deadline suite on the `fast` build (minimum duration 3 s).
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
PID=$(solana-keygen pubkey target/deploy/sol_bite-keypair.json)
LEDGER=${LEDGER:-/tmp/solbite-ledger}
stop() { pkill -f "^solana-test-validator" 2>/dev/null || true; sleep 1; }
wait_rpc() { for i in $(seq 1 60); do curl -s -X POST -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' http://127.0.0.1:8899 | grep -q ok && return 0; sleep 1; done; echo "validator did not start"; exit 1; }
cargo-build-sbf --manifest-path Cargo.toml --features fast >/dev/null 2>&1 && cp target/deploy/sol_bite.so target/deploy/sol_bite_fast.so
cargo-build-sbf --manifest-path Cargo.toml >/dev/null 2>&1
stop
solana-test-validator --reset --quiet --ledger "$LEDGER" --bpf-program "$PID" target/deploy/sol_bite.so > "$LEDGER.log" 2>&1 &
wait_rpc
PROGRAM_ID=$PID RPC=http://127.0.0.1:8899 node test.js
stop
solana-test-validator --reset --quiet --ledger "$LEDGER" --bpf-program "$PID" target/deploy/sol_bite_fast.so > "$LEDGER.log" 2>&1 &
wait_rpc
PROGRAM_ID=$PID RPC=http://127.0.0.1:8899 node test-deadline.js
stop
echo "all program tests passed"
