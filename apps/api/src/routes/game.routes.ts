import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BUILDING_DEFINITIONS, TROOP_DEFINITIONS, replayBattle, trophyDeltas, ACHIEVEMENT_DEFINITIONS, xpForLevel } from '@launch/game-engine';
import {
  abandonBattle,
  battleHistory,
  buildingCatalog,
  cancelConstruction,
  cancelTraining,
  claimAchievement,
  collectResources,
  findOpponent,
  getArmyDTO,
  getPlayerSummary,
  getVillageDTO,
  listAchievements,
  moveBuilding,
  placeBuilding,
  removeBuilding,
  researchTroop,
  skipConstruction,
  syncPlayer,
  toDTO as notificationToDTO,
  trainTroops,
  upgradeBuilding,
} from '@launch/game-core';
import type { BattleSnapshot, DeploymentRecord } from '@launch/types';
import { requirePlayer } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';

const PlaceSchema = z.object({ type: z.string().min(1).max(40), x: z.number().int().min(0).max(100), y: z.number().int().min(0).max(100) });
const MoveSchema = z.object({ x: z.number().int().min(0).max(100), y: z.number().int().min(0).max(100) });
const TrainSchema = z.object({ troopType: z.string().min(1).max(40), count: z.number().int().min(1).max(200) });
const ResearchSchema = z.object({ troopType: z.string().min(1).max(40) });

export async function registerGameRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const game = app.game;

  app.get('/game/catalog', async () => ({ buildings: Object.values(BUILDING_DEFINITIONS), troops: Object.values(TROOP_DEFINITIONS), achievements: ACHIEVEMENT_DEFINITIONS, xpTable: Array.from({ length: 50 }, (_, i) => xpForLevel(i + 1)) }));

  app.get('/game/village', async (request) => {
    const auth = requirePlayer(request);
    const now = game.now();
    await db.$transaction(async (tx) => {
      await syncPlayer(tx, auth.pid, now);
      await tx.player.update({ where: { id: auth.pid }, data: { lastSeenAt: now } });
    });
    const village = await getVillageDTO(db, auth.pid, now);
    return { village, catalog: buildingCatalog(village.townHallLevel) };
  });

  app.post('/game/buildings', async (request, reply) => {
    const auth = requirePlayer(request);
    const body = PlaceSchema.parse(request.body);
    const building = await placeBuilding(game, auth.pid, body.type, body.x, body.y);
    return reply.status(201).send({ building, village: await getVillageDTO(db, auth.pid, game.now()) });
  });
  app.patch('/game/buildings/:id/move', async (request) => {
    const auth = requirePlayer(request);
    const body = MoveSchema.parse(request.body);
    const building = await moveBuilding(game, auth.pid, (request.params as { id: string }).id, body.x, body.y);
    return { building };
  });
  app.post('/game/buildings/:id/upgrade', async (request) => {
    const auth = requirePlayer(request);
    const building = await upgradeBuilding(game, auth.pid, (request.params as { id: string }).id);
    return { building, village: await getVillageDTO(db, auth.pid, game.now()) };
  });
  app.post('/game/buildings/:id/cancel', async (request) => {
    const auth = requirePlayer(request);
    const result = await cancelConstruction(game, auth.pid, (request.params as { id: string }).id);
    return { ...result, village: await getVillageDTO(db, auth.pid, game.now()) };
  });
  app.post('/game/buildings/:id/collect', async (request) => {
    const auth = requirePlayer(request);
    const result = await collectResources(game, auth.pid, (request.params as { id: string }).id);
    return { ...result, village: await getVillageDTO(db, auth.pid, game.now()) };
  });
  app.post('/game/buildings/:id/skip', async (request) => {
    const auth = requirePlayer(request);
    const building = await skipConstruction(game, auth.pid, (request.params as { id: string }).id);
    return { building, village: await getVillageDTO(db, auth.pid, game.now()) };
  });
  app.delete('/game/buildings/:id', async (request) => {
    const auth = requirePlayer(request);
    await removeBuilding(game, auth.pid, (request.params as { id: string }).id);
    return { ok: true, village: await getVillageDTO(db, auth.pid, game.now()) };
  });

  app.get('/game/army', async (request) => {
    const auth = requirePlayer(request);
    const now = game.now();
    await db.$transaction((tx) => syncPlayer(tx, auth.pid, now));
    return { army: await getArmyDTO(db, auth.pid, now) };
  });
  app.post('/game/army/train', async (request) => {
    const auth = requirePlayer(request);
    const body = TrainSchema.parse(request.body);
    return { army: await trainTroops(game, auth.pid, body.troopType, body.count) };
  });
  app.delete('/game/army/training/:jobId', async (request) => {
    const auth = requirePlayer(request);
    return { army: await cancelTraining(game, auth.pid, (request.params as { jobId: string }).jobId) };
  });
  app.post('/game/army/research', async (request) => {
    const auth = requirePlayer(request);
    const body = ResearchSchema.parse(request.body);
    return { army: await researchTroop(game, auth.pid, body.troopType) };
  });

  app.post('/game/battles/find', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
    const auth = requirePlayer(request);
    const match = await findOpponent(game, auth.pid);
    return { battleId: match.battle.id, seed: match.battle.seed, snapshot: match.snapshot, army: match.battle.attackerArmy, defender: match.defender };
  });
  app.post('/game/battles/:id/abandon', async (request) => {
    const auth = requirePlayer(request);
    await abandonBattle(game, auth.pid, (request.params as { id: string }).id);
    return { ok: true };
  });
  app.get('/game/battles/history', async (request) => {
    const auth = requirePlayer(request);
    return { battles: await battleHistory(db, auth.pid, 30) };
  });
  app.get('/game/battles/:id', async (request) => {
    const auth = requirePlayer(request);
    const { id } = request.params as { id: string };
    const b = await db.battle.findFirst({ where: { id, OR: [{ attackerId: auth.pid }, { defenderId: auth.pid }] }, include: { attacker: { select: { id: true, name: true } }, defender: { select: { id: true, name: true } } } });
    if (!b) throw notFound('Battle not found');
    return { battle: { id: b.id, state: b.state, attacker: b.attacker, defender: b.defender, seed: b.seed, snapshot: b.defenderSnapshot, army: b.attackerArmy, deployments: b.deployments, result: b.result, startedAt: b.startedAt, endedAt: b.endedAt, createdAt: b.createdAt } };
  });
  /** Deterministic replay of a finished battle (anyone involved can audit the result). */
  app.get('/game/battles/:id/replay', async (request) => {
    const auth = requirePlayer(request);
    const { id } = request.params as { id: string };
    const b = await db.battle.findFirst({ where: { id, state: 'FINISHED', OR: [{ attackerId: auth.pid }, { defenderId: auth.pid }] } });
    if (!b) throw notFound('Battle not found');
    const troops = await db.playerTroop.findMany({ where: { playerId: b.attackerId } });
    const troopLevels = Object.fromEntries(troops.map((t) => [t.troopType, t.level]));
    const result = b.result as { durationMs?: number } | null;
    const sim = replayBattle({ seed: b.seed, snapshot: b.defenderSnapshot as unknown as BattleSnapshot, army: b.attackerArmy as Record<string, number>, troopLevels, attackerTownHall: 1 }, b.deployments as unknown as DeploymentRecord[], result?.durationMs);
    const replayed = sim.result(0, 0, trophyDeltas, (b.defenderSnapshot as unknown as BattleSnapshot).townHallLevel);
    return { recorded: b.result, replayed: { stars: replayed.stars, destructionPercent: replayed.destructionPercent, lootGold: replayed.lootGold, lootElixir: replayed.lootElixir }, matches: replayed.destructionPercent === b.destructionPercent && replayed.stars === b.stars, events: sim.events.slice(0, 500) };
  });

  app.get('/game/player/me', async (request) => {
    const auth = requirePlayer(request);
    return { player: await getPlayerSummary(db, auth.pid), achievements: await listAchievements(db, auth.pid) };
  });
  app.get('/game/players/search', async (request) => {
    requirePlayer(request);
    const q = String((request.query as { q?: string }).q ?? '').trim();
    if (q.length < 2) return { players: [] };
    const players = await db.player.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: 20, orderBy: { trophies: 'desc' }, select: { id: true, name: true, level: true, trophies: true, clanMember: { select: { clan: { select: { name: true, tag: true } } } } } });
    return { players: players.map((p) => ({ id: p.id, name: p.name, level: p.level, trophies: p.trophies, clan: p.clanMember?.clan ?? null })) };
  });
  app.get('/game/players/:id', async (request) => {
    requirePlayer(request);
    const { id } = request.params as { id: string };
    const player = await getPlayerSummary(db, id);
    const village = await getVillageDTO(db, id, game.now());
    return { player, village: { ...village, resources: undefined }, achievements: await listAchievements(db, id), history: await battleHistory(db, id, 10) };
  });
  app.post('/game/achievements/:key/claim', async (request) => {
    const auth = requirePlayer(request);
    const reward = await claimAchievement(game, auth.pid, (request.params as { key: string }).key);
    return { reward, achievements: await listAchievements(db, auth.pid) };
  });

  app.get('/game/leaderboard/players', async (request) => {
    const { cursor, limit } = request.query as { cursor?: string; limit?: string };
    const take = Math.min(100, Math.max(1, Number(limit ?? 50)));
    const players = await db.player.findMany({
      orderBy: [{ trophies: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, name: true, level: true, trophies: true, attacksWon: true, clanMember: { select: { clan: { select: { id: true, name: true, tag: true } } } } },
    });
    const offset = cursor ? (await db.player.count({ where: { trophies: { gt: (await db.player.findUnique({ where: { id: cursor } }))?.trophies ?? 0 } } })) : 0;
    const items = players.slice(0, take).map((p, i) => ({ rank: offset + i + 1, id: p.id, name: p.name, level: p.level, trophies: p.trophies, attacksWon: p.attacksWon, clan: p.clanMember?.clan ?? null }));
    return { items, nextCursor: players.length > take ? players[take - 1].id : null };
  });
  app.get('/game/leaderboard/clans', async (request) => {
    const { limit } = request.query as { limit?: string };
    const take = Math.min(100, Math.max(1, Number(limit ?? 50)));
    const clans = await db.clan.findMany({ orderBy: [{ trophies: 'desc' }, { id: 'asc' }], take, include: { _count: { select: { members: true } } } });
    return { items: clans.map((c, i) => ({ rank: i + 1, id: c.id, name: c.name, tag: c.tag, badge: c.badge, trophies: c.trophies, members: c._count.members, type: c.type })) };
  });

  app.get('/game/notifications', async (request) => {
    const auth = requirePlayer(request);
    const rows = await db.notification.findMany({ where: { userId: auth.sub }, orderBy: { createdAt: 'desc' }, take: 50 });
    const unread = await db.notification.count({ where: { userId: auth.sub, readAt: null } });
    return { notifications: rows.map(notificationToDTO), unread };
  });
  app.post('/game/notifications/read', async (request) => {
    const auth = requirePlayer(request);
    const body = z.object({ ids: z.array(z.string()).max(100).optional() }).parse(request.body ?? {});
    await db.notification.updateMany({ where: { userId: auth.sub, readAt: null, ...(body.ids ? { id: { in: body.ids } } : {}) }, data: { readAt: new Date() } });
    return { ok: true };
  });
}
