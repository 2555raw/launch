/**
 * Integration tests against the real test database + Redis.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from 'dotenv';
import path from 'node:path';
import { Redis } from 'ioredis';
import { createPrismaClient, type Db } from '@launch/database';
import { BattleSimulation, STARTER_RESOURCES, trophyDeltas } from '@launch/game-engine';
import { GameError, type GameContext } from './context.js';
import { cancelConstruction, collectResources, moveBuilding, placeBuilding, removeBuilding, upgradeBuilding } from './services/building.service.js';
import { createPlayerForUser, getVillageDTO, syncPlayer } from './services/player.service.js';
import { getArmyDTO, trainTroops } from './services/army.service.js';
import { abandonBattle, finalizeBattle, findOpponent, startBattle } from './services/battle.service.js';
import { createClan, donateTroops, joinClan, leaveClan, postClanMessage, requestTroops, setMemberRole } from './services/clan.service.js';
import { listAchievements } from './services/progression.service.js';

config({ path: path.resolve(process.cwd(), '../../.env') });
const url = process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5432/launch_test';
let db: Db;
let redis: Redis;
let clock = new Date('2026-01-01T00:00:00Z');
const ctx: GameContext = { get db() { return db; }, get redis() { return redis; }, now: () => clock };
const suffix = Date.now().toString(36);

async function makePlayer(name: string) {
  const user = await db.user.create({ data: { username: `${name}_${suffix}`, email: `${name}_${suffix}@test.local` } });
  return createPlayerForUser(db, user.id, name, clock);
}

beforeAll(async () => {
  db = createPrismaClient(url);
  redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  await db.$queryRaw`SELECT 1`;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { username: { endsWith: `_${suffix}` } } });
  await db.$disconnect();
  redis.disconnect();
});

describe('village lifecycle', () => {
  it('creates a starter village with resources and completes a construction over time', async () => {
    const p = await makePlayer('alice');
    let village = await getVillageDTO(db, p.id, clock);
    expect(village.resources.gold).toBe(STARTER_RESOURCES.gold);
    expect(village.buildings.find((b) => b.type === 'town_hall')).toBeTruthy();
    expect(village.builders).toEqual({ total: 1, busy: 0 });

    const cannon = await placeBuilding(ctx, p.id, 'cannon', 2, 2);
    expect(cannon.state).toBe('CONSTRUCTING');
    village = await getVillageDTO(db, p.id, clock);
    expect(village.resources.gold).toBe(STARTER_RESOURCES.gold - 250);
    expect(village.builders.busy).toBe(1);
    await expect(upgradeBuilding(ctx, p.id, village.buildings.find((b) => b.type === 'gold_mine')!.id)).rejects.toMatchObject({ code: 'NO_FREE_BUILDER' });
    await expect(placeBuilding(ctx, p.id, 'gold_mine', 2, 6)).rejects.toMatchObject({ code: 'LIMIT_REACHED' });
    await expect(placeBuilding(ctx, p.id, 'cannon', 2, 2)).rejects.toMatchObject({ code: 'LIMIT_REACHED' });
    await expect(placeBuilding(ctx, p.id, 'wall', 20, 20)).rejects.toMatchObject({ code: 'INVALID_PLACEMENT' });
    const wall = await placeBuilding(ctx, p.id, 'wall', 2, 40);
    expect(wall.state).toBe('IDLE');
    await expect(placeBuilding(ctx, p.id, 'mortar', 2, 10)).rejects.toMatchObject({ code: 'LIMIT_REACHED' });

    clock = new Date(clock.getTime() + 25_000);
    village = await getVillageDTO(db, p.id, clock);
    await db.$transaction((tx) => syncPlayer(tx, p.id, clock));
    village = await getVillageDTO(db, p.id, clock);
    expect(village.buildings.find((b) => b.id === cannon.id)?.state).toBe('IDLE');
    expect(village.builders.busy).toBe(0);
    const player = await db.player.findUniqueOrThrow({ where: { id: p.id } });
    expect(player.xp).toBeGreaterThan(0);
    const ach = await listAchievements(db, p.id);
    expect(ach.find((a) => a.key === 'architect')?.progress).toBe(1);
  });

  it('moves, upgrades, cancels and removes buildings with validation', async () => {
    const p = await makePlayer('bob');
    const v = await getVillageDTO(db, p.id, clock);
    const cannon = v.buildings.find((b) => b.type === 'cannon')!;
    const moved = await moveBuilding(ctx, p.id, cannon.id, 1, 1);
    expect(moved.x).toBe(1);
    await expect(moveBuilding(ctx, p.id, cannon.id, 20, 20)).rejects.toMatchObject({ code: 'INVALID_PLACEMENT' });
    const up = await upgradeBuilding(ctx, p.id, cannon.id);
    expect(up.state).toBe('UPGRADING');
    await expect(upgradeBuilding(ctx, p.id, cannon.id)).rejects.toMatchObject({ code: 'BUILDING_BUSY' });
    const cancelled = await cancelConstruction(ctx, p.id, cannon.id);
    expect(cancelled.building?.state).toBe('IDLE');
    await expect(removeBuilding(ctx, p.id, v.buildings.find((b) => b.type === 'town_hall')!.id)).rejects.toMatchObject({ code: 'CANNOT_REMOVE' });
    await removeBuilding(ctx, p.id, cannon.id);
    const after = await getVillageDTO(db, p.id, clock);
    expect(after.buildings.find((b) => b.id === cannon.id)).toBeUndefined();
    await expect(upgradeBuilding(ctx, p.id, 'nope')).rejects.toBeInstanceOf(GameError);
  });

  it('collects resources from a mine, capped by storage', async () => {
    const p = await makePlayer('carol');
    const v = await getVillageDTO(db, p.id, clock);
    const mine = v.buildings.find((b) => b.type === 'gold_mine')!;
    clock = new Date(clock.getTime() + 3 * 3_600_000);
    const r = await collectResources(ctx, p.id, mine.id);
    expect(r.resource).toBe('gold');
    expect(r.collected).toBe(600);
    const after = await getVillageDTO(db, p.id, clock);
    expect(after.resources.gold).toBe(STARTER_RESOURCES.gold + 600);
    const ledger = await db.resourceLedger.findMany({ where: { playerId: p.id } });
    expect(ledger.some((l) => l.reason === 'collect:gold_mine' && l.delta === 600)).toBe(true);
  });
});

describe('army', () => {
  it('trains troops with housing and elixir validation, then completes them', async () => {
    const p = await makePlayer('dave');
    await expect(trainTroops(ctx, p.id, 'brute', 1)).rejects.toMatchObject({ code: 'TROOP_LOCKED' });
    await expect(trainTroops(ctx, p.id, 'grunt', 25)).rejects.toMatchObject({ code: 'NOT_ENOUGH_HOUSING' });
    const army = await trainTroops(ctx, p.id, 'grunt', 10);
    expect(army.training.length).toBe(1);
    expect(army.housingUsed).toBe(10);
    await db.player.update({ where: { id: p.id }, data: { elixir: 100 } });
    await expect(trainTroops(ctx, p.id, 'grunt', 5)).rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
    clock = new Date(clock.getTime() + 10 * 20_000 + 1000);
    await db.$transaction((tx) => syncPlayer(tx, p.id, clock));
    const done = await getArmyDTO(db, p.id, clock);
    expect(done.units).toEqual([{ troopType: 'grunt', count: 10, level: 1 }]);
    expect(done.training.length).toBe(0);
  });
});

describe('battles', () => {
  it('matchmakes, locks the defender, runs an authoritative battle and applies ledgered rewards once', async () => {
    const attacker = await makePlayer('erin');
    const defender = await makePlayer('frank');
    const t = 20000 + Math.floor(Math.random() * 100000);
    await db.player.update({ where: { id: defender.id }, data: { gold: 5000, elixir: 5000, trophies: t } });
    await db.player.update({ where: { id: attacker.id }, data: { trophies: t } });
    await expect(findOpponent(ctx, attacker.id)).rejects.toMatchObject({ code: 'NO_ARMY' });
    await trainTroops(ctx, attacker.id, 'grunt', 20);
    clock = new Date(clock.getTime() + 20 * 20_000 + 1000);
    const match = await findOpponent(ctx, attacker.id);
    expect(match.battle.state).toBe('PENDING');
    expect(match.snapshot.buildings.length).toBeGreaterThan(0);
    expect(match.defender.id).toBe(defender.id);
    expect(match.snapshot.buildings.reduce((s, b) => s + b.storedGold, 0)).toBeGreaterThanOrEqual(1000);
    expect(await redis.get(`battle:lock:defender:${match.defender.id}`)).toBe(attacker.id);
    await expect(findOpponent(ctx, attacker.id)).rejects.toMatchObject({ code: 'BATTLE_IN_PROGRESS' });

    const started = await startBattle(ctx, attacker.id, match.battle.id);
    expect(started.battle.state).toBe('ACTIVE');
    const armyAfter = await getArmyDTO(db, attacker.id, clock);
    expect(armyAfter.units.length).toBe(0);

    const sim = new BattleSimulation({ seed: match.battle.seed, snapshot: match.snapshot, army: match.battle.attackerArmy as Record<string, number>, troopLevels: started.troopLevels, attackerTownHall: started.attackerTownHall });
    for (let i = 0; i < 20; i++) sim.deploy('grunt', 1 + (i % 5), 1 + Math.floor(i / 5));
    while (!sim.tick()) {
      /* run */
    }
    const result = sim.result(t, t, trophyDeltas, 1);
    const finished = await finalizeBattle(ctx, match.battle.id, result, sim.deployments);
    expect(finished.state).toBe('FINISHED');
    const a = await db.player.findUniqueOrThrow({ where: { id: attacker.id } });
    const d = await db.player.findUniqueOrThrow({ where: { id: match.defender.id } });
    expect(a.gold).toBe(STARTER_RESOURCES.gold + result.lootGold);
    expect(a.trophies).toBe(t + finished.attackerTrophyDelta);
    expect(d.trophies).toBe(t + finished.defenderTrophyDelta);
    if (result.victory) expect(d.shieldUntil).not.toBeNull();
    // idempotent: a second finalize is a no-op
    const again = await finalizeBattle(ctx, match.battle.id, result, sim.deployments);
    expect(again.state).toBe('FINISHED');
    expect((await db.player.findUniqueOrThrow({ where: { id: attacker.id } })).gold).toBe(a.gold);
    expect(await redis.get(`battle:lock:defender:${match.defender.id}`)).toBeNull();
    const notif = await db.notification.findFirst({ where: { user: { player: { id: match.defender.id } } } });
    expect(notif?.type).toBe('defense');
  });

  it('abandoning a pending battle releases the defender lock', async () => {
    const attacker = await makePlayer('gina');
    const defender = await makePlayer('hal');
    const t2 = 200000 + Math.floor(Math.random() * 100000);
    await db.player.update({ where: { id: attacker.id }, data: { trophies: t2 } });
    await db.player.update({ where: { id: defender.id }, data: { trophies: t2 } });
    await trainTroops(ctx, attacker.id, 'grunt', 1);
    clock = new Date(clock.getTime() + 21_000);
    const match = await findOpponent(ctx, attacker.id);
    await abandonBattle(ctx, attacker.id, match.battle.id);
    expect(await redis.get(`battle:lock:defender:${match.defender.id}`)).toBeNull();
    expect((await db.battle.findUniqueOrThrow({ where: { id: match.battle.id } })).state).toBe('ABANDONED');
  });
});

describe('clans', () => {
  it('creates, joins, promotes, donates, chats and leaves', async () => {
    const leader = await makePlayer('ivan');
    const member = await makePlayer('judy');
    await expect(createClan(ctx, leader.id, { name: `Ember ${suffix}`, tag: 'EMB' + suffix.slice(-3) })).rejects.toMatchObject({ code: 'NO_CLAN_HALL' });
    for (const p of [leader, member]) {
      const v = await db.village.findUniqueOrThrow({ where: { playerId: p.id } });
      await db.building.create({ data: { villageId: v.id, type: 'clan_hall', level: 1, x: 2, y: 36 } });
      await db.player.update({ where: { id: p.id }, data: { gold: 20000 } });
    }
    const clan = await createClan(ctx, leader.id, { name: `Ember ${suffix}`, tag: 'E' + suffix.slice(-3).toUpperCase() });
    expect(clan.tag).toBe(('E' + suffix.slice(-3)).toUpperCase());
    await joinClan(ctx, member.id, clan.id);
    await setMemberRole(ctx, leader.id, member.id, 'ELDER');
    await expect(setMemberRole(ctx, member.id, leader.id, 'MEMBER')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const req = await requestTroops(ctx, member.id, 'need grunts');
    await trainTroops(ctx, leader.id, 'grunt', 3);
    clock = new Date(clock.getTime() + 61_000);
    await donateTroops(ctx, leader.id, req.id, 'grunt', 2);
    const memberArmy = await getArmyDTO(db, member.id, clock);
    expect(memberArmy.units).toEqual([{ troopType: 'grunt', count: 2, level: 1 }]);
    expect(memberArmy.housingUsed).toBe(0);
    const msg = await postClanMessage(ctx, member.id, 'thanks!');
    expect(msg.playerName).toBe('judy');
    const left = await leaveClan(ctx, leader.id);
    expect(left.disbanded).toBe(false);
    expect((await db.clanMember.findUniqueOrThrow({ where: { playerId: member.id } })).role).toBe('LEADER');
    expect((await leaveClan(ctx, member.id)).disbanded).toBe(true);
  });
});
