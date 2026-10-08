import type { Db, Tx } from '@launch/database';
import type { Redis } from 'ioredis';

export interface GameContext {
  db: Db;
  redis: Redis;
  now: () => Date;
}

export type DbOrTx = Db | Tx;

export class GameError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function assert(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) throw new GameError(code, message, status);
}
