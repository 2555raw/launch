import { config } from './config.mjs';
import { sigmaFromCloses } from './model.mjs';

export async function getJson(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${res.status} ${url.split('?')[0]}`);
  return res.json();
}

export function klines(interval, { startTime, endTime, limit = 1000 } = {}) {
  const q = new URLSearchParams({ symbol: 'BTCUSDT', interval, limit: String(limit) });
  if (startTime !== undefined) q.set('startTime', String(startTime));
  if (endTime !== undefined) q.set('endTime', String(endTime));
  return getJson(`${config.binanceRest}/api/v3/klines?${q}`);
}

// Mean of the 1-second closes in [fromMs, toMs): our stand-in for a Chainlink TWAP.
export async function twapFromKlines(fromMs, toMs) {
  const rows = await klines('1s', { startTime: fromMs, endTime: toMs - 1, limit: 1000 });
  if (!rows.length) return null;
  return rows.reduce((a, r) => a + Number(r[4]), 0) / rows.length;
}

// Live BTCUSDT price: the aggTrade WebSocket, with REST polling whenever the
// socket has gone quiet. Keeps one price per second for in-window averages.
export class BinanceFeed {
  price = null;
  updatedAt = 0;
  source = 'none';
  sigma = null; // per-second log volatility
  seconds = new Map();

  start() {
    this.#connect();
    setInterval(() => this.#pollIfStale(), 1000);
    this.#refreshVol();
    setInterval(() => this.#refreshVol(), 60_000);
  }

  #record(price, source) {
    const now = Date.now();
    this.price = price;
    this.updatedAt = now;
    this.source = source;
    this.seconds.set(Math.floor(now / 1000), price);
    if (this.seconds.size > 4 * 3600) {
      const cutoff = Math.floor(now / 1000) - 3 * 3600;
      for (const s of this.seconds.keys()) if (s < cutoff) this.seconds.delete(s); else break;
    }
  }

  #connect() {
    let ws;
    try {
      ws = new WebSocket(config.binanceWs);
    } catch (err) {
      console.warn('[binance] websocket unavailable:', err.message);
      return;
    }
    ws.onmessage = (e) => {
      const p = Number(JSON.parse(e.data).p);
      if (p > 0) this.#record(p, 'websocket');
    };
    ws.onclose = () => setTimeout(() => this.#connect(), 2000);
    ws.onerror = () => {}; // onclose follows and reconnects
  }

  async #pollIfStale() {
    if (Date.now() - this.updatedAt < 1500) return;
    try {
      const j = await getJson(`${config.binanceRest}/api/v3/ticker/price?symbol=BTCUSDT`);
      this.#record(Number(j.price), 'rest');
    } catch (err) {
      console.warn('[binance] price poll failed:', err.message);
    }
  }

  async #refreshVol() {
    try {
      const rows = await klines('1m', { limit: 180 });
      const s = sigmaFromCloses(rows.map((r) => Number(r[4])), 60);
      if (s) this.sigma = s;
    } catch (err) {
      console.warn('[binance] volatility refresh failed:', err.message);
    }
  }

  // Forward-filled average of our own per-second prices over [fromMs, toMs).
  // Null if we have no price from the first few seconds of the range.
  averageSince(fromMs, toMs) {
    const from = Math.floor(fromMs / 1000), to = Math.floor(toMs / 1000);
    let last;
    for (let s = from - 5; s <= from; s++) last = this.seconds.get(s) ?? last;
    if (last === undefined) return null;
    let sum = 0, n = 0;
    for (let s = from; s <= to; s++) {
      last = this.seconds.get(s) ?? last;
      sum += last; n++;
    }
    return sum / n;
  }
}
