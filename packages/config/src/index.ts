import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/**
 * Loads `.env` from the monorepo root (walking up from cwd) and validates it.
 * Every server process calls `loadEnv()` once at startup; the web app reads only NEXT_PUBLIC_* values.
 */
export function findRootEnvPath(start = process.cwd()): string | null {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const SolanaNetwork = z.enum(['devnet', 'testnet', 'mainnet-beta']);
const RobinhoodNetwork = z.enum(['testnet', 'mainnet']);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  GAME_SERVER_PORT: z.coerce.number().int().positive().default(4100),
  WEB_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CREDENTIALS_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'CREDENTIALS_ENCRYPTION_KEY must be 32 bytes hex'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),

  SOLANA_NETWORK: SolanaNetwork.default('mainnet-beta'),
  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'),
  SOLANA_DEVNET_RPC_URL: z.string().url().default('https://api.devnet.solana.com'),
  SOLANA_SERVER_KEYPAIR: z.string().optional(),
  JUPITER_API_URL: z.string().url().default('https://api.jup.ag/swap/v2'),
  JUPITER_API_KEY: z.string().optional(),

  ROBINHOOD_CHAIN_NETWORK: RobinhoodNetwork.default('mainnet'),
  ROBINHOOD_CHAIN_RPC_URL: z.string().url().default('https://rpc.mainnet.chain.robinhood.com'),
  ROBINHOOD_CHAIN_TESTNET_RPC_URL: z.string().url().default('https://rpc.testnet.chain.robinhood.com'),
  EVM_SERVER_PRIVATE_KEY: z.string().optional(),

  ROBINHOOD_API_BASE_URL: z.string().url().default('https://trading.robinhood.com'),
  ROBINHOOD_PLATFORM_API_KEY: z.string().optional(),
  ROBINHOOD_PLATFORM_PRIVATE_KEY_BASE64: z.string().optional(),

  DEXSCREENER_API_URL: z.string().url().default('https://api.dexscreener.com'),

  UPLOADS_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOADS_DIR: z.string().default('./uploads'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(overrides: Partial<Record<keyof Env, string>> = {}): Env {
  if (cached) return cached;
  const envPath = findRootEnvPath();
  if (envPath) loadDotenv({ path: envPath });
  const merged = { ...process.env, ...overrides };
  const parsed = EnvSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
}

export * from './chains.js';
