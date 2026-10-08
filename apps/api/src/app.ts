import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { corsOrigins, type Env } from '@launch/config';
import type { Db } from '@launch/database';
import type { GameContext } from '@launch/game-core';
import type { Redis } from 'ioredis';
import { verifyAccessToken } from './lib/auth.js';
import { HttpError, errorHandler } from './lib/errors.js';
import { registerAdminRoutes } from './routes/admin.routes.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerClanRoutes } from './routes/clan.routes.js';
import { registerGameRoutes } from './routes/game.routes.js';
import { registerLaunchpadRoutes } from './routes/launchpad.routes.js';
import { registerPortfolioRoutes } from './routes/portfolio.routes.js';
import { registerRobinhoodRoutes } from './routes/robinhood.routes.js';
import { registerSwapRoutes } from './routes/swap.routes.js';
import { registerWalletRoutes } from './routes/wallet.routes.js';

export interface AppDeps {
  env: Env;
  db: Db;
  redis: Redis;
  now?: () => Date;
  logger?: boolean | object;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps;
    game: GameContext;
  }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { env } = deps;
  const app = Fastify({
    logger: deps.logger ?? (env.NODE_ENV === 'production' ? true : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }),
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });
  app.decorate('deps', deps);
  app.decorate('game', { db: deps.db, redis: deps.redis, now: deps.now ?? (() => new Date()) });
  app.decorateRequest('auth', null);

  await app.register(helmet, { crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false });
  await app.register(cors, { origin: corsOrigins(env), credentials: true });
  await app.register(cookie, { secret: env.JWT_SECRET });
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    redis: deps.redis,
    nameSpace: 'rl:',
    keyGenerator: (req) => req.auth?.sub ?? req.ip,
    errorResponseBuilder: (_req, ctx) => new HttpError(429, 'RATE_LIMITED', `Too many requests, retry in ${Math.ceil(ctx.ttl / 1000)}s`),
  });
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

  const uploadsDir = path.resolve(process.cwd(), env.UPLOADS_DIR);
  mkdirSync(path.join(uploadsDir, 'logos'), { recursive: true });
  mkdirSync(path.join(uploadsDir, 'metadata'), { recursive: true });
  await app.register(fastifyStatic, { root: uploadsDir, prefix: '/uploads/', decorateReply: false, cacheControl: true, maxAge: '1h' });

  app.addHook('onRequest', async (request) => {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        request.auth = verifyAccessToken(env.JWT_SECRET, header.slice(7));
      } catch {
        request.auth = null;
      }
    }
  });

  app.setErrorHandler(errorHandler);
  app.get('/health', async () => {
    const [dbOk, redisOk] = await Promise.all([deps.db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), deps.redis.ping().then((r) => r === 'PONG').catch(() => false)]);
    return { ok: dbOk && redisOk, db: dbOk, redis: redisOk, solana: { network: env.SOLANA_NETWORK }, robinhoodChain: { network: env.ROBINHOOD_CHAIN_NETWORK }, time: new Date().toISOString() };
  });

  await registerAuthRoutes(app);
  await registerWalletRoutes(app);
  await registerGameRoutes(app);
  await registerClanRoutes(app);
  await registerLaunchpadRoutes(app, uploadsDir);
  await registerSwapRoutes(app);
  await registerPortfolioRoutes(app);
  await registerRobinhoodRoutes(app);
  await registerAdminRoutes(app);
  return app;
}
