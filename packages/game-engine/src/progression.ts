/** XP required to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.round(50 * Math.pow(level, 1.5) + 50 * level);
}

/** Computes player level from total xp (level 1 at 0 xp). */
export function levelFromXp(totalXp: number): { level: number; xpIntoLevel: number; xpToNext: number } {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (level < 200) {
    const need = xpForLevel(level);
    if (remaining < need) return { level, xpIntoLevel: remaining, xpToNext: need };
    remaining -= need;
    level++;
  }
  return { level, xpIntoLevel: remaining, xpToNext: xpForLevel(level) };
}

export const MAX_BUILDERS = 5;
export const BATTLE_DURATION_MS = 180_000;
export const BATTLE_PREP_MS = 30_000;
export const BATTLE_TICK_MS = 100;
export const SHIELD_AFTER_DEFEAT_MS = 8 * 3600 * 1000;
export const GEMS_PER_HOUR_SKIP = 10; // gems to skip 1 hour of build time (prorated, min 1)

export function gemsToSkip(remainingMs: number): number {
  if (remainingMs <= 0) return 0;
  return Math.max(1, Math.ceil((remainingMs / 3_600_000) * GEMS_PER_HOUR_SKIP));
}
