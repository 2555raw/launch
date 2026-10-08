import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { JupiterClient, WELL_KNOWN_MINTS } from '@launch/solana';
import { requireAuth } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';

const QuoteSchema = z.object({
  inputMint: z.string().min(32).max(44),
  outputMint: z.string().min(32).max(44),
  amount: z.string().regex(/^\d+$/),
  taker: z.string().min(32).max(44).optional(),
  slippageBps: z.coerce.number().int().min(1).max(5000).optional(),
});
const ExecuteSchema = z.object({ signedTransaction: z.string().min(100), requestId: z.string().min(4), inputMint: z.string(), outputMint: z.string(), taker: z.string() });

/**
 * Jupiter Swap API v2 proxy. Jupiter aggregates mainnet liquidity only: on devnet the quote
 * endpoint responds with "no route" errors, which we pass through unchanged.
 */
export async function registerSwapRoutes(app: FastifyInstance) {
  const { env, db } = app.deps;
  const jupiter = new JupiterClient(env.JUPITER_API_URL, env.JUPITER_API_KEY);

  app.get('/swap/config', async () => ({ provider: 'jupiter', apiUrl: env.JUPITER_API_URL, network: env.SOLANA_NETWORK, executable: env.SOLANA_NETWORK === 'mainnet-beta', wellKnownMints: WELL_KNOWN_MINTS, keyless: !env.JUPITER_API_KEY }));

  app.get('/swap/quote', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
    requireAuth(request);
    const q = QuoteSchema.parse(request.query);
    const cacheKey = `swap:quote:${q.inputMint}:${q.outputMint}:${q.amount}:${q.taker ?? ''}:${q.slippageBps ?? ''}`;
    const cached = await app.deps.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    try {
      const order = await jupiter.order(q);
      await app.deps.redis.set(cacheKey, JSON.stringify({ order }), 'EX', 3);
      return { order };
    } catch (e) {
      throw new HttpError(502, 'JUPITER_ERROR', (e as Error).message);
    }
  });

  app.post('/swap/execute', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const auth = requireAuth(request);
    if (env.SOLANA_NETWORK !== 'mainnet-beta') throw new HttpError(409, 'MAINNET_ONLY', 'Swaps execute on mainnet-beta only; this server runs on ' + env.SOLANA_NETWORK);
    const body = ExecuteSchema.parse(request.body);
    const linked = await db.wallet.findFirst({ where: { userId: auth.sub, chain: 'SOLANA', address: body.taker } });
    if (!linked) throw new HttpError(403, 'WALLET_NOT_LINKED', 'Link this wallet to your account before swapping');
    let result;
    try {
      result = await jupiter.execute(body.signedTransaction, body.requestId);
    } catch (e) {
      throw new HttpError(502, 'JUPITER_ERROR', (e as Error).message);
    }
    if (result.signature) {
      await db.transaction.upsert({
        where: { chain_network_signature: { chain: 'SOLANA', network: env.SOLANA_NETWORK, signature: result.signature } },
        update: { status: result.status === 'Success' ? 'CONFIRMED' : 'FAILED', confirmedAt: result.status === 'Success' ? new Date() : null, raw: result as object },
        create: { userId: auth.sub, chain: 'SOLANA', network: env.SOLANA_NETWORK, signature: result.signature, kind: 'SWAP', status: result.status === 'Success' ? 'CONFIRMED' : 'FAILED', fromAddress: body.taker, asset: body.outputMint, amount: result.totalOutputAmount ?? null, confirmedAt: result.status === 'Success' ? new Date() : null, raw: result as object },
      });
    }
    return { result };
  });
}
