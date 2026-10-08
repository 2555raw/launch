import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CLAN_CREATE_COST_GOLD, createClan, donateTroops, getClanDetail, invitePlayer, joinClan, kickMember, leaveClan, postClanMessage, requestTroops, respondInvite, setMemberRole, updateClan } from '@launch/game-core';
import { requirePlayer } from '../lib/auth.js';

const CreateSchema = z.object({
  name: z.string().min(3).max(24),
  tag: z.string().min(2).max(6).regex(/^[A-Za-z0-9]+$/),
  description: z.string().max(300).optional(),
  type: z.enum(['OPEN', 'INVITE_ONLY', 'CLOSED']).optional(),
  requiredTrophies: z.number().int().min(0).max(100000).optional(),
  badge: z.string().max(32).optional(),
});
const UpdateSchema = CreateSchema.omit({ name: true, tag: true });

export async function registerClanRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const game = app.game;

  app.get('/game/clans', async (request) => {
    const { q, limit } = request.query as { q?: string; limit?: string };
    const take = Math.min(50, Math.max(1, Number(limit ?? 25)));
    const clans = await db.clan.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { tag: { contains: q.toUpperCase() } }] } : {},
      orderBy: { trophies: 'desc' },
      take,
      include: { _count: { select: { members: true } } },
    });
    return { clans: clans.map((c) => ({ id: c.id, name: c.name, tag: c.tag, badge: c.badge, description: c.description, type: c.type, requiredTrophies: c.requiredTrophies, trophies: c.trophies, members: c._count.members })), createCost: CLAN_CREATE_COST_GOLD };
  });
  app.get('/game/clans/mine', async (request) => {
    const auth = requirePlayer(request);
    const member = await db.clanMember.findUnique({ where: { playerId: auth.pid } });
    if (!member) {
      const invites = await db.clanInvite.findMany({ where: { playerId: auth.pid, status: 'PENDING' }, include: { clan: { select: { id: true, name: true, tag: true, badge: true } } } });
      return { clan: null, role: null, invites: invites.map((i) => ({ id: i.id, clan: i.clan, createdAt: i.createdAt.toISOString() })) };
    }
    const clan = await getClanDetail(db, member.clanId);
    const messages = await db.clanMessage.findMany({ where: { clanId: member.clanId }, orderBy: { createdAt: 'desc' }, take: 50, include: { player: { select: { name: true } } } });
    return { clan, role: member.role, invites: [], messages: messages.reverse().map((m) => ({ id: m.id, clanId: m.clanId, playerId: m.playerId, playerName: m.player.name, content: m.content, createdAt: m.createdAt.toISOString() })) };
  });
  app.post('/game/clans', async (request, reply) => {
    const auth = requirePlayer(request);
    const body = CreateSchema.parse(request.body);
    const clan = await createClan(game, auth.pid, body);
    return reply.status(201).send({ clan: await getClanDetail(db, clan.id) });
  });
  app.get('/game/clans/:id', async (request) => ({ clan: await getClanDetail(db, (request.params as { id: string }).id) }));
  app.post('/game/clans/:id/join', async (request) => {
    const auth = requirePlayer(request);
    const clan = await joinClan(game, auth.pid, (request.params as { id: string }).id);
    return { clan: await getClanDetail(db, clan.id) };
  });
  app.post('/game/clans/leave', async (request) => {
    const auth = requirePlayer(request);
    return leaveClan(game, auth.pid);
  });
  app.patch('/game/clans', async (request) => {
    const auth = requirePlayer(request);
    const body = UpdateSchema.parse(request.body);
    const clan = await updateClan(game, auth.pid, body);
    return { clan: await getClanDetail(db, clan.id) };
  });
  app.post('/game/clans/invite', async (request) => {
    const auth = requirePlayer(request);
    const body = z.object({ playerId: z.string() }).parse(request.body);
    return { invite: await invitePlayer(game, auth.pid, body.playerId) };
  });
  app.post('/game/clans/invites/:id/respond', async (request) => {
    const auth = requirePlayer(request);
    const body = z.object({ accept: z.boolean() }).parse(request.body);
    const clan = await respondInvite(game, auth.pid, (request.params as { id: string }).id, body.accept);
    return { clan: clan ? await getClanDetail(db, clan.id) : null };
  });
  app.post('/game/clans/members/:playerId/role', async (request) => {
    const auth = requirePlayer(request);
    const body = z.object({ role: z.enum(['LEADER', 'CO_LEADER', 'ELDER', 'MEMBER']) }).parse(request.body);
    await setMemberRole(game, auth.pid, (request.params as { playerId: string }).playerId, body.role);
    return { ok: true };
  });
  app.delete('/game/clans/members/:playerId', async (request) => {
    const auth = requirePlayer(request);
    await kickMember(game, auth.pid, (request.params as { playerId: string }).playerId);
    return { ok: true };
  });
  app.post('/game/clans/messages', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
    const auth = requirePlayer(request);
    const body = z.object({ content: z.string().min(1).max(500) }).parse(request.body);
    return { message: await postClanMessage(game, auth.pid, body.content) };
  });
  app.post('/game/clans/requests', async (request) => {
    const auth = requirePlayer(request);
    const body = z.object({ message: z.string().max(140).optional() }).parse(request.body ?? {});
    return { request: await requestTroops(game, auth.pid, body.message ?? '') };
  });
  app.post('/game/clans/requests/:id/donate', async (request) => {
    const auth = requirePlayer(request);
    const body = z.object({ troopType: z.string(), count: z.number().int().min(1).max(50) }).parse(request.body);
    await donateTroops(game, auth.pid, (request.params as { id: string }).id, body.troopType, body.count);
    return { ok: true };
  });
}
