import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from 'dotenv';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import { loadEnv, resetEnvCache } from '@launch/config';
import { createPrismaClient, type Db } from '@launch/database';
import { createPlayerForUser, findOpponent, trainTroops, type GameContext } from '@launch/game-core';
import type { ServerMessage } from '@launch/types';
import { Redis } from 'ioredis';
import pino from 'pino';
import { GameServer } from './game-server.js';

config({ path: path.resolve(process.cwd(), '../../.env') });
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5432/launch_test';
process.env.NODE_ENV = 'test';
resetEnvCache();
const env = loadEnv();

let db: Db;
let redis: Redis;
let subscriber: Redis;
let server: GameServer;
let clock = new Date('2026-02-01T00:00:00Z');
const suffix = Date.now().toString(36);
const ctx: GameContext = { get db() { return db; }, get redis() { return redis; }, now: () => clock };

function connect(): Promise<{ ws: WebSocket; next: (type: string, timeoutMs?: number) => Promise<ServerMessage>; all: ServerMessage[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.address}`);
    const all: ServerMessage[] = [];
    const queue: ServerMessage[] = [];
    const waiters: Array<{ type: string; resolve: (m: ServerMessage) => void }> = [];
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as ServerMessage;
      all.push(m);
      const i = waiters.findIndex((w) => w.type === m.type);
      if (i >= 0) waiters.splice(i, 1)[0].resolve(m);
      else queue.push(m);
    });
    ws.on('error', reject);
    ws.on('open', () =>
      resolve({
        ws,
        all,
        next: (type, timeoutMs = 15_000) =>
          new Promise((res, rej) => {
            const idx = queue.findIndex((m) => m.type === type);
            if (idx >= 0) return res(queue.splice(idx, 1)[0]);
            const t = setTimeout(() => rej(new Error(`timeout waiting for ${type}`)), timeoutMs);
            waiters.push({ type, resolve: (m) => { clearTimeout(t); res(m); } });
          }),
      }),
    );
  });
}

async function makePlayer(name: string) {
  const user = await db.user.create({ data: { username: `${name}_${suffix}`, email: `${name}_${suffix}@gs.local` } });
  const player = await createPlayerForUser(db, user.id, name, clock);
  const token = jwt.sign({ sub: user.id, pid: player.id, role: 'USER', username: user.username }, env.JWT_SECRET, { issuer: 'launch-api', audience: 'launch', expiresIn: 600 });
  return { user, player, token };
}

beforeAll(async () => {
  db = createPrismaClient(env.DATABASE_URL);
  redis = new Redis(env.REDIS_URL);
  subscriber = new Redis(env.REDIS_URL);
  server = new GameServer({ env, db, redis, subscriber, logger: pino({ level: 'silent' }), port: 0, now: () => clock });
  await server.start();
});
afterAll(async () => {
  await server.stop();
  await db.user.deleteMany({ where: { username: { endsWith: `_${suffix}` } } });
  await db.$disconnect();
  redis.disconnect();
  subscriber.disconnect();
});

describe('game server', () => {
  it('rejects bad tokens and unauthenticated commands', async () => {
    const c = await connect();
    c.ws.send(JSON.stringify({ type: 'battle:join', battleId: 'x' }));
    const err = await c.next('auth:error');
    expect(err.type).toBe('auth:error');
    c.ws.send(JSON.stringify({ type: 'auth', token: 'garbage' }));
    const err2 = await c.next('auth:error');
    expect((err2 as { message: string }).message).toMatch(/Invalid/);
    c.ws.close();
  });

  it('runs an authoritative battle end to end over WebSocket', async () => {
    const attacker = await makePlayer('wsatk');
    const defender = await makePlayer('wsdef');
    const t = 500000 + Math.floor(Math.random() * 100000);
    await db.player.update({ where: { id: attacker.player.id }, data: { trophies: t } });
    await db.player.update({ where: { id: defender.player.id }, data: { trophies: t, gold: 3000, elixir: 3000 } });
    await trainTroops(ctx, attacker.player.id, 'grunt', 20);
    clock = new Date(clock.getTime() + 20 * 20_000 + 1000);
    const match = await findOpponent(ctx, attacker.player.id);
    expect(match.defender.id).toBe(defender.player.id);

    const c = await connect();
    c.ws.send(JSON.stringify({ type: 'auth', token: attacker.token }));
    const ok = await c.next('auth:ok');
    expect((ok as { playerId: string }).playerId).toBe(attacker.player.id);

    c.ws.send(JSON.stringify({ type: 'battle:join', battleId: match.battle.id }));
    const ready = (await c.next('battle:ready')) as Extract<ServerMessage, { type: 'battle:ready' }>;
    expect(ready.army.grunt).toBe(20);
    expect(ready.snapshot.buildings.length).toBeGreaterThan(5);
    expect((await db.battle.findUniqueOrThrow({ where: { id: match.battle.id } })).state).toBe('ACTIVE');

    // invalid deployment inside the base is rejected by the server
    c.ws.send(JSON.stringify({ type: 'battle:deploy', battleId: match.battle.id, troopType: 'grunt', x: 21, y: 21 }));
    const rejected = (await c.next('battle:event')) as Extract<ServerMessage, { type: 'battle:event' }>;
    expect(rejected.event).toEqual({ kind: 'rejected', reason: 'INVALID_DEPLOY_ZONE' });
    // cheating with a troop the army does not have
    c.ws.send(JSON.stringify({ type: 'battle:deploy', battleId: match.battle.id, troopType: 'pyromancer', x: 1, y: 1 }));
    const rejected2 = (await c.next('battle:event')) as Extract<ServerMessage, { type: 'battle:event' }>;
    expect(rejected2.event).toEqual({ kind: 'rejected', reason: 'NO_UNITS_LEFT' });

    for (let i = 0; i < 20; i++) c.ws.send(JSON.stringify({ type: 'battle:deploy', battleId: match.battle.id, troopType: 'grunt', x: 1 + (i % 5), y: 1 + Math.floor(i / 5) }));
    const state = (await c.next('battle:state')) as Extract<ServerMessage, { type: 'battle:state' }>;
    expect(state.state.battleId).toBe(match.battle.id);
    const result = (await c.next('battle:result', 120_000)) as Extract<ServerMessage, { type: 'battle:result' }>;
    expect(result.result.destructionPercent).toBeGreaterThan(0);
    expect(result.result.troopsUsed.grunt).toBe(20);
    const stored = await db.battle.findUniqueOrThrow({ where: { id: match.battle.id } });
    expect(stored.state).toBe('FINISHED');
    expect(stored.destructionPercent).toBe(result.result.destructionPercent);
    expect((stored.deployments as unknown[]).length).toBe(20);
    const a = await db.player.findUniqueOrThrow({ where: { id: attacker.player.id } });
    expect(a.trophies).toBe(t + stored.attackerTrophyDelta);
    c.ws.close();
  }, 150_000);
});
