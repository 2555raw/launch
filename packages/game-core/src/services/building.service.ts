import { BUILDING_DEFINITIONS, accruedProduction, builderCount, busyBuilders, gemsToSkip, getBuildingLevel, maxBuildingCount, maxBuildingLevel, storageCapacity, townHallLevel, validatePlacement } from '@launch/game-engine';
import type { BuildingDTO } from '@launch/types';
import type { GameContext } from '../context.js';
import { GameError, assert } from '../context.js';
import { applyResourceDelta, spend } from './ledger.js';
import { buildingToDTO, getVillage, withPlayer } from './player.service.js';
import { bumpAchievement } from './progression.service.js';

/** Gem price of the Nth builder's hut (the first is free). */
export const BUILDER_HUT_GEM_COST = [0, 250, 500, 1000, 2000];

function requireFreeBuilder(buildings: Parameters<typeof builderCount>[0] & Parameters<typeof busyBuilders>[0], now: Date) {
  const total = builderCount(buildings);
  const busy = busyBuilders(buildings, now);
  assert(busy < total, 'NO_FREE_BUILDER', 'All builders are busy', 409);
}

export async function placeBuilding(ctx: GameContext, playerId: string, type: string, x: number, y: number): Promise<BuildingDTO> {
  return withPlayer(ctx, playerId, async (tx, now) => {
    const def = BUILDING_DEFINITIONS[type];
    assert(def, 'UNKNOWN_BUILDING', 'Unknown building type');
    const village = await getVillage(tx, playerId);
    const th = townHallLevel(village.buildings);
    const count = village.buildings.filter((b) => b.type === type).length;
    assert(count < maxBuildingCount(type, th), 'LIMIT_REACHED', `Your Town Hall level allows ${maxBuildingCount(type, th)} of this building`, 409);
    const level1 = def.levels[0];
    assert(level1.requiredTownHall <= th, 'TOWN_HALL_TOO_LOW', `Requires Town Hall ${level1.requiredTownHall}`, 409);
    const placement = validatePlacement(village.buildings, type, x, y, village.gridSize);
    assert(placement.ok, 'INVALID_PLACEMENT', placement.ok ? '' : placement.error === 'OVERLAP' ? 'That spot overlaps another building' : 'Out of bounds');
    const instant = level1.buildTimeSec === 0;
    if (!instant) requireFreeBuilder(village.buildings, now);

    const cost: { gold?: number; elixir?: number; gems?: number } = { ...level1.cost };
    if (type === 'builder_hut') cost.gems = BUILDER_HUT_GEM_COST[Math.min(count, BUILDER_HUT_GEM_COST.length - 1)];
    await spend(tx, playerId, cost, `build:${type}`, null);
    const created = await tx.building.create({
      data: {
        villageId: village.id,
        type,
        level: 1,
        x,
        y,
        state: instant ? 'IDLE' : 'CONSTRUCTING',
        constructionStartedAt: instant ? null : now,
        constructionEndsAt: instant ? null : new Date(now.getTime() + level1.buildTimeSec * 1000),
        lastCollectedAt: now,
      },
    });
    if (instant) await bumpAchievement(tx, playerId, 'buildingsUpgraded', 1);
    return buildingToDTO(created, now);
  });
}

export async function moveBuilding(ctx: GameContext, playerId: string, buildingId: string, x: number, y: number): Promise<BuildingDTO> {
  return withPlayer(ctx, playerId, async (tx, now) => {
    const village = await getVillage(tx, playerId);
    const b = village.buildings.find((v) => v.id === buildingId);
    assert(b, 'BUILDING_NOT_FOUND', 'Building not found', 404);
    const placement = validatePlacement(village.buildings, b.type, x, y, village.gridSize, b.id);
    assert(placement.ok, 'INVALID_PLACEMENT', placement.ok ? '' : placement.error === 'OVERLAP' ? 'That spot overlaps another building' : 'Out of bounds');
    const updated = await tx.building.update({ where: { id: b.id }, data: { x, y } });
    return buildingToDTO(updated, now);
  });
}

export async function upgradeBuilding(ctx: GameContext, playerId: string, buildingId: string): Promise<BuildingDTO> {
  return withPlayer(ctx, playerId, async (tx, now) => {
    const village = await getVillage(tx, playerId);
    const b = village.buildings.find((v) => v.id === buildingId);
    assert(b, 'BUILDING_NOT_FOUND', 'Building not found', 404);
    assert(b.state === 'IDLE', 'BUILDING_BUSY', 'This building is already under construction', 409);
    const next = getBuildingLevel(b.type, b.level + 1);
    assert(next, 'MAX_LEVEL', 'This building is at its maximum level', 409);
    const th = townHallLevel(village.buildings);
    assert(b.level + 1 <= maxBuildingLevel(b.type, th) || b.type === 'town_hall', 'TOWN_HALL_TOO_LOW', `Requires Town Hall ${next.requiredTownHall}`, 409);
    if (b.type === 'town_hall') assert(next.requiredTownHall <= th, 'TOWN_HALL_TOO_LOW', `Requires Town Hall ${next.requiredTownHall}`, 409);
    const instant = next.buildTimeSec === 0;
    if (!instant) requireFreeBuilder(village.buildings, now);
    await spend(tx, playerId, next.cost, `upgrade:${b.type}:${b.level + 1}`, null);
    const updated = await tx.building.update({
      where: { id: b.id },
      data: instant ? { level: b.level + 1 } : { state: 'UPGRADING', constructionStartedAt: now, constructionEndsAt: new Date(now.getTime() + next.buildTimeSec * 1000) },
    });
    if (instant) await bumpAchievement(tx, playerId, 'buildingsUpgraded', 1);
    return buildingToDTO(updated, now);
  });
}

export async function cancelConstruction(ctx: GameContext, playerId: string, buildingId: string): Promise<{ removed: boolean; building: BuildingDTO | null }> {
  return withPlayer(ctx, playerId, async (tx, now) => {
    const village = await getVillage(tx, playerId);
    const b = village.buildings.find((v) => v.id === buildingId);
    assert(b, 'BUILDING_NOT_FOUND', 'Building not found', 404);
    assert(b.state !== 'IDLE', 'NOT_UNDER_CONSTRUCTION', 'Nothing to cancel', 409);
    const lvl = getBuildingLevel(b.type, b.state === 'UPGRADING' ? b.level + 1 : b.level)!;
    const refund = { gold: Math.floor((lvl.cost.gold ?? 0) / 2), elixir: Math.floor((lvl.cost.elixir ?? 0) / 2) };
    const cap = storageCapacity(village.buildings);
    if (refund.gold) await applyResourceDelta(tx, playerId, 'GOLD', refund.gold, `cancel:${b.type}`, null, { cap: cap.gold });
    if (refund.elixir) await applyResourceDelta(tx, playerId, 'ELIXIR', refund.elixir, `cancel:${b.type}`, null, { cap: cap.elixir });
    if (b.state === 'CONSTRUCTING') {
      await tx.building.delete({ where: { id: b.id } });
      return { removed: true, building: null };
    }
    const updated = await tx.building.update({ where: { id: b.id }, data: { state: 'IDLE', constructionStartedAt: null, constructionEndsAt: null } });
    return { removed: false, building: buildingToDTO(updated, now) };
  });
}

export async function removeBuilding(ctx: GameContext, playerId: string, buildingId: string): Promise<void> {
  return withPlayer(ctx, playerId, async (tx) => {
    const village = await getVillage(tx, playerId);
    const b = village.buildings.find((v) => v.id === buildingId);
    assert(b, 'BUILDING_NOT_FOUND', 'Building not found', 404);
    assert(b.type !== 'town_hall', 'CANNOT_REMOVE', 'The Town Hall cannot be removed', 409);
    assert(b.state === 'IDLE', 'BUILDING_BUSY', 'Cancel the construction first', 409);
    if (b.type === 'builder_hut') {
      const huts = village.buildings.filter((v) => v.type === 'builder_hut').length;
      assert(huts > 1, 'CANNOT_REMOVE', 'You need at least one builder', 409);
    }
    await tx.building.delete({ where: { id: b.id } });
  });
}

export async function collectResources(ctx: GameContext, playerId: string, buildingId: string): Promise<{ collected: number; resource: 'gold' | 'elixir' | 'gems'; building: BuildingDTO }> {
  return withPlayer(ctx, playerId, async (tx, now) => {
    const village = await getVillage(tx, playerId);
    const b = village.buildings.find((v) => v.id === buildingId);
    assert(b, 'BUILDING_NOT_FOUND', 'Building not found', 404);
    const lvl = getBuildingLevel(b.type, b.level);
    const def = BUILDING_DEFINITIONS[b.type];
    if (lvl?.gemsPerDay) {
      const days = Math.max(0, now.getTime() - b.lastCollectedAt.getTime()) / 86_400_000;
      const amount = Math.min(lvl.gemsPerDay * 7, Math.floor(days * lvl.gemsPerDay));
      if (amount > 0) await applyResourceDelta(tx, playerId, 'GEMS', amount, 'collect:crystal_mine', null);
      const updated = await tx.building.update({ where: { id: b.id }, data: { lastCollectedAt: now } });
      return { collected: amount, resource: 'gems' as const, building: buildingToDTO(updated, now) };
    }
    assert(def?.producesResource && lvl?.productionPerHour, 'NOT_A_COLLECTOR', 'This building does not produce resources', 409);
    const { amount } = accruedProduction(b, now);
    const resource = def.producesResource;
    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
    const cap = storageCapacity(village.buildings)[resource];
    const room = Math.max(0, cap - player[resource]);
    const collected = Math.min(amount, room);
    if (collected > 0) await applyResourceDelta(tx, playerId, resource === 'gold' ? 'GOLD' : 'ELIXIR', collected, `collect:${b.type}`, null, { cap });
    // keep the uncollected remainder in the collector by backdating the timestamp
    const leftover = amount - collected;
    const lastCollectedAt = leftover > 0 ? new Date(now.getTime() - (leftover / lvl.productionPerHour) * 3_600_000) : now;
    const updated = await tx.building.update({ where: { id: b.id }, data: { lastCollectedAt } });
    return { collected, resource, building: buildingToDTO(updated, now) };
  });
}

export async function skipConstruction(ctx: GameContext, playerId: string, buildingId: string): Promise<BuildingDTO> {
  return withPlayer(ctx, playerId, async (tx, now) => {
    const village = await getVillage(tx, playerId);
    const b = village.buildings.find((v) => v.id === buildingId);
    assert(b, 'BUILDING_NOT_FOUND', 'Building not found', 404);
    assert(b.state !== 'IDLE' && b.constructionEndsAt, 'NOT_UNDER_CONSTRUCTION', 'Nothing to speed up', 409);
    const remaining = b.constructionEndsAt.getTime() - now.getTime();
    const gems = gemsToSkip(remaining);
    await spend(tx, playerId, { gems }, `skip:${b.type}`, null);
    await tx.building.update({ where: { id: b.id }, data: { constructionEndsAt: now } });
    // syncing on the next action will finalize it; do it now so the response is already complete
    const { syncPlayer } = await import('./player.service.js');
    await syncPlayer(tx, playerId, now);
    const fresh = await tx.building.findUniqueOrThrow({ where: { id: b.id } });
    return buildingToDTO(fresh, now);
  });
}

export function buildingCatalog(townHall: number) {
  return Object.values(BUILDING_DEFINITIONS).map((def) => ({
    type: def.type,
    name: def.name,
    description: def.description,
    category: def.category,
    size: def.size,
    maxCount: maxBuildingCount(def.type, townHall),
    maxLevel: maxBuildingLevel(def.type, townHall),
    levels: def.levels,
  }));
}

export { GameError };
