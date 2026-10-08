import type { ClanRole } from '@launch/database';
import { TROOP_DEFINITIONS, getBuildingLevel, highestLevel } from '@launch/game-engine';
import type { ClanMessageDTO } from '@launch/types';
import type { DbOrTx, GameContext } from '../context.js';
import { GameError, assert } from '../context.js';
import { spend } from './ledger.js';
import { notify } from './notification.service.js';
import { getVillage, withPlayer } from './player.service.js';
import { bumpAchievement } from './progression.service.js';

export const CLAN_CREATE_COST_GOLD = 10_000;
export const CLAN_CHAT_CHANNEL = 'launch:clan-chat';
const ROLE_RANK: Record<ClanRole, number> = { MEMBER: 0, ELDER: 1, CO_LEADER: 2, LEADER: 3 };

async function requireClanHall(tx: DbOrTx, playerId: string) {
  const village = await getVillage(tx, playerId);
  assert(highestLevel(village.buildings, 'clan_hall') > 0, 'NO_CLAN_HALL', 'Build a Clan Hall to use clan features', 409);
  return village;
}

export async function createClan(ctx: GameContext, playerId: string, input: { name: string; tag: string; description?: string; type?: 'OPEN' | 'INVITE_ONLY' | 'CLOSED'; requiredTrophies?: number; badge?: string }) {
  return withPlayer(ctx, playerId, async (tx) => {
    await requireClanHall(tx, playerId);
    const existing = await tx.clanMember.findUnique({ where: { playerId } });
    assert(!existing, 'ALREADY_IN_CLAN', 'Leave your current clan first', 409);
    const taken = await tx.clan.findFirst({ where: { OR: [{ name: input.name }, { tag: input.tag.toUpperCase() }] } });
    assert(!taken, 'CLAN_EXISTS', 'A clan with that name or tag already exists', 409);
    await spend(tx, playerId, { gold: CLAN_CREATE_COST_GOLD }, 'clan:create', null);
    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
    const clan = await tx.clan.create({
      data: {
        name: input.name,
        tag: input.tag.toUpperCase(),
        description: input.description ?? '',
        type: input.type ?? 'OPEN',
        requiredTrophies: input.requiredTrophies ?? 0,
        badge: input.badge ?? 'shield-1',
        trophies: player.trophies,
        members: { create: { playerId, role: 'LEADER' } },
      },
    });
    return clan;
  });
}

export async function joinClan(ctx: GameContext, playerId: string, clanId: string) {
  return withPlayer(ctx, playerId, async (tx) => {
    await requireClanHall(tx, playerId);
    const existing = await tx.clanMember.findUnique({ where: { playerId } });
    assert(!existing, 'ALREADY_IN_CLAN', 'Leave your current clan first', 409);
    const clan = await tx.clan.findUnique({ where: { id: clanId }, include: { _count: { select: { members: true } } } });
    assert(clan, 'CLAN_NOT_FOUND', 'Clan not found', 404);
    assert(clan._count.members < 50, 'CLAN_FULL', 'This clan is full', 409);
    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
    assert(player.trophies >= clan.requiredTrophies, 'NOT_ENOUGH_TROPHIES', `This clan requires ${clan.requiredTrophies} trophies`, 409);
    if (clan.type !== 'OPEN') {
      const invite = await tx.clanInvite.findFirst({ where: { clanId, playerId, status: 'PENDING' } });
      assert(invite, 'INVITE_REQUIRED', 'This clan is invite only', 403);
      await tx.clanInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } });
    }
    await tx.clanMember.create({ data: { clanId, playerId, role: 'MEMBER' } });
    await recomputeClanTrophies(tx, clanId);
    return tx.clan.findUniqueOrThrow({ where: { id: clanId } });
  });
}

export async function leaveClan(ctx: GameContext, playerId: string) {
  return ctx.db.$transaction(async (tx) => {
    const member = await tx.clanMember.findUnique({ where: { playerId } });
    assert(member, 'NOT_IN_CLAN', 'You are not in a clan', 409);
    const others = await tx.clanMember.findMany({ where: { clanId: member.clanId, playerId: { not: playerId } }, orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }] });
    await tx.clanMember.delete({ where: { playerId } });
    if (others.length === 0) {
      await tx.clan.delete({ where: { id: member.clanId } });
      return { disbanded: true };
    }
    if (member.role === 'LEADER') {
      const successor = [...others].sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.joinedAt.getTime() - b.joinedAt.getTime())[0];
      await tx.clanMember.update({ where: { id: successor.id }, data: { role: 'LEADER' } });
    }
    await recomputeClanTrophies(tx, member.clanId);
    return { disbanded: false };
  });
}

async function recomputeClanTrophies(tx: DbOrTx, clanId: string) {
  const agg = await tx.player.aggregate({ where: { clanMember: { clanId } }, _sum: { trophies: true } });
  await tx.clan.update({ where: { id: clanId }, data: { trophies: agg._sum.trophies ?? 0 } });
}

async function requireRole(tx: DbOrTx, playerId: string, minRole: ClanRole) {
  const member = await tx.clanMember.findUnique({ where: { playerId } });
  assert(member, 'NOT_IN_CLAN', 'You are not in a clan', 409);
  assert(ROLE_RANK[member.role] >= ROLE_RANK[minRole], 'FORBIDDEN', 'You do not have permission to do that in this clan', 403);
  return member;
}

export async function invitePlayer(ctx: GameContext, playerId: string, targetPlayerId: string) {
  return ctx.db.$transaction(async (tx) => {
    const member = await requireRole(tx, playerId, 'ELDER');
    const target = await tx.player.findUnique({ where: { id: targetPlayerId }, include: { clanMember: true, user: { select: { id: true } } } });
    assert(target, 'PLAYER_NOT_FOUND', 'Player not found', 404);
    assert(!target.clanMember, 'ALREADY_IN_CLAN', 'That player is already in a clan', 409);
    const dup = await tx.clanInvite.findFirst({ where: { clanId: member.clanId, playerId: targetPlayerId, status: 'PENDING' } });
    assert(!dup, 'ALREADY_INVITED', 'Already invited', 409);
    const invite = await tx.clanInvite.create({ data: { clanId: member.clanId, playerId: targetPlayerId, invitedById: playerId } });
    const clan = await tx.clan.findUniqueOrThrow({ where: { id: member.clanId } });
    await notify(ctx, tx, target.user.id, 'clan_invite', 'Clan invitation', `You were invited to join ${clan.name} [${clan.tag}]`, { clanId: clan.id, inviteId: invite.id });
    return invite;
  });
}

export async function respondInvite(ctx: GameContext, playerId: string, inviteId: string, accept: boolean) {
  const invite = await ctx.db.clanInvite.findFirst({ where: { id: inviteId, playerId, status: 'PENDING' } });
  assert(invite, 'INVITE_NOT_FOUND', 'Invite not found', 404);
  if (!accept) {
    await ctx.db.clanInvite.update({ where: { id: inviteId }, data: { status: 'DECLINED' } });
    return null;
  }
  return joinClan(ctx, playerId, invite.clanId);
}

export async function setMemberRole(ctx: GameContext, playerId: string, targetPlayerId: string, role: ClanRole) {
  return ctx.db.$transaction(async (tx) => {
    const actor = await requireRole(tx, playerId, 'CO_LEADER');
    const target = await tx.clanMember.findUnique({ where: { playerId: targetPlayerId } });
    assert(target && target.clanId === actor.clanId, 'MEMBER_NOT_FOUND', 'Member not found', 404);
    assert(targetPlayerId !== playerId, 'CANNOT_CHANGE_SELF', 'Use leave to step down', 409);
    assert(ROLE_RANK[target.role] < ROLE_RANK[actor.role], 'FORBIDDEN', 'You cannot change a member of equal or higher rank', 403);
    if (role === 'LEADER') {
      assert(actor.role === 'LEADER', 'FORBIDDEN', 'Only the leader can hand over leadership', 403);
      await tx.clanMember.update({ where: { id: actor.id }, data: { role: 'CO_LEADER' } });
    } else {
      assert(ROLE_RANK[role] < ROLE_RANK[actor.role], 'FORBIDDEN', 'You cannot promote to your own rank or above', 403);
    }
    return tx.clanMember.update({ where: { id: target.id }, data: { role } });
  });
}

export async function kickMember(ctx: GameContext, playerId: string, targetPlayerId: string) {
  return ctx.db.$transaction(async (tx) => {
    const actor = await requireRole(tx, playerId, 'ELDER');
    const target = await tx.clanMember.findUnique({ where: { playerId: targetPlayerId } });
    assert(target && target.clanId === actor.clanId, 'MEMBER_NOT_FOUND', 'Member not found', 404);
    assert(ROLE_RANK[target.role] < ROLE_RANK[actor.role], 'FORBIDDEN', 'You cannot remove a member of equal or higher rank', 403);
    await tx.clanMember.delete({ where: { id: target.id } });
    await recomputeClanTrophies(tx, actor.clanId);
  });
}

export async function updateClan(ctx: GameContext, playerId: string, input: { description?: string; type?: 'OPEN' | 'INVITE_ONLY' | 'CLOSED'; requiredTrophies?: number; badge?: string }) {
  return ctx.db.$transaction(async (tx) => {
    const actor = await requireRole(tx, playerId, 'CO_LEADER');
    return tx.clan.update({ where: { id: actor.clanId }, data: input });
  });
}

export async function requestTroops(ctx: GameContext, playerId: string, message: string) {
  return withPlayer(ctx, playerId, async (tx) => {
    const member = await tx.clanMember.findUnique({ where: { playerId } });
    assert(member, 'NOT_IN_CLAN', 'You are not in a clan', 409);
    const village = await requireClanHall(tx, playerId);
    const hallLevel = highestLevel(village.buildings, 'clan_hall');
    const capacity = getBuildingLevel('clan_hall', hallLevel)?.housing ?? 10;
    const open = await tx.clanTroopRequest.findFirst({ where: { playerId }, orderBy: { createdAt: 'desc' } });
    if (open && open.filled < open.capacity) throw new GameError('REQUEST_OPEN', 'You already have an open request', 409);
    return tx.clanTroopRequest.create({ data: { clanId: member.clanId, playerId, message: message.slice(0, 140), capacity } });
  });
}

export async function donateTroops(ctx: GameContext, playerId: string, requestId: string, troopType: string, count: number) {
  return withPlayer(ctx, playerId, async (tx) => {
    const def = TROOP_DEFINITIONS[troopType];
    assert(def, 'UNKNOWN_TROOP', 'Unknown troop');
    assert(Number.isInteger(count) && count > 0, 'INVALID_COUNT', 'Invalid count');
    const member = await tx.clanMember.findUnique({ where: { playerId } });
    assert(member, 'NOT_IN_CLAN', 'You are not in a clan', 409);
    const request = await tx.clanTroopRequest.findFirst({ where: { id: requestId, clanId: member.clanId } });
    assert(request, 'REQUEST_NOT_FOUND', 'Request not found', 404);
    assert(request.playerId !== playerId, 'CANNOT_SELF_DONATE', 'You cannot donate to yourself', 409);
    const housing = count * def.housing;
    assert(request.filled + housing <= request.capacity, 'REQUEST_FULL', 'That would exceed the request capacity', 409);
    const unit = await tx.armyUnit.findUnique({ where: { playerId_troopType: { playerId, troopType } } });
    assert(unit && unit.count >= count, 'NOT_ENOUGH_TROOPS', 'You do not have enough of that troop', 409);
    await tx.armyUnit.update({ where: { id: unit.id }, data: { count: { decrement: count } } });
    await tx.armyUnit.upsert({
      where: { playerId_troopType: { playerId: request.playerId, troopType } },
      update: { donated: { increment: count } },
      create: { playerId: request.playerId, troopType, count: 0, donated: count },
    });
    await tx.clanTroopRequest.update({ where: { id: request.id }, data: { filled: { increment: housing } } });
    await tx.troopDonation.create({ data: { clanId: member.clanId, requestId, fromPlayerId: playerId, toPlayerId: request.playerId, troopType, count } });
    await tx.clanMember.update({ where: { id: member.id }, data: { donated: { increment: count } } });
    await tx.clanMember.updateMany({ where: { playerId: request.playerId }, data: { received: { increment: count } } });
    await bumpAchievement(tx, playerId, 'donations', count);
    const recipient = await tx.player.findUniqueOrThrow({ where: { id: request.playerId }, select: { userId: true } });
    const donor = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { name: true } });
    await notify(ctx, tx, recipient.userId, 'donation', 'Reinforcements arrived', `${donor.name} donated ${count} ${def.name}${count > 1 ? 's' : ''}`, { requestId });
  });
}

export async function postClanMessage(ctx: GameContext, playerId: string, content: string): Promise<ClanMessageDTO> {
  const text = content.trim().slice(0, 500);
  assert(text.length > 0, 'EMPTY_MESSAGE', 'Message is empty');
  const member = await ctx.db.clanMember.findUnique({ where: { playerId }, include: { player: { select: { name: true } } } });
  assert(member, 'NOT_IN_CLAN', 'You are not in a clan', 409);
  const msg = await ctx.db.clanMessage.create({ data: { clanId: member.clanId, playerId, content: text } });
  const dto: ClanMessageDTO = { id: msg.id, clanId: msg.clanId, playerId, playerName: member.player.name, content: msg.content, createdAt: msg.createdAt.toISOString() };
  await ctx.redis.publish(CLAN_CHAT_CHANNEL, JSON.stringify(dto)).catch(() => undefined);
  return dto;
}

export async function getClanDetail(tx: DbOrTx, clanId: string) {
  const clan = await tx.clan.findUnique({
    where: { id: clanId },
    include: {
      members: { include: { player: { select: { id: true, name: true, level: true, trophies: true, lastSeenAt: true } } }, orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }] },
      requests: { orderBy: { createdAt: 'desc' }, take: 20, include: { player: { select: { id: true, name: true } } } },
      _count: { select: { members: true } },
    },
  });
  if (!clan) throw new GameError('CLAN_NOT_FOUND', 'Clan not found', 404);
  const order: ClanRole[] = ['LEADER', 'CO_LEADER', 'ELDER', 'MEMBER'];
  return {
    id: clan.id,
    name: clan.name,
    tag: clan.tag,
    description: clan.description,
    badge: clan.badge,
    type: clan.type,
    requiredTrophies: clan.requiredTrophies,
    trophies: clan.trophies,
    memberCount: clan._count.members,
    createdAt: clan.createdAt.toISOString(),
    members: clan.members
      .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || b.player.trophies - a.player.trophies)
      .map((m) => ({ playerId: m.playerId, name: m.player.name, level: m.player.level, trophies: m.player.trophies, role: m.role, donated: m.donated, received: m.received, joinedAt: m.joinedAt.toISOString(), lastSeenAt: m.player.lastSeenAt.toISOString() })),
    requests: clan.requests.filter((r) => r.filled < r.capacity).map((r) => ({ id: r.id, playerId: r.playerId, playerName: r.player.name, message: r.message, capacity: r.capacity, filled: r.filled, createdAt: r.createdAt.toISOString() })),
  };
}
