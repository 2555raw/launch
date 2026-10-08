import type { Building, Player, Village } from '@launch/database';
import {
  BUILDING_DEFINITIONS,
  STARTER_RESOURCES,
  STARTER_VILLAGE,
  accruedProduction,
  builderCount,
  busyBuilders,
  getBuildingLevel,
  levelFromXp,
  storageCapacity,
  townHallLevel,
} from '@launch/game-engine';
import type { BuildingDTO, PlayerSummaryDTO, VillageDTO } from '@launch/types';
import type { DbOrTx, GameContext } from '../context.js';
import { GameError } from '../context.js';
import { applyResourceDelta } from './ledger.js';
import { bumpAchievement } from './progression.service.js';

export type VillageWithBuildings = Village & { buildings: Building[] };

export async function createPlayerForUser(tx: DbOrTx, userId: string, name: string, now: Date = new Date()): Promise<Player> {
  return tx.player.create({
    data: {
      userId,
      name,
      gold: STARTER_RESOURCES.gold,
      elixir: STARTER_RESOURCES.elixir,
      gems: STARTER_RESOURCES.gems,
      village: { create: { name: `${name}'s Hold`, buildings: { create: STARTER_VILLAGE.map((b) => ({ type: b.type, level: b.level, x: b.x, y: b.y, lastCollectedAt: now })) } } },
      troops: { create: [{ troopType: 'grunt', level: 1 }] },
    },
  });
}

export async function getVillage(tx: DbOrTx, playerId: string): Promise<VillageWithBuildings> {
  const village = await tx.village.findUnique({ where: { playerId }, include: { buildings: { orderBy: { createdAt: 'asc' } } } });
  if (!village) throw new GameError('VILLAGE_NOT_FOUND', 'Village not found', 404);
  return village;
}

/**
 * Brings a player's village up to date with the clock: finishes constructions, upgrades, training
 * and research whose timers elapsed. Idempotent; called before every game action and read.
 */
export async function syncPlayer(tx: DbOrTx, playerId: string, now: Date): Promise<void> {
  const village = await tx.village.findUnique({ where: { playerId }, include: { buildings: true } });
  if (!village) return;
  for (const b of village.buildings) {
    if (b.state === 'IDLE' || !b.constructionEndsAt || b.constructionEndsAt > now) continue;
    const nextLevel = b.state === 'UPGRADING' ? b.level + 1 : b.level;
    const lvl = getBuildingLevel(b.type, nextLevel);
    await tx.building.update({
      where: { id: b.id },
      data: { state: 'IDLE', level: nextLevel, constructionEndsAt: null, constructionStartedAt: null, ...(b.state === 'CONSTRUCTING' ? { lastCollectedAt: b.constructionEndsAt } : {}) },
    });
    await addXp(tx, playerId, lvl?.xpReward ?? 1);
    await bumpAchievement(tx, playerId, 'buildingsUpgraded', 1);
    if (b.type === 'town_hall') await bumpAchievement(tx, playerId, 'townHallLevel', nextLevel, 'set');
  }
  const jobs = await tx.trainingJob.findMany({ where: { playerId, completesAt: { lte: now } } });
  for (const job of jobs) {
    await tx.armyUnit.upsert({
      where: { playerId_troopType: { playerId, troopType: job.troopType } },
      update: { count: { increment: job.count } },
      create: { playerId, troopType: job.troopType, count: job.count },
    });
    await tx.trainingJob.delete({ where: { id: job.id } });
    await bumpAchievement(tx, playerId, 'troopsTrained', job.count);
  }
  const research = await tx.researchJob.findMany({ where: { playerId, completesAt: { lte: now } } });
  for (const r of research) {
    await tx.playerTroop.upsert({ where: { playerId_troopType: { playerId, troopType: r.troopType } }, update: { level: r.toLevel }, create: { playerId, troopType: r.troopType, level: r.toLevel } });
    await tx.researchJob.delete({ where: { id: r.id } });
    await addXp(tx, playerId, 25 * r.toLevel);
  }
}

export async function addXp(tx: DbOrTx, playerId: string, xp: number): Promise<{ level: number; leveledUp: boolean }> {
  const p = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { xp: true, level: true } });
  const total = p.xp + Math.max(0, Math.round(xp));
  const { level } = levelFromXp(total);
  await tx.player.update({ where: { id: playerId }, data: { xp: total, level } });
  return { level, leveledUp: level > p.level };
}

export function buildingToDTO(b: Building, now: Date): BuildingDTO {
  const def = BUILDING_DEFINITIONS[b.type];
  const lvl = getBuildingLevel(b.type, b.level);
  const dto: BuildingDTO = {
    id: b.id,
    type: b.type,
    level: b.level,
    x: b.x,
    y: b.y,
    size: def?.size ?? 1,
    state: b.state,
    constructionStartedAt: b.constructionStartedAt?.toISOString() ?? null,
    constructionEndsAt: b.constructionEndsAt?.toISOString() ?? null,
    hp: lvl?.hp ?? 0,
  };
  if (lvl?.productionPerHour) {
    const acc = accruedProduction(b, now);
    dto.accrued = acc.amount;
    dto.accruedCapacity = acc.capacity;
  }
  if (lvl?.gemsPerDay) {
    const days = Math.max(0, now.getTime() - b.lastCollectedAt.getTime()) / 86_400_000;
    dto.accrued = Math.min(lvl.gemsPerDay * 7, Math.floor(days * lvl.gemsPerDay));
    dto.accruedCapacity = lvl.gemsPerDay * 7;
  }
  return dto;
}

export async function getVillageDTO(tx: DbOrTx, playerId: string, now: Date): Promise<VillageDTO> {
  const village = await getVillage(tx, playerId);
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
  const cap = storageCapacity(village.buildings);
  return {
    id: village.id,
    name: village.name,
    gridSize: village.gridSize,
    townHallLevel: townHallLevel(village.buildings),
    buildings: village.buildings.map((b) => buildingToDTO(b, now)),
    resources: { gold: player.gold, elixir: player.elixir, gems: player.gems, goldCapacity: cap.gold, elixirCapacity: cap.elixir },
    builders: { total: builderCount(village.buildings), busy: busyBuilders(village.buildings, now) },
    shieldUntil: player.shieldUntil && player.shieldUntil > now ? player.shieldUntil.toISOString() : null,
  };
}

export async function getPlayerSummary(tx: DbOrTx, playerId: string): Promise<PlayerSummaryDTO> {
  const p = await tx.player.findUnique({ where: { id: playerId }, include: { clanMember: { include: { clan: true } }, village: { include: { buildings: { where: { type: 'town_hall' } } } } } });
  if (!p) throw new GameError('PLAYER_NOT_FOUND', 'Player not found', 404);
  return {
    id: p.id,
    name: p.name,
    level: p.level,
    xp: p.xp,
    trophies: p.trophies,
    bestTrophies: p.bestTrophies,
    townHallLevel: p.village?.buildings[0]?.level ?? 1,
    clan: p.clanMember ? { id: p.clanMember.clan.id, name: p.clanMember.clan.name, tag: p.clanMember.clan.tag, role: p.clanMember.role } : null,
    attacksWon: p.attacksWon,
    attacksLost: p.attacksLost,
    defensesWon: p.defensesWon,
    defensesLost: p.defensesLost,
  };
}

/** Runs `fn` inside a transaction after syncing the player's timers. */
export async function withPlayer<T>(ctx: GameContext, playerId: string, fn: (tx: DbOrTx, now: Date) => Promise<T>): Promise<T> {
  const now = ctx.now();
  return ctx.db.$transaction(
    async (tx) => {
      await syncPlayer(tx, playerId, now);
      return fn(tx, now);
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

export { applyResourceDelta };
