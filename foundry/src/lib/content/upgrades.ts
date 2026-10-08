/**
 * Upgrade catalog. Effects are interpreted by src/lib/economy.ts, so adding a
 * new kind of upgrade means adding a branch there and a row here.
 */
export type UpgradeEffect =
  | { type: "click_mult"; value: number }
  | { type: "click_prod_pct"; value: number }
  | { type: "autoclick"; cps: number }
  | { type: "generator_mult"; generatorId: string; value: number }
  | { type: "category_mult"; category: string; value: number }
  | { type: "global_mult"; value: number }
  | { type: "burn_mult"; value: number };

export type UpgradeRequirement =
  | { type: "clicks"; value: number }
  | { type: "generator_count"; generatorId: string; value: number }
  | { type: "produced"; value: number }
  | { type: "burn_power"; value: number };

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: UpgradeEffect;
  requires: UpgradeRequirement;
  tier: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: "pickaxes", name: "Reinforced Pickaxes", description: "+10% click power", cost: 100, effect: { type: "click_mult", value: 1.1 }, requires: { type: "clicks", value: 10 }, tier: 1 },
  { id: "steady_hands", name: "Steady Hands", description: "+25% Cursor production", cost: 500, effect: { type: "category_mult", category: "cursor", value: 1.25 }, requires: { type: "generator_count", generatorId: "cursor", value: 10 }, tier: 1 },
  { id: "twin_cursors", name: "Twin Cursors", description: "+25% Cursor production", cost: 5_000, effect: { type: "category_mult", category: "cursor", value: 1.25 }, requires: { type: "generator_count", generatorId: "cursor", value: 25 }, tier: 2 },
  { id: "carbon_cursors", name: "Carbon Cursors", description: "+50% Cursor production", cost: 50_000, effect: { type: "category_mult", category: "cursor", value: 1.5 }, requires: { type: "generator_count", generatorId: "cursor", value: 50 }, tier: 3 },
  { id: "auto_click", name: "Auto Click", description: "Clicks the coin once per second for you", cost: 20_000, effect: { type: "autoclick", cps: 1 }, requires: { type: "clicks", value: 500 }, tier: 2 },
  { id: "auto_click2", name: "Auto Click II", description: "+4 automatic clicks per second", cost: 2_000_000, effect: { type: "autoclick", cps: 4 }, requires: { type: "clicks", value: 5_000 }, tier: 4 },
  { id: "royalties", name: "Click Royalties", description: "Each click also earns 1% of your production per second", cost: 100_000, effect: { type: "click_prod_pct", value: 0.01 }, requires: { type: "clicks", value: 1_000 }, tier: 3 },
  { id: "royalties2", name: "Click Royalties II", description: "Each click also earns 2% of your production per second", cost: 10_000_000, effect: { type: "click_prod_pct", value: 0.02 }, requires: { type: "clicks", value: 10_000 }, tier: 5 },
  { id: "power_click", name: "Power Clicking", description: "+50% click power", cost: 1_000_000, effect: { type: "click_mult", value: 1.5 }, requires: { type: "clicks", value: 2_500 }, tier: 4 },
  { id: "overclock", name: "Overclocked Mouse", description: "2x click power", cost: 100_000_000, effect: { type: "click_mult", value: 2 }, requires: { type: "clicks", value: 25_000 }, tier: 6 },
  { id: "deep_shafts", name: "Deeper Shafts", description: "+50% Miner production", cost: 40_000, effect: { type: "generator_mult", generatorId: "miner", value: 1.5 }, requires: { type: "generator_count", generatorId: "miner", value: 10 }, tier: 2 },
  { id: "explosive", name: "Explosive Mining", description: "2x Miner production", cost: 600_000, effect: { type: "generator_mult", generatorId: "miner", value: 2 }, requires: { type: "generator_count", generatorId: "miner", value: 25 }, tier: 3 },
  { id: "prospecting", name: "Prospecting", description: "+50% Gold Mine production", cost: 250_000, effect: { type: "generator_mult", generatorId: "goldmine", value: 1.5 }, requires: { type: "generator_count", generatorId: "goldmine", value: 10 }, tier: 3 },
  { id: "fracking", name: "Pressure Fracking", description: "+50% Oil Rig production", cost: 1_500_000, effect: { type: "generator_mult", generatorId: "oilrig", value: 1.5 }, requires: { type: "generator_count", generatorId: "oilrig", value: 10 }, tier: 4 },
  { id: "silver_veins", name: "Silver Veins", description: "+50% Silver Mine production", cost: 10_000_000, effect: { type: "generator_mult", generatorId: "silvermine", value: 1.5 }, requires: { type: "generator_count", generatorId: "silvermine", value: 10 }, tier: 4 },
  { id: "cracking", name: "Catalytic Cracking", description: "+50% Refinery production", cost: 60_000_000, effect: { type: "generator_mult", generatorId: "refinery", value: 1.5 }, requires: { type: "generator_count", generatorId: "refinery", value: 10 }, tier: 5 },
  { id: "assembly", name: "Assembly Lines", description: "+50% Factory production", cost: 400_000_000, effect: { type: "generator_mult", generatorId: "factory", value: 1.5 }, requires: { type: "generator_count", generatorId: "factory", value: 10 }, tier: 5 },
  { id: "arbitrage", name: "Arbitrage Desk", description: "+50% Trading Post production", cost: 2_500_000_000, effect: { type: "generator_mult", generatorId: "tradingpost", value: 1.5 }, requires: { type: "generator_count", generatorId: "tradingpost", value: 10 }, tier: 6 },
  { id: "reserves", name: "Fractional Reserves", description: "+50% Bank production", cost: 17_500_000_000, effect: { type: "generator_mult", generatorId: "bank", value: 1.5 }, requires: { type: "generator_count", generatorId: "bank", value: 10 }, tier: 6 },
  { id: "dark_pools", name: "Dark Pools", description: "+50% Commodity Exchange production", cost: 125_000_000_000, effect: { type: "generator_mult", generatorId: "exchange", value: 1.5 }, requires: { type: "generator_count", generatorId: "exchange", value: 10 }, tier: 7 },
  { id: "expansion", name: "Industrial Expansion", description: "+10% global production", cost: 1_000_000, effect: { type: "global_mult", value: 1.1 }, requires: { type: "produced", value: 500_000 }, tier: 3 },
  { id: "multiplier", name: "Commodity Multiplier", description: "+25% global production", cost: 50_000_000, effect: { type: "global_mult", value: 1.25 }, requires: { type: "produced", value: 25_000_000 }, tier: 5 },
  { id: "mandate", name: "Megaproject Mandate", description: "+50% global production", cost: 5_000_000_000, effect: { type: "global_mult", value: 1.5 }, requires: { type: "produced", value: 2_000_000_000 }, tier: 6 },
  { id: "burn1", name: "Burn Protocol I", description: "2x burn efficiency: your production counts double toward the supply burn", cost: 25_000, effect: { type: "burn_mult", value: 2 }, requires: { type: "burn_power", value: 1_000 }, tier: 2 },
  { id: "burn2", name: "Burn Protocol II", description: "2x burn efficiency", cost: 2_500_000, effect: { type: "burn_mult", value: 2 }, requires: { type: "burn_power", value: 1_000_000 }, tier: 4 },
  { id: "burn3", name: "Burn Protocol III", description: "2x burn efficiency", cost: 250_000_000, effect: { type: "burn_mult", value: 2 }, requires: { type: "burn_power", value: 100_000_000 }, tier: 6 },
  { id: "burn4", name: "Burn Protocol IV", description: "2x burn efficiency", cost: 25_000_000_000, effect: { type: "burn_mult", value: 2 }, requires: { type: "burn_power", value: 10_000_000_000 }, tier: 7 },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
