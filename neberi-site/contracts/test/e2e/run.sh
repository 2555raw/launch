#!/bin/sh
# Browser end-to-end test of the whole site against a local chain.
#   cd neberi-site/contracts && npm install && npm run test:e2e
# Needs Chromium (set CHROME=/path/to/chrome if it is not the Playwright one).
set -e
cd "$(dirname "$0")/../.."
for port in 8545 8767; do
  if curl -s -m 2 "http://127.0.0.1:$port" > /dev/null 2>&1; then
    echo "port $port is already in use; stop whatever is running there first" >&2
    exit 1
  fi
done
node scripts/compile.js test/Harness.sol test/MockToken.sol > /dev/null
./node_modules/.bin/hardhat node --config hardhat.e2e.config.js --hostname 127.0.0.1 --port 8545 > test/e2e/node.log 2>&1 &
NODE=$!
trap 'kill $NODE $SITE 2>/dev/null || true' EXIT
for i in $(seq 1 40); do
  curl -s -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:8545 | grep -q result && break
  sleep 1
done
node test/e2e/deploy-local.js > /dev/null
node test/e2e/server.js > test/e2e/server.log 2>&1 &
SITE=$!
sleep 1
node test/e2e/e2e.js
