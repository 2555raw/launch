/**
 * Achievement catalog. `kind` names the metric checked by the server after
 * every state change; `threshold` is the value that unlocks it.
 */
export type AchievementKind =
  | "clicks"
  | "cursors"
  | "produced"
  | "burn_power"
  | "buildings"
  | "generator_types"
  | "upgrades"
  | "per_sec"
  | "global_burned";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  kind: AchievementKind;
  threshold: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_click", name: "First Strike", description: "Click the deposit for the first time.", kind: "clicks", threshold: 1 },
  { id: "clicks_100", name: "Warm Hands", description: "Click 100 times.", kind: "clicks", threshold: 100 },
  { id: "clicks_1k", name: "Carpal Commodities", description: "Click 1,000 times.", kind: "clicks", threshold: 1_000 },
  { id: "clicks_10k", name: "Relentless", description: "Click 10,000 times.", kind: "clicks", threshold: 10_000 },
  { id: "clicks_100k", name: "Machine Spirit", description: "Click 100,000 times.", kind: "clicks", threshold: 100_000 },
  { id: "first_cursor", name: "Hired Help", description: "Buy your first Cursor.", kind: "cursors", threshold: 1 },
  { id: "cursors_100", name: "Click Farm", description: "Own 100 cursors of any tier.", kind: "cursors", threshold: 100 },
  { id: "cursors_500", name: "Thousand Hands", description: "Own 500 cursors of any tier.", kind: "cursors", threshold: 500 },
  { id: "produced_1m", name: "Millionaire", description: "Produce 1 million units in total.", kind: "produced", threshold: 1_000_000 },
  { id: "produced_1b", name: "Billionaire", description: "Produce 1 billion units in total.", kind: "produced", threshold: 1_000_000_000 },
  { id: "produced_1t", name: "Trillionaire", description: "Produce 1 trillion units in total.", kind: "produced", threshold: 1_000_000_000_000 },
  { id: "first_burn", name: "First Burn", description: "Contribute your first burn power.", kind: "burn_power", threshold: 1 },
  { id: "burn_1m", name: "Pyre", description: "Contribute 1 million burn power.", kind: "burn_power", threshold: 1_000_000 },
  { id: "burn_1b", name: "Inferno", description: "Contribute 1 billion burn power.", kind: "burn_power", threshold: 1_000_000_000 },
  { id: "industrialist", name: "Industrialist", description: "Own 100 buildings.", kind: "buildings", threshold: 100 },
  { id: "tycoon", name: "Commodity Tycoon", description: "Own at least one of every generator.", kind: "generator_types", threshold: 15 },
  { id: "conglomerate", name: "Conglomerate", description: "Own 500 buildings.", kind: "buildings", threshold: 500 },
  { id: "upgrades_10", name: "Optimizer", description: "Buy 10 upgrades.", kind: "upgrades", threshold: 10 },
  { id: "persec_1m", name: "Steady Flow", description: "Reach 1 million production per second.", kind: "per_sec", threshold: 1_000_000 },
  { id: "persec_1b", name: "Torrent", description: "Reach 1 billion production per second.", kind: "per_sec", threshold: 1_000_000_000 },
  { id: "global_100m", name: "Supply Shock", description: "Be part of the community when 100M supply has been burned.", kind: "global_burned", threshold: 100_000_000 },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
