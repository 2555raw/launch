import type { Battle } from '@launch/database';
import { BATTLE_DURATION_MS, BUILDING_DEFINITIONS, SHIELD_AFTER_DEFEAT_MS, accruedProduction, distributeLoot, getBuildingLevel, storageCapacity, townHallLevel, trophyDeltas } from '@launch/game-engine';
import type { BattleResultDTO, BattleSnapshot, DeploymentRecord } from '@launch/types';
import type { DbOrTx, GameContext } from '../context.js';
import { GameError, assert } from '../context.js';
import { applyResourceDelta } from './ledger.js';
import { notify } from './notification.service.js';
import { addXp, getVillage, syncPlayer, withPlayer } from './player.service.js';
import { bumpAchievement } from './progression.service.js';

const DEFENDER_LOCK_TTL_SEC = 300;
const RECENTLY_ATTACKED_TTL_SEC = 600;

export function defenderLockKey(defenderId: string) {
  return `battle:lock:defender:${defenderId}`;
}

/** Builds the immutable snapshot of a village used for a battle, including lootable amounts. */
export async function buildSnapshot(tx: DbOrTx, defenderId: string, attackerTh: number, now: Date): Promise<BattleSnapshot> {
  const village = await getVillage(tx, defenderId);
  const defender = await tx.player.findUniqueOrThrow({ where: { id: defenderId } });
  const buildings = village.buildings.filter((b) => b.state !== 'CONSTRUCTING');
  const accrued: Record<string, number> = {};
  for (const b of buildings) accrued[b.id] = accruedProduction(b, now).amount;
  const base: BattleSnapshot = {
    gridSize: village.gridSize,
    townHallLevel: townHallLevel(buildings),
    buildings: buildings.map((b) => ({
      id: b.id,
      type: b.type,
      level: b.level,
      x: b.x,
      y: b.y,
      size: BUILDING_DEFINITIONS[b.type]?.size ?? 1,
      hp: getBuildingLevel(b.type, b.level)?.hp ?? 100,
      storedGold: 0,
      storedElixir: 0,
    })),
  };
  return distributeLoot(base, { gold: defender.gold, elixir: defender.elixir }, accrued, attackerTh);
}

export async function currentArmy(tx: DbOrTx, playerId: string): Promise<Record<string, number>> {
  const units = await tx.armyUnit.findMany({ where: { playerId } });
  const army: Record<string, number> = {};
  for (const u of units) if (u.count + u.donated > 0) army[u.troopType] = u.count + u.donated;
  return army;
}

/** Picks an opponent near the attacker's trophy count and creates a PENDING battle. */
export async function findOpponent(ctx: GameContext, attackerId: string): Promise<{ battle: Battle; snapshot: BattleSnapshot; defender: { id: string; name: string; trophies: number; level: number; townHallLevel: number; clanName: string | null } }> {
  const now = ctx.now();
  await ctx.db.$transaction((tx) => syncPlayer(tx, attackerId, now));
  const attacker = await ctx.db.player.findUniqueOrThrow({ where: { id: attackerId }, include: { clanMember: true, village: { include: { buildings: true } } } });
  const army = await currentArmy(ctx.db, attackerId);
  assert(Object.keys(army).length > 0, 'NO_ARMY', 'Train some troops before attacking', 409);
  const pending = await ctx.db.battle.findFirst({ where: { attackerId, state: { in: ['PENDING', 'ACTIVE'] } } });
  if (pending) {
    if (pending.state === 'ACTIVE' && pending.startedAt && now.getTime() - pending.startedAt.getTime() > BATTLE_DURATION_MS + 60_000) {
      await ctx.db.battle.update({ where: { id: pending.id }, data: { state: 'ABANDONED', endedAt: now } });
      await ctx.redis.del(defenderLockKey(pending.defenderId));
    } else {
      throw new GameError('BATTLE_IN_PROGRESS', 'Finish or abandon your current battle first', 409, { battleId: pending.id });
    }
  }

  const attackerTh = townHallLevel(attacker.village?.buildings ?? []);
  const ranges = [150, 400, 1000, 100000];
  let defender: { id: string; name: string; trophies: number; level: number; clanMember: { clanId: string } | null } | null = null;
  for (const range of ranges) {
    const candidates = await ctx.db.player.findMany({
      where: {
        id: { not: attackerId },
        trophies: { gte: Math.max(0, attacker.trophies - range), lte: attacker.trophies + range },
        OR: [{ shieldUntil: null }, { shieldUntil: { lt: now } }],
        ...(attacker.clanMember ? { OR: [{ clanMember: null }, { clanMember: { clanId: { not: attacker.clanMember.clanId } } }] } : {}),
        village: { isNot: null },
      },
      select: { id: true, name: true, trophies: true, level: true, clanMember: { select: { clanId: true } } },
      orderBy: { lastSeenAt: 'desc' },
      take: 40,
    });
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    for (const c of shuffled) {
      const locked = await ctx.redis.set(defenderLockKey(c.id), attackerId, 'EX', DEFENDER_LOCK_TTL_SEC, 'NX');
      if (locked === 'OK') {
        const recently = await ctx.redis.get(`battle:recent:${c.id}`);
        if (recently) {
          await ctx.redis.del(defenderLockKey(c.id));
          continue;
        }
        defender = c;
        break;
      }
    }
    if (defender) break;
  }
  assert(defender, 'NO_OPPONENT', 'No opponent available right now. Try again in a moment.', 404);

  const defenderId = defender.id;
  const result = await ctx.db.$transaction(async (tx) => {
    await syncPlayer(tx, defenderId, now);
    const snapshot = await buildSnapshot(tx, defenderId, attackerTh, now);
    const seed = Math.floor(Math.random() * 2 ** 31);
    const battle = await tx.battle.create({
      data: { attackerId, defenderId, state: 'PENDING', seed, defenderSnapshot: snapshot as object, attackerArmy: army, deployments: [] },
    });
    const clan = defender.clanMember ? await tx.clan.findUnique({ where: { id: defender.clanMember.clanId }, select: { name: true } }) : null;
    return { battle, snapshot, defender: { id: defender.id, name: defender.name, trophies: defender.trophies, level: defender.level, townHallLevel: snapshot.townHallLevel, clanName: clan?.name ?? null } };
  });
  return result;
}

export async function abandonBattle(ctx: GameContext, attackerId: string, battleId: string): Promise<void> {
  const battle = await ctx.db.battle.findFirst({ where: { id: battleId, attackerId } });
  assert(battle, 'BATTLE_NOT_FOUND', 'Battle not found', 404);
  if (battle.state === 'PENDING') {
    await ctx.db.battle.update({ where: { id: battleId }, data: { state: 'ABANDONED', endedAt: ctx.now() } });
    await ctx.redis.del(defenderLockKey(battle.defenderId));
    return;
  }
  throw new GameError('BATTLE_ALREADY_STARTED', 'A started battle must be finished from the battle screen', 409);
}

/** Marks a battle ACTIVE and consumes the attacker's army. Called by the game server when the player joins. */
export async function startBattle(ctx: GameContext, attackerId: string, battleId: string): Promise<{ battle: Battle; troopLevels: Record<string, number>; attackerTownHall: number }> {
  return withPlayer(ctx, attackerId, async (tx, now) => {
    const battle = await tx.battle.findFirst({ where: { id: battleId, attackerId } });
    assert(battle, 'BATTLE_NOT_FOUND', 'Battle not found', 404);
    const village = await getVillage(tx, attackerId);
    const troops = await tx.playerTroop.findMany({ where: { playerId: attackerId } });
    const troopLevels: Record<string, number> = {};
    for (const t of troops) troopLevels[t.troopType] = t.level;
    if (battle.state === 'ACTIVE') return { battle, troopLevels, attackerTownHall: townHallLevel(village.buildings) };
    assert(battle.state === 'PENDING', 'BATTLE_NOT_PENDING', 'This battle has already ended', 409);
    const army = battle.attackerArmy as Record<string, number>;
    for (const [troopType, count] of Object.entries(army)) {
      const unit = await tx.armyUnit.findUnique({ where: { playerId_troopType: { playerId: attackerId, troopType } } });
      const have = (unit?.count ?? 0) + (unit?.donated ?? 0);
      assert(have >= count, 'ARMY_CHANGED', 'Your army changed since matchmaking', 409);
      const fromDonated = Math.min(unit?.donated ?? 0, count);
      await tx.armyUnit.update({ where: { playerId_troopType: { playerId: attackerId, troopType } }, data: { donated: { decrement: fromDonated }, count: { decrement: count - fromDonated } } });
    }
    const updated = await tx.battle.update({ where: { id: battleId }, data: { state: 'ACTIVE', startedAt: now } });
    return { battle: updated, troopLevels, attackerTownHall: townHallLevel(village.buildings) };
  });
}

/**
 * Applies a finished battle: loot, trophies, xp, stats, shield, achievements, notifications.
 * Ledger entries keyed by battleId make this idempotent even if the game server retries.
 */
export async function finalizeBattle(ctx: GameContext, battleId: string, result: BattleResultDTO, deployments: DeploymentRecord[]): Promise<Battle> {
  const now = ctx.now();
  const battle = await ctx.db.$transaction(async (tx) => {
    const b = await tx.battle.findUniqueOrThrow({ where: { id: battleId } });
    if (b.state === 'FINISHED') return b;
    assert(b.state === 'ACTIVE', 'BATTLE_NOT_ACTIVE', 'Battle is not active', 409);
    const [attacker, defender] = await Promise.all([tx.player.findUniqueOrThrow({ where: { id: b.attackerId } }), tx.player.findUniqueOrThrow({ where: { id: b.defenderId } })]);
    const [attackerDelta, defenderDelta] = trophyDeltas(attacker.trophies, defender.trophies, result.stars);

    // attacker rewards
    const attackerVillage = await getVillage(tx, b.attackerId);
    const cap = storageCapacity(attackerVillage.buildings);
    if (result.lootGold > 0) await applyResourceDelta(tx, b.attackerId, 'GOLD', result.lootGold, 'battle:loot:gold', battleId, { cap: cap.gold });
    if (result.lootElixir > 0) await applyResourceDelta(tx, b.attackerId, 'ELIXIR', result.lootElixir, 'battle:loot:elixir', battleId, { cap: cap.elixir });
    if (result.lootGold > 0) await applyResourceDelta(tx, b.defenderId, 'GOLD', -result.lootGold, 'battle:lost:gold', battleId, { allowNegative: true });
    if (result.lootElixir > 0) await applyResourceDelta(tx, b.defenderId, 'ELIXIR', -result.lootElixir, 'battle:lost:elixir', battleId, { allowNegative: true });
    await addXp(tx, b.attackerId, result.xpGained);

    const attackerTrophies = Math.max(0, attacker.trophies + attackerDelta);
    const defenderTrophies = Math.max(0, defender.trophies + defenderDelta);
    await tx.player.update({
      where: { id: b.attackerId },
      data: { trophies: attackerTrophies, bestTrophies: Math.max(attacker.bestTrophies, attackerTrophies), ...(result.victory ? { attacksWon: { increment: 1 } } : { attacksLost: { increment: 1 } }) },
    });
    const shield = result.destructionPercent >= 30 || result.stars >= 1;
    await tx.player.update({
      where: { id: b.defenderId },
      data: {
        trophies: defenderTrophies,
        bestTrophies: Math.max(defender.bestTrophies, defenderTrophies),
        ...(result.victory ? { defensesLost: { increment: 1 } } : { defensesWon: { increment: 1 } }),
        ...(shield ? { shieldUntil: new Date(now.getTime() + SHIELD_AFTER_DEFEAT_MS) } : {}),
      },
    });
    if (result.victory) await bumpAchievement(tx, b.attackerId, 'attacksWon', 1);
    else await bumpAchievement(tx, b.defenderId, 'defensesWon', 1);
    await bumpAchievement(tx, b.attackerId, 'trophies', attackerTrophies, 'set');
    await bumpAchievement(tx, b.defenderId, 'trophies', defenderTrophies, 'set');
    if (result.lootGold > 0) await bumpAchievement(tx, b.attackerId, 'lootGold', result.lootGold);
    if (result.lootElixir > 0) await bumpAchievement(tx, b.attackerId, 'lootElixir', result.lootElixir);

    for (const clanPlayer of [b.attackerId, b.defenderId]) {
      const member = await tx.clanMember.findUnique({ where: { playerId: clanPlayer } });
      if (member) {
        const agg = await tx.player.aggregate({ where: { clanMember: { clanId: member.clanId } }, _sum: { trophies: true } });
        await tx.clan.update({ where: { id: member.clanId }, data: { trophies: agg._sum.trophies ?? 0 } });
      }
    }

    const finished = await tx.battle.update({
      where: { id: battleId },
      data: {
        state: 'FINISHED',
        endedAt: now,
        result: { ...result, attackerTrophyDelta: attackerDelta, defenderTrophyDelta: defenderDelta } as object,
        deployments: deployments as object[],
        stars: result.stars,
        destructionPercent: result.destructionPercent,
        lootGold: result.lootGold,
        lootElixir: result.lootElixir,
        attackerTrophyDelta: attackerDelta,
        defenderTrophyDelta: defenderDelta,
      },
    });
    const defenderUser = await tx.player.findUnique({ where: { id: b.defenderId }, select: { userId: true } });
    if (defenderUser) {
      await notify(ctx, tx, defenderUser.userId, 'defense', result.victory ? 'Your village was raided' : 'Your defenses held', `${attacker.name} attacked you: ${result.stars} star(s), ${result.destructionPercent}% destruction. Trophies ${defenderDelta >= 0 ? '+' : ''}${defenderDelta}.`, { battleId });
    }
    return finished;
  });
  await ctx.redis.del(defenderLockKey(battle.defenderId));
  await ctx.redis.set(`battle:recent:${battle.defenderId}`, '1', 'EX', RECENTLY_ATTACKED_TTL_SEC);
  return battle;
}

export async function battleHistory(tx: DbOrTx, playerId: string, limit = 20) {
  const battles = await tx.battle.findMany({
    where: { OR: [{ attackerId: playerId }, { defenderId: playerId }], state: 'FINISHED' },
    orderBy: { endedAt: 'desc' },
    take: limit,
    include: { attacker: { select: { id: true, name: true } }, defender: { select: { id: true, name: true } } },
  });
  return battles.map((b) => ({
    id: b.id,
    role: b.attackerId === playerId ? 'attack' : 'defense',
    opponent: b.attackerId === playerId ? b.defender : b.attacker,
    stars: b.stars,
    destructionPercent: b.destructionPercent,
    lootGold: b.lootGold,
    lootElixir: b.lootElixir,
    trophyDelta: b.attackerId === playerId ? b.attackerTrophyDelta : b.defenderTrophyDelta,
    endedAt: b.endedAt?.toISOString() ?? null,
  }));
}
