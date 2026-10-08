#!/usr/bin/env node
/**
 * Starts everything for local development:
 *   1. builds the shared packages once (tsc) and keeps them in watch mode
 *   2. runs the API, the game server and the Next.js web app
 * Requires Postgres + Redis (see docker-compose.yml or `npm run setup`).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!existsSync(path.join(root, '.env'))) {
  console.error('No .env found. Run `npm run setup` first (it copies .env.example and generates secrets).');
  process.exit(1);
}

const packages = ["@launch/types", "@launch/config", "@launch/game-engine", "@launch/database", "@launch/game-core", "@launch/solana", "@launch/evm", "@launch/robinhood"];

function run(name, args, opts = {}) {
  const child = spawn(npm, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' }, ...opts });
  const tag = `[${name}]`.padEnd(14);
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) out.write(`${tag} ${l}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  return child;
}

function once(name, args) {
  return new Promise((resolve, reject) => {
    const c = run(name, args);
    c.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${name} exited with ${code}`))));
  });
}

try {
  console.log('→ Building shared packages…');
  for (const p of packages) await once(p.replace('@launch/', 'build:'), ['run', 'build', '-w', p]);
  console.log('→ Generating Prisma client and applying migrations…');
  await once('prisma', ['run', 'generate', '-w', '@launch/database']);
  await once('migrate', ['run', 'migrate:deploy', '-w', '@launch/database']);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const children = [];
for (const p of packages) children.push(run(p.replace('@launch/', 'watch:'), ['exec', '-w', p, '--', 'tsc', '-p', 'tsconfig.json', '--watch', '--preserveWatchOutput']));
children.push(run('api', ['run', 'dev', '-w', '@launch/api']));
children.push(run('game-server', ['run', 'dev', '-w', '@launch/game-server']));
children.push(run('web', ['run', 'dev', '-w', '@launch/web']));

const shutdown = () => {
  for (const c of children) c.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
console.log('\n  Web:          http://localhost:3000\n  API:          http://localhost:4000\n  Game server:  ws://localhost:4100\n');
