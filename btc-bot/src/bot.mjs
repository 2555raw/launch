import http from 'node:http';
import fs from 'node:fs';
import { config } from './config.mjs';
import { BinanceFeed, klines, twapFromKlines } from './binance.mjs';
import { discoverMarkets, fetchBooks, fetchResolution } from './polymarket.mjs';
import { probPointAbove, probTwapAbove, feePerShare, planBuy, SECONDS_PER_YEAR } from './model.mjs';
import { PaperAccount } from './paper.mjs';

const feed = new BinanceFeed();
const account = new PaperAccount(config.stateFile, config.startBankroll);
const markets = new Map(); // id -> market spec, plus K once known
let books = new Map();
let rows = [];
let lastDiscovery = { at: 0, count: 0, skipped: 0 };
const logLines = [];

function log(msg) {
  const line = `${new Date().toISOString().slice(11, 19)} ${msg}`;
  console.log(line);
  logLines.unshift(line);
  logLines.length = Math.min(logLines.length, 100);
}

const every = (ms, fn) => {
  const run = () => fn().catch((err) => log(`error: ${err.message}`));
  run();
  setInterval(run, ms);
};

async function discover() {
  const { markets: found, skipped } = await discoverMarkets();
  const seen = new Set();
  for (const m of found) {
    seen.add(m.id);
    if (!markets.has(m.id)) markets.set(m.id, m);
  }
  for (const id of markets.keys()) if (!seen.has(id) && markets.get(id).end < Date.now()) markets.delete(id);
  if (found.length !== lastDiscovery.count) log(`scanning ${found.length} BTC markets (${skipped} without a model)`);
  lastDiscovery = { at: Date.now(), count: found.length, skipped };
}

// The reference price of an Up/Down market only exists once its window opens.
async function resolveStrike(m) {
  if (m.K !== undefined || m.strikePending) return;
  if (Date.now() < m.start + 2000) return;
  m.strikePending = true;
  try {
    if (m.kind === 'twap') {
      m.K = (await twapFromKlines(m.start - m.L * 1000, m.start)) ?? undefined;
    } else if (m.kind === 'candle') {
      const [k] = await klines('1h', { startTime: m.start, limit: 1 });
      if (k && k[0] === m.start) m.K = Number(k[1]);
    }
  } finally {
    m.strikePending = false;
  }
}

const isLive = (m, now) => now >= m.start - 60_000 && now < m.end;

async function refreshBooks() {
  const now = Date.now();
  const tokens = [...markets.values()].filter((m) => isLive(m, now)).flatMap((m) => m.tokens);
  if (tokens.length) books = await fetchBooks(tokens);
}

function sigmaNow() {
  const floor = config.minSigmaAnnual / Math.sqrt(SECONDS_PER_YEAR);
  return Math.max(feed.sigma ?? 0, floor) * config.volMult;
}

function probUp(m, now, sigma) {
  const S = feed.price;
  if (m.kind === 'twap') {
    const windowStart = m.end - m.L * 1000;
    const realizedAvg = now > windowStart ? feed.averageSince(windowStart, now) : undefined;
    if (realizedAvg === null) return null; // we started mid-window and missed part of it
    return probTwapAbove({ S, K: m.K, sigma, now, end: m.end, L: m.L, realizedAvg });
  }
  return probPointAbove({ S, K: m.K, sigma, tau: (m.end - now) / 1000 });
}

async function tick() {
  const now = Date.now();
  const sigma = sigmaNow();
  const priceFresh = feed.price && now - feed.updatedAt < config.maxPriceAgeMs;
  const next = [];

  for (const m of markets.values()) {
    if (!isLive(m, now) || now < m.start) continue;
    resolveStrike(m).catch((err) => log(`strike ${m.slug}: ${err.message}`));
    const row = { id: m.id, slug: m.slug, label: m.label, kind: m.kind, question: m.question, outcomes: m.outcomes, secondsLeft: Math.round((m.end - now) / 1000), K: m.K };
    next.push(row);
    if (m.K === undefined) { row.status = 'esperando precio de referencia'; continue; }
    if (!priceFresh) { row.status = 'precio BTC desactualizado'; continue; }

    const p = probUp(m, now, sigma);
    if (p === null) { row.status = 'faltan datos de la ventana'; continue; }
    row.prob = p;

    const fee = (price) => feePerShare(price, m.fee);
    const sides = [0, 1].map((side) => {
      const book = books.get(m.tokens[side]);
      if (!book || now - book.at > config.maxBookAgeMs) return null;
      const prob = side === 0 ? p : 1 - p;
      const ask = book.asks[0]?.[0];
      const bid = book.bids[0]?.[0];
      return { side, prob, ask, bid, book, edge: ask === undefined ? null : prob - ask - fee(ask) };
    });
    row.sides = sides.map((s) => s && { ask: s.ask, bid: s.bid, edge: s.edge });
    if (sides.some((s) => !s)) { row.status = 'sin libro de órdenes'; continue; }

    const best = sides.filter((s) => s.edge !== null).sort((a, b) => b.edge - a.edge)[0];
    if (!best || best.edge < config.minEdge) { row.status = 'sin ventaja'; continue; }
    if (best.edge > config.maxEdge) { row.status = 'ventaja sospechosa (modelo?)'; continue; }
    if (best.ask < config.minPrice || best.ask > config.maxPrice) { row.status = 'precio en la cola'; continue; }
    if (row.secondsLeft < config.minSecondsLeft) { row.status = 'demasiado cerca del cierre'; continue; }
    if (account.holds(m.id)) { row.status = 'ya en cartera'; continue; }

    const budget = Math.min(config.maxStake, account.state.cash * config.stakePct);
    const plan = planBuy({
      asks: best.book.asks.filter(([price]) => price <= config.maxPrice),
      prob: best.prob, budget, minEdge: config.minEdge, fee, minShares: m.minShares,
    });
    if (!plan) { row.status = 'saldo o liquidez insuficiente'; continue; }
    const pos = account.buy({ market: m, side: best.side, plan, prob: best.prob, btc: feed.price });
    if (pos) {
      row.status = 'COMPRADO';
      log(`BUY ${m.label} "${m.outcomes[best.side]}" ${plan.shares} @ ${plan.avgPrice.toFixed(3)} ` +
        `(model ${(best.prob * 100).toFixed(1)}%, fees $${plan.fees.toFixed(2)}, EV +$${plan.expectedProfit.toFixed(2)}) ${m.slug}`);
    }
  }
  rows = next.sort((a, b) => a.secondsLeft - b.secondsLeft);
}

// Settle with Polymarket's official result; if it is slow to arrive, fall back
// to recomputing the outcome from Binance data.
async function settle() {
  const now = Date.now();
  for (const pos of [...account.state.open]) {
    if (now < pos.end + 5000) continue;
    let winner = await fetchResolution(pos.slug).catch(() => null);
    let method = 'polymarket';
    if (winner === null && now > pos.end + config.settleFallbackMs) {
      winner = await estimateWinner(pos);
      method = 'estimado (Binance)';
    }
    if (winner === null) continue;
    account.settle(pos, winner, method);
    const c = account.state.closed[0];
    log(`SETTLE ${pos.label} "${pos.outcome}" -> ${pos.side === winner ? 'WIN' : 'LOSS'} ${c.pnl >= 0 ? '+' : ''}$${c.pnl.toFixed(2)} [${method}]`);
  }
}

async function estimateWinner(pos) {
  if (pos.strike === undefined || pos.strike === null) return null;
  if (pos.kind === 'twap') {
    const final = await twapFromKlines(pos.end - pos.L * 1000, pos.end);
    return final === null ? null : final >= pos.strike ? 0 : 1;
  }
  const [k] = await klines('1h', { startTime: pos.end - 3600_000, limit: 1 });
  if (!k) return null;
  const close = Number(k[4]);
  return (pos.kind === 'above' ? close > pos.strike : close >= pos.strike) ? 0 : 1;
}

function snapshot() {
  return {
    now: Date.now(),
    btc: { price: feed.price, source: feed.source, ageMs: Date.now() - feed.updatedAt, sigmaAnnual: sigmaNow() * Math.sqrt(SECONDS_PER_YEAR) },
    scanned: lastDiscovery,
    account: account.summary(),
    open: account.state.open,
    closed: account.state.closed.slice(0, 50),
    markets: rows,
    log: logLines.slice(0, 40),
    config: { minEdge: config.minEdge, stakePct: config.stakePct, maxStake: config.maxStake, volMult: config.volMult },
    chart: [...feed.seconds.entries()].slice(-600),
  };
}

const page = new URL('../public/index.html', import.meta.url);
http.createServer((req, res) => {
  if (req.url === '/api/state') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(snapshot()));
  } else if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    fs.createReadStream(page).pipe(res);
  } else {
    res.writeHead(404).end();
  }
}).listen(config.port, config.host, () => log(`dashboard on http://localhost:${config.port}  (PAPER TRADING, no real money)`));

feed.start();
every(config.discoverEveryMs, discover);
every(config.bookEveryMs, refreshBooks);
every(config.tickEveryMs, tick);
every(config.settleEveryMs, settle);
