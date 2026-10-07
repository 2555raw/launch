import { config } from './config.mjs';
import { getJson } from './binance.mjs';

const parse = (s) => (typeof s === 'string' ? JSON.parse(s) : s);

// Turn a Gamma market into something the model can price, or null if it is a
// kind we have no model for. Kinds:
//   twap   - "Up or Down" 5m/15m/4h: Chainlink TWAP at the end vs at the start
//   candle - "Up or Down" hourly: Binance 1h candle close vs its open
//   above  - "Bitcoin above X": Binance 1h candle close vs a fixed strike
export function parseMarket(m, eventSlug) {
  if (!m.active || m.closed || !m.acceptingOrders || !m.enableOrderBook) return null;
  const tokens = parse(m.clobTokenIds);
  const outcomes = parse(m.outcomes);
  if (!tokens || tokens.length !== 2) return null;

  const base = {
    id: m.id,
    slug: m.slug,
    eventSlug,
    question: m.question,
    end: Date.parse(m.endDate),
    tokens,
    outcomes,
    fee: m.feesEnabled ? m.feeSchedule : null,
    minShares: Number(m.orderMinSize) || 5,
  };
  const desc = m.description || '';
  const cfg = m.cryptoMarketConfig;

  if (cfg?.twapEnabled && cfg.asset === 'btc' && m.eventStartTime) {
    return { ...base, kind: 'twap', label: cfg.duration, start: Date.parse(m.eventStartTime), L: cfg.twapLookbackSeconds || 60 };
  }
  if (/close price is greater than or equal to the open price/i.test(desc) && /BTC\/USDT 1 hour candle/i.test(desc) && m.eventStartTime) {
    return { ...base, kind: 'candle', label: '1h', start: Date.parse(m.eventStartTime) };
  }
  const above = /Bitcoin above ([\d,.]+)/i.exec(m.question || '');
  if (above && /Binance/.test(desc) && /1 hour candle/i.test(desc)) {
    // A fixed strike can be priced at any time; watching only the last two
    // hours keeps the book polling to a few requests per cycle.
    return { ...base, kind: 'above', label: '1h', start: base.end - 2 * 3600_000, K: Number(above[1].replace(/,/g, '')) };
  }
  return null;
}

export async function discoverMarkets() {
  const now = Date.now();
  const q = {
    tag_slug: 'bitcoin', active: 'true', closed: 'false', limit: '100',
    end_date_min: new Date(now).toISOString(),
    end_date_max: new Date(now + config.horizonHours * 3600_000).toISOString(),
  };
  const markets = [];
  let skipped = 0;
  for (let offset = 0; offset < 1000; offset += 100) {
    const events = await getJson(`${config.gamma}/events?${new URLSearchParams({ ...q, offset: String(offset) })}`);
    for (const e of events) {
      for (const m of e.markets || []) {
        const spec = parseMarket(m, e.slug);
        if (spec && spec.end > now) markets.push(spec); else skipped++;
      }
    }
    if (events.length < 100) break;
  }
  return { markets, skipped };
}

// Order books for many tokens at once: Map(token -> {bids, asks, at}),
// levels as [price, size] with the best price first.
export async function fetchBooks(tokenIds) {
  const books = new Map();
  for (let i = 0; i < tokenIds.length; i += 50) {
    const chunk = tokenIds.slice(i, i + 50);
    const rows = await getJson(`${config.clob}/books`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(chunk.map((token_id) => ({ token_id }))),
    });
    const at = Date.now();
    for (const b of rows) {
      const lv = (xs) => xs.map((x) => [Number(x.price), Number(x.size)]);
      books.set(b.asset_id, {
        bids: lv(b.bids || []).sort((a, b) => b[0] - a[0]),
        asks: lv(b.asks || []).sort((a, b) => a[0] - b[0]),
        at,
      });
    }
  }
  return books;
}

// Index of the winning outcome once Polymarket has resolved the market, else null.
export async function fetchResolution(eventSlug, slug) {
  // /markets?slug= hides closed markets; the event lookup still returns them.
  const events = await getJson(`${config.gamma}/events?slug=${encodeURIComponent(eventSlug)}`);
  const m = events[0]?.markets?.find((x) => x.slug === slug);
  if (!m?.closed) return null;
  const prices = parse(m.outcomePrices).map(Number);
  if (prices[0] === 1 && prices[1] === 0) return 0;
  if (prices[0] === 0 && prices[1] === 1) return 1;
  return null;
}
