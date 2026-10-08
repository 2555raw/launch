import { BUILDING_DEFINITIONS, getBuildingLevel } from './definitions/buildings.js';

export interface BuildingLike {
  id: string;
  type: string;
  level: number;
  x: number;
  y: number;
  state: 'IDLE' | 'CONSTRUCTING' | 'UPGRADING';
  lastCollectedAt: Date;
  constructionEndsAt?: Date | null;
}

/** Total gold/elixir the village can hold (sum of storages + town hall). */
export function storageCapacity(buildings: Array<Pick<BuildingLike, 'type' | 'level' | 'state'>>): { gold: number; elixir: number } {
  let gold = 0;
  let elixir = 0;
  for (const b of buildings) {
    if (b.state === 'CONSTRUCTING') continue;
    const lvl = getBuildingLevel(b.type, b.level);
    if (!lvl?.storage) continue;
    gold += lvl.storage.gold ?? 0;
    elixir += lvl.storage.elixir ?? 0;
  }
  return { gold, elixir };
}

/** Resource accrued in a collector since its last collection, capped by its capacity. */
export function accruedProduction(b: Pick<BuildingLike, 'type' | 'level' | 'state' | 'lastCollectedAt'>, now: Date): { amount: number; capacity: number } {
  const lvl = getBuildingLevel(b.type, b.level);
  if (!lvl?.productionPerHour || b.state === 'CONSTRUCTING') return { amount: 0, capacity: lvl?.collectorCapacity ?? 0 };
  const hours = Math.max(0, now.getTime() - b.lastCollectedAt.getTime()) / 3_600_000;
  const capacity = lvl.collectorCapacity ?? 0;
  return { amount: Math.min(capacity, Math.floor(hours * lvl.productionPerHour)), capacity };
}

export function builderCount(buildings: Array<Pick<BuildingLike, 'type' | 'state'>>): number {
  let n = 0;
  for (const b of buildings) if (b.type === 'builder_hut' && b.state !== 'CONSTRUCTING') n += 1;
  return n;
}

export function busyBuilders(buildings: Array<Pick<BuildingLike, 'state' | 'constructionEndsAt'>>, now: Date): number {
  let n = 0;
  for (const b of buildings) {
    if (b.state !== 'IDLE' && b.constructionEndsAt && b.constructionEndsAt.getTime() > now.getTime()) n += 1;
  }
  return n;
}

export function townHallLevel(buildings: Array<Pick<BuildingLike, 'type' | 'level'>>): number {
  const th = buildings.find((b) => b.type === 'town_hall');
  return th?.level ?? 1;
}

export function housingCapacity(buildings: Array<Pick<BuildingLike, 'type' | 'level' | 'state'>>): number {
  let n = 0;
  for (const b of buildings) {
    if (b.type !== 'army_camp' || b.state === 'CONSTRUCTING') continue;
    n += getBuildingLevel(b.type, b.level)?.housing ?? 0;
  }
  return n;
}

export function highestLevel(buildings: Array<Pick<BuildingLike, 'type' | 'level' | 'state'>>, type: string): number {
  let max = 0;
  for (const b of buildings) if (b.type === type && b.state !== 'CONSTRUCTING') max = Math.max(max, b.level);
  return max;
}

export function isResourceBuilding(type: string): boolean {
  const cat = BUILDING_DEFINITIONS[type]?.category;
  return cat === 'resource' || cat === 'storage';
}
