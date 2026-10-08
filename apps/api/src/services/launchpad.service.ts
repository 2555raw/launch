import type { FastifyInstance } from 'fastify';
import type { Project, Token } from '@launch/database';
import { EvmVerificationError, verifyErc20Deployment, type VerifiedErc20 } from '@launch/evm';
import { VerificationError, verifyTokenCreation, type VerifiedToken } from '@launch/solana';
import type { ProjectDTO, TokenDTO } from '@launch/types';
import type { Hex } from 'viem';
import { evmClient, explorerAddress, explorerTx, solanaConnection } from '../lib/chains.js';
import { HttpError } from '../lib/errors.js';
import { getMetrics } from './metrics.service.js';

export function slugify(name: string, symbol: string): string {
  const base = `${name}-${symbol}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export function tokenToDTO(t: Token, metrics: TokenDTO['metrics']): TokenDTO {
  return {
    id: t.id,
    chain: t.chain,
    network: t.network,
    address: t.address,
    creatorWallet: t.creatorWallet,
    createTxSignature: t.createTxSignature,
    decimals: t.decimals,
    supply: t.supply,
    tokenProgram: t.tokenProgram,
    metadataUri: t.metadataUri,
    mintAuthorityRevoked: t.mintAuthorityRevoked,
    explorerUrl: explorerAddress(t.chain, t.network, t.address),
    txExplorerUrl: explorerTx(t.chain, t.network, t.createTxSignature),
    verifiedAt: t.verifiedAt.toISOString(),
    metrics,
  };
}

export async function projectToDTO(app: FastifyInstance, p: Project & { creator: { id: string; username: string }; token: Token | null }, withMetrics = true): Promise<ProjectDTO> {
  const metrics = p.token ? (withMetrics ? await getMetrics(app, p.token) : ((p.token.metrics as TokenDTO['metrics']) ?? null)) : null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    symbol: p.symbol,
    description: p.description,
    logoUrl: p.logoUrl,
    website: p.website,
    twitter: p.twitter,
    discord: p.discord,
    telegram: p.telegram,
    chain: p.chain,
    network: p.network,
    totalSupply: p.totalSupply,
    decimals: p.decimals,
    fixedSupply: p.fixedSupply,
    revokeFreeze: p.revokeFreeze,
    status: p.status,
    failureReason: p.failureReason,
    metadataUri: p.metadataUri,
    creator: p.creator,
    token: p.token ? tokenToDTO(p.token, metrics) : null,
    createdAt: p.createdAt.toISOString(),
    publishedAt: p.publishedAt?.toISOString() ?? null,
  };
}

async function waitFor<T>(fn: () => Promise<T>, isRetryable: (e: unknown) => boolean, attempts = 12, delayMs = 2500): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isRetryable(e)) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}

/**
 * Verifies the user's signed launch transaction on chain and publishes the project.
 * Nothing from the client is trusted beyond the transaction id and the address to check.
 */
export async function verifyAndPublish(app: FastifyInstance, project: Project, userId: string, input: { signature: string; address: string }): Promise<void> {
  const { env, db } = app.deps;
  await db.project.update({ where: { id: project.id }, data: { status: 'VERIFYING', failureReason: null } });
  try {
    const linkedWallets = await db.wallet.findMany({ where: { userId, chain: project.chain } });
    const linked = new Set(linkedWallets.map((w) => (project.chain === 'ROBINHOOD' ? w.address.toLowerCase() : w.address)));
    const expectedRaw = BigInt(project.totalSupply) * 10n ** BigInt(project.decimals);

    if (project.chain === 'SOLANA') {
      const connection = solanaConnection(env);
      const v: VerifiedToken = await waitFor(
        () => verifyTokenCreation(connection, input.signature, input.address),
        (e) => e instanceof VerificationError && (e.code === 'TX_NOT_FOUND' || e.code === 'MINT_NOT_FOUND'),
      );
      if (!linked.has(v.feePayer)) throw new HttpError(403, 'WALLET_NOT_LINKED', `The transaction was paid by ${v.feePayer}, which is not linked to your account`);
      if (v.decimals !== project.decimals) throw new HttpError(400, 'DECIMALS_MISMATCH', `On-chain decimals ${v.decimals} differ from project ${project.decimals}`);
      if (v.supply !== expectedRaw) throw new HttpError(400, 'SUPPLY_MISMATCH', `On-chain supply ${v.supply} differs from project ${expectedRaw}`);
      if (v.symbol && v.symbol !== project.symbol) throw new HttpError(400, 'SYMBOL_MISMATCH', `On-chain symbol ${v.symbol} differs from project ${project.symbol}`);
      if (project.fixedSupply && v.mintAuthority !== null) throw new HttpError(400, 'MINT_AUTHORITY_NOT_REVOKED', 'The project promises a fixed supply but the mint authority is still active');
      await db.$transaction(async (tx) => {
        await tx.token.create({
          data: { projectId: project.id, chain: 'SOLANA', network: env.SOLANA_NETWORK, address: v.mint, creatorWallet: v.feePayer, createTxSignature: v.signature, decimals: v.decimals, supply: v.supply.toString(), tokenProgram: v.tokenProgram, metadataUri: v.uri, mintAuthorityRevoked: v.mintAuthority === null, verifiedAt: new Date() },
        });
        await tx.transaction.upsert({
          where: { chain_network_signature: { chain: 'SOLANA', network: env.SOLANA_NETWORK, signature: v.signature } },
          update: { status: 'CONFIRMED', confirmedAt: new Date(), blockRef: String(v.slot) },
          create: { userId, chain: 'SOLANA', network: env.SOLANA_NETWORK, signature: v.signature, kind: 'TOKEN_CREATE', status: 'CONFIRMED', fromAddress: v.feePayer, toAddress: v.mint, amount: v.supply.toString(), asset: v.mint, blockRef: String(v.slot), confirmedAt: new Date(), raw: { blockTime: v.blockTime } },
        });
        await tx.project.update({ where: { id: project.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
      });
    } else {
      const client = evmClient(env);
      const v: VerifiedErc20 = await waitFor(
        () => verifyErc20Deployment(client, input.signature as Hex, input.address),
        (e) => e instanceof EvmVerificationError && e.code === 'TX_NOT_FOUND',
      );
      if (!linked.has(v.deployer.toLowerCase())) throw new HttpError(403, 'WALLET_NOT_LINKED', `The transaction was sent by ${v.deployer}, which is not linked to your account`);
      if (v.decimals !== project.decimals) throw new HttpError(400, 'DECIMALS_MISMATCH', `On-chain decimals ${v.decimals} differ from project ${project.decimals}`);
      if (v.totalSupply !== expectedRaw) throw new HttpError(400, 'SUPPLY_MISMATCH', `On-chain supply ${v.totalSupply} differs from project ${expectedRaw}`);
      if (v.symbol !== project.symbol) throw new HttpError(400, 'SYMBOL_MISMATCH', `On-chain symbol ${v.symbol} differs from project ${project.symbol}`);
      if (project.fixedSupply && v.mintingDisabled !== true) throw new HttpError(400, 'MINTING_NOT_DISABLED', 'The project promises a fixed supply but minting is still enabled on the contract');
      await db.$transaction(async (tx) => {
        await tx.token.create({
          data: { projectId: project.id, chain: 'ROBINHOOD', network: env.ROBINHOOD_CHAIN_NETWORK, address: v.address.toLowerCase(), creatorWallet: v.deployer.toLowerCase(), createTxSignature: v.txHash, decimals: v.decimals, supply: v.totalSupply.toString(), tokenProgram: 'ERC20', metadataUri: project.metadataUri, mintAuthorityRevoked: v.mintingDisabled === true, verifiedAt: new Date() },
        });
        await tx.transaction.upsert({
          where: { chain_network_signature: { chain: 'ROBINHOOD', network: env.ROBINHOOD_CHAIN_NETWORK, signature: v.txHash } },
          update: { status: 'CONFIRMED', confirmedAt: new Date(), blockRef: v.blockNumber.toString() },
          create: { userId, chain: 'ROBINHOOD', network: env.ROBINHOOD_CHAIN_NETWORK, signature: v.txHash, kind: 'TOKEN_CREATE', status: 'CONFIRMED', fromAddress: v.deployer.toLowerCase(), toAddress: v.address.toLowerCase(), amount: v.totalSupply.toString(), asset: v.address.toLowerCase(), blockRef: v.blockNumber.toString(), confirmedAt: new Date(), raw: { chainId: v.chainId } },
        });
        await tx.project.update({ where: { id: project.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.project.update({ where: { id: project.id }, data: { status: 'AWAITING_SIGNATURE', failureReason: message } });
    if (e instanceof HttpError) throw e;
    if (e instanceof VerificationError || e instanceof EvmVerificationError) throw new HttpError(400, e.code, e.message);
    throw e;
  }
}
