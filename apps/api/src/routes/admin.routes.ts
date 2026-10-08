import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UserRole } from '@launch/database';
import { applyResourceDelta, getVillageDTO } from '@launch/game-core';
import { replayBattle, trophyDeltas } from '@launch/game-engine';
import type { BattleSnapshot, DeploymentRecord } from '@launch/types';
import { audit } from '../lib/audit.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { projectToDTO } from '../services/launchpad.service.js';

const STAFF: UserRole[] = ['ADMIN', 'MODERATOR', 'DEVELOPER'];
const MODS: UserRole[] = ['ADMIN', 'MODERATOR'];

export async function registerAdminRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const include = { creator: { select: { id: true, username: true } }, token: true } as const;

  app.post('/reports', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (request, reply) => {
    const auth = requireAuth(request);
    const body = z.object({ targetType: z.enum(['player', 'clan', 'project', 'message']), targetId: z.string().min(1).max(64), reason: z.string().min(5).max(1000) }).parse(request.body);
    const report = await db.report.create({ data: { reporterId: auth.sub, ...body } });
    return reply.status(201).send({ report });
  });

  app.get('/admin/stats', async (request) => {
    requireRole(request, ...STAFF);
    const [users, players, battles, clans, projects, tokens, openReports, banned] = await Promise.all([db.user.count(), db.player.count(), db.battle.count({ where: { state: 'FINISHED' } }), db.clan.count(), db.project.count(), db.token.count(), db.report.count({ where: { status: 'OPEN' } }), db.user.count({ where: { status: 'BANNED' } })]);
    const since = new Date(Date.now() - 86_400_000);
    const [newUsers24h, battles24h] = await Promise.all([db.user.count({ where: { createdAt: { gte: since } } }), db.battle.count({ where: { endedAt: { gte: since } } })]);
    return { users, players, battles, clans, projects, tokens, openReports, banned, newUsers24h, battles24h };
  });

  app.get('/admin/users', async (request) => {
    requireRole(request, ...STAFF);
    const { q, cursor, limit } = request.query as { q?: string; cursor?: string; limit?: string };
    const take = Math.min(100, Number(limit ?? 50));
    const users = await db.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }, { wallets: { some: { address: { contains: q } } } }] } : {},
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { player: { select: { id: true, name: true, level: true, trophies: true } }, wallets: { select: { chain: true, address: true } }, _count: { select: { projects: true } } },
    });
    return { items: users.slice(0, take).map((u) => ({ id: u.id, email: u.email, username: u.username, role: u.role, status: u.status, banReason: u.banReason, bannedUntil: u.bannedUntil, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, player: u.player, wallets: u.wallets, projects: u._count.projects })), nextCursor: users.length > take ? users[take - 1].id : null };
  });

  app.post('/admin/users/:id/ban', async (request) => {
    const auth = requireRole(request, ...MODS);
    const { id } = request.params as { id: string };
    const body = z.object({ reason: z.string().min(3).max(500), days: z.number().int().min(0).max(3650).optional() }).parse(request.body);
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw notFound('User not found');
    if (target.role === 'ADMIN') throw new HttpError(403, 'FORBIDDEN', 'Admins cannot be banned');
    await db.$transaction([
      db.user.update({ where: { id }, data: { status: 'BANNED', banReason: body.reason, bannedUntil: body.days ? new Date(Date.now() + body.days * 86_400_000) : null } }),
      db.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await audit(db, { actorUserId: auth.sub, action: 'admin.user_ban', targetType: 'user', targetId: id, metadata: body, ip: request.ip });
    return { ok: true };
  });
  app.post('/admin/users/:id/unban', async (request) => {
    const auth = requireRole(request, ...MODS);
    const { id } = request.params as { id: string };
    await db.user.update({ where: { id }, data: { status: 'ACTIVE', banReason: null, bannedUntil: null } });
    await audit(db, { actorUserId: auth.sub, action: 'admin.user_unban', targetType: 'user', targetId: id, ip: request.ip });
    return { ok: true };
  });
  app.post('/admin/users/:id/role', async (request) => {
    const auth = requireRole(request, 'ADMIN');
    const { id } = request.params as { id: string };
    const body = z.object({ role: z.enum(['USER', 'MODERATOR', 'ADMIN', 'DEVELOPER']) }).parse(request.body);
    if (id === auth.sub) throw new HttpError(409, 'SELF', 'You cannot change your own role');
    await db.user.update({ where: { id }, data: { role: body.role } });
    await audit(db, { actorUserId: auth.sub, action: 'admin.user_role', targetType: 'user', targetId: id, metadata: body, ip: request.ip });
    return { ok: true };
  });

  app.get('/admin/villages/:playerId', async (request) => {
    requireRole(request, ...STAFF);
    const { playerId } = request.params as { playerId: string };
    const player = await db.player.findUnique({ where: { id: playerId }, include: { user: { select: { id: true, username: true, email: true } } } });
    if (!player) throw notFound('Player not found');
    const ledger = await db.resourceLedger.findMany({ where: { playerId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { player, village: await getVillageDTO(db, playerId, app.game.now()), ledger };
  });
  app.post('/admin/villages/:playerId/grant', async (request) => {
    const auth = requireRole(request, 'ADMIN');
    const { playerId } = request.params as { playerId: string };
    const body = z.object({ resource: z.enum(['GOLD', 'ELIXIR', 'GEMS']), amount: z.number().int().min(-1000000).max(1000000), reason: z.string().min(3).max(200) }).parse(request.body);
    await db.$transaction((tx) => applyResourceDelta(tx, playerId, body.resource, body.amount, `admin:${body.reason}`, null, { allowNegative: true }));
    await audit(db, { actorUserId: auth.sub, action: 'admin.grant_resources', targetType: 'player', targetId: playerId, metadata: body, ip: request.ip });
    return { village: await getVillageDTO(db, playerId, app.game.now()) };
  });

  app.get('/admin/battles', async (request) => {
    requireRole(request, ...STAFF);
    const { cursor, limit, playerId } = request.query as { cursor?: string; limit?: string; playerId?: string };
    const take = Math.min(100, Number(limit ?? 50));
    const battles = await db.battle.findMany({
      where: playerId ? { OR: [{ attackerId: playerId }, { defenderId: playerId }] } : {},
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { attacker: { select: { id: true, name: true } }, defender: { select: { id: true, name: true } } },
    });
    return { items: battles.slice(0, take).map((b) => ({ id: b.id, state: b.state, attacker: b.attacker, defender: b.defender, stars: b.stars, destructionPercent: b.destructionPercent, lootGold: b.lootGold, lootElixir: b.lootElixir, attackerTrophyDelta: b.attackerTrophyDelta, createdAt: b.createdAt, endedAt: b.endedAt })), nextCursor: battles.length > take ? battles[take - 1].id : null };
  });
  /** Re-simulates a battle from its seed + deployment log and compares with the stored result (anti-cheat audit). */
  app.get('/admin/battles/:id/audit', async (request) => {
    requireRole(request, ...STAFF);
    const { id } = request.params as { id: string };
    const b = await db.battle.findUnique({ where: { id } });
    if (!b) throw notFound('Battle not found');
    if (b.state !== 'FINISHED') return { battle: b, replayed: null, matches: null };
    const troops = await db.playerTroop.findMany({ where: { playerId: b.attackerId } });
    const result = b.result as { durationMs?: number } | null;
    const sim = replayBattle({ seed: b.seed, snapshot: b.defenderSnapshot as unknown as BattleSnapshot, army: b.attackerArmy as Record<string, number>, troopLevels: Object.fromEntries(troops.map((t) => [t.troopType, t.level])), attackerTownHall: 1 }, b.deployments as unknown as DeploymentRecord[], result?.durationMs);
    const replayed = sim.result(0, 0, trophyDeltas, (b.defenderSnapshot as unknown as BattleSnapshot).townHallLevel);
    return { battle: { id: b.id, stars: b.stars, destructionPercent: b.destructionPercent, lootGold: b.lootGold, lootElixir: b.lootElixir, deployments: b.deployments }, replayed, matches: replayed.stars === b.stars && replayed.destructionPercent === b.destructionPercent && replayed.lootGold === b.lootGold };
  });

  app.get('/admin/clans', async (request) => {
    requireRole(request, ...STAFF);
    const clans = await db.clan.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { _count: { select: { members: true } } } });
    return { items: clans.map((c) => ({ id: c.id, name: c.name, tag: c.tag, type: c.type, trophies: c.trophies, members: c._count.members, createdAt: c.createdAt })) };
  });
  app.delete('/admin/clans/:id', async (request) => {
    const auth = requireRole(request, 'ADMIN');
    const { id } = request.params as { id: string };
    await db.clan.delete({ where: { id } });
    await audit(db, { actorUserId: auth.sub, action: 'admin.clan_delete', targetType: 'clan', targetId: id, ip: request.ip });
    return { ok: true };
  });

  app.get('/admin/projects', async (request) => {
    requireRole(request, ...STAFF);
    const { status } = request.query as { status?: string };
    const projects = await db.project.findMany({ where: status ? { status: status as 'DRAFT' } : {}, include, orderBy: { createdAt: 'desc' }, take: 100 });
    return { items: await Promise.all(projects.map((p) => projectToDTO(app, p, false))) };
  });
  app.post('/admin/projects/:id/unpublish', async (request) => {
    const auth = requireRole(request, ...MODS);
    const { id } = request.params as { id: string };
    const body = z.object({ reason: z.string().min(3).max(500) }).parse(request.body);
    await db.project.update({ where: { id }, data: { status: 'FAILED', failureReason: `Removed by moderation: ${body.reason}` } });
    await audit(db, { actorUserId: auth.sub, action: 'admin.project_unpublish', targetType: 'project', targetId: id, metadata: body, ip: request.ip });
    return { ok: true };
  });
  app.get('/admin/tokens', async (request) => {
    requireRole(request, ...STAFF);
    const tokens = await db.token.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { project: { select: { name: true, symbol: true, slug: true, status: true } } } });
    return { items: tokens };
  });
  app.get('/admin/transactions', async (request) => {
    requireRole(request, ...STAFF);
    const rows = await db.transaction.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { username: true } } } });
    return { items: rows };
  });

  app.get('/admin/reports', async (request) => {
    requireRole(request, ...STAFF);
    const { status } = request.query as { status?: string };
    const reports = await db.report.findMany({ where: { status: (status as 'OPEN') ?? 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 100, include: { reporter: { select: { username: true } } } });
    return { items: reports };
  });
  app.post('/admin/reports/:id/resolve', async (request) => {
    const auth = requireRole(request, ...MODS);
    const { id } = request.params as { id: string };
    const body = z.object({ status: z.enum(['RESOLVED', 'DISMISSED']), resolution: z.string().max(500).optional() }).parse(request.body);
    await db.report.update({ where: { id }, data: { status: body.status, resolution: body.resolution, resolvedById: auth.sub, resolvedAt: new Date() } });
    await audit(db, { actorUserId: auth.sub, action: 'admin.report_resolve', targetType: 'report', targetId: id, metadata: body, ip: request.ip });
    return { ok: true };
  });

  app.get('/admin/config', async (request) => {
    requireRole(request, ...STAFF);
    return { items: await db.gameConfigOverride.findMany() };
  });
  app.put('/admin/config/:key', async (request) => {
    const auth = requireRole(request, 'ADMIN', 'DEVELOPER');
    const { key } = request.params as { key: string };
    const body = z.object({ value: z.unknown() }).parse(request.body);
    const row = await db.gameConfigOverride.upsert({ where: { key }, update: { value: body.value as object, updatedById: auth.sub }, create: { key, value: body.value as object, updatedById: auth.sub } });
    await audit(db, { actorUserId: auth.sub, action: 'admin.config_set', targetType: 'config', targetId: key, metadata: { value: body.value }, ip: request.ip });
    return { item: row };
  });

  app.get('/admin/audit-logs', async (request) => {
    requireRole(request, ...STAFF);
    const { cursor, limit, action } = request.query as { cursor?: string; limit?: string; action?: string };
    const take = Math.min(200, Number(limit ?? 100));
    const logs = await db.auditLog.findMany({ where: action ? { action: { startsWith: action } } : {}, orderBy: { createdAt: 'desc' }, take: take + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), include: { actor: { select: { username: true } } } });
    return { items: logs.slice(0, take), nextCursor: logs.length > take ? logs[take - 1].id : null };
  });
}
