/* 24-hour market stats, rebuilt from the swaps themselves.
 *
 * The public RPC keeps no price history, but every swap leaves an event with the
 * pool's price after it and the amounts that moved. For each listed pool this
 * reads the last 24 hours of Swap events and works out, per stock:
 *   - an hourly price line in USD (24 points) and the 24h change,
 *   - the 24h high and low,
 *   - the 24h volume in USD, summed over all of its pools.
 * The price line follows the stock's most-traded pool, so a thin pool with a
 * stray price can't bend it. ETH/USD comes from the USDG/WETH pools the same way.
 *
 * Runs inside server.js, refreshes every few minutes, and is served as
 * /api/stats. Node 18+, no dependencies. */
const fs = require('fs');
const path = require('path');

const RPC = process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const POOL_MANAGER = '0x8366a39cc670b4001a1121b8f6a443a643e40951';
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';
const USDG = '0x5fc5360d0400a0fd4f2af552add042d716f1d168';
const ZERO = '0x0000000000000000000000000000000000000000';
const V3_SWAP = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
const V4_SWAP = '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f';
const HOURS = 24;
const CONCURRENCY = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let id = 0;
async function rpc(method, params) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
        signal: AbortSignal.timeout(60_000)
      });
      if (res.status === 429) throw new Error('rate limited');
      const body = await res.json();
      if (body.error) throw Object.assign(new Error(body.error.message), { rpcError: true });
      return body.result;
    } catch (e) {
      if (e.rpcError || attempt >= 6) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
}
const hex = (n) => '0x' + n.toString(16);

/* a log query over [from, to], halved until the node accepts it */
async function logs(filter, from, to) {
  try {
    return await rpc('eth_getLogs', [{ ...filter, fromBlock: hex(from), toBlock: hex(to) }]);
  } catch (e) {
    if (!e.rpcError || to - from < 2000) throw e;
    const mid = Math.floor((from + to) / 2);
    return [...await logs(filter, from, mid), ...await logs(filter, mid + 1, to)];
  }
}

function signed(word, bits) {
  let v = BigInt('0x' + word);
  const max = 1n << BigInt(bits);
  v &= max - 1n;
  return v >= max >> 1n ? v - max : v;
}
const words = (data) => data.slice(2).match(/.{64}/g) || [];

/* What a pool is: which side is the stock, which is the base, and how its events
   read. Prices come out as "base per token" in whole units. */
function describePool(token, p) {
  const baseIsEth = p.base === 'ETH';
  const baseDecimals = baseIsEth ? 18 : 6;
  if (p.v === 3) {
    const baseAddr = baseIsEth ? WETH : USDG;
    const tokenIs0 = token.address.toLowerCase() < baseAddr;
    return { ...p, tokenIs0, baseDecimals, filter: { address: p.pool, topics: [V3_SWAP] }, amountBits: 256, amountOffset: 0 };
  }
  const c0 = p.key.currency0.toLowerCase();
  const tokenIs0 = c0 === token.address.toLowerCase();
  return { ...p, tokenIs0, baseDecimals, filter: { address: POOL_MANAGER, topics: [V4_SWAP, p.id] }, amountBits: 128, amountOffset: 0 };
}

function readSwap(pool, log, tokenDecimals) {
  const w = words(log.data);
  const a0 = signed(w[0], pool.amountBits), a1 = signed(w[1], pool.amountBits);
  const sqrt = Number(BigInt('0x' + w[2])) / 2 ** 96;
  const [dec0, dec1] = pool.tokenIs0 ? [tokenDecimals, pool.baseDecimals] : [pool.baseDecimals, tokenDecimals];
  const p1per0 = sqrt * sqrt * 10 ** (dec0 - dec1);
  const price = pool.tokenIs0 ? p1per0 : 1 / p1per0; // base per token
  const baseRaw = pool.tokenIs0 ? a1 : a0;
  const baseAmount = Math.abs(Number(baseRaw)) / 10 ** pool.baseDecimals;
  return { block: Number(log.blockNumber), price, baseAmount };
}

async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) await fn(items[next++]); }));
}

/* the last price before `block`, looking back a little further each time */
async function priceBefore(pool, block, tokenDecimals) {
  let span = 20_000;
  for (let i = 0; i < 5; i++) {
    const from = Math.max(0, block - span);
    const found = await logs(pool.filter, from, block - 1);
    if (found.length) return readSwap(pool, found[found.length - 1], tokenDecimals).price;
    if (from === 0) return null;
    span *= 4;
  }
  return null;
}

function hourly(start, end, swaps, opening) {
  const per = (end - start) / HOURS;
  const out = [];
  let last = opening ?? (swaps[0] && swaps[0].price) ?? null;
  let i = 0;
  for (let h = 1; h <= HOURS; h++) {
    const cut = start + per * h;
    while (i < swaps.length && swaps[i].block <= cut) last = swaps[i++].price;
    out.push(last);
  }
  return out;
}

async function buildStats(tokensFile) {
  const src = fs.readFileSync(tokensFile, 'utf8');
  const tokens = JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));

  const headBlock = await rpc('eth_getBlockByNumber', ['latest', false]);
  const head = Number(headBlock.number);
  const probe = await rpc('eth_getBlockByNumber', [hex(head - 100_000), false]);
  const perSec = 100_000 / (Number(headBlock.timestamp) - Number(probe.timestamp));
  const start = head - Math.round(perSec * 86_400);
  const hourOf = (block) => Math.min(HOURS - 1, Math.max(0, Math.floor((block - start) / ((head - start) / HOURS))));

  /* read every pool's swaps for the day */
  const jobs = [];
  for (const t of tokens) for (const p of t.pools) jobs.push({ t, pool: describePool(t, p) });
  await pool(jobs, CONCURRENCY, async (j) => {
    try {
      j.swaps = (await logs(j.pool.filter, start, head)).map((l) => readSwap(j.pool, l, j.t.decimals));
    } catch {
      j.swaps = null;
    }
  });

  /* ETH/USD per hour, from USDG's pools (priced in ETH per USDG) */
  const usdgJobs = jobs.filter((j) => j.t.address.toLowerCase() === USDG && j.swaps);
  const ethRef = usdgJobs.sort((a, b) => b.swaps.length - a.swaps.length)[0];
  let ethLine = null;
  if (ethRef) {
    const open = await priceBefore(ethRef.pool, start, 6).catch(() => null);
    ethLine = hourly(start, head, ethRef.swaps, open).map((p) => (p ? 1 / p : null));
  }
  const ethNow = ethLine && ethLine[HOURS - 1];
  const ethAt = (h) => (ethLine && ethLine[h]) || ethNow;
  const baseUsd = (base, h) => (base === 'USDG' ? 1 : ethAt(h));

  const out = {};
  for (const t of tokens) {
    if (t.address.toLowerCase() === USDG) continue;
    const mine = jobs.filter((j) => j.t === t && j.swaps);
    if (!mine.length) continue;
    let volume = 0;
    for (const j of mine) for (const s of j.swaps) volume += s.baseAmount * (baseUsd(j.pool.base, hourOf(s.block)) || 0);
    /* the price line follows the pool with the most swaps today */
    const ref = mine.slice().sort((a, b) => b.swaps.length - a.swaps.length)[0];
    let line;
    let high = null, low = null;
    if (ref.swaps.length) {
      const open = await priceBefore(ref.pool, start, t.decimals).catch(() => null);
      line = hourly(start, head, ref.swaps, open).map((p, h) => (p == null ? null : p * (baseUsd(ref.pool.base, h) || 0)));
      for (const s of ref.swaps) {
        const usd = s.price * (baseUsd(ref.pool.base, hourOf(s.block)) || 0);
        if (high === null || usd > high) high = usd;
        if (low === null || usd < low) low = usd;
      }
      const first = open != null ? open * (baseUsd(ref.pool.base, 0) || 0) : line.find((v) => v != null);
      if (first) line = [first, ...line];
    }
    const first = line && line.find((v) => v != null && v > 0);
    const last = line && line[line.length - 1];
    out[t.symbol] = {
      change24h: first && last ? last / first - 1 : 0,
      volume24h: Math.round(volume * 100) / 100,
      high24h: high,
      low24h: low,
      trades24h: mine.reduce((n, j) => n + j.swaps.length, 0),
      spark: line ? line.map((v) => (v == null ? null : Number(v.toPrecision(6)))) : null
    };
  }
  return { updatedAt: new Date().toISOString(), block: head, ethUsd: ethNow, tokens: out };
}

/* keep one copy fresh in memory; callers get whatever is current */
function startStats(tokensFile, everyMs = 10 * 60 * 1000) {
  const state = { data: null, error: null, running: false };
  const run = async () => {
    if (state.running) return;
    state.running = true;
    const t0 = Date.now();
    try {
      state.data = await buildStats(tokensFile);
      state.error = null;
      console.log(`stats: ${Object.keys(state.data.tokens).length} stocks in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } catch (e) {
      state.error = e.message;
      console.warn('stats failed:', e.message);
    } finally {
      state.running = false;
    }
  };
  run();
  setInterval(run, everyMs).unref();
  return () => state;
}

module.exports = { buildStats, startStats };

if (require.main === module) {
  buildStats(path.join(__dirname, 'tokens.js')).then((s) => {
    const rows = Object.entries(s.tokens).sort((a, b) => b[1].volume24h - a[1].volume24h).slice(0, 12);
    console.log('ETH/USD', s.ethUsd, 'block', s.block);
    for (const [sym, v] of rows) console.log(sym.padEnd(6), (v.change24h * 100).toFixed(2).padStart(7) + '%', ('$' + v.volume24h.toFixed(0)).padStart(10), v.trades24h, v.spark && v.spark.length);
  }).catch((e) => { console.error(e); process.exit(1); });
}
