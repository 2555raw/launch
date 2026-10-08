/**
 * Original troop roster for Emberhold. Data-driven: add an entry to `TROOP_DEFINITIONS` to add a unit.
 */

export type TroopTargetPreference = 'any' | 'defense' | 'resource' | 'wall';

export interface TroopLevel {
  level: number;
  hp: number;
  damage: number;
  /** elixir cost to train one unit at this level */
  trainCost: number;
  /** research cost to reach this level (0 for level 1) */
  researchCost: number;
  researchTimeSec: number;
  requiredLabLevel: number;
}

export interface TroopDefinition {
  type: string;
  name: string;
  description: string;
  housing: number;
  attackSpeedMs: number;
  /** tiles per second */
  moveSpeed: number;
  /** attack range in tiles (melee ~0.5) */
  range: number;
  targetPreference: TroopTargetPreference;
  isFlying: boolean;
  /** damage multiplier against walls */
  wallDamageMultiplier: number;
  /** unit dies after its first hit (breacher) */
  suicide: boolean;
  splashRadius: number;
  trainTimeSec: number;
  /** barracks level that unlocks the troop */
  requiredBarracksLevel: number;
  levels: TroopLevel[];
  sprite?: string;
}

interface TroopSpec extends Omit<TroopDefinition, 'levels'> {
  baseHp: number;
  baseDamage: number;
  baseCost: number;
  maxLevel: number;
}

function expandLevels(spec: TroopSpec): TroopLevel[] {
  const out: TroopLevel[] = [];
  for (let i = 0; i < spec.maxLevel; i++) {
    const level = i + 1;
    out.push({
      level,
      hp: Math.round(spec.baseHp * Math.pow(1.2, i)),
      damage: Math.round(spec.baseDamage * Math.pow(1.18, i)),
      trainCost: Math.round(spec.baseCost * Math.pow(1.3, i)),
      researchCost: i === 0 ? 0 : Math.round(spec.baseCost * 400 * Math.pow(2.2, i - 1)),
      researchTimeSec: i === 0 ? 0 : Math.round(1800 * Math.pow(2.5, i - 1)),
      requiredLabLevel: i === 0 ? 0 : i,
    });
  }
  return out;
}

const SPECS: TroopSpec[] = [
  {
    type: 'grunt',
    name: 'Grunt',
    description: 'A fearless melee brawler. Cheap, quick to train, attacks whatever is closest.',
    housing: 1,
    attackSpeedMs: 1000,
    moveSpeed: 2,
    range: 0.5,
    targetPreference: 'any',
    isFlying: false,
    wallDamageMultiplier: 1,
    suicide: false,
    splashRadius: 0,
    trainTimeSec: 20,
    requiredBarracksLevel: 1,
    baseHp: 45,
    baseDamage: 8,
    baseCost: 25,
    maxLevel: 6,
  },
  {
    type: 'ranger',
    name: 'Ranger',
    description: 'Fires from a distance, picking off targets over walls.',
    housing: 1,
    attackSpeedMs: 1000,
    moveSpeed: 2.2,
    range: 3.5,
    targetPreference: 'any',
    isFlying: false,
    wallDamageMultiplier: 1,
    suicide: false,
    splashRadius: 0,
    trainTimeSec: 25,
    requiredBarracksLevel: 2,
    baseHp: 20,
    baseDamage: 7,
    baseCost: 50,
    maxLevel: 6,
  },
  {
    type: 'brute',
    name: 'Brute',
    description: 'A slow mountain of muscle that goes straight for defenses.',
    housing: 5,
    attackSpeedMs: 2000,
    moveSpeed: 1.2,
    range: 0.5,
    targetPreference: 'defense',
    isFlying: false,
    wallDamageMultiplier: 1,
    suicide: false,
    splashRadius: 0,
    trainTimeSec: 120,
    requiredBarracksLevel: 3,
    baseHp: 300,
    baseDamage: 22,
    baseCost: 250,
    maxLevel: 6,
  },
  {
    type: 'breacher',
    name: 'Breacher',
    description: 'Runs at the nearest wall and blows it open. One use only.',
    housing: 2,
    attackSpeedMs: 1000,
    moveSpeed: 3,
    range: 0.5,
    targetPreference: 'wall',
    isFlying: false,
    wallDamageMultiplier: 40,
    suicide: true,
    splashRadius: 1,
    trainTimeSec: 60,
    requiredBarracksLevel: 4,
    baseHp: 20,
    baseDamage: 12,
    baseCost: 400,
    maxLevel: 5,
  },
  {
    type: 'sky_scout',
    name: 'Sky Scout',
    description: 'A winged raider that ignores walls entirely. Only air-capable defenses can touch it.',
    housing: 2,
    attackSpeedMs: 1000,
    moveSpeed: 2.5,
    range: 0.5,
    targetPreference: 'any',
    isFlying: true,
    wallDamageMultiplier: 1,
    suicide: false,
    splashRadius: 0,
    trainTimeSec: 90,
    requiredBarracksLevel: 5,
    baseHp: 60,
    baseDamage: 11,
    baseCost: 600,
    maxLevel: 5,
  },
  {
    type: 'pyromancer',
    name: 'Pyromancer',
    description: 'Hurls fire that splashes over nearby buildings. Fragile but devastating.',
    housing: 4,
    attackSpeedMs: 1500,
    moveSpeed: 1.8,
    range: 3,
    targetPreference: 'any',
    isFlying: false,
    wallDamageMultiplier: 1,
    suicide: false,
    splashRadius: 1,
    trainTimeSec: 180,
    requiredBarracksLevel: 6,
    baseHp: 75,
    baseDamage: 50,
    baseCost: 1500,
    maxLevel: 5,
  },
];

export const TROOP_DEFINITIONS: Record<string, TroopDefinition> = Object.fromEntries(
  SPECS.map((spec) => {
    const { baseHp: _h, baseDamage: _d, baseCost: _c, maxLevel: _m, ...rest } = spec;
    return [spec.type, { ...rest, levels: expandLevels(spec) }];
  }),
);

export const TROOP_TYPES = Object.keys(TROOP_DEFINITIONS);

export function getTroopDefinition(type: string): TroopDefinition | undefined {
  return TROOP_DEFINITIONS[type];
}

export function getTroopLevel(type: string, level: number): TroopLevel | undefined {
  return TROOP_DEFINITIONS[type]?.levels[level - 1];
}
