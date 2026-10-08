/**
 * Pure game math shared by client and server. The server is the only place
 * these functions change persistent state; the client uses them for
 * prediction and display between syncs.
 */
import { COST_GROWTH, GENERATORS, GENERATOR_BY_ID, LEVEL_BONUS, LEVEL_COST_GROWTH, type GeneratorDef } from "./content/generators";
import { UPGRADES, UPGRADE_BY_ID, type UpgradeRequirement } from "./content/upgrades";

export interface OwnedGenerator {
  id: string;
  count: number;
  level: number;
}

export interface GameplayConfig {
  clickMultiplier: number;
  cursorMultiplier: number;
  generatorMultiplier: number;
}

export interface BurnConfig {
  initialSupply: number;
  maxBurnPercent: number;
  burnFormula: string;
  burnRate: number;
  burnHalfLife: number;
}

export interface GeneratorRate {
  id: string;
  count: number;
  level: number;
  perSec: number;
  burnPerSec: number;
  eachPerSec: number;
}

export interface Rates {
  productionPerSec: number;
  burnPerSec: number;
  clickPower: number;
  clickBurn: number;
  burnMultiplier: number;
  autoClicksPerSec: number;
  globalMultiplier: number;
  generators: GeneratorRate[];
}

export const DEFAULT_GAMEPLAY: GameplayConfig = { clickMultiplier: 1, cursorMultiplier: 1, generatorMultiplier: 1 };

export function generatorCost(def: GeneratorDef, owned: number): number {
  return Math.ceil(def.baseCost * Math.pow(COST_GROWTH, Math.max(0, owned)));
}

/** Cost of buying `qty` units starting from `owned`. */
export function generatorBulkCost(def: GeneratorDef, owned: number, qty: number): number {
  let total = 0;
  for (let i = 0; i < qty; i++) total += generatorCost(def, owned + i);
  return total;
}

/** How many units can be bought with `balance`. */
export function maxAffordable(def: GeneratorDef, owned: number, balance: number, cap = 1000): number {
  let n = 0;
  let spent = 0;
  while (n < cap) {
    const c = generatorCost(def, owned + n);
    if (spent + c > balance) break;
    spent += c;
    n++;
  }
  return n;
}

export function levelUpCost(def: GeneratorDef, level: number): number {
  return Math.ceil(def.baseCost * 10 * Math.pow(LEVEL_COST_GROWTH, Math.max(0, level - 1)));
}

export function levelMultiplier(level: number): number {
  return 1 + LEVEL_BONUS * Math.max(0, level - 1);
}

/**
 * Derive every rate from what the player owns. Deterministic and side-effect
 * free; the server stores the results as cached columns.
 */
export function computeRates(owned: OwnedGenerator[], upgradeIds: string[], config: GameplayConfig = DEFAULT_GAMEPLAY): Rates {
  let clickMult = 1;
  let clickProdPct = 0;
  let autoClicks = 0;
  let globalMult = 1;
  let burnMult = 1;
  const genMult: Record<string, number> = {};
  const catMult: Record<string, number> = {};

  for (const id of upgradeIds) {
    const u = UPGRADE_BY_ID[id];
    if (!u) continue;
    const e = u.effect;
    switch (e.type) {
      case "click_mult": clickMult *= e.value; break;
      case "click_prod_pct": clickProdPct += e.value; break;
      case "autoclick": autoClicks += e.cps; break;
      case "generator_mult": genMult[e.generatorId] = (genMult[e.generatorId] ?? 1) * e.value; break;
      case "category_mult": catMult[e.category] = (catMult[e.category] ?? 1) * e.value; break;
      case "global_mult": globalMult *= e.value; break;
      case "burn_mult": burnMult *= e.value; break;
    }
  }

  const ownedById = new Map(owned.map((o) => [o.id, o]));
  const generators: GeneratorRate[] = [];
  let productionPerSec = 0;
  let burnPerSec = 0;

  for (const def of GENERATORS) {
    const o = ownedById.get(def.id);
    const count = o?.count ?? 0;
    const level = o?.level ?? 1;
    const each =
      def.baseProduction *
      levelMultiplier(level) *
      (genMult[def.id] ?? 1) *
      (catMult[def.category] ?? 1) *
      globalMult *
      config.generatorMultiplier *
      (def.category === "cursor" ? config.cursorMultiplier : 1);
    const perSec = each * count;
    const gBurn = perSec * def.burnWeight * burnMult;
    productionPerSec += perSec;
    burnPerSec += gBurn;
    generators.push({ id: def.id, count, level, perSec, burnPerSec: gBurn, eachPerSec: each });
  }

  const baseClick = 1 * clickMult * config.clickMultiplier;
  const clickPower = baseClick + productionPerSec * clickProdPct;
  const clickBurn = clickPower * burnMult;

  // Auto clicks are modelled as passive production at click weight.
  const autoProd = autoClicks * clickPower;
  productionPerSec += autoProd;
  burnPerSec += autoProd * burnMult;

  return { productionPerSec, burnPerSec, clickPower, clickBurn, burnMultiplier: burnMult, autoClicksPerSec: autoClicks, globalMultiplier: globalMult, generators };
}

export interface RequirementContext {
  totalClicks: number;
  totalProduced: number;
  burnPower: number;
  owned: OwnedGenerator[];
}

export function requirementMet(req: UpgradeRequirement, ctx: RequirementContext): boolean {
  switch (req.type) {
    case "clicks": return ctx.totalClicks >= req.value;
    case "produced": return ctx.totalProduced >= req.value;
    case "burn_power": return ctx.burnPower >= req.value;
    case "generator_count": return (ctx.owned.find((o) => o.id === req.generatorId)?.count ?? 0) >= req.value;
  }
}

export function describeRequirement(req: UpgradeRequirement): string {
  switch (req.type) {
    case "clicks": return `${req.value.toLocaleString("en-US")} clicks`;
    case "produced": return `${req.value.toLocaleString("en-US")} produced`;
    case "burn_power": return `${req.value.toLocaleString("en-US")} burn power`;
    case "generator_count": return `${req.value} × ${GENERATOR_BY_ID[req.generatorId]?.name ?? req.generatorId}`;
  }
}

export function availableUpgrades(ownedUpgrades: string[], ctx: RequirementContext) {
  const have = new Set(ownedUpgrades);
  return UPGRADES.filter((u) => !have.has(u.id) && requirementMet(u.requires, ctx));
}

// ---------------------------------------------------------------------------
// Burn formula
// ---------------------------------------------------------------------------

export function maxBurn(cfg: BurnConfig): number {
  const pct = clamp(cfg.maxBurnPercent, 0, 100);
  return Math.max(0, cfg.initialSupply) * (pct / 100);
}

/**
 * Supply burned for a given total burn power. Always within [0, maxBurn] and
 * therefore never above the initial supply, whatever the inputs.
 *
 *   linear:      burned = burnRate × burnPower                      (capped at maxBurn)
 *   asymptotic:  burned = maxBurn × (1 − 2^(−burnPower / halfLife)) (approaches maxBurn)
 */
export function burnedSupply(cfg: BurnConfig, totalBurnPower: number): number {
  const cap = maxBurn(cfg);
  const power = Math.max(0, Number.isFinite(totalBurnPower) ? totalBurnPower : 0);
  let burned: number;
  if (cfg.burnFormula === "asymptotic") {
    const half = cfg.burnHalfLife > 0 ? cfg.burnHalfLife : 1;
    burned = cap * (1 - Math.pow(2, -power / half));
  } else {
    burned = Math.max(0, cfg.burnRate) * power;
  }
  return clamp(burned, 0, cap);
}

export function burnSummary(cfg: BurnConfig, totalBurnPower: number) {
  const burned = Math.floor(burnedSupply(cfg, totalBurnPower));
  const initial = Math.max(0, cfg.initialSupply);
  const finalSupply = Math.max(0, initial - burned);
  const burnPercent = initial > 0 ? (burned / initial) * 100 : 0;
  return { initialSupply: initial, burnedSupply: burned, finalSupply, burnPercent, maxBurn: maxBurn(cfg) };
}

export function describeFormula(cfg: BurnConfig): string {
  if (cfg.burnFormula === "asymptotic") {
    return `burned = maxBurn × (1 − 2^(−burnPower / ${cfg.burnHalfLife.toLocaleString("en-US")}))`;
  }
  return `burned = min(maxBurn, ${cfg.burnRate} × burnPower)`;
}

export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
