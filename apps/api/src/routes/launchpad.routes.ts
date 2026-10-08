import type { FastifyInstance } from 'fastify';
import { createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { ROBINHOOD_CHAIN_NETWORKS } from '@launch/config';
import type { Prisma } from '@launch/database';
import { LAUNCH_TOKEN_ABI, LAUNCH_TOKEN_BYTECODE, LAUNCH_TOKEN_COMPILER, validateErc20Input } from '@launch/evm';
import { validateTokenInput } from '@launch/solana';
import type { ProjectStatus } from '@launch/types';
import { audit } from '../lib/audit.js';
import { requireAuth } from '../lib/auth.js';
import { explorerTx, networkFor } from '../lib/chains.js';
import { HttpError, badRequest, notFound } from '../lib/errors.js';
import { projectToDTO, slugify, verifyAndPublish } from '../services/launchpad.service.js';
import { refreshTokenMetrics } from '../services/metrics.service.js';

const url = z.string().url().max(200).optional().or(z.literal('').transform(() => undefined));
const ProjectSchema = z.object({
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(10).regex(/^[A-Za-z0-9]+$/).transform((s) => s.toUpperCase()),
  description: z.string().max(2000).default(''),
  website: url,
  twitter: url,
  discord: url,
  telegram: url,
  chain: z.enum(['SOLANA', 'ROBINHOOD']),
  totalSupply: z.string().regex(/^\d{1,30}$/, 'Whole number'),
  decimals: z.number().int().min(0).max(18),
  fixedSupply: z.boolean().default(true),
  revokeFreeze: z.boolean().default(true),
});
const SubmitSchema = z.object({ signature: z.string().min(10).max(140), address: z.string().min(10).max(64) });
const ALLOWED_LOGO = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/svg+xml', 'svg'],
]);

export async function registerLaunchpadRoutes(app: FastifyInstance, uploadsDir: string) {
  const { env, db } = app.deps;
  const include = { creator: { select: { id: true, username: true } }, token: true } as const;

  app.get('/launchpad/config', async () => ({
    solana: { network: env.SOLANA_NETWORK, rpcUrl: env.SOLANA_RPC_URL },
    robinhoodChain: { network: env.ROBINHOOD_CHAIN_NETWORK, ...ROBINHOOD_CHAIN_NETWORKS[env.ROBINHOOD_CHAIN_NETWORK] },
    erc20: { abi: LAUNCH_TOKEN_ABI, bytecode: LAUNCH_TOKEN_BYTECODE, compiler: LAUNCH_TOKEN_COMPILER },
  }));

  app.get('/launchpad/projects', async (request) => {
    const q = request.query as { sort?: string; chain?: string; q?: string; cursor?: string; limit?: string; status?: string };
    const take = Math.min(60, Math.max(1, Number(q.limit ?? 24)));
    const mine = request.auth && q.status && q.status !== 'PUBLISHED';
    const where: Prisma.ProjectWhereInput = {
      ...(mine ? { status: q.status as 'DRAFT', creatorUserId: request.auth!.sub } : { status: 'PUBLISHED' }),
      ...(q.chain === 'SOLANA' || q.chain === 'ROBINHOOD' ? { chain: q.chain } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { symbol: { contains: q.q, mode: 'insensitive' } }, { token: { address: { contains: q.q } } }] } : {}),
    };
    const projects = await db.project.findMany({ where, include, orderBy: { publishedAt: 'desc' }, take: 300 });
    const dtos = await Promise.all(projects.map((p) => projectToDTO(app, p, false)));
    const metric = (p: (typeof dtos)[number], key: 'volume24hUsd' | 'liquidityUsd' | 'marketCapUsd' | 'holders' | 'txns24h') => p.token?.metrics?.[key] ?? -1;
    const sort = q.sort ?? 'new';
    const sorted =
      sort === 'trending' ? [...dtos].sort((a, b) => metric(b, 'txns24h') - metric(a, 'txns24h'))
      : sort === 'volume' ? [...dtos].sort((a, b) => metric(b, 'volume24hUsd') - metric(a, 'volume24hUsd'))
      : sort === 'liquidity' ? [...dtos].sort((a, b) => metric(b, 'liquidityUsd') - metric(a, 'liquidityUsd'))
      : sort === 'marketcap' ? [...dtos].sort((a, b) => metric(b, 'marketCapUsd') - metric(a, 'marketCapUsd'))
      : sort === 'holders' ? [...dtos].sort((a, b) => metric(b, 'holders') - metric(a, 'holders'))
      : dtos;
    const start = q.cursor ? Math.max(0, Number(q.cursor)) : 0;
    const items = sorted.slice(start, start + take);
    return { items, nextCursor: start + take < sorted.length ? String(start + take) : null, total: sorted.length };
  });

  app.get('/launchpad/mine', async (request) => {
    const auth = requireAuth(request);
    const projects = await db.project.findMany({ where: { creatorUserId: auth.sub }, include, orderBy: { createdAt: 'desc' } });
    return { items: await Promise.all(projects.map((p) => projectToDTO(app, p, false))) };
  });

  app.get('/launchpad/projects/:slug', async (request) => {
    const { slug } = request.params as { slug: string };
    const p = await db.project.findFirst({ where: { OR: [{ slug }, { id: slug }, { token: { address: slug } }] }, include });
    if (!p) throw notFound('Project not found');
    if (p.status !== 'PUBLISHED' && p.creatorUserId !== request.auth?.sub && !['ADMIN', 'MODERATOR'].includes(request.auth?.role ?? '')) throw notFound('Project not found');
    const transactions = p.token ? await db.transaction.findMany({ where: { asset: p.token.address }, orderBy: { createdAt: 'desc' }, take: 20 }) : [];
    return { project: await projectToDTO(app, p, true), transactions: transactions.map((t) => ({ id: t.id, kind: t.kind, chain: t.chain, network: t.network, signature: t.signature, status: t.status, fromAddress: t.fromAddress, toAddress: t.toAddress, amount: t.amount, explorerUrl: explorerTx(t.chain, t.network, t.signature), confirmedAt: t.confirmedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() })) };
  });

  app.post('/launchpad/projects/:slug/refresh-metrics', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const { slug } = request.params as { slug: string };
    const p = await db.project.findFirst({ where: { OR: [{ slug }, { id: slug }] }, include });
    if (!p?.token) throw notFound('Token not found');
    return { metrics: await refreshTokenMetrics(app, p.token.id) };
  });

  app.post('/launchpad/projects', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (request, reply) => {
    const auth = requireAuth(request);
    const body = ProjectSchema.parse(request.body);
    const supply = BigInt(body.totalSupply);
    const errors = body.chain === 'SOLANA' ? validateTokenInput({ name: body.name, symbol: body.symbol, decimals: body.decimals, totalSupply: supply }) : validateErc20Input({ name: body.name, symbol: body.symbol, decimals: body.decimals, totalSupply: supply });
    if (errors.length) throw badRequest('INVALID_TOKEN', errors.join('; '), errors);
    const project = await db.project.create({ data: { ...body, creatorUserId: auth.sub, slug: slugify(body.name, body.symbol), network: networkFor(env, body.chain), status: 'DRAFT' }, include });
    await audit(db, { actorUserId: auth.sub, action: 'launchpad.project_create', targetType: 'project', targetId: project.id, ip: request.ip });
    return reply.status(201).send({ project: await projectToDTO(app, project, false) });
  });

  app.patch('/launchpad/projects/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const existing = await db.project.findFirst({ where: { id, creatorUserId: auth.sub } });
    if (!existing) throw notFound('Project not found');
    if (!(['DRAFT', 'AWAITING_SIGNATURE'] as ProjectStatus[]).includes(existing.status)) throw new HttpError(409, 'LOCKED', 'Published projects cannot be edited');
    const body = ProjectSchema.partial().parse(request.body);
    const merged = { ...existing, ...body };
    const supply = BigInt(merged.totalSupply);
    const errors = merged.chain === 'SOLANA' ? validateTokenInput({ name: merged.name, symbol: merged.symbol, decimals: merged.decimals, totalSupply: supply }) : validateErc20Input({ name: merged.name, symbol: merged.symbol, decimals: merged.decimals, totalSupply: supply });
    if (errors.length) throw badRequest('INVALID_TOKEN', errors.join('; '), errors);
    const project = await db.project.update({ where: { id }, data: { ...body, network: body.chain ? networkFor(env, body.chain) : undefined, status: 'DRAFT', metadataUri: null }, include });
    return { project: await projectToDTO(app, project, false) };
  });

  app.post('/launchpad/projects/:id/logo', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const project = await db.project.findFirst({ where: { id, creatorUserId: auth.sub } });
    if (!project) throw notFound('Project not found');
    if (project.status === 'PUBLISHED') throw new HttpError(409, 'LOCKED', 'Published projects cannot be edited');
    const file = await request.file();
    if (!file) throw badRequest('NO_FILE', 'Upload a logo file');
    const ext = ALLOWED_LOGO.get(file.mimetype);
    if (!ext) throw badRequest('BAD_TYPE', 'Logo must be PNG, JPEG, WebP or SVG');
    const filename = `${project.id}.${ext}`;
    await pipeline(file.file, createWriteStream(path.join(uploadsDir, 'logos', filename)));
    if (file.file.truncated) throw badRequest('TOO_LARGE', 'Logo must be under 2 MB');
    const logoUrl = `${env.API_PUBLIC_URL}/uploads/logos/${filename}?v=${Date.now()}`;
    const updated = await db.project.update({ where: { id }, data: { logoUrl }, include });
    return { project: await projectToDTO(app, updated, false) };
  });

  /** Writes the off-chain metadata JSON and returns everything the wallet needs to build the transaction. */
  app.post('/launchpad/projects/:id/prepare', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const project = await db.project.findFirst({ where: { id, creatorUserId: auth.sub }, include });
    if (!project) throw notFound('Project not found');
    if (project.status === 'PUBLISHED') throw new HttpError(409, 'ALREADY_PUBLISHED', 'This project is already published');
    const wallets = await db.wallet.findMany({ where: { userId: auth.sub, chain: project.chain } });
    if (wallets.length === 0) throw new HttpError(409, 'NO_LINKED_WALLET', `Link a ${project.chain === 'SOLANA' ? 'Solana' : 'Robinhood Chain'} wallet first so the launch can be attributed to you`);
    const metadata = {
      name: project.name,
      symbol: project.symbol,
      description: project.description,
      image: project.logoUrl,
      external_url: project.website,
      attributes: [],
      properties: { category: 'fungible', chain: project.chain, decimals: project.decimals, totalSupply: project.totalSupply },
      extensions: { website: project.website, twitter: project.twitter, discord: project.discord, telegram: project.telegram },
      launchpad: { project: project.id, platform: 'Launch', createdAt: new Date().toISOString() },
    };
    await writeFile(path.join(uploadsDir, 'metadata', `${project.id}.json`), JSON.stringify(metadata, null, 2));
    const metadataUri = `${env.API_PUBLIC_URL}/uploads/metadata/${project.id}.json`;
    const updated = await db.project.update({ where: { id }, data: { metadataUri, status: 'AWAITING_SIGNATURE', failureReason: null }, include });
    return {
      project: await projectToDTO(app, updated, false),
      metadataUri,
      linkedWallets: wallets.map((w) => w.address),
      chain: project.chain === 'SOLANA' ? { network: env.SOLANA_NETWORK, rpcUrl: env.SOLANA_RPC_URL } : { network: env.ROBINHOOD_CHAIN_NETWORK, ...ROBINHOOD_CHAIN_NETWORKS[env.ROBINHOOD_CHAIN_NETWORK], abi: LAUNCH_TOKEN_ABI, bytecode: LAUNCH_TOKEN_BYTECODE },
    };
  });

  /** Called after the wallet broadcast the transaction. Verifies on chain, then publishes. */
  app.post('/launchpad/projects/:id/submit', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const body = SubmitSchema.parse(request.body);
    const project = await db.project.findFirst({ where: { id, creatorUserId: auth.sub } });
    if (!project) throw notFound('Project not found');
    if (project.status === 'PUBLISHED') throw new HttpError(409, 'ALREADY_PUBLISHED', 'This project is already published');
    if (project.status === 'VERIFYING') throw new HttpError(409, 'VERIFYING', 'Verification already in progress');
    if (project.status !== 'AWAITING_SIGNATURE') throw new HttpError(409, 'NOT_PREPARED', 'Prepare the launch first');
    await db.transaction.upsert({
      where: { chain_network_signature: { chain: project.chain, network: project.network, signature: body.signature } },
      update: {},
      create: { userId: auth.sub, chain: project.chain, network: project.network, signature: body.signature, kind: 'TOKEN_CREATE', status: 'PENDING', toAddress: body.address, asset: body.address },
    });
    await verifyAndPublish(app, project, auth.sub, body);
    await audit(db, { actorUserId: auth.sub, action: 'launchpad.project_publish', targetType: 'project', targetId: project.id, metadata: { signature: body.signature, address: body.address }, ip: request.ip });
    const published = await db.project.findUniqueOrThrow({ where: { id }, include });
    return { project: await projectToDTO(app, published, true) };
  });

  app.delete('/launchpad/projects/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const project = await db.project.findFirst({ where: { id, creatorUserId: auth.sub } });
    if (!project) throw notFound('Project not found');
    if (project.status === 'PUBLISHED') throw new HttpError(409, 'LOCKED', 'Published projects cannot be deleted');
    await db.project.delete({ where: { id } });
    return { ok: true };
  });

  app.get('/transactions', async (request) => {
    const auth = requireAuth(request);
    const rows = await db.transaction.findMany({ where: { userId: auth.sub }, orderBy: { createdAt: 'desc' }, take: 100 });
    return { items: rows.map((t) => ({ id: t.id, chain: t.chain, network: t.network, signature: t.signature, kind: t.kind, status: t.status, fromAddress: t.fromAddress, toAddress: t.toAddress, amount: t.amount, asset: t.asset, explorerUrl: explorerTx(t.chain, t.network, t.signature), confirmedAt: t.confirmedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() })) };
  });
}
