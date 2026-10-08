#!/usr/bin/env node
/** Runs the Prisma CLI with the monorepo root .env loaded (Prisma only reads a package-local .env by itself). */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
for (const candidate of [path.resolve(here, '../../../.env'), path.resolve(here, '../.env')]) {
  if (existsSync(candidate)) {
    config({ path: candidate });
    break;
  }
}
if (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL_TEST) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
const bin = path.resolve(here, '../node_modules/.bin/prisma');
const fallback = path.resolve(here, '../../../node_modules/.bin/prisma');
const prisma = existsSync(bin) ? bin : fallback;
const r = spawnSync(prisma, process.argv.slice(2), { stdio: 'inherit', env: process.env });
process.exit(r.status ?? 1);
