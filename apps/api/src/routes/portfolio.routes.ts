import type { FastifyInstance } from 'fastify';
import type { Address } from 'viem';
import { getErc20Balance, getNativeBalance } from '@launch/evm';
import { getWalletBalances } from '@launch/solana';
import { requireAuth } from '../lib/auth.js';
import { evmClient, explorerAddress, solanaConnection } from '../lib/chains.js';
import { getRobinhoodClientForUser } from './robinhood.routes.js';

/**
 * Aggregates REAL balances for every linked wallet (RPC reads) plus Robinhood crypto holdings
 * when the user linked API credentials. Each source reports its own error instead of failing the page.
 */
export async function registerPortfolioRoutes(app: FastifyInstance) {
  const { env, db } = app.deps;

  app.get('/portfolio', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
    const auth = requireAuth(request);
    const wallets = await db.wallet.findMany({ where: { userId: auth.sub } });
    const launched = await db.token.findMany({ include: { project: { select: { name: true, symbol: true, slug: true, logoUrl: true } } } });
    const byAddress = new Map(launched.map((t) => [t.address.toLowerCase(), t]));

    const solana = await Promise.all(
      wallets.filter((w) => w.chain === 'SOLANA').map(async (w) => {
        try {
          const b = await getWalletBalances(solanaConnection(env), w.address);
          return {
            walletId: w.id,
            address: w.address,
            network: env.SOLANA_NETWORK,
            explorerUrl: explorerAddress('SOLANA', env.SOLANA_NETWORK, w.address),
            native: { symbol: 'SOL', amount: b.sol, raw: String(b.lamports) },
            tokens: b.tokens.map((t) => {
              const known = byAddress.get(t.mint.toLowerCase());
              return { mint: t.mint, amount: t.uiAmount, raw: t.amount, decimals: t.decimals, tokenProgram: t.tokenProgram, project: known ? { name: known.project.name, symbol: known.project.symbol, slug: known.project.slug, logoUrl: known.project.logoUrl } : null };
            }),
            error: null,
          };
        } catch (e) {
          return { walletId: w.id, address: w.address, network: env.SOLANA_NETWORK, explorerUrl: explorerAddress('SOLANA', env.SOLANA_NETWORK, w.address), native: null, tokens: [], error: (e as Error).message };
        }
      }),
    );

    const client = evmClient(env);
    const evmTokens = launched.filter((t) => t.chain === 'ROBINHOOD' && t.network === env.ROBINHOOD_CHAIN_NETWORK);
    const robinhoodChain = await Promise.all(
      wallets.filter((w) => w.chain === 'ROBINHOOD').map(async (w) => {
        try {
          const native = await getNativeBalance(client, w.address as Address);
          const tokens = (
            await Promise.all(
              evmTokens.map(async (t) => {
                try {
                  const bal = await getErc20Balance(client, t.address as Address, w.address as Address);
                  if (bal.raw === 0n) return null;
                  return { address: t.address, amount: Number(bal.formatted), raw: bal.raw.toString(), decimals: bal.decimals, project: { name: t.project.name, symbol: t.project.symbol, slug: t.project.slug, logoUrl: t.project.logoUrl } };
                } catch {
                  return null;
                }
              }),
            )
          ).filter((x): x is NonNullable<typeof x> => x !== null);
          return { walletId: w.id, address: w.address, network: env.ROBINHOOD_CHAIN_NETWORK, explorerUrl: explorerAddress('ROBINHOOD', env.ROBINHOOD_CHAIN_NETWORK, w.address), native: { symbol: 'ETH', amount: Number(native.eth), raw: native.wei.toString() }, tokens, error: null };
        } catch (e) {
          return { walletId: w.id, address: w.address, network: env.ROBINHOOD_CHAIN_NETWORK, explorerUrl: explorerAddress('ROBINHOOD', env.ROBINHOOD_CHAIN_NETWORK, w.address), native: null, tokens: [], error: (e as Error).message };
        }
      }),
    );

    let robinhood: { linked: boolean; holdings: unknown[]; account: unknown; error: string | null } = { linked: false, holdings: [], account: null, error: null };
    const rh = await getRobinhoodClientForUser(app, auth.sub);
    if (rh) {
      try {
        const [account, holdings] = await Promise.all([rh.getAccount(), rh.getHoldings()]);
        robinhood = { linked: true, account, holdings: holdings.results, error: null };
      } catch (e) {
        robinhood = { linked: true, account: null, holdings: [], error: (e as Error).message };
      }
    }
    return { solana, robinhoodChain, robinhood, generatedAt: new Date().toISOString() };
  });
}
