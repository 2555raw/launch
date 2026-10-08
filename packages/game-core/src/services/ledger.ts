import type { ResourceType } from '@launch/database';
import type { DbOrTx } from '../context.js';
import { GameError } from '../context.js';

/**
 * Every resource mutation goes through here so the ResourceLedger is a complete audit trail and
 * the (playerId, reason, refId) uniqueness blocks duplicate reward application.
 */
export async function applyResourceDelta(
  tx: DbOrTx,
  playerId: string,
  resource: ResourceType,
  delta: number,
  reason: string,
  refId: string | null,
  opts: { cap?: number; allowNegative?: boolean } = {},
): Promise<number> {
  const field = resource === 'GOLD' ? 'gold' : resource === 'ELIXIR' ? 'elixir' : 'gems';
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { gold: true, elixir: true, gems: true } });
  const current = player[field];
  let next = current + delta;
  if (next < 0 && !opts.allowNegative) throw new GameError('INSUFFICIENT_RESOURCES', `Not enough ${field}`, 400, { resource, needed: -delta, have: current });
  if (next < 0) next = 0;
  if (opts.cap !== undefined && delta > 0) next = Math.min(next, Math.max(current, opts.cap));
  const applied = next - current;
  if (applied === 0 && delta !== 0 && refId === null) return current;
  await tx.player.update({ where: { id: playerId }, data: { [field]: next } });
  try {
    await tx.resourceLedger.create({ data: { playerId, resource, delta: applied, balanceAfter: next, reason, refId } });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'P2002') throw new GameError('DUPLICATE_REWARD', 'This reward was already applied', 409);
    throw e;
  }
  return next;
}

export async function spend(tx: DbOrTx, playerId: string, cost: { gold?: number; elixir?: number; gems?: number }, reason: string, refId: string | null): Promise<void> {
  if (cost.gold) await applyResourceDelta(tx, playerId, 'GOLD', -cost.gold, reason, refId);
  if (cost.elixir) await applyResourceDelta(tx, playerId, 'ELIXIR', -cost.elixir, reason, refId);
  if (cost.gems) await applyResourceDelta(tx, playerId, 'GEMS', -cost.gems, reason, refId);
}
