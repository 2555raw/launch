import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { GameError } from '@launch/game-core';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const unauthorized = (msg = 'Authentication required') => new HttpError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Forbidden') => new HttpError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'Not found') => new HttpError(404, 'NOT_FOUND', msg);
export const badRequest = (code: string, msg: string, details?: unknown) => new HttpError(400, code, msg, details);

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof HttpError) return reply.status(error.status).send({ error: { code: error.code, message: error.message, details: error.details } });
  if (error instanceof GameError) return reply.status(error.status).send({ error: { code: error.code, message: error.message, details: error.details } });
  if (error instanceof ZodError) return reply.status(400).send({ error: { code: 'VALIDATION', message: 'Invalid request', details: error.flatten() } });
  const fe = error as FastifyError;
  if (fe.statusCode && fe.statusCode < 500) return reply.status(fe.statusCode).send({ error: { code: fe.code ?? 'BAD_REQUEST', message: fe.message } });
  request.log.error({ err: error }, 'unhandled error');
  return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
