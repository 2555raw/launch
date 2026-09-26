/* The whole thing on your machine, in one command:
 *
 *   npm run dev:chain            anvil + deploy + seed, then the site on http://localhost:5173
 *   npm run dev:chain -- --no-web    chain only (for tests)
 *
 * Needs Foundry's anvil on PATH (https://getfoundry.sh). The chain starts four
 * days in the past so the seeded coins get a few days of history, then catches up
 * to now and keeps mining a block a second like a real L2. Ctrl-C stops everything. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ROOT, args, sleep } from './lib/common.mjs';

const opts = args();
const port = Number(opts.port || 8545);
const rpc = `http://127.0.0.1:${port}`;
const children = [];

function which(bin) {
  const local = join(homedir(), '.foundry', 'bin', bin);
  return existsSync(local) ? local : bin;
}

function run(cmd, argv, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${argv.join(' ')} exited with ${code}`))));
  });
}

async function rpcCall(method, params = []) {
  const r = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

function shutdown() {
  for (const c of children) c.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const start = Math.floor(Date.now() / 1000) - 4 * 24 * 3600;
const anvil = spawn(which('anvil'), ['--port', String(port), '--timestamp', String(start), '--silent', '--chain-id', '31337'], { stdio: 'inherit' });
anvil.on('error', () => {
  console.error('anvil not found. Install Foundry: https://getfoundry.sh');
  process.exit(1);
});
children.push(anvil);

for (let i = 0; i < 50; i++) {
  try {
    await rpcCall('eth_chainId');
    break;
  } catch {
    await sleep(200);
  }
}
console.log(`anvil up on ${rpc}`);

await run('node', ['scripts/deploy.mjs'], { RPC_URL: rpc });
if (opts['no-seed'] !== 'true') await run('node', ['scripts/seed.mjs'], { RPC_URL: rpc });
await rpcCall('evm_setIntervalMining', [1]);
console.log('chain mining a block every second');

if (opts['no-web'] === 'true') {
  console.log('ready (chain only). Ctrl-C to stop.');
} else {
  const web = spawn('npx', ['vite', ...(opts.preview === 'true' ? ['preview'] : [])], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_ALLOW_LOCAL: '1' } });
  children.push(web);
}
await new Promise(() => {});
