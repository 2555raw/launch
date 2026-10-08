'use client';
import { ApiRequestError } from '@/lib/api';

/**
 * Extracts per-field validation messages from an API error.
 * The API returns zod `flatten()` output in `details` for VALIDATION errors:
 * `{ formErrors: string[], fieldErrors: Record<string, string[]> }`.
 */
export function fieldErrors(e: unknown): Record<string, string> {
  if (e instanceof ApiRequestError && e.details && typeof e.details === 'object') {
    const d = e.details as { fieldErrors?: Record<string, string[] | undefined> };
    if (d.fieldErrors) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(d.fieldErrors)) if (v && v.length) out[k] = v[0];
      return out;
    }
  }
  return {};
}

export function isValidationError(e: unknown): boolean {
  return e instanceof ApiRequestError && e.code === 'VALIDATION';
}
