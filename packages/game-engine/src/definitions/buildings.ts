/**
 * Data-driven building catalogue for Emberhold.
 *
 * Every building is described by a `BuildingDefinition`. Adding a new building means adding an
 * entry to `BUILDING_DEFINITIONS` (plus a sprite in the web renderer) — no engine code changes.
 * Level tables are generated from a compact spec so the numbers stay consistent; the expanded
 * per-level data is what the rest of the engine (and the API) reads.
 */

export type BuildingCategory = 'core' | 'resource' | 'storage' | 'defense' | 'army' | 'wall' | 'special';
export type TargetMode = 'ground' | 'air' | 'both';

export interface BuildingLevel {
  level: number;
  cost: { gold?: number; elixir?: number };
  buildTimeSec: number;
  hp: number;
  requiredTownHall: number;
  xpReward: number;
  /** resource per hour, for collectors */
  productionPerHour?: number;
  /** how much a collector holds before it must be collected */
  collectorCapacity?: number;
  /** extra storage capacity provided to the village */
  storage?: { gold?: number; elixir?: number };
  /** defenses */
  damage?: number;
  attackSpeedMs?: number;
  range?: number;
  minRange?: number;
  splashRadius?: number;
  targets?: TargetMode;
  /** army */
  housing?: number;
  /** barracks: highest troop tier it can train; laboratory: highest research level */
  tier?: number;
  /** special */
  builders?: number;
  gemsPerDay?: number;
}

export interface BuildingDefinition {
  type: string;
  name: string;
  description: string;
  category: BuildingCategory;
  /** footprint is size x size tiles */
  size: number;
  /** maximum number of this building allowed at each town hall level (index = TH level - 1) */
  maxCountByTownHall: number[];
  producesResource?: 'gold' | 'elixir';
  levels: BuildingLevel[];
  /** optional art key for the renderer; defaults to `type` */
  sprite?: string;
}

export const MAX_TOWN_HALL_LEVEL = 8;

const round = (n: number, step = 1) => Math.round(n / step) * step;

/** Generates a geometric sequence `base * growth^(i)` rounded to `step`. */
function series(levels: number, base: number, growth: number, step = 1): number[] {
  return Array.from({ length: levels }, (_, i) => round(base * Math.pow(growth, i), step));
}

interface Spec {
  type: string;
  name: string;
  description: string;
  category: BuildingCategory;
  size: number;
  maxCountByTownHall: number[];
  levels: number;
  costResource: 'gold' | 'elixir';
  baseCost: number;
  costGrowth: number;
  baseTimeSec: number;
  timeGrowth: number;
  baseHp: number;
  hpGrowth: number;
  /** TH level required for each building level (index = level-1) */
  requiredTownHall: number[];
  extra?: (level: number) => Partial<BuildingLevel>;
  producesResource?: 'gold' | 'elixir';
  sprite?: string;
}

function expand(spec: Spec): BuildingDefinition {
  const costs = series(spec.levels, spec.baseCost, spec.costGrowth, 10);
  const times = series(spec.levels, spec.baseTimeSec, spec.timeGrowth, 5);
  const hps = series(spec.levels, spec.baseHp, spec.hpGrowth, 5);
  const levels: BuildingLevel[] = [];
  for (let i = 0; i < spec.levels; i++) {
    const level = i + 1;
    const cost = spec.costResource === 'gold' ? { gold: costs[i] } : { elixir: costs[i] };
    levels.push({
      level,
      cost,
      buildTimeSec: times[i],
      hp: hps[i],
      requiredTownHall: spec.requiredTownHall[i] ?? spec.requiredTownHall[spec.requiredTownHall.length - 1],
      xpReward: Math.max(1, Math.round(Math.sqrt(times[i]))),
      ...(spec.extra ? spec.extra(level) : {}),
    });
  }
  return {
    type: spec.type,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    size: spec.size,
    maxCountByTownHall: spec.maxCountByTownHall,
    producesResource: spec.producesResource,
    levels,
    sprite: spec.sprite,
  };
}

const TH = [1, 1, 2, 3, 4, 5, 6, 7]; // generic unlock ladder for 8-level buildings

export const BUILDING_DEFINITIONS: Record<string, BuildingDefinition> = Object.fromEntries(
  (
    [
      {
        type: 'town_hall',
        name: 'Town Hall',
        description: 'The heart of your settlement. Upgrading it unlocks new buildings, higher levels and more troops.',
        category: 'core',
        size: 4,
        maxCountByTownHall: [1, 1, 1, 1, 1, 1, 1, 1],
        levels: MAX_TOWN_HALL_LEVEL,
        costResource: 'gold',
        baseCost: 0,
        costGrowth: 1,
        baseTimeSec: 0,
        timeGrowth: 1,
        baseHp: 450,
        hpGrowth: 1.33,
        requiredTownHall: [1, 1, 2, 3, 4, 5, 6, 7],
        extra: (level) => ({
          // upgrade cost/time to reach `level` is defined on that level entry
          cost: { gold: [0, 1000, 4000, 25000, 150000, 750000, 1200000, 2000000][level - 1] },
          buildTimeSec: [0, 60, 900, 3600, 14400, 43200, 86400, 172800][level - 1],
          storage: { gold: 1000 * Math.pow(2, level - 1), elixir: 1000 * Math.pow(2, level - 1) },
        }),
      },
      {
        type: 'gold_mine',
        name: 'Gold Mine',
        description: 'Digs gold out of the hills. Collect it before the mine fills up.',
        category: 'resource',
        size: 3,
        maxCountByTownHall: [1, 2, 3, 4, 5, 6, 6, 7],
        levels: 8,
        costResource: 'elixir',
        baseCost: 150,
        costGrowth: 2.1,
        baseTimeSec: 10,
        timeGrowth: 2.4,
        baseHp: 400,
        hpGrowth: 1.15,
        requiredTownHall: TH,
        producesResource: 'gold',
        extra: (level) => ({
          productionPerHour: [200, 400, 650, 1000, 1300, 1600, 1900, 2200][level - 1],
          collectorCapacity: [1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000][level - 1],
        }),
      },
      {
        type: 'elixir_collector',
        name: 'Elixir Collector',
        description: 'Draws elixir from the ley lines. Fuels troop training and research.',
        category: 'resource',
        size: 3,
        maxCountByTownHall: [1, 2, 3, 4, 5, 6, 6, 7],
        levels: 8,
        costResource: 'gold',
        baseCost: 150,
        costGrowth: 2.1,
        baseTimeSec: 10,
        timeGrowth: 2.4,
        baseHp: 400,
        hpGrowth: 1.15,
        requiredTownHall: TH,
        producesResource: 'elixir',
        extra: (level) => ({
          productionPerHour: [200, 400, 650, 1000, 1300, 1600, 1900, 2200][level - 1],
          collectorCapacity: [1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000][level - 1],
        }),
      },
      {
        type: 'gold_storage',
        name: 'Gold Vault',
        description: 'Stores gold. Attackers can plunder a share of what you keep here.',
        category: 'storage',
        size: 3,
        maxCountByTownHall: [1, 1, 2, 2, 3, 3, 4, 4],
        levels: 8,
        costResource: 'elixir',
        baseCost: 300,
        costGrowth: 2.4,
        baseTimeSec: 15,
        timeGrowth: 2.5,
        baseHp: 600,
        hpGrowth: 1.22,
        requiredTownHall: TH,
        extra: (level) => ({ storage: { gold: [1500, 3000, 6000, 12000, 25000, 50000, 100000, 200000][level - 1] } }),
      },
      {
        type: 'elixir_storage',
        name: 'Elixir Reservoir',
        description: 'Stores elixir. Attackers can plunder a share of what you keep here.',
        category: 'storage',
        size: 3,
        maxCountByTownHall: [1, 1, 2, 2, 3, 3, 4, 4],
        levels: 8,
        costResource: 'gold',
        baseCost: 300,
        costGrowth: 2.4,
        baseTimeSec: 15,
        timeGrowth: 2.5,
        baseHp: 600,
        hpGrowth: 1.22,
        requiredTownHall: TH,
        extra: (level) => ({ storage: { elixir: [1500, 3000, 6000, 12000, 25000, 50000, 100000, 200000][level - 1] } }),
      },
      {
        type: 'barracks',
        name: 'Barracks',
        description: 'Trains troops. Higher levels unlock stronger units.',
        category: 'army',
        size: 3,
        maxCountByTownHall: [1, 1, 2, 2, 3, 3, 4, 4],
        levels: 8,
        costResource: 'elixir',
        baseCost: 200,
        costGrowth: 2.3,
        baseTimeSec: 10,
        timeGrowth: 2.6,
        baseHp: 250,
        hpGrowth: 1.15,
        requiredTownHall: TH,
        extra: (level) => ({ tier: level }),
      },
      {
        type: 'army_camp',
        name: 'Army Camp',
        description: 'Houses trained troops until you march to war.',
        category: 'army',
        size: 4,
        maxCountByTownHall: [1, 1, 2, 2, 3, 3, 4, 4],
        levels: 6,
        costResource: 'elixir',
        baseCost: 250,
        costGrowth: 3,
        baseTimeSec: 20,
        timeGrowth: 3,
        baseHp: 250,
        hpGrowth: 1.2,
        requiredTownHall: [1, 2, 3, 4, 5, 7],
        extra: (level) => ({ housing: [20, 30, 35, 40, 45, 50][level - 1] }),
      },
      {
        type: 'laboratory',
        name: 'Laboratory',
        description: 'Researches troop upgrades.',
        category: 'army',
        size: 3,
        maxCountByTownHall: [0, 0, 1, 1, 1, 1, 1, 1],
        levels: 6,
        costResource: 'elixir',
        baseCost: 5000,
        costGrowth: 2.2,
        baseTimeSec: 1800,
        timeGrowth: 2,
        baseHp: 500,
        hpGrowth: 1.15,
        requiredTownHall: [3, 4, 5, 6, 7, 8],
        extra: (level) => ({ tier: level }),
      },
      {
        type: 'builder_hut',
        name: "Builder's Hut",
        description: 'Each hut adds one builder. Builders are needed for every construction and upgrade.',
        category: 'special',
        size: 2,
        maxCountByTownHall: [2, 2, 3, 3, 4, 4, 5, 5],
        levels: 1,
        costResource: 'gold',
        baseCost: 0,
        costGrowth: 1,
        baseTimeSec: 0,
        timeGrowth: 1,
        baseHp: 250,
        hpGrowth: 1,
        requiredTownHall: [1],
        extra: () => ({ builders: 1, cost: { gold: 0 } }),
      },
      {
        type: 'clan_hall',
        name: 'Clan Hall',
        description: 'Lets you join a clan, request reinforcements and chat with clanmates.',
        category: 'special',
        size: 3,
        maxCountByTownHall: [0, 1, 1, 1, 1, 1, 1, 1],
        levels: 4,
        costResource: 'gold',
        baseCost: 10000,
        costGrowth: 4,
        baseTimeSec: 300,
        timeGrowth: 4,
        baseHp: 1000,
        hpGrowth: 1.3,
        requiredTownHall: [2, 4, 6, 8],
        extra: (level) => ({ housing: [10, 15, 20, 25][level - 1] }),
      },
      {
        type: 'crystal_mine',
        name: 'Crystal Mine',
        description: 'Slowly yields crystals, the premium currency, from deep veins.',
        category: 'special',
        size: 2,
        maxCountByTownHall: [0, 0, 0, 1, 1, 1, 1, 1],
        levels: 3,
        costResource: 'gold',
        baseCost: 120000,
        costGrowth: 2.5,
        baseTimeSec: 43200,
        timeGrowth: 1.5,
        baseHp: 700,
        hpGrowth: 1.2,
        requiredTownHall: [4, 6, 8],
        extra: (level) => ({ gemsPerDay: [2, 3, 5][level - 1] }),
      },
      {
        type: 'arrow_tower',
        name: 'Arrow Tower',
        description: 'Long-range single-target defense that hits ground and air.',
        category: 'defense',
        size: 3,
        maxCountByTownHall: [1, 1, 2, 2, 3, 3, 4, 5],
        levels: 8,
        costResource: 'gold',
        baseCost: 1000,
        costGrowth: 2,
        baseTimeSec: 60,
        timeGrowth: 2.5,
        baseHp: 380,
        hpGrowth: 1.18,
        requiredTownHall: [2, 2, 3, 4, 5, 6, 7, 8],
        extra: (level) => ({ damage: 11 + level * 4, attackSpeedMs: 1000, range: 10, targets: 'both' }),
      },
      {
        type: 'cannon',
        name: 'Cannon',
        description: 'Cheap, sturdy ground-only defense.',
        category: 'defense',
        size: 3,
        maxCountByTownHall: [2, 2, 2, 3, 4, 4, 5, 6],
        levels: 8,
        costResource: 'gold',
        baseCost: 250,
        costGrowth: 2.1,
        baseTimeSec: 20,
        timeGrowth: 2.7,
        baseHp: 420,
        hpGrowth: 1.2,
        requiredTownHall: TH,
        extra: (level) => ({ damage: 9 + level * 5, attackSpeedMs: 800, range: 9, targets: 'ground' }),
      },
      {
        type: 'mortar',
        name: 'Mortar',
        description: 'Lobs splash damage at groups of ground troops. Cannot hit nearby targets.',
        category: 'defense',
        size: 3,
        maxCountByTownHall: [0, 0, 1, 1, 2, 2, 3, 4],
        levels: 6,
        costResource: 'gold',
        baseCost: 8000,
        costGrowth: 2.2,
        baseTimeSec: 1800,
        timeGrowth: 2,
        baseHp: 400,
        hpGrowth: 1.15,
        requiredTownHall: [3, 4, 5, 6, 7, 8],
        extra: (level) => ({ damage: 20 + level * 12, attackSpeedMs: 5000, range: 11, minRange: 4, splashRadius: 1.5, targets: 'ground' }),
      },
      {
        type: 'mage_tower',
        name: 'Mage Tower',
        description: 'Short-range splash damage against ground and air.',
        category: 'defense',
        size: 3,
        maxCountByTownHall: [0, 0, 0, 0, 1, 2, 2, 3],
        levels: 5,
        costResource: 'gold',
        baseCost: 120000,
        costGrowth: 1.8,
        baseTimeSec: 14400,
        timeGrowth: 1.8,
        baseHp: 620,
        hpGrowth: 1.15,
        requiredTownHall: [5, 6, 7, 8, 8],
        extra: (level) => ({ damage: 10 + level * 6, attackSpeedMs: 1300, range: 7, splashRadius: 1, targets: 'both' }),
      },
      {
        type: 'wall',
        name: 'Wall',
        description: 'Slows down ground troops. Build them in rings around what matters.',
        category: 'wall',
        size: 1,
        maxCountByTownHall: [0, 25, 50, 75, 100, 125, 175, 225],
        levels: 8,
        costResource: 'gold',
        baseCost: 50,
        costGrowth: 2.6,
        baseTimeSec: 0,
        timeGrowth: 1,
        baseHp: 300,
        hpGrowth: 1.45,
        requiredTownHall: [2, 2, 3, 4, 5, 6, 7, 8],
      },
    ] as Spec[]
  ).map((spec) => [spec.type, expand(spec)]),
);

export function getBuildingDefinition(type: string): BuildingDefinition | undefined {
  return BUILDING_DEFINITIONS[type];
}

export function getBuildingLevel(type: string, level: number): BuildingLevel | undefined {
  return BUILDING_DEFINITIONS[type]?.levels[level - 1];
}

export function maxBuildingCount(type: string, townHallLevel: number): number {
  const def = BUILDING_DEFINITIONS[type];
  if (!def) return 0;
  const idx = Math.min(Math.max(townHallLevel, 1), def.maxCountByTownHall.length) - 1;
  return def.maxCountByTownHall[idx] ?? 0;
}

/** Highest level a building may reach at the given town hall level. */
export function maxBuildingLevel(type: string, townHallLevel: number): number {
  const def = BUILDING_DEFINITIONS[type];
  if (!def) return 0;
  let max = 0;
  for (const lvl of def.levels) if (lvl.requiredTownHall <= townHallLevel) max = lvl.level;
  return max;
}

export const BUILDING_TYPES = Object.keys(BUILDING_DEFINITIONS);

/** Buildings every new village starts with. Positions are grid coordinates (top-left corner). */
export const STARTER_VILLAGE: Array<{ type: string; level: number; x: number; y: number }> = [
  { type: 'town_hall', level: 1, x: 20, y: 20 },
  { type: 'builder_hut', level: 1, x: 14, y: 14 },
  { type: 'gold_mine', level: 1, x: 26, y: 16 },
  { type: 'elixir_collector', level: 1, x: 16, y: 26 },
  { type: 'gold_storage', level: 1, x: 26, y: 24 },
  { type: 'elixir_storage', level: 1, x: 24, y: 28 },
  { type: 'barracks', level: 1, x: 13, y: 20 },
  { type: 'army_camp', level: 1, x: 28, y: 29 },
  { type: 'cannon', level: 1, x: 20, y: 15 },
];

/** Free starting resources for a new player. */
export const STARTER_RESOURCES = { gold: 750, elixir: 750, gems: 50 };
