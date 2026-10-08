import { describe, expect, it } from 'vitest';
import {
  BUILDING_DEFINITIONS,
  BattleSimulation,
  STARTER_VILLAGE,
  TROOP_DEFINITIONS,
  accruedProduction,
  canDeployAt,
  deploymentMask,
  distributeLoot,
  levelFromXp,
  maxBuildingCount,
  maxBuildingLevel,
  replayBattle,
  storageCapacity,
  trophyDeltas,
  validatePlacement,
} from './index.js';
import type { BattleSnapshot } from '@launch/types';

describe('building definitions', () => {
  it('every building has monotonically increasing costs and hp', () => {
    for (const def of Object.values(BUILDING_DEFINITIONS)) {
      for (let i = 1; i < def.levels.length; i++) {
        const prev = def.levels[i - 1];
        const cur = def.levels[i];
        expect(cur.hp).toBeGreaterThanOrEqual(prev.hp);
        const prevCost = (prev.cost.gold ?? 0) + (prev.cost.elixir ?? 0);
        const curCost = (cur.cost.gold ?? 0) + (cur.cost.elixir ?? 0);
        expect(curCost).toBeGreaterThanOrEqual(prevCost);
        expect(cur.requiredTownHall).toBeGreaterThanOrEqual(prev.requiredTownHall);
      }
    }
  });
  it('town hall gates counts and levels', () => {
    expect(maxBuildingCount('mortar', 1)).toBe(0);
    expect(maxBuildingCount('mortar', 3)).toBe(1);
    expect(maxBuildingLevel('cannon', 1)).toBe(2);
    expect(maxBuildingCount('wall', 1)).toBe(60);
    expect(maxBuildingLevel('cannon', 8)).toBe(8);
  });
  it('starter village is placeable without overlaps', () => {
    const placed: Array<{ id: string; type: string; x: number; y: number }> = [];
    for (const s of STARTER_VILLAGE) {
      const r = validatePlacement(placed, s.type, s.x, s.y, 44);
      expect(r.ok).toBe(true);
      placed.push({ id: s.type + s.x, ...s });
    }
  });
});

describe('placement', () => {
  it('rejects overlaps and out-of-bounds', () => {
    const existing = [{ id: 'a', type: 'town_hall', x: 10, y: 10 }];
    expect(validatePlacement(existing, 'cannon', 12, 12, 44)).toEqual({ ok: false, error: 'OVERLAP' });
    expect(validatePlacement(existing, 'cannon', 14, 10, 44).ok).toBe(true);
    expect(validatePlacement(existing, 'cannon', 42, 42, 44)).toEqual({ ok: false, error: 'OUT_OF_BOUNDS' });
    expect(validatePlacement(existing, 'town_hall', 10, 10, 44, 'a').ok).toBe(true);
  });
  it('deployment mask blocks footprints plus margin', () => {
    const mask = deploymentMask([{ type: 'cannon', x: 10, y: 10 }], 44);
    expect(canDeployAt(mask, 44, 11, 11)).toBe(false);
    expect(canDeployAt(mask, 44, 9, 9)).toBe(false);
    expect(canDeployAt(mask, 44, 8, 8)).toBe(true);
    expect(canDeployAt(mask, 44, -1, 0)).toBe(false);
  });
});

describe('resources', () => {
  it('accrues production over time and caps at capacity', () => {
    const now = new Date('2026-01-01T10:00:00Z');
    const b = { type: 'gold_mine', level: 1, state: 'IDLE' as const, lastCollectedAt: new Date('2026-01-01T09:00:00Z') };
    expect(accruedProduction(b, now).amount).toBe(200);
    const old = { ...b, lastCollectedAt: new Date('2025-12-01T00:00:00Z') };
    expect(accruedProduction(old, now).amount).toBe(1000);
    expect(accruedProduction({ ...b, state: 'CONSTRUCTING' }, now).amount).toBe(0);
  });
  it('sums storage capacity', () => {
    const cap = storageCapacity([
      { type: 'town_hall', level: 1, state: 'IDLE' },
      { type: 'gold_storage', level: 1, state: 'IDLE' },
      { type: 'gold_storage', level: 2, state: 'CONSTRUCTING' },
    ]);
    expect(cap.gold).toBe(2500);
    expect(cap.elixir).toBe(1000);
  });
});

describe('progression', () => {
  it('levels from xp are consistent', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(100000).level).toBeGreaterThan(10);
  });
  it('trophy exchange is zero-sum-ish and bounded', () => {
    const [a, d] = trophyDeltas(1000, 1000, 3);
    expect(a).toBe(15);
    expect(d).toBe(-15);
    const [a2, d2] = trophyDeltas(0, 1000, 0);
    expect(a2).toBe(0);
    expect(d2).toBeGreaterThan(0);
  });
});

function snapshot(): BattleSnapshot {
  return {
    gridSize: 44,
    townHallLevel: 1,
    buildings: [
      { id: 'th', type: 'town_hall', level: 1, x: 20, y: 20, size: 4, hp: 450, storedGold: 100, storedElixir: 100 },
      { id: 'c1', type: 'cannon', level: 1, x: 16, y: 20, size: 3, hp: 420, storedGold: 0, storedElixir: 0 },
      { id: 'gs', type: 'gold_storage', level: 1, x: 25, y: 20, size: 3, hp: 600, storedGold: 200, storedElixir: 0 },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `w${i}`, type: 'wall', level: 1, x: 15 + i, y: 18, size: 1, hp: 300, storedGold: 0, storedElixir: 0 })),
    ],
  };
}

describe('battle simulation', () => {
  it('rejects invalid deployments', () => {
    const sim = new BattleSimulation({ seed: 1, snapshot: snapshot(), army: { grunt: 5 }, troopLevels: {}, attackerTownHall: 1 });
    expect(sim.deploy('grunt', 21, 21)).toEqual({ ok: false, reason: 'INVALID_DEPLOY_ZONE' });
    expect(sim.deploy('dragon', 1, 1)).toEqual({ ok: false, reason: 'UNKNOWN_TROOP' });
    expect(sim.deploy('ranger', 1, 1)).toEqual({ ok: false, reason: 'NO_UNITS_LEFT' });
    expect(sim.deploy('grunt', 1, 1).ok).toBe(true);
    expect(sim.remainingArmy.grunt).toBe(4);
  });

  it('a strong army destroys the base, earns loot and 3 stars', () => {
    const sim = new BattleSimulation({ seed: 42, snapshot: snapshot(), army: { grunt: 40, brute: 4 }, troopLevels: { grunt: 3 }, attackerTownHall: 1 });
    for (let i = 0; i < 40; i++) sim.deploy('grunt', 2 + (i % 10), 2 + Math.floor(i / 10));
    for (let i = 0; i < 4; i++) sim.deploy('brute', 2 + i, 8);
    while (!sim.tick()) {
      /* run */
    }
    expect(sim.destructionPercent).toBe(100);
    expect(sim.townHallDestroyed).toBe(true);
    const res = sim.result(500, 500, trophyDeltas, 1);
    expect(res.stars).toBe(3);
    expect(res.lootGold).toBe(300);
    expect(res.lootElixir).toBe(100);
    expect(res.victory).toBe(true);
    expect(res.attackerTrophyDelta).toBeGreaterThan(0);
    expect(sim.elapsedMs).toBeLessThan(180_000);
  });

  it('is deterministic for the same seed and deployments', () => {
    const run = () => {
      const sim = new BattleSimulation({ seed: 7, snapshot: snapshot(), army: { grunt: 6, ranger: 4 }, troopLevels: {}, attackerTownHall: 1 });
      sim.deploy('grunt', 3, 3);
      sim.deploy('ranger', 4, 3);
      for (let i = 0; i < 300; i++) sim.tick();
      sim.deploy('grunt', 40, 40);
      sim.deploy('ranger', 40, 3);
      while (!sim.tick()) {
        /* run */
      }
      return JSON.stringify(sim.state('x'));
    };
    expect(run()).toBe(run());
  });

  it('replay reproduces a live result from the deployment log', () => {
    const live = new BattleSimulation({ seed: 99, snapshot: snapshot(), army: { grunt: 10 }, troopLevels: {}, attackerTownHall: 1 });
    live.deploy('grunt', 2, 2);
    live.deploy('grunt', 2, 3);
    for (let i = 0; i < 50; i++) live.tick();
    live.deploy('grunt', 40, 40);
    while (!live.tick()) {
      /* run */
    }
    const replay = replayBattle({ seed: 99, snapshot: snapshot(), army: { grunt: 10 }, troopLevels: {}, attackerTownHall: 1 }, live.deployments);
    expect(replay.destructionPercent).toBe(live.destructionPercent);
    expect(replay.state('x').lootGold).toBe(live.state('x').lootGold);
    expect(replay.elapsedMs).toBe(live.elapsedMs);
  });

  it('ground troops path through walls while flyers ignore them', () => {
    const snap = snapshot();
    const ground = new BattleSimulation({ seed: 3, snapshot: snap, army: { grunt: 1 }, troopLevels: {}, attackerTownHall: 1 });
    ground.deploy('grunt', 19, 10);
    for (let i = 0; i < 100; i++) ground.tick();
    // the nearest building straight down is behind the wall row; the grunt should have engaged a wall or found a route
    const t = ground.troops[0];
    expect(t.targetId).not.toBeNull();
    const flyer = new BattleSimulation({ seed: 3, snapshot: snap, army: { sky_scout: 1 }, troopLevels: {}, attackerTownHall: 1 });
    flyer.deploy('sky_scout', 19, 10);
    for (let i = 0; i < 100; i++) flyer.tick();
    expect(flyer.troops[0].targetId).not.toMatch(/^w/);
  });

  it('battle ends when all troops are dead and no army remains', () => {
    const sim = new BattleSimulation({ seed: 5, snapshot: snapshot(), army: { grunt: 1 }, troopLevels: {}, attackerTownHall: 1 });
    sim.deploy('grunt', 12, 21);
    while (!sim.tick()) {
      /* run */
    }
    expect(sim.ended).toBe(true);
    expect(sim.elapsedMs).toBeLessThan(180_000);
  });

  it('distributes loot across storages and town hall', () => {
    const snap = distributeLoot(snapshot(), { gold: 10000, elixir: 5000 }, {}, 1);
    const gold = snap.buildings.reduce((s, b) => s + b.storedGold, 0);
    const elixir = snap.buildings.reduce((s, b) => s + b.storedElixir, 0);
    expect(gold).toBe(1000);
    expect(elixir).toBe(1000);
    const th = snap.buildings.find((b) => b.id === 'th')!;
    expect(th.storedGold).toBe(500);
    expect(th.storedElixir).toBe(1000);
  });
});

describe('troops', () => {
  it('every troop has levels with increasing stats and research gated by lab', () => {
    for (const t of Object.values(TROOP_DEFINITIONS)) {
      expect(t.levels[0].researchCost).toBe(0);
      for (let i = 1; i < t.levels.length; i++) {
        expect(t.levels[i].hp).toBeGreaterThan(t.levels[i - 1].hp);
        expect(t.levels[i].requiredLabLevel).toBe(i);
      }
    }
  });
});
