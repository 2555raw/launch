/* Live prices for the ticker and the $SEEKR pill. Fetched from public APIs,
 * cached for a minute, and when the network says no the last known values
 * are served flagged `stale` so the page never breaks. */
const config = require('./config');

const COINS = [
  { sym: 'BTC', id: 'bitcoin', color: '#F7931A' },
  { sym: 'ETH', id: 'ethereum', color: '#627EEA' },
  { sym: 'BNB', id: 'binancecoin', color: '#F3BA2F' },
  { sym: 'XRP', id: 'ripple', color: '#8A8F98' },
  { sym: 'SOL', id: 'solana', color: '#9945FF' },
  { sym: 'DOGE', id: 'dogecoin', color: '#C2A633' }
];

/* what the page opened with, so nothing is empty on a cold start */
let tickers = { at: 0, stale: true, coins: [
  { sym: 'BTC', price: 84451.35, change: -0.03 }, { sym: 'ETH', price: 2692.35, change: 0.39 }, { sym: 'BNB', price: 777.28, change: 1.5 },
  { sym: 'XRP', price: 1.54, change: 2.71 }, { sym: 'SOL', price: 117.1, change: 1.99 }, { sym: 'DOGE', price: 0.0959, change: 3.61 }
].map((c) => ({ ...c, color: COINS.find((x) => x.sym === c.sym).color })) };
let seekr = { at: 0, stale: true, live: false, price: null, change: null, symbol: 'SEEKR' };

const TTL = 60 * 1000;

async function fetchJson(url, ms = 6000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

async function refreshTickers() {
  if (Date.now() - tickers.at < TTL) return tickers;
  try {
    const j = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${COINS.map((c) => c.id).join(',')}&vs_currencies=usd&include_24hr_change=true`);
    tickers = { at: Date.now(), stale: false, coins: COINS.map((c) => ({ sym: c.sym, color: c.color, price: j[c.id].usd, change: j[c.id].usd_24h_change })) };
  } catch {
    tickers.at = Date.now() - TTL + 15000; // try again in 15s
  }
  return tickers;
}

async function refreshSeekr() {
  if (Date.now() - seekr.at < TTL) return seekr;
  const { dexscreenerPair: pair, seekrToken: token } = config.chain;
  if (!pair && !token) { seekr.at = Date.now(); return seekr; }
  try {
    /* a pinned pair wins; otherwise take the most liquid pair for the token */
    const j = await fetchJson(pair ? `https://api.dexscreener.com/latest/dex/pairs/${pair}` : `https://api.dexscreener.com/latest/dex/tokens/${token}`);
    const pairs = j.pairs || (j.pair ? [j.pair] : []);
    const p = pairs.filter((x) => x.priceUsd).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    if (p) seekr = { at: Date.now(), stale: false, live: true, price: Number(p.priceUsd), change: Number(p.priceChange?.h24 || 0), symbol: 'SEEKR', url: p.url };
    else seekr.at = Date.now();
  } catch {
    seekr.at = Date.now() - TTL + 15000;
  }
  return seekr;
}

/* USD price of a coin for deposits (ETH, SOL, BTC, USDT) */
async function usdPrice(sym) {
  if (sym === 'USDT' || sym === 'USDC') return 1;
  const t = await refreshTickers();
  const c = t.coins.find((x) => x.sym === sym);
  if (!c) throw new Error(`No price for ${sym}`);
  return c.price;
}

async function snapshot() {
  const [t, a] = await Promise.all([refreshTickers(), refreshSeekr()]);
  return { tickers: t, seekr: a };
}

module.exports = { snapshot, usdPrice, refreshTickers };
