import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from 'dotenv';
import path from 'node:path';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { privateKeyToAccount } from 'viem/accounts';
import { loadEnv, resetEnvCache } from '@launch/config';
import { createPrismaClient, type Db } from '@launch/database';
import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

config({ path: path.resolve(process.cwd(), '../../.env') });
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5432/launch_test';
process.env.NODE_ENV = 'test';
resetEnvCache();
const env = loadEnv();

let app: FastifyInstance;
let db: Db;
let redis: Redis;
const suffix = Date.now().toString(36);
const email = (n: string) => `${n}_${suffix}@test.local`;

let ipCounter = 10;
async function register(name: string) {
  const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: email(name), password: 'Password-123', username: `${name}${suffix}`.slice(0, 20) }, remoteAddress: `10.0.0.${ipCounter++}` });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  return { token: body.accessToken as string, user: body.user as { id: string; playerId: string }, cookie: res.cookies.find((c) => c.name === 'launch_rt')?.value as string };
}
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  db = createPrismaClient(env.DATABASE_URL);
  redis = new Redis(env.REDIS_URL);
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
  app = await buildApp({ env, db, redis, logger: false });
  await app.ready();
});
afterAll(async () => {
  await db.user.deleteMany({ where: { OR: [{ email: { endsWith: `_${suffix}@test.local` } }, { username: { contains: suffix } }] } });
  await app.close();
  await db.$disconnect();
  redis.disconnect();
});

describe('health & security headers', () => {
  it('reports dependencies and sets security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().db).toBe(true);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
  it('rejects unauthenticated access to protected routes', async () => {
    for (const url of ['/game/village', '/wallets', '/portfolio', '/launchpad/mine', '/admin/stats']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(401);
    }
  });
});

describe('email/password auth', () => {
  it('registers, logs in, refreshes with rotation and detects reuse', async () => {
    const { token, user, cookie } = await register('alice');
    expect(user.playerId).toBeTruthy();
    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: auth(token) });
    expect(me.json().user.username).toBe(`alice${suffix}`.slice(0, 20));

    const bad = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: email('alice'), password: 'wrong' } });
    expect(bad.statusCode).toBe(401);
    const dup = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: email('alice'), password: 'Password-123', username: 'someoneelse' } });
    expect(dup.statusCode).toBe(409);

    const refreshed = await app.inject({ method: 'POST', url: '/auth/refresh', cookies: { launch_rt: cookie } });
    expect(refreshed.statusCode).toBe(200);
    const newCookie = refreshed.cookies.find((c) => c.name === 'launch_rt')?.value as string;
    expect(newCookie).not.toBe(cookie);
    // reuse of the rotated token revokes the family
    const reuse = await app.inject({ method: 'POST', url: '/auth/refresh', cookies: { launch_rt: cookie } });
    expect(reuse.statusCode).toBe(401);
    const afterReuse = await app.inject({ method: 'POST', url: '/auth/refresh', cookies: { launch_rt: newCookie } });
    expect(afterReuse.statusCode).toBe(401);
  });
  it('validates input', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: 'nope', password: 'short', username: '!!' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
  });
});

describe('wallet auth', () => {
  it('signs in with a Solana wallet (ed25519) and rejects replayed nonces', async () => {
    const kp = Keypair.generate();
    const address = kp.publicKey.toBase58();
    const nonceRes = await app.inject({ method: 'POST', url: '/auth/wallet/nonce', payload: { chain: 'SOLANA', address } });
    expect(nonceRes.statusCode).toBe(200);
    const { nonce, message } = nonceRes.json();
    expect(message).toContain(address);
    const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey));
    const verify = await app.inject({ method: 'POST', url: '/auth/wallet/verify', payload: { chain: 'SOLANA', address, nonce, signature } });
    expect(verify.statusCode).toBe(201);
    const body = verify.json();
    expect(body.user.playerId).toBeTruthy();
    const replay = await app.inject({ method: 'POST', url: '/auth/wallet/verify', payload: { chain: 'SOLANA', address, nonce, signature } });
    expect(replay.statusCode).toBe(400);
    // second sign-in with the same wallet logs into the same account
    const n2 = await app.inject({ method: 'POST', url: '/auth/wallet/nonce', payload: { chain: 'SOLANA', address } });
    const sig2 = bs58.encode(nacl.sign.detached(new TextEncoder().encode(n2.json().message), kp.secretKey));
    const v2 = await app.inject({ method: 'POST', url: '/auth/wallet/verify', payload: { chain: 'SOLANA', address, nonce: n2.json().nonce, signature: sig2 } });
    expect(v2.statusCode).toBe(200);
    expect(v2.json().user.id).toBe(body.user.id);
    await db.user.delete({ where: { id: body.user.id } });
  });
  it('rejects a bad Solana signature', async () => {
    const kp = Keypair.generate();
    const other = Keypair.generate();
    const address = kp.publicKey.toBase58();
    const { nonce, message } = (await app.inject({ method: 'POST', url: '/auth/wallet/nonce', payload: { chain: 'SOLANA', address } })).json();
    const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), other.secretKey));
    const verify = await app.inject({ method: 'POST', url: '/auth/wallet/verify', payload: { chain: 'SOLANA', address, nonce, signature } });
    expect(verify.statusCode).toBe(401);
  });
  it('links a Robinhood Chain (EVM) wallet to an existing account with EIP-191', async () => {
    const { token } = await register('evmlinker');
    const account = privateKeyToAccount(`0x${'1'.repeat(63)}a`);
    const { nonce, message } = (await app.inject({ method: 'POST', url: '/auth/wallet/nonce', payload: { chain: 'ROBINHOOD', address: account.address } })).json();
    expect(message).toContain(`Chain ID: ${env.ROBINHOOD_CHAIN_NETWORK === 'mainnet' ? 4663 : 46630}`);
    const signature = await account.signMessage({ message });
    const link = await app.inject({ method: 'POST', url: '/wallets/link', headers: auth(token), payload: { chain: 'ROBINHOOD', address: account.address, nonce, signature } });
    expect(link.statusCode).toBe(201);
    expect(link.json().wallet.address).toBe(account.address.toLowerCase());
    const list = await app.inject({ method: 'GET', url: '/wallets', headers: auth(token) });
    expect(list.json().wallets.length).toBe(1);
    await db.wallet.deleteMany({ where: { address: account.address.toLowerCase() } });
  });
});

describe('game API', () => {
  it('serves the village, enforces server-side validation and trains troops', async () => {
    const { token } = await register('builder');
    const v = await app.inject({ method: 'GET', url: '/game/village', headers: auth(token) });
    expect(v.statusCode).toBe(200);
    expect(v.json().village.buildings.length).toBeGreaterThan(5);
    const place = await app.inject({ method: 'POST', url: '/game/buildings', headers: auth(token), payload: { type: 'wall', x: 2, y: 2 } });
    expect(place.statusCode).toBe(201);
    expect(place.json().village.resources.gold).toBe(700);
    const overlap = await app.inject({ method: 'POST', url: '/game/buildings', headers: auth(token), payload: { type: 'wall', x: 2, y: 2 } });
    expect(overlap.statusCode).toBe(400);
    const limit = await app.inject({ method: 'POST', url: '/game/buildings', headers: auth(token), payload: { type: 'cannon', x: 2, y: 6 } });
    expect(limit.statusCode).toBe(409);
    const cheat = await app.inject({ method: 'POST', url: '/game/buildings', headers: auth(token), payload: { type: 'mage_tower', x: 30, y: 30 } });
    expect(cheat.statusCode).toBe(409);
    const army = await app.inject({ method: 'POST', url: '/game/army/train', headers: auth(token), payload: { troopType: 'grunt', count: 5 } });
    expect(army.statusCode).toBe(200);
    expect(army.json().army.training[0].count).toBe(5);
    const tooMany = await app.inject({ method: 'POST', url: '/game/army/train', headers: auth(token), payload: { troopType: 'grunt', count: 500 } });
    expect(tooMany.statusCode).toBe(400);
    const profile = await app.inject({ method: 'GET', url: '/game/player/me', headers: auth(token) });
    expect(profile.json().achievements.length).toBeGreaterThan(5);
    const lb = await app.inject({ method: 'GET', url: '/game/leaderboard/players?limit=5' });
    expect(lb.json().items[0].rank).toBe(1);
  });
  it('requires an army to matchmake and never exposes other villages\' resources', async () => {
    const { token, user } = await register('raider');
    const find = await app.inject({ method: 'POST', url: '/game/battles/find', headers: auth(token) });
    expect(find.statusCode).toBe(409);
    expect(find.json().error.code).toBe('NO_ARMY');
    const other = await register('victim');
    const view = await app.inject({ method: 'GET', url: `/game/players/${other.user.playerId}`, headers: auth(token) });
    expect(view.statusCode).toBe(200);
    expect(view.json().village.resources).toBeUndefined();
    expect(user.playerId).not.toBe(other.user.playerId);
  });
  it('clan endpoints enforce the clan hall and roles', async () => {
    const { token } = await register('clanless');
    const res = await app.inject({ method: 'POST', url: '/game/clans', headers: auth(token), payload: { name: `Clan ${suffix}`, tag: 'CL' + suffix.slice(-2) } });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('NO_CLAN_HALL');
    const list = await app.inject({ method: 'GET', url: '/game/clans' });
    expect(list.statusCode).toBe(200);
  });
});

describe('launchpad', () => {
  it('creates a draft, validates token parameters and gates prepare on a linked wallet', async () => {
    const { token } = await register('founder');
    const bad = await app.inject({ method: 'POST', url: '/launchpad/projects', headers: auth(token), payload: { name: 'Ember', symbol: 'EMB', chain: 'SOLANA', totalSupply: '1000000000000', decimals: 9 } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('INVALID_TOKEN');
    const ok = await app.inject({ method: 'POST', url: '/launchpad/projects', headers: auth(token), payload: { name: 'Ember', symbol: 'emb', chain: 'SOLANA', totalSupply: '1000000', decimals: 6, description: 'The Emberhold token', website: 'https://example.com' } });
    expect(ok.statusCode).toBe(201);
    const project = ok.json().project;
    expect(project.symbol).toBe('EMB');
    expect(project.status).toBe('DRAFT');
    expect(project.network).toBe(env.SOLANA_NETWORK);
    const hidden = await app.inject({ method: 'GET', url: `/launchpad/projects/${project.slug}` });
    expect(hidden.statusCode).toBe(404);
    const prep = await app.inject({ method: 'POST', url: `/launchpad/projects/${project.id}/prepare`, headers: auth(token) });
    expect(prep.statusCode).toBe(409);
    expect(prep.json().error.code).toBe('NO_LINKED_WALLET');
    const kp = Keypair.generate();
    await db.wallet.create({ data: { userId: (await db.user.findUniqueOrThrow({ where: { email: email('founder') } })).id, chain: 'SOLANA', address: kp.publicKey.toBase58() } });
    const prep2 = await app.inject({ method: 'POST', url: `/launchpad/projects/${project.id}/prepare`, headers: auth(token) });
    expect(prep2.statusCode).toBe(200);
    expect(prep2.json().metadataUri).toContain(`/uploads/metadata/${project.id}.json`);
    const meta = await app.inject({ method: 'GET', url: `/uploads/metadata/${project.id}.json` });
    expect(meta.statusCode).toBe(200);
    expect(meta.json().symbol).toBe('EMB');
    const notSubmitted = await app.inject({ method: 'POST', url: `/launchpad/projects/${project.id}/submit`, headers: auth(token), payload: { signature: 'not-a-real-signature-xxxxxxxxxxxxxx', address: 'not-a-mint-address' } });
    expect([400, 502]).toContain(notSubmitted.statusCode);
    const after = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(after.status).toBe('AWAITING_SIGNATURE');
    expect(after.failureReason).toBeTruthy();
    const config = await app.inject({ method: 'GET', url: '/launchpad/config' });
    expect(config.json().erc20.bytecode.startsWith('0x')).toBe(true);
    const list = await app.inject({ method: 'GET', url: '/launchpad/projects?sort=new' });
    expect(list.statusCode).toBe(200);
  });
});

describe('admin', () => {
  it('blocks regular users and lets admins ban with an audit trail', async () => {
    const { token: userToken, user } = await register('plainuser');
    const forbidden = await app.inject({ method: 'GET', url: '/admin/stats', headers: auth(userToken) });
    expect(forbidden.statusCode).toBe(403);
    const { token: adminTokenInitial, user: adminUser } = await register('adminuser');
    await db.user.update({ where: { id: adminUser.id }, data: { role: 'ADMIN' } });
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: email('adminuser'), password: 'Password-123' }, remoteAddress: '10.0.1.1' });
    const adminToken = login.json().accessToken as string;
    expect(adminTokenInitial).not.toBe(adminToken);
    const stats = await app.inject({ method: 'GET', url: '/admin/stats', headers: auth(adminToken) });
    expect(stats.statusCode).toBe(200);
    expect(stats.json().users).toBeGreaterThan(0);
    const ban = await app.inject({ method: 'POST', url: `/admin/users/${user.id}/ban`, headers: auth(adminToken), payload: { reason: 'testing bans' } });
    expect(ban.statusCode).toBe(200);
    const bannedLogin = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: email('plainuser'), password: 'Password-123' }, remoteAddress: '10.0.1.2' });
    expect(bannedLogin.statusCode).toBe(403);
    const logs = await app.inject({ method: 'GET', url: '/admin/audit-logs?action=admin.user_ban', headers: auth(adminToken) });
    expect(logs.json().items.some((l: { targetId: string }) => l.targetId === user.id)).toBe(true);
    const grant = await app.inject({ method: 'POST', url: `/admin/villages/${user.playerId}/grant`, headers: auth(adminToken), payload: { resource: 'GEMS', amount: 100, reason: 'test' } });
    expect(grant.statusCode).toBe(200);
    expect(grant.json().village.resources.gems).toBe(150);
  });
});

describe('rate limiting', () => {
  it('limits repeated login attempts', async () => {
    let limited = false;
    for (let i = 0; i < 14; i++) {
      const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: email('nobody'), password: 'x' }, remoteAddress: '203.0.113.9' });
      if (res.statusCode === 429) {
        limited = true;
        expect(res.json().error.code).toBe('RATE_LIMITED');
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
