import { buildApp } from './app.js';
import { getEnv } from './lib/env.js';
import { createRedis } from './lib/redis.js';
import { getPrisma } from '@launch/database';
import { startMetricsRefresher } from './services/metrics.service.js';

const env = getEnv();
const db = getPrisma();
const redis = createRedis(env.REDIS_URL);
const app = await buildApp({ env, db, redis });
const stopRefresher = startMetricsRefresher(app);

const shutdown = async () => {
  stopRefresher();
  await app.close();
  await db.$disconnect();
  redis.disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
app.log.info(`API ready on http://localhost:${env.API_PORT} (solana=${env.SOLANA_NETWORK}, robinhood-chain=${env.ROBINHOOD_CHAIN_NETWORK})`);
