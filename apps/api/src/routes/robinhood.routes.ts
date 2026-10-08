import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ROBINHOOD_CAPABILITIES, RobinhoodApiError, RobinhoodCryptoClient, generateRobinhoodKeyPair, keyPairFromBase64 } from '@launch/robinhood';
import { audit } from '../lib/audit.js';
import { requireAuth } from '../lib/auth.js';
import { decryptSecret, encryptSecret } from '../lib/crypto.js';
import { HttpError } from '../lib/errors.js';

const ConnectSchema = z.object({ apiKey: z.string().min(8).max(200), privateKeyBase64: z.string().min(40).max(120), label: z.string().max(40).optional() });
const OrderSchema = z.object({
  symbol: z.string().regex(/^[A-Z0-9]{2,10}-USD$/),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit']),
  assetQuantity: z.string().regex(/^\d+(\.\d+)?$/),
  limitPrice: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  clientOrderId: z.string().uuid(),
});

/** Builds a Robinhood crypto client from the user's encrypted credentials, or null if not linked. */
export async function getRobinhoodClientForUser(app: FastifyInstance, userId: string): Promise<RobinhoodCryptoClient | null> {
  const { env, db } = app.deps;
  const conn = await db.robinhoodConnection.findUnique({ where: { userId } });
  if (!conn) return null;
  return new RobinhoodCryptoClient({ apiKey: decryptSecret(conn.apiKeyEnc, env.CREDENTIALS_ENCRYPTION_KEY), privateKeyBase64: decryptSecret(conn.privateKeyEnc, env.CREDENTIALS_ENCRYPTION_KEY) }, env.ROBINHOOD_API_BASE_URL);
}

function mapRhError(e: unknown): never {
  if (e instanceof RobinhoodApiError) throw new HttpError(e.status === 401 || e.status === 403 ? 401 : 502, 'ROBINHOOD_API', e.message, e.body);
  throw e;
}

export async function registerRobinhoodRoutes(app: FastifyInstance) {
  const { env, db } = app.deps;

  app.get('/robinhood/capabilities', async (request) => {
    const linked = request.auth ? !!(await db.robinhoodConnection.findUnique({ where: { userId: request.auth.sub }, select: { id: true } })) : false;
    return { capabilities: ROBINHOOD_CAPABILITIES, apiBaseUrl: env.ROBINHOOD_API_BASE_URL, linked };
  });

  /** Generates an Ed25519 key pair the user registers at robinhood.com/account/crypto. The private key is returned once and never stored here. */
  app.post('/robinhood/keypair', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request) => {
    requireAuth(request);
    return generateRobinhoodKeyPair();
  });

  app.get('/robinhood/connection', async (request) => {
    const auth = requireAuth(request);
    const conn = await db.robinhoodConnection.findUnique({ where: { userId: auth.sub } });
    return { connection: conn ? { label: conn.label, publicKeyBase64: conn.publicKeyBase64, lastVerifiedAt: conn.lastVerifiedAt?.toISOString() ?? null, createdAt: conn.createdAt.toISOString() } : null };
  });

  app.post('/robinhood/connection', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request) => {
    const auth = requireAuth(request);
    const body = ConnectSchema.parse(request.body);
    let publicKeyBase64: string;
    try {
      publicKeyBase64 = Buffer.from(keyPairFromBase64(body.privateKeyBase64).publicKey).toString('base64');
    } catch (e) {
      throw new HttpError(400, 'BAD_KEY', (e as Error).message);
    }
    // prove the credentials work before storing them
    const client = new RobinhoodCryptoClient({ apiKey: body.apiKey, privateKeyBase64: body.privateKeyBase64 }, env.ROBINHOOD_API_BASE_URL);
    const account = await client.getAccount().catch(mapRhError);
    await db.robinhoodConnection.upsert({
      where: { userId: auth.sub },
      update: { apiKeyEnc: encryptSecret(body.apiKey, env.CREDENTIALS_ENCRYPTION_KEY), privateKeyEnc: encryptSecret(body.privateKeyBase64, env.CREDENTIALS_ENCRYPTION_KEY), publicKeyBase64, label: body.label, lastVerifiedAt: new Date() },
      create: { userId: auth.sub, apiKeyEnc: encryptSecret(body.apiKey, env.CREDENTIALS_ENCRYPTION_KEY), privateKeyEnc: encryptSecret(body.privateKeyBase64, env.CREDENTIALS_ENCRYPTION_KEY), publicKeyBase64, label: body.label, lastVerifiedAt: new Date() },
    });
    await audit(db, { actorUserId: auth.sub, action: 'robinhood.connect', ip: request.ip });
    return { ok: true, account };
  });

  app.delete('/robinhood/connection', async (request) => {
    const auth = requireAuth(request);
    await db.robinhoodConnection.deleteMany({ where: { userId: auth.sub } });
    await audit(db, { actorUserId: auth.sub, action: 'robinhood.disconnect', ip: request.ip });
    return { ok: true };
  });

  const withClient = async (request: Parameters<typeof requireAuth>[0]) => {
    const auth = requireAuth(request);
    const client = await getRobinhoodClientForUser(app, auth.sub);
    if (!client) throw new HttpError(409, 'NOT_CONNECTED', 'Link your Robinhood Crypto API credentials in Settings first');
    return { auth, client };
  };

  app.get('/robinhood/account', async (request) => ({ account: await (await withClient(request)).client.getAccount().catch(mapRhError) }));
  app.get('/robinhood/holdings', async (request) => ({ holdings: (await (await withClient(request)).client.getHoldings().catch(mapRhError)).results }));
  app.get('/robinhood/pairs', async (request) => ({ pairs: (await (await withClient(request)).client.getTradingPairs().catch(mapRhError)).results }));
  app.get('/robinhood/quotes', async (request) => {
    const { client } = await withClient(request);
    const symbols = String((request.query as { symbols?: string }).symbols ?? 'BTC-USD,ETH-USD,SOL-USD').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
    return { quotes: (await client.getBestBidAsk(symbols).catch(mapRhError)).results };
  });
  app.get('/robinhood/orders', async (request) => ({ orders: (await (await withClient(request)).client.getOrders().catch(mapRhError)).results }));
  app.post('/robinhood/orders', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const { auth, client } = await withClient(request);
    const body = OrderSchema.parse(request.body);
    const order = await client
      .placeOrder({
        client_order_id: body.clientOrderId,
        side: body.side,
        type: body.type,
        symbol: body.symbol,
        ...(body.type === 'market' ? { market_order_config: { asset_quantity: body.assetQuantity } } : { limit_order_config: { asset_quantity: body.assetQuantity, limit_price: body.limitPrice ?? '0', time_in_force: 'gtc' as const } }),
      })
      .catch(mapRhError);
    await audit(db, { actorUserId: auth.sub, action: 'robinhood.order', metadata: { symbol: body.symbol, side: body.side, type: body.type, assetQuantity: body.assetQuantity, orderId: order.id }, ip: request.ip });
    return { order };
  });
  app.post('/robinhood/orders/:id/cancel', async (request) => {
    const { auth, client } = await withClient(request);
    const { id } = request.params as { id: string };
    const result = await client.cancelOrder(id).catch(mapRhError);
    await audit(db, { actorUserId: auth.sub, action: 'robinhood.order_cancel', metadata: { orderId: id }, ip: request.ip });
    return { result };
  });
}
