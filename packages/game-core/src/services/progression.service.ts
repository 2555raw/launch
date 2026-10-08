import { ACHIEVEMENT_DEFINITIONS, getAchievement } from '@launch/game-engine';
import type { DbOrTx, GameContext } from '../context.js';
import { GameError, assert } from '../context.js';
import { applyResourceDelta } from './ledger.js';

type Stat = (typeof ACHIEVEMENT_DEFINITIONS)[number]['stat'];

/** Advances every achievement tracking `stat`. `mode: 'set'` replaces progress (for level-type stats). */
export async function bumpAchievement(tx: DbOrTx, playerId: string, stat: Stat, amount: number, mode: 'add' | 'set' = 'add'): Promise<void> {
  for (const def of ACHIEVEMENT_DEFINITIONS.filter((a) => a.stat === stat)) {
    const existing = await tx.playerAchievement.findUnique({ where: { playerId_key: { playerId, key: def.key } } });
    const progress = mode === 'set' ? Math.max(existing?.progress ?? 0, amount) : (existing?.progress ?? 0) + amount;
    const tier = existing?.tier ?? 0;
    const target = def.tiers[tier]?.target;
    const completedAt = target !== undefined && progress >= target && !existing?.completedAt ? new Date() : existing?.completedAt ?? null;
    await tx.playerAchievement.upsert({
      where: { playerId_key: { playerId, key: def.key } },
      update: { progress, completedAt },
      create: { playerId, key: def.key, progress, tier, completedAt },
    });
  }
}

export async function listAchievements(tx: DbOrTx, playerId: string) {
  const rows = await tx.playerAchievement.findMany({ where: { playerId } });
  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    const row = rows.find((r) => r.key === def.key);
    const tier = row?.tier ?? 0;
    const current = def.tiers[Math.min(tier, def.tiers.length - 1)];
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      tier,
      maxTier: def.tiers.length,
      progress: row?.progress ?? 0,
      target: current.target,
      reward: { gems: current.gems, xp: current.xp },
      completed: tier < def.tiers.length && (row?.progress ?? 0) >= current.target,
      claimable: tier < def.tiers.length && (row?.progress ?? 0) >= current.target,
      finished: tier >= def.tiers.length,
    };
  });
}

export async function claimAchievement(ctx: GameContext, playerId: string, key: string): Promise<{ gems: number; xp: number; tier: number }> {
  const def = getAchievement(key);
  assert(def, 'UNKNOWN_ACHIEVEMENT', 'Unknown achievement', 404);
  return ctx.db.$transaction(async (tx) => {
    const row = await tx.playerAchievement.findUnique({ where: { playerId_key: { playerId, key } } });
    const tier = row?.tier ?? 0;
    const current = def.tiers[tier];
    if (!current) throw new GameError('ALREADY_FINISHED', 'All tiers claimed', 409);
    assert((row?.progress ?? 0) >= current.target, 'NOT_COMPLETED', 'Achievement not completed yet', 409);
    await applyResourceDelta(tx, playerId, 'GEMS', current.gems, `achievement:${key}`, String(tier + 1));
    const { addXp } = await import('./player.service.js');
    await addXp(tx, playerId, current.xp);
    await tx.playerAchievement.update({ where: { playerId_key: { playerId, key } }, data: { tier: tier + 1, claimedAt: new Date(), completedAt: null } });
    return { gems: current.gems, xp: current.xp, tier: tier + 1 };
  });
}
