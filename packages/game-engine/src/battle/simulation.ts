import type { BattleEvent, BattleResultDTO, BattleSnapshot, BattleStateDTO, DeploymentRecord } from '@launch/types';
import { BUILDING_DEFINITIONS, getBuildingLevel } from '../definitions/buildings.js';
import { TROOP_DEFINITIONS, getTroopLevel } from '../definitions/troops.js';
import { BATTLE_DURATION_MS, BATTLE_TICK_MS } from '../progression.js';
import { canDeployAt, deploymentMask } from '../placement.js';
import { battleXp, starsFor } from './economy.js';
import { findPath, type GridCell } from './pathfinding.js';
import { Rng } from './rng.js';

interface SimBuilding {
  id: string;
  type: string;
  level: number;
  x: number;
  y: number;
  size: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  storedGold: number;
  storedElixir: number;
  isWall: boolean;
  isDefense: boolean;
  category: string;
  // defense
  damage: number;
  attackSpeedMs: number;
  range: number;
  minRange: number;
  splashRadius: number;
  targets: 'ground' | 'air' | 'both';
  cooldownMs: number;
  cx: number;
  cy: number;
}

interface SimTroop {
  id: number;
  troopType: string;
  level: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  attackSpeedMs: number;
  moveSpeed: number;
  range: number;
  isFlying: boolean;
  preference: 'any' | 'defense' | 'resource' | 'wall';
  wallMult: number;
  suicide: boolean;
  splashRadius: number;
  targetId: string | null;
  /** when the current target is a wall that blocks the way to `finalTargetId` */
  finalTargetId: string | null;
  path: Array<{ x: number; y: number }>;
  cooldownMs: number;
  dead: boolean;
  repathIn: number;
}

export interface SimulationOptions {
  seed: number;
  snapshot: BattleSnapshot;
  army: Record<string, number>;
  troopLevels: Record<string, number>;
  attackerTownHall: number;
  durationMs?: number;
}

export type DeployOutcome = { ok: true; entityId: number } | { ok: false; reason: string };

/**
 * Authoritative battle simulation. Pure and deterministic given the seed + deployment stream,
 * so the game server can run it live and the API can re-run it to audit a result.
 */
export class BattleSimulation {
  readonly gridSize: number;
  readonly durationMs: number;
  readonly buildings: SimBuilding[] = [];
  readonly troops: SimTroop[] = [];
  readonly remainingArmy: Record<string, number>;
  readonly deployments: DeploymentRecord[] = [];
  readonly events: BattleEvent[] = [];
  elapsedMs = 0;
  ended = false;
  private nextEntityId = 1;
  private readonly rng: Rng;
  private readonly grid: GridCell[];
  private readonly mask: Uint8Array;
  private readonly totalScoring: number;
  private readonly troopLevels: Record<string, number>;
  private readonly attackerTh: number;
  private lootGold = 0;
  private lootElixir = 0;
  private troopsUsed: Record<string, number> = {};
  private stars = 0;

  constructor(opts: SimulationOptions) {
    this.rng = new Rng(opts.seed);
    this.gridSize = opts.snapshot.gridSize;
    this.durationMs = opts.durationMs ?? BATTLE_DURATION_MS;
    this.remainingArmy = { ...opts.army };
    this.troopLevels = opts.troopLevels;
    this.attackerTh = opts.attackerTownHall;
    for (const b of opts.snapshot.buildings) {
      const def = BUILDING_DEFINITIONS[b.type];
      const lvl = getBuildingLevel(b.type, b.level);
      const size = b.size || def?.size || 1;
      this.buildings.push({
        id: b.id,
        type: b.type,
        level: b.level,
        x: b.x,
        y: b.y,
        size,
        hp: b.hp,
        maxHp: b.hp,
        destroyed: false,
        storedGold: b.storedGold,
        storedElixir: b.storedElixir,
        isWall: def?.category === 'wall',
        isDefense: def?.category === 'defense',
        category: def?.category ?? 'special',
        damage: lvl?.damage ?? 0,
        attackSpeedMs: lvl?.attackSpeedMs ?? 1000,
        range: lvl?.range ?? 0,
        minRange: lvl?.minRange ?? 0,
        splashRadius: lvl?.splashRadius ?? 0,
        targets: lvl?.targets ?? 'ground',
        cooldownMs: 0,
        cx: b.x + size / 2,
        cy: b.y + size / 2,
      });
    }
    this.totalScoring = this.buildings.filter((b) => !b.isWall).length;
    this.grid = new Array(this.gridSize * this.gridSize);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = { kind: 0, wallCost: 0, wallId: null };
    this.rebuildGrid();
    this.mask = deploymentMask(opts.snapshot.buildings, this.gridSize);
  }

  private rebuildGrid() {
    for (const c of this.grid) {
      c.kind = 0;
      c.wallCost = 0;
      c.wallId = null;
    }
    for (const b of this.buildings) {
      if (b.destroyed) continue;
      for (let y = b.y; y < b.y + b.size; y++) {
        for (let x = b.x; x < b.x + b.size; x++) {
          const c = this.grid[y * this.gridSize + x];
          if (!c) continue;
          if (b.isWall) {
            c.kind = 2;
            c.wallCost = 2 + b.hp / 60;
            c.wallId = b.id;
          } else {
            c.kind = 1;
          }
        }
      }
    }
  }

  get destructionPercent(): number {
    if (this.totalScoring === 0) return 100;
    const destroyed = this.buildings.filter((b) => !b.isWall && b.destroyed).length;
    return Math.floor((destroyed / this.totalScoring) * 100);
  }

  get townHallDestroyed(): boolean {
    return this.buildings.some((b) => b.type === 'town_hall' && b.destroyed);
  }

  deploy(troopType: string, x: number, y: number): DeployOutcome {
    if (this.ended) return { ok: false, reason: 'BATTLE_ENDED' };
    const def = TROOP_DEFINITIONS[troopType];
    if (!def) return { ok: false, reason: 'UNKNOWN_TROOP' };
    if ((this.remainingArmy[troopType] ?? 0) <= 0) return { ok: false, reason: 'NO_UNITS_LEFT' };
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, reason: 'INVALID_POSITION' };
    if (!canDeployAt(this.mask, this.gridSize, x, y)) return { ok: false, reason: 'INVALID_DEPLOY_ZONE' };
    const level = Math.max(1, this.troopLevels[troopType] ?? 1);
    const lvl = getTroopLevel(troopType, level) ?? def.levels[0];
    this.remainingArmy[troopType] -= 1;
    this.troopsUsed[troopType] = (this.troopsUsed[troopType] ?? 0) + 1;
    const id = this.nextEntityId++;
    this.troops.push({
      id,
      troopType,
      level,
      x: Math.floor(x) + 0.5,
      y: Math.floor(y) + 0.5,
      hp: lvl.hp,
      maxHp: lvl.hp,
      damage: lvl.damage,
      attackSpeedMs: def.attackSpeedMs,
      moveSpeed: def.moveSpeed,
      range: def.range,
      isFlying: def.isFlying,
      preference: def.targetPreference,
      wallMult: def.wallDamageMultiplier,
      suicide: def.suicide,
      splashRadius: def.splashRadius,
      targetId: null,
      finalTargetId: null,
      path: [],
      cooldownMs: 0,
      dead: false,
      repathIn: 0,
    });
    this.deployments.push({ t: this.elapsedMs, troopType, x: Math.floor(x), y: Math.floor(y) });
    this.events.push({ kind: 'deploy', troopType, x: Math.floor(x), y: Math.floor(y), entityId: id });
    return { ok: true, entityId: id };
  }

  /** Advances the simulation by one tick. Returns true when the battle has ended. */
  tick(dtMs: number = BATTLE_TICK_MS): boolean {
    if (this.ended) return true;
    this.elapsedMs += dtMs;
    const dt = dtMs / 1000;

    for (const t of this.troops) {
      if (t.dead) continue;
      t.cooldownMs = Math.max(0, t.cooldownMs - dtMs);
      t.repathIn = Math.max(0, t.repathIn - dtMs);
      let target = t.targetId ? this.buildingById(t.targetId) : null;
      if (!target || target.destroyed) {
        target = this.pickTarget(t);
        t.targetId = target?.id ?? null;
        t.finalTargetId = null;
        t.path = [];
        if (!target) continue;
        if (!t.isFlying) this.planPath(t, target);
      }
      if (this.withinRange(t, target)) {
        if (t.cooldownMs <= 0) {
          this.troopAttack(t, target);
          t.cooldownMs = t.attackSpeedMs;
        }
        continue;
      }
      // move
      if (t.isFlying) {
        this.moveToward(t, target.cx, target.cy, dt);
      } else {
        if (t.path.length === 0 && t.repathIn <= 0) this.planPath(t, target);
        const next = t.path[0];
        if (!next) {
          this.moveToward(t, target.cx, target.cy, dt);
        } else {
          const nx = next.x + 0.5;
          const ny = next.y + 0.5;
          this.moveToward(t, nx, ny, dt);
          if (Math.abs(t.x - nx) < 0.05 && Math.abs(t.y - ny) < 0.05) t.path.shift();
        }
      }
    }

    for (const b of this.buildings) {
      if (b.destroyed || !b.isDefense || b.damage <= 0) continue;
      b.cooldownMs = Math.max(0, b.cooldownMs - dtMs);
      if (b.cooldownMs > 0) continue;
      const victim = this.pickVictim(b);
      if (!victim) continue;
      b.cooldownMs = b.attackSpeedMs;
      if (b.splashRadius > 0) {
        for (const t of this.troops) {
          if (t.dead) continue;
          if (!this.canTarget(b.targets, t)) continue;
          if (dist(t.x, t.y, victim.x, victim.y) <= b.splashRadius) this.damageTroop(t, b.damage);
        }
      } else {
        this.damageTroop(victim, b.damage);
      }
    }

    const stars = starsFor(this.destructionPercent, this.townHallDestroyed);
    if (stars !== this.stars) {
      this.stars = stars;
      this.events.push({ kind: 'star', stars });
    }

    const armyLeft = Object.values(this.remainingArmy).some((n) => n > 0);
    const troopsAlive = this.troops.some((t) => !t.dead);
    if (this.destructionPercent >= 100 || this.elapsedMs >= this.durationMs || (!armyLeft && !troopsAlive && this.troops.length > 0)) {
      this.ended = true;
    }
    return this.ended;
  }

  /** Attacker chose to end the battle early. */
  end(): void {
    this.ended = true;
  }

  state(battleId: string): BattleStateDTO {
    return {
      battleId,
      elapsedMs: this.elapsedMs,
      remainingMs: Math.max(0, this.durationMs - this.elapsedMs),
      troops: this.troops.filter((t) => !t.dead).map((t) => ({ id: t.id, troopType: t.troopType, x: round2(t.x), y: round2(t.y), hp: Math.round(t.hp), maxHp: t.maxHp, targetId: t.targetId })),
      buildings: this.buildings.map((b) => ({ id: b.id, hp: Math.max(0, Math.round(b.hp)), maxHp: b.maxHp, destroyed: b.destroyed })),
      destructionPercent: this.destructionPercent,
      stars: this.stars,
      lootGold: this.lootGold,
      lootElixir: this.lootElixir,
      remainingArmy: { ...this.remainingArmy },
    };
  }

  result(attackerTrophies: number, defenderTrophies: number, trophyFn: (a: number, d: number, stars: number) => [number, number], defenderTh: number): BattleResultDTO {
    const stars = starsFor(this.destructionPercent, this.townHallDestroyed);
    const [attackerTrophyDelta, defenderTrophyDelta] = trophyFn(attackerTrophies, defenderTrophies, stars);
    return {
      stars,
      destructionPercent: this.destructionPercent,
      lootGold: this.lootGold,
      lootElixir: this.lootElixir,
      attackerTrophyDelta,
      defenderTrophyDelta,
      xpGained: battleXp(stars, this.destructionPercent, defenderTh),
      durationMs: this.elapsedMs,
      troopsUsed: { ...this.troopsUsed },
      victory: stars >= 1,
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private buildingById(id: string): SimBuilding | undefined {
    return this.buildings.find((b) => b.id === id);
  }

  private pickTarget(t: SimTroop): SimBuilding | null {
    const alive = this.buildings.filter((b) => !b.destroyed);
    let pool: SimBuilding[] = [];
    if (t.preference === 'wall') pool = alive.filter((b) => b.isWall);
    else if (t.preference === 'defense') pool = alive.filter((b) => b.isDefense);
    else if (t.preference === 'resource') pool = alive.filter((b) => b.category === 'resource' || b.category === 'storage');
    if (pool.length === 0) pool = alive.filter((b) => !b.isWall);
    if (pool.length === 0) pool = alive;
    if (pool.length === 0) return null;
    let best: SimBuilding | null = null;
    let bestD = Infinity;
    for (const b of pool) {
      const d = this.distanceToFootprint(t.x, t.y, b) + this.rng.next() * 0.01;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private planPath(t: SimTroop, target: SimBuilding) {
    t.repathIn = 1500;
    const goals = new Set<number>();
    const reach = Math.max(1, Math.floor(t.range + 0.5));
    for (let y = target.y - reach; y < target.y + target.size + reach; y++) {
      for (let x = target.x - reach; x < target.x + target.size + reach; x++) {
        if (x < 0 || y < 0 || x >= this.gridSize || y >= this.gridSize) continue;
        const c = this.grid[y * this.gridSize + x];
        if (c.kind === 1) continue;
        if (this.distanceToFootprint(x + 0.5, y + 0.5, target) <= t.range + 0.5) goals.add(y * this.gridSize + x);
      }
    }
    if (goals.size === 0) {
      t.path = [];
      return;
    }
    const res = findPath(this.grid, this.gridSize, Math.floor(t.x), Math.floor(t.y), goals);
    if (!res) {
      t.path = [];
      return;
    }
    if (res.firstWall && res.firstWall.wallId !== target.id) {
      // walk up to the wall, then attack it before continuing
      const idx = res.path.findIndex((p) => p.x === res.firstWall!.x && p.y === res.firstWall!.y);
      t.path = res.path.slice(0, Math.max(0, idx));
      t.finalTargetId = target.id;
      t.targetId = res.firstWall.wallId;
    } else {
      t.path = res.path;
    }
  }

  private withinRange(t: SimTroop, b: SimBuilding): boolean {
    return this.distanceToFootprint(t.x, t.y, b) <= t.range + 0.3;
  }

  private distanceToFootprint(px: number, py: number, b: SimBuilding): number {
    const dx = Math.max(b.x - px, 0, px - (b.x + b.size));
    const dy = Math.max(b.y - py, 0, py - (b.y + b.size));
    return Math.sqrt(dx * dx + dy * dy);
  }

  private moveToward(t: SimTroop, tx: number, ty: number, dt: number) {
    const dx = tx - t.x;
    const dy = ty - t.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-6) return;
    const step = Math.min(d, t.moveSpeed * dt);
    t.x += (dx / d) * step;
    t.y += (dy / d) * step;
  }

  private troopAttack(t: SimTroop, target: SimBuilding) {
    const mult = target.isWall ? t.wallMult : 1;
    this.damageBuilding(target, t.damage * mult);
    if (t.splashRadius > 0) {
      for (const b of this.buildings) {
        if (b.destroyed || b.id === target.id) continue;
        if (this.distanceToFootprint(target.cx, target.cy, b) <= t.splashRadius) this.damageBuilding(b, t.damage * 0.5 * (b.isWall ? t.wallMult : 1));
      }
    }
    if (t.suicide) {
      t.dead = true;
      t.hp = 0;
      this.events.push({ kind: 'troop_died', entityId: t.id });
    }
    if (target.destroyed) {
      if (t.finalTargetId) {
        t.targetId = t.finalTargetId;
        t.finalTargetId = null;
        t.path = [];
        t.repathIn = 0;
      } else {
        t.targetId = null;
      }
    }
  }

  private damageBuilding(b: SimBuilding, dmg: number) {
    if (b.destroyed) return;
    b.hp -= dmg;
    if (b.hp <= 0) {
      b.hp = 0;
      b.destroyed = true;
      this.lootGold += b.storedGold;
      this.lootElixir += b.storedElixir;
      this.events.push({ kind: 'building_destroyed', buildingId: b.id, buildingType: b.type });
      this.rebuildGrid();
      for (const t of this.troops) if (!t.dead && !t.isFlying) t.repathIn = 0;
    }
  }

  private canTarget(mode: 'ground' | 'air' | 'both', t: SimTroop): boolean {
    if (mode === 'both') return true;
    return mode === 'air' ? t.isFlying : !t.isFlying;
  }

  private pickVictim(b: SimBuilding): SimTroop | null {
    let best: SimTroop | null = null;
    let bestD = Infinity;
    for (const t of this.troops) {
      if (t.dead || !this.canTarget(b.targets, t)) continue;
      const d = dist(t.x, t.y, b.cx, b.cy);
      if (d > b.range || d < b.minRange) continue;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private damageTroop(t: SimTroop, dmg: number) {
    if (t.dead) return;
    t.hp -= dmg;
    if (t.hp <= 0) {
      t.hp = 0;
      t.dead = true;
      this.events.push({ kind: 'troop_died', entityId: t.id });
    }
  }
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Replays a recorded deployment stream from a seed and returns the final simulation.
 * Used by the API to audit a result the game server reported.
 */
export function replayBattle(opts: SimulationOptions, deployments: DeploymentRecord[], endedAtMs?: number): BattleSimulation {
  const sim = new BattleSimulation(opts);
  const queue = [...deployments].sort((a, b) => a.t - b.t);
  let i = 0;
  while (!sim.ended) {
    while (i < queue.length && queue[i].t <= sim.elapsedMs) {
      sim.deploy(queue[i].troopType, queue[i].x, queue[i].y);
      i++;
    }
    if (endedAtMs !== undefined && sim.elapsedMs >= endedAtMs) {
      sim.end();
      break;
    }
    sim.tick();
  }
  return sim;
}
