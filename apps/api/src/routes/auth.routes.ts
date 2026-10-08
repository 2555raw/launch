import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createPlayerForUser } from '@launch/game-core';
import { buildEvmSignInMessage, verifyEvmSignature, isValidEvmAddress } from '@launch/evm';
import { buildSolanaSignInMessage, isValidSolanaAddress, verifySolanaSignature } from '@launch/solana';
import { ROBINHOOD_CHAIN_NETWORKS } from '@launch/config';
import { audit } from '../lib/audit.js';
import { REFRESH_COOKIE, clearRefreshCookie, hashPassword, issueRefreshToken, requireAuth, revokeRefreshToken, rotateRefreshToken, setRefreshCookie, signAccessToken, toAuthUser, verifyPassword } from '../lib/auth.js';
import { randomToken } from '../lib/crypto.js';
import { HttpError, badRequest, unauthorized } from '../lib/errors.js';

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
});
const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(128) });
const NonceSchema = z.object({ chain: z.enum(['SOLANA', 'ROBINHOOD']), address: z.string().min(20).max(64) });
const VerifySchema = z.object({ chain: z.enum(['SOLANA', 'ROBINHOOD']), address: z.string().min(20).max(64), nonce: z.string().min(8), signature: z.string().min(16).max(400) });

export const AUTH_RATE = { max: 10, timeWindow: '1 minute' };

export async function registerAuthRoutes(app: FastifyInstance) {
  const { env, db } = app.deps;
  const secure = env.NODE_ENV === 'production';

  async function session(reply: Parameters<typeof setRefreshCookie>[0], user: { id: string; email: string | null; username: string; role: 'USER' | 'MODERATOR' | 'ADMIN' | 'DEVELOPER'; status: 'ACTIVE' | 'BANNED' | 'SUSPENDED'; player: { id: string } | null }, meta: { userAgent?: string; ip?: string }) {
    if (user.status === 'BANNED') throw new HttpError(403, 'BANNED', 'This account is banned');
    const refresh = await issueRefreshToken(db, user.id, env.JWT_REFRESH_TTL_DAYS, meta);
    setRefreshCookie(reply, refresh.token, refresh.expiresAt, secure);
    const access = signAccessToken(env.JWT_SECRET, env.JWT_ACCESS_TTL, { sub: user.id, role: user.role, pid: user.player?.id ?? null, username: user.username });
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { user: toAuthUser(user), accessToken: access.token, expiresIn: access.expiresIn, refreshToken: refresh.token };
  }

  app.post('/auth/register', { config: { rateLimit: AUTH_RATE } }, async (request, reply) => {
    const body = RegisterSchema.parse(request.body);
    const exists = await db.user.findFirst({ where: { OR: [{ email: body.email.toLowerCase() }, { username: { equals: body.username, mode: 'insensitive' } }] } });
    if (exists) throw new HttpError(409, 'USER_EXISTS', 'Email or username already in use');
    const passwordHash = await hashPassword(body.password);
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email: body.email.toLowerCase(), username: body.username, passwordHash } });
      await createPlayerForUser(tx, u.id, body.username, app.game.now());
      return tx.user.findUniqueOrThrow({ where: { id: u.id }, include: { player: { select: { id: true } } } });
    });
    await audit(db, { actorUserId: user.id, action: 'auth.register', ip: request.ip });
    return reply.status(201).send(await session(reply, user, { userAgent: request.headers['user-agent'], ip: request.ip }));
  });

  app.post('/auth/login', { config: { rateLimit: AUTH_RATE } }, async (request, reply) => {
    const body = LoginSchema.parse(request.body);
    const user = await db.user.findUnique({ where: { email: body.email.toLowerCase() }, include: { player: { select: { id: true } } } });
    if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, body.password))) {
      await audit(db, { action: 'auth.login_failed', metadata: { email: body.email }, ip: request.ip });
      throw unauthorized('Invalid email or password');
    }
    await audit(db, { actorUserId: user.id, action: 'auth.login', ip: request.ip });
    return session(reply, user, { userAgent: request.headers['user-agent'], ip: request.ip });
  });

  app.post('/auth/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const bodyToken = (request.body as { refreshToken?: string } | null)?.refreshToken;
    const token = request.cookies[REFRESH_COOKIE] ?? bodyToken;
    if (!token) throw unauthorized('No refresh token');
    const rotated = await rotateRefreshToken(db, token, env.JWT_REFRESH_TTL_DAYS, { userAgent: request.headers['user-agent'], ip: request.ip });
    if (!rotated) {
      clearRefreshCookie(reply, secure);
      throw unauthorized('Refresh token invalid or reused');
    }
    const user = await db.user.findUniqueOrThrow({ where: { id: rotated.userId }, include: { player: { select: { id: true } } } });
    if (user.status === 'BANNED') throw new HttpError(403, 'BANNED', 'This account is banned');
    setRefreshCookie(reply, rotated.token, rotated.expiresAt, secure);
    const access = signAccessToken(env.JWT_SECRET, env.JWT_ACCESS_TTL, { sub: user.id, role: user.role, pid: user.player?.id ?? null, username: user.username });
    return { user: toAuthUser(user), accessToken: access.token, expiresIn: access.expiresIn, refreshToken: rotated.token };
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE] ?? (request.body as { refreshToken?: string } | null)?.refreshToken;
    if (token) await revokeRefreshToken(db, token);
    clearRefreshCookie(reply, secure);
    return { ok: true };
  });

  app.get('/auth/me', async (request) => {
    const auth = requireAuth(request);
    const user = await db.user.findUnique({ where: { id: auth.sub }, include: { player: { select: { id: true } }, wallets: true } });
    if (!user) throw unauthorized();
    return { user: toAuthUser(user), wallets: user.wallets.map((w) => ({ id: w.id, chain: w.chain, address: w.address, label: w.label, isPrimary: w.isPrimary, verifiedAt: w.verifiedAt.toISOString() })) };
  });

  // ── Wallet sign-in (Solana: ed25519; Robinhood Chain/EVM: EIP-191) ───────────
  app.post('/auth/wallet/nonce', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request) => {
    const body = NonceSchema.parse(request.body);
    if (body.chain === 'SOLANA' && !isValidSolanaAddress(body.address)) throw badRequest('INVALID_ADDRESS', 'Invalid Solana address');
    if (body.chain === 'ROBINHOOD' && !isValidEvmAddress(body.address)) throw badRequest('INVALID_ADDRESS', 'Invalid EVM address');
    const nonce = randomToken(16);
    const issuedAt = new Date().toISOString();
    const domain = new URL(env.WEB_PUBLIC_URL).host;
    const message =
      body.chain === 'SOLANA'
        ? buildSolanaSignInMessage({ domain, address: body.address, nonce, issuedAt })
        : buildEvmSignInMessage({ domain, address: body.address, nonce, issuedAt, chainId: ROBINHOOD_CHAIN_NETWORKS[env.ROBINHOOD_CHAIN_NETWORK].chainId });
    await app.deps.redis.set(`wallet:nonce:${body.chain}:${body.address.toLowerCase()}:${nonce}`, message, 'EX', 300);
    return { nonce, message, issuedAt };
  });

  app.post('/auth/wallet/verify', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = VerifySchema.parse(request.body);
    const { address } = await consumeNonceAndVerify(app, body);
    let wallet = await db.wallet.findUnique({ where: { chain_address: { chain: body.chain, address } }, include: { user: { include: { player: { select: { id: true } } } } } });
    if (!wallet) {
      // first-time wallet sign-in creates an account
      const username = `${body.chain === 'SOLANA' ? 'sol' : 'rh'}_${address.slice(0, 4)}${address.slice(-4)}_${randomToken(3).replace(/[^a-zA-Z0-9]/g, '').slice(0, 4)}`.slice(0, 20);
      const user = await db.$transaction(async (tx) => {
        const u = await tx.user.create({ data: { username, wallets: { create: { chain: body.chain, address, isPrimary: true } } } });
        await createPlayerForUser(tx, u.id, username, app.game.now());
        return u;
      });
      await audit(db, { actorUserId: user.id, action: 'auth.wallet_register', metadata: { chain: body.chain, address }, ip: request.ip });
      wallet = await db.wallet.findUniqueOrThrow({ where: { chain_address: { chain: body.chain, address } }, include: { user: { include: { player: { select: { id: true } } } } } });
      reply.status(201);
    }
    await audit(db, { actorUserId: wallet.userId, action: 'auth.wallet_login', metadata: { chain: body.chain, address }, ip: request.ip });
    return session(reply, wallet.user, { userAgent: request.headers['user-agent'], ip: request.ip });
  });
}

/** Shared by sign-in and wallet linking: one-time nonce lookup + signature verification. */
export async function consumeNonceAndVerify(app: FastifyInstance, body: z.infer<typeof VerifySchema>): Promise<{ address: string }> {
  const address = body.chain === 'ROBINHOOD' ? body.address.toLowerCase() : body.address;
  const key = `wallet:nonce:${body.chain}:${body.address.toLowerCase()}:${body.nonce}`;
  const message = await app.deps.redis.getdel(key);
  if (!message) throw badRequest('NONCE_INVALID', 'Sign-in request expired or already used. Request a new one.');
  const ok = body.chain === 'SOLANA' ? verifySolanaSignature(message, body.signature, body.address) : await verifyEvmSignature(message, body.signature, body.address);
  if (!ok) throw unauthorized('Signature verification failed');
  return { address };
}
