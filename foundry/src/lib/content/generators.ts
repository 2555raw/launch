/**
 * Generator catalog. Everything the game knows about a building lives here;
 * the database mirrors these rows so new generators are added by appending to
 * this array (and restarting the server, which upserts the catalog).
 */
export type GeneratorCategory = "cursor" | "extraction" | "industry" | "finance" | "mega";

export interface GeneratorDef {
  id: string;
  name: string;
  category: GeneratorCategory;
  /** Price of the first unit. Each additional unit costs 15% more. */
  baseCost: number;
  /** Units produced per second by one level-1 unit. */
  baseProduction: number;
  /** How much of this generator's output counts toward burn power (1 = full). */
  burnWeight: number;
  /** Total production required before the generator shows up in the shop. */
  unlockAt: number;
  flavor: string;
  /** Short word shown on the generator's world row. */
  icon: GeneratorIcon;
}

export type GeneratorIcon =
  | "cursor"
  | "pick"
  | "mine"
  | "rig"
  | "ingot"
  | "refinery"
  | "factory"
  | "trade"
  | "bank"
  | "exchange"
  | "vault"
  | "complex"
  | "orbital";

export const COST_GROWTH = 1.15;
export const LEVEL_COST_GROWTH = 4;
export const LEVEL_BONUS = 0.5;

export const GENERATORS: GeneratorDef[] = [
  { id: "cursor", name: "Cursor", category: "cursor", baseCost: 15, baseProduction: 1, burnWeight: 0.5, unlockAt: 0, icon: "cursor", flavor: "A hired hand that taps the deposit for you." },
  { id: "cursor2", name: "Cursor II", category: "cursor", baseCost: 100, baseProduction: 10, burnWeight: 0.6, unlockAt: 50, icon: "cursor", flavor: "Two hands, twice the tempo, better gloves." },
  { id: "cursor3", name: "Advanced Cursor", category: "cursor", baseCost: 1_000, baseProduction: 100, burnWeight: 0.7, unlockAt: 500, icon: "cursor", flavor: "Servo-driven clicking at industrial cadence." },
  { id: "miner", name: "Miner", category: "extraction", baseCost: 8_000, baseProduction: 600, burnWeight: 0.8, unlockAt: 3_000, icon: "pick", flavor: "Works the seam with a pick and a headlamp." },
  { id: "goldmine", name: "Gold Mine", category: "extraction", baseCost: 50_000, baseProduction: 3_000, burnWeight: 0.9, unlockAt: 20_000, icon: "mine", flavor: "Shafts, carts and a very long ladder." },
  { id: "oilrig", name: "Oil Rig", category: "extraction", baseCost: 300_000, baseProduction: 15_000, burnWeight: 1.0, unlockAt: 120_000, icon: "rig", flavor: "Pumps crude from the basin around the clock." },
  { id: "silvermine", name: "Silver Mine", category: "extraction", baseCost: 2_000_000, baseProduction: 80_000, burnWeight: 1.0, unlockAt: 800_000, icon: "ingot", flavor: "Deep veins, bright returns." },
  { id: "refinery", name: "Refinery", category: "industry", baseCost: 12_000_000, baseProduction: 400_000, burnWeight: 1.1, unlockAt: 5_000_000, icon: "refinery", flavor: "Turns raw ore and crude into graded product." },
  { id: "factory", name: "Factory", category: "industry", baseCost: 80_000_000, baseProduction: 2_200_000, burnWeight: 1.2, unlockAt: 30_000_000, icon: "factory", flavor: "Stamps, forges and ships. Never sleeps." },
  { id: "tradingpost", name: "Trading Post", category: "finance", baseCost: 500_000_000, baseProduction: 12_000_000, burnWeight: 1.3, unlockAt: 200_000_000, icon: "trade", flavor: "Where the commodity finds its price." },
  { id: "bank", name: "Bank", category: "finance", baseCost: 3_500_000_000, baseProduction: 70_000_000, burnWeight: 1.4, unlockAt: 1_500_000_000, icon: "bank", flavor: "Lends against reserves, collects on everything." },
  { id: "exchange", name: "Commodity Exchange", category: "finance", baseCost: 25_000_000_000, baseProduction: 400_000_000, burnWeight: 1.5, unlockAt: 10_000_000_000, icon: "exchange", flavor: "Futures, options and a very loud floor." },
  { id: "vault", name: "Vault", category: "mega", baseCost: 200_000_000_000, baseProduction: 2_500_000_000, burnWeight: 1.7, unlockAt: 80_000_000_000, icon: "vault", flavor: "Stores so much that storing it makes more." },
  { id: "complex", name: "Industrial Complex", category: "mega", baseCost: 1_500_000_000_000, baseProduction: 15_000_000_000, burnWeight: 1.9, unlockAt: 600_000_000_000, icon: "complex", flavor: "A city that exists only to produce." },
  { id: "orbital", name: "Orbital Smelter", category: "mega", baseCost: 12_000_000_000_000, baseProduction: 100_000_000_000, burnWeight: 2.2, unlockAt: 5_000_000_000_000, icon: "orbital", flavor: "Refines asteroid ore in zero gravity." },
];

export const GENERATOR_BY_ID: Record<string, GeneratorDef> = Object.fromEntries(
  GENERATORS.map((g) => [g.id, g]),
);
