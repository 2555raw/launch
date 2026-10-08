import { TROOP_DEFINITIONS, getTroopDefinition, getTroopLevel, highestLevel, housingCapacity } from '@launch/game-engine';
import type { ArmyDTO } from '@launch/types';
import type { DbOrTx, GameContext } from '../context.js';
import { assert } from '../context.js';
import { applyResourceDelta, spend } from './ledger.js';
import { getVillage, withPlayer } from './player.service.js';

export async function getArmyDTO(tx: DbOrTx, playerId: string, now: Date): Promise<ArmyDTO> {
  const [village, units, jobs, research, troops] = await Promise.all([
    getVillage(tx, playerId),
    tx.armyUnit.findMany({ where: { playerId } }),
    tx.trainingJob.findMany({ where: { playerId }, orderBy: { completesAt: 'asc' } }),
    tx.researchJob.findFirst({ where: { playerId } }),
    tx.playerTroop.findMany({ where: { playerId } }),
  ]);
  const troopLevels: Record<string, number> = {};
  for (const t of troops) troopLevels[t.troopType] = t.level;
  const barracks = highestLevel(village.buildings, 'barracks');
  for (const def of Object.values(TROOP_DEFINITIONS)) if (!troopLevels[def.type] && def.requiredBarracksLevel <= barracks) troopLevels[def.type] = 1;
  let housingUsed = 0;
  for (const u of units) housingUsed += u.count * (getTroopDefinition(u.troopType)?.housing ?? 1);
  for (const j of jobs) housingUsed += j.count * (getTroopDefinition(j.troopType)?.housing ?? 1);
  return {
    units: units.filter((u) => u.count + u.donated > 0).map((u) => ({ troopType: u.troopType, count: u.count + u.donated, level: troopLevels[u.troopType] ?? 1 })),
    housingUsed,
    housingCapacity: housingCapacity(village.buildings),
    training: jobs.map((j) => ({ id: j.id, troopType: j.troopType, count: j.count, startedAt: j.startedAt.toISOString(), completesAt: j.completesAt.toISOString() })),
    troopLevels,
    research: research ? { troopType: research.troopType, completesAt: research.completesAt.toISOString() } : null,
    ...(now ? {} : {}),
  };
}

export async function trainTroops(ctx: GameContext, playerId: string, troopType: string, count: number): Promise<ArmyDTO> {
  return withPlayer(ctx, playerId, async (tx, now) => {
    const def = getTroopDefinition(troopType);
    assert(def, 'UNKNOWN_TROOP', 'Unknown troop');
    assert(Number.isInteger(count) && count > 0 && count <= 200, 'INVALID_COUNT', 'Count must be 1-200');
    const village = await getVillage(tx, playerId);
    const barracksLevel = highestLevel(village.buildings, 'barracks');
    assert(barracksLevel >= def.requiredBarracksLevel, 'TROOP_LOCKED', `${def.name} requires Barracks level ${def.requiredBarracksLevel}`, 409);
    const army = await getArmyDTO(tx, playerId, now);
    const needed = count * def.housing;
    assert(army.housingUsed + needed <= army.housingCapacity, 'NOT_ENOUGH_HOUSING', 'Not enough army camp space', 409);
    const level = army.troopLevels[troopType] ?? 1;
    const lvl = getTroopLevel(troopType, level) ?? def.levels[0];
    await spend(tx, playerId, { elixir: lvl.trainCost * count }, `train:${troopType}`, null);
    const barracksCount = village.buildings.filter((b) => b.type === 'barracks' && b.state !== 'CONSTRUCTING').length || 1;
    const last = await tx.trainingJob.findFirst({ where: { playerId }, orderBy: { completesAt: 'desc' } });
    const start = last && last.completesAt > now ? last.completesAt : now;
    const durationMs = Math.ceil((def.trainTimeSec * count * 1000) / barracksCount);
    await tx.trainingJob.create({ data: { playerId, troopType, count, startedAt: start, completesAt: new Date(start.getTime() + durationMs) } });
    return getArmyDTO(tx, playerId, now);
  });
}

export async function cancelTraining(ctx: GameContext, playerId: string, jobId: string): Promise<ArmyDTO> {
  return withPlayer(ctx, playerId, async (tx, now) => {
    const job = await tx.trainingJob.findFirst({ where: { id: jobId, playerId } });
    assert(job, 'JOB_NOT_FOUND', 'Training job not found', 404);
    const army = await getArmyDTO(tx, playerId, now);
    const lvl = getTroopLevel(job.troopType, army.troopLevels[job.troopType] ?? 1)!;
    await applyResourceDelta(tx, playerId, 'ELIXIR', lvl.trainCost * job.count, `train:cancel:${job.troopType}`, null);
    await tx.trainingJob.delete({ where: { id: job.id } });
    return getArmyDTO(tx, playerId, now);
  });
}

export async function researchTroop(ctx: GameContext, playerId: string, troopType: string): Promise<ArmyDTO> {
  return withPlayer(ctx, playerId, async (tx, now) => {
    const def = getTroopDefinition(troopType);
    assert(def, 'UNKNOWN_TROOP', 'Unknown troop');
    const village = await getVillage(tx, playerId);
    const lab = highestLevel(village.buildings, 'laboratory');
    assert(lab > 0, 'NO_LABORATORY', 'Build a Laboratory first', 409);
    const active = await tx.researchJob.findFirst({ where: { playerId } });
    assert(!active, 'RESEARCH_BUSY', 'The Laboratory is already researching', 409);
    const army = await getArmyDTO(tx, playerId, now);
    const current = army.troopLevels[troopType];
    assert(current, 'TROOP_LOCKED', 'Unlock this troop first', 409);
    const next = getTroopLevel(troopType, current + 1);
    assert(next, 'MAX_LEVEL', 'This troop is at its maximum level', 409);
    assert(next.requiredLabLevel <= lab, 'LAB_TOO_LOW', `Requires Laboratory level ${next.requiredLabLevel}`, 409);
    await spend(tx, playerId, { elixir: next.researchCost }, `research:${troopType}:${next.level}`, null);
    await tx.researchJob.create({ data: { playerId, troopType, toLevel: next.level, completesAt: new Date(now.getTime() + next.researchTimeSec * 1000) } });
    return getArmyDTO(tx, playerId, now);
  });
}

export function troopCatalog() {
  return Object.values(TROOP_DEFINITIONS);
}
