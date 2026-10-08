import type { ZodTypeAny, z } from 'zod';

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}
