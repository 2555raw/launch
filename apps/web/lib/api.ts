'use client';
import type { ApiError } from '@launch/types';
import { API_URL } from './config';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

type TokenStore = { get: () => string | null; set: (t: string | null) => void };
let tokenStore: TokenStore = { get: () => null, set: () => undefined };
let refreshing: Promise<string | null> | null = null;

export function bindTokenStore(store: TokenStore) {
  tokenStore = store;
}

/** Refreshes the access token using the httpOnly refresh cookie (or the stored refresh token on mobile browsers that drop cookies). */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('launch_refresh') : null;
      const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(stored ? { refreshToken: stored } : {}) });
      if (!res.ok) {
        tokenStore.set(null);
        return null;
      }
      const body = (await res.json()) as { accessToken: string; refreshToken?: string };
      tokenStore.set(body.accessToken);
      if (body.refreshToken && typeof localStorage !== 'undefined') localStorage.setItem('launch_refresh', body.refreshToken);
      return body.accessToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; retry?: boolean } = {}): Promise<T> {
  const { json, retry = true, ...rest } = init;
  const headers: Record<string, string> = { ...(rest.headers as Record<string, string>) };
  if (json !== undefined) headers['content-type'] = 'application/json';
  const token = tokenStore.get();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...rest, headers, credentials: 'include', body: json !== undefined ? JSON.stringify(json) : rest.body });
  if (res.status === 401 && retry && token) {
    const fresh = await refreshAccessToken();
    if (fresh) return api<T>(path, { ...init, retry: false });
  }
  if (!res.ok) {
    let err: ApiError | null = null;
    try {
      err = (await res.json()) as ApiError;
    } catch {
      /* ignore */
    }
    throw new ApiRequestError(res.status, err?.error.code ?? 'HTTP_ERROR', err?.error.message ?? `Request failed (${res.status})`, err?.error.details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
