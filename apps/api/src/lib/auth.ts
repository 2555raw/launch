import argon2 from 'argon2';
import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import type { Db, UserRole } from '@launch/database';
import type { AuthUser } from '@launch/types';
import { randomToken, sha256 } from './crypto.js';
import { forbidden, unauthorized } from './errors.js';

export interface AccessClaims {
  sub: string;
  role: UserRole;
  pid: string | null;
  username: string;
}

export const REFRESH_COOKIE = 'launch_rt';

export function parseTtl(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 900;
  const n = Number(m[1]);
  return { s: n, m: n * 60, h: n * 3600, d: n * 86400 }[m[2]] ?? 900;
}

export function signAccessToken(secret: string, ttl: string, claims: AccessClaims): { token: string; expiresIn: number } {
  const expiresIn = parseTtl(ttl);
  const token = jwt.sign(claims, secret, { expiresIn, issuer: 'launch-api', audience: 'launch' });
  return { token, expiresIn };
}

export function verifyAccessToken(secret: string, token: string): AccessClaims {
  const payload = jwt.verify(token, secret, { issuer: 'launch-api', audience: 'launch' }) as AccessClaims;
  return payload;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function issueRefreshToken(db: Db, userId: string, ttlDays: number, meta: { userAgent?: string; ip?: string }, family?: string): Promise<{ token: string; expiresAt: Date; family: string }> {
  const token = randomToken(48);
  const fam = family ?? randomToken(16);
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  await db.refreshSession.create({ data: { userId, tokenHash: sha256(token), family: fam, expiresAt, userAgent: meta.userAgent?.slice(0, 255), ip: meta.ip } });
  return { token, expiresAt, family: fam };
}

/**
 * Rotates a refresh token. Reusing an already-rotated token revokes the whole family
 * (classic refresh-token reuse detection).
 */
export async function rotateRefreshToken(db: Db, token: string, ttlDays: number, meta: { userAgent?: string; ip?: string }): Promise<{ userId: string; token: string; expiresAt: Date } | null> {
  const session = await db.refreshSession.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session) return null;
  if (session.revokedAt || session.replacedById) {
    await db.refreshSession.updateMany({ where: { family: session.family, revokedAt: null }, data: { revokedAt: new Date() } });
    return null;
  }
  if (session.expiresAt < new Date()) return null;
  const next = await issueRefreshToken(db, session.userId, ttlDays, meta, session.family);
  await db.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date(), replacedById: sha256(next.token) } });
  return { userId: session.userId, token: next.token, expiresAt: next.expiresAt };
}

export async function revokeRefreshToken(db: Db, token: string): Promise<void> {
  await db.refreshSession.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

export function toAuthUser(u: { id: string; email: string | null; username: string; role: UserRole; status: 'ACTIVE' | 'BANNED' | 'SUSPENDED'; player?: { id: string } | null }): AuthUser {
  return { id: u.id, email: u.email, username: u.username, role: u.role, status: u.status, playerId: u.player?.id ?? null };
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AccessClaims | null;
  }
}

export function requireAuth(request: FastifyRequest): AccessClaims {
  if (!request.auth) throw unauthorized();
  return request.auth;
}

export function requirePlayer(request: FastifyRequest): AccessClaims & { pid: string } {
  const auth = requireAuth(request);
  if (!auth.pid) throw forbidden('No player profile on this account');
  return auth as AccessClaims & { pid: string };
}

const ROLE_RANK: Record<UserRole, number> = { USER: 0, DEVELOPER: 1, MODERATOR: 2, ADMIN: 3 };

export function requireRole(request: FastifyRequest, ...roles: UserRole[]): AccessClaims {
  const auth = requireAuth(request);
  if (!roles.includes(auth.role)) throw forbidden('Insufficient role');
  return auth;
}

export function hasAtLeastRole(role: UserRole, min: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function clientIp(request: FastifyRequest): string {
  return request.ip;
}

export function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date, secure: boolean) {
  reply.setCookie(REFRESH_COOKIE, token, { httpOnly: true, sameSite: secure ? 'none' : 'lax', secure, path: '/auth', expires: expiresAt });
}

export function clearRefreshCookie(reply: FastifyReply, secure: boolean) {
  reply.clearCookie(REFRESH_COOKIE, { path: '/auth', httpOnly: true, sameSite: secure ? 'none' : 'lax', secure });
}
