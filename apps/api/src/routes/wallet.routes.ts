import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../lib/audit.js';
import { requireAuth } from '../lib/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { consumeNonceAndVerify } from './auth.routes.js';

const LinkSchema = z.object({ chain: z.enum(['SOLANA', 'ROBINHOOD']), address: z.string().min(20).max(64), nonce: z.string().min(8), signature: z.string().min(16).max(400), label: z.string().max(40).optional() });

export async function registerWalletRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  app.get('/wallets', async (request) => {
    const auth = requireAuth(request);
    const wallets = await db.wallet.findMany({ where: { userId: auth.sub }, orderBy: { createdAt: 'asc' } });
    return { wallets: wallets.map((w) => ({ id: w.id, chain: w.chain, address: w.address, label: w.label, isPrimary: w.isPrimary, verifiedAt: w.verifiedAt.toISOString() })) };
  });

  /** Links an additional wallet to the signed-in account (same nonce + signature flow as sign-in). */
  app.post('/wallets/link', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const auth = requireAuth(request);
    const body = LinkSchema.parse(request.body);
    const { address } = await consumeNonceAndVerify(app, body);
    const existing = await db.wallet.findUnique({ where: { chain_address: { chain: body.chain, address } } });
    if (existing && existing.userId !== auth.sub) throw new HttpError(409, 'WALLET_TAKEN', 'This wallet is linked to another account');
    if (existing) return { wallet: existing };
    const count = await db.wallet.count({ where: { userId: auth.sub, chain: body.chain } });
    const wallet = await db.wallet.create({ data: { userId: auth.sub, chain: body.chain, address, label: body.label, isPrimary: count === 0 } });
    await audit(db, { actorUserId: auth.sub, action: 'wallet.link', targetType: 'wallet', targetId: wallet.id, metadata: { chain: body.chain, address }, ip: request.ip });
    return reply.status(201).send({ wallet: { id: wallet.id, chain: wallet.chain, address: wallet.address, label: wallet.label, isPrimary: wallet.isPrimary, verifiedAt: wallet.verifiedAt.toISOString() } });
  });

  app.delete('/wallets/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const wallet = await db.wallet.findFirst({ where: { id, userId: auth.sub } });
    if (!wallet) throw notFound('Wallet not found');
    const user = await db.user.findUniqueOrThrow({ where: { id: auth.sub }, include: { wallets: true } });
    if (!user.passwordHash && user.wallets.length === 1) throw new HttpError(409, 'LAST_LOGIN_METHOD', 'Set a password before removing your only wallet');
    await db.wallet.delete({ where: { id } });
    await audit(db, { actorUserId: auth.sub, action: 'wallet.unlink', targetType: 'wallet', targetId: id, ip: request.ip });
    return { ok: true };
  });

  app.patch('/wallets/:id/primary', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const wallet = await db.wallet.findFirst({ where: { id, userId: auth.sub } });
    if (!wallet) throw notFound('Wallet not found');
    await db.$transaction([db.wallet.updateMany({ where: { userId: auth.sub, chain: wallet.chain }, data: { isPrimary: false } }), db.wallet.update({ where: { id }, data: { isPrimary: true } })]);
    return { ok: true };
  });
}
