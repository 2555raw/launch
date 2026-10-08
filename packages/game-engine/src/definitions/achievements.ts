export interface AchievementTier {
  target: number;
  gems: number;
  xp: number;
}

export interface AchievementDefinition {
  key: string;
  name: string;
  description: string;
  /** which player statistic the achievement tracks */
  stat: 'attacksWon' | 'trophies' | 'buildingsUpgraded' | 'troopsTrained' | 'lootGold' | 'lootElixir' | 'defensesWon' | 'donations' | 'townHallLevel';
  tiers: AchievementTier[];
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { key: 'raider', name: 'Raider', description: 'Win attacks against other players.', stat: 'attacksWon', tiers: [{ target: 5, gems: 5, xp: 20 }, { target: 50, gems: 20, xp: 100 }, { target: 500, gems: 100, xp: 500 }] },
  { key: 'ascendant', name: 'Ascendant', description: 'Reach trophy milestones.', stat: 'trophies', tiers: [{ target: 200, gems: 10, xp: 30 }, { target: 1000, gems: 50, xp: 150 }, { target: 3000, gems: 250, xp: 800 }] },
  { key: 'architect', name: 'Architect', description: 'Complete building upgrades.', stat: 'buildingsUpgraded', tiers: [{ target: 10, gems: 5, xp: 20 }, { target: 100, gems: 30, xp: 150 }, { target: 1000, gems: 150, xp: 700 }] },
  { key: 'drillmaster', name: 'Drillmaster', description: 'Train troops.', stat: 'troopsTrained', tiers: [{ target: 50, gems: 5, xp: 15 }, { target: 1000, gems: 25, xp: 120 }, { target: 20000, gems: 120, xp: 600 }] },
  { key: 'gold_hoarder', name: 'Gold Hoarder', description: 'Plunder gold from your enemies.', stat: 'lootGold', tiers: [{ target: 10000, gems: 5, xp: 20 }, { target: 500000, gems: 40, xp: 200 }, { target: 10000000, gems: 200, xp: 900 }] },
  { key: 'elixir_hoarder', name: 'Elixir Hoarder', description: 'Plunder elixir from your enemies.', stat: 'lootElixir', tiers: [{ target: 10000, gems: 5, xp: 20 }, { target: 500000, gems: 40, xp: 200 }, { target: 10000000, gems: 200, xp: 900 }] },
  { key: 'bulwark', name: 'Bulwark', description: 'Successfully defend your village.', stat: 'defensesWon', tiers: [{ target: 5, gems: 5, xp: 20 }, { target: 50, gems: 25, xp: 120 }, { target: 500, gems: 120, xp: 600 }] },
  { key: 'benefactor', name: 'Benefactor', description: 'Donate troops to clanmates.', stat: 'donations', tiers: [{ target: 25, gems: 5, xp: 20 }, { target: 500, gems: 30, xp: 150 }, { target: 5000, gems: 150, xp: 700 }] },
  { key: 'foundations', name: 'Foundations', description: 'Upgrade your Town Hall.', stat: 'townHallLevel', tiers: [{ target: 3, gems: 10, xp: 40 }, { target: 5, gems: 50, xp: 200 }, { target: 8, gems: 300, xp: 1000 }] },
];

export function getAchievement(key: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((a) => a.key === key);
}
