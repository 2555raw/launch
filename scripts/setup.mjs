#!/usr/bin/env node
/** One-time local setup: writes .env with generated secrets, builds packages, generates Prisma client, migrates and seeds. */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
if (!existsSync(envPath)) {
  let env = readFileSync(path.join(root, '.env.example'), 'utf8');
  env = env.replace('JWT_SECRET=change-me-generate-a-64-hex-secret', `JWT_SECRET=${randomBytes(32).toString('hex')}`);
  env = env.replace('CREDENTIALS_ENCRYPTION_KEY=change-me-generate-a-64-hex-secret', `CREDENTIALS_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`);
  writeFileSync(envPath, env);
  console.log('✓ wrote .env with generated secrets');
} else {
  console.log('• .env already exists, leaving it alone');
}
const sh = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
sh('npm run build:packages');
sh('npm run db:generate');
sh('npm run db:migrate');
sh('npm run db:seed');
console.log('\n✓ Setup complete. Run `npm run dev`.');
