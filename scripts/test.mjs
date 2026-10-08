#!/usr/bin/env node
/**
 * Runs every workspace test suite in dependency order. Integration suites need Postgres + Redis
 * (DATABASE_URL_TEST / REDIS_URL). Devnet/testnet suites run only when SOLANA_DEVNET_TESTS=1 /
 * EVM_TESTNET_TESTS=1 are set (they hit public networks and need funded keys).
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });

sh('npm run build:packages');
sh('npm run generate -w @launch/database');
const suites = ['@launch/game-engine', '@launch/game-core', '@launch/solana', '@launch/evm', '@launch/robinhood', '@launch/api', '@launch/game-server', '@launch/web'];
let failed = false;
for (const s of suites) {
  console.log(`\n━━━ ${s} ━━━`);
  try {
    sh(`npm run test -w ${s}`);
  } catch {
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
