import { PrismaClient, Prisma } from '@prisma/client';

export * from '@prisma/client';
export { Prisma };

declare global {
  // eslint-disable-next-line no-var
  var __launchPrisma: PrismaClient | undefined;
}

/**
 * Single PrismaClient per process. In tests, `DATABASE_URL_TEST` can be passed through
 * `createPrismaClient(url)` to isolate the suite from the dev database.
 */
export function createPrismaClient(datasourceUrl?: string): PrismaClient {
  return new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.PRISMA_LOG === '1' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

export function getPrisma(datasourceUrl?: string): PrismaClient {
  if (!globalThis.__launchPrisma) {
    globalThis.__launchPrisma = createPrismaClient(datasourceUrl);
  }
  return globalThis.__launchPrisma;
}

export type Db = PrismaClient;
export type Tx = Prisma.TransactionClient;
