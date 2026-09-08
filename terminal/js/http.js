/* One place for every outbound request: a timeout, a small cache so a page does
   not hammer the provider, and errors that say which provider failed and why. */

import { config } from './config.js';

const mem = new Map();

export class DataError extends Error {
  constructor(message, { status = 0, provider = '' } = {}) {
    super(message);
    this.name = 'DataError';
    this.status = status;
    this.provider = provider;
  }
}

export async function getJSON(url, { provider = '', ttlMinutes = null, timeout = 12000 } = {}) {
  const ttl = (ttlMinutes ?? config.cacheMinutes) * 60_000;
  const hit = mem.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit.data;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
  } catch (err) {
    throw new DataError(
      err.name === 'AbortError' ? 'La petición ha superado el tiempo de espera' : 'No se ha podido contactar con el proveedor',
      { provider }
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) throw new DataError('Clave de API no válida o sin permisos para este dato', { status: res.status, provider });
  if (res.status === 429) throw new DataError('Límite de peticiones del proveedor alcanzado', { status: 429, provider });
  if (!res.ok) throw new DataError(`El proveedor ha respondido ${res.status}`, { status: res.status, provider });

  const data = await res.json().catch(() => { throw new DataError('Respuesta ilegible del proveedor', { provider }); });
  mem.set(url, { at: Date.now(), data });
  return data;
}

export function clearCache() { mem.clear(); }
