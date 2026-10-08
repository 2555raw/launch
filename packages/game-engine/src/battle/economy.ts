import type { BattleSnapshot } from '@launch/types';

/** Percentage of stored resources that can be looted, by defender town hall level. */
export const LOOT_PERCENT_BY_TH = [0.2, 0.2, 0.2, 0.2, 0.18, 0.16, 0.14, 0.12];
export const LOOT_CAP_BY_TH = [1000, 2500, 10000, 50000, 100000, 150000, 200000, 250000];

/** Attacking much weaker villages yields less. */
export function lootMultiplier(attackerTh: number, defenderTh: number): number {
  const diff = attackerTh - defenderTh;
  if (diff <= 0) return 1;
  if (diff === 1) return 0.9;
  if (diff === 2) return 0.5;
  if (diff === 3) return 0.25;
  return 0.05;
}

/**
 * Distributes the defender's lootable resources across the buildings in the snapshot so the
 * attacker earns loot by destroying specific buildings. Collectors hold half of what they have
 * accrued; storages and the town hall split the stored resources.
 */
export function distributeLoot(
  snapshot: BattleSnapshot,
  defender: { gold: number; elixir: number },
  collectorsAccrued: Record<string, number>,
  attackerTh: number,
): BattleSnapshot {
  const th = Math.min(Math.max(snapshot.townHallLevel, 1), 8);
  const mult = lootMultiplier(attackerTh, th);
  const pct = LOOT_PERCENT_BY_TH[th - 1];
  const cap = LOOT_CAP_BY_TH[th - 1];
  const lootGold = Math.floor(Math.min(defender.gold * pct, cap) * mult);
  const lootElixir = Math.floor(Math.min(defender.elixir * pct, cap) * mult);

  const goldHolders = snapshot.buildings.filter((b) => b.type === 'gold_storage' || b.type === 'town_hall');
  const elixirHolders = snapshot.buildings.filter((b) => b.type === 'elixir_storage' || b.type === 'town_hall');
  const buildings = snapshot.buildings.map((b) => ({ ...b, storedGold: 0, storedElixir: 0 }));

  const share = (total: number, holders: typeof goldHolders, key: 'storedGold' | 'storedElixir') => {
    if (holders.length === 0 || total <= 0) return;
    const per = Math.floor(total / holders.length);
    let remainder = total - per * holders.length;
    for (const h of holders) {
      const target = buildings.find((b) => b.id === h.id)!;
      target[key] += per + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }
  };
  share(lootGold, goldHolders, 'storedGold');
  share(lootElixir, elixirHolders, 'storedElixir');

  for (const b of buildings) {
    const accrued = collectorsAccrued[b.id] ?? 0;
    if (b.type === 'gold_mine') b.storedGold += Math.floor(accrued * 0.5 * mult);
    if (b.type === 'elixir_collector') b.storedElixir += Math.floor(accrued * 0.5 * mult);
  }
  return { ...snapshot, buildings };
}

/** Elo-style trophy exchange. Returns [attackerDelta, defenderDelta]. */
export function trophyDeltas(attackerTrophies: number, defenderTrophies: number, stars: number): [number, number] {
  const expected = 1 / (1 + Math.pow(10, (defenderTrophies - attackerTrophies) / 400));
  const K = 30;
  if (stars >= 1) {
    const starMult = stars === 1 ? 0.5 : stars === 2 ? 0.75 : 1;
    const gain = Math.max(1, Math.round(K * (1 - expected) * starMult));
    return [gain, defenderTrophies === 0 ? 0 : -Math.min(gain, defenderTrophies)];
  }
  const loss = Math.max(1, Math.round(K * expected));
  return [attackerTrophies === 0 ? 0 : -Math.min(loss, attackerTrophies), loss];
}

export function starsFor(destructionPercent: number, townHallDestroyed: boolean): number {
  let stars = 0;
  if (destructionPercent >= 50) stars++;
  if (townHallDestroyed) stars++;
  if (destructionPercent >= 100) stars = 3;
  return stars;
}

export function battleXp(stars: number, destructionPercent: number, defenderTh: number): number {
  return Math.round(destructionPercent / 4 + stars * 10 * defenderTh);
}
