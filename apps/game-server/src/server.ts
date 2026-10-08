import { loadEnv } from '@launch/config';
import { getPrisma } from '@launch/database';
import { Redis } from 'ioredis';
import pino from 'pino';
import { GameServer } from './game-server.js';

const env = loadEnv();
const logger = pino(env.NODE_ENV === 'production' ? {} : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } });
const db = getPrisma();
const redis = new Redis(env.REDIS_URL);
const subscriber = new Redis(env.REDIS_URL);

const server = new GameServer({ env, db, redis, subscriber, logger, port: env.GAME_SERVER_PORT });
await server.start();
logger.info(`Game server listening on ws://0.0.0.0:${env.GAME_SERVER_PORT}`);

const shutdown = async () => {
  await server.stop();
  await db.$disconnect();
  redis.disconnect();
  subscriber.disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
