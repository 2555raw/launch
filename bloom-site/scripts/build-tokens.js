/* Rebuilds tokens.js: every tokenized stock on Robinhood Chain with live Uniswap
 * liquidity, and the pools that hold it.
 *
 *   node scripts/build-tokens.js
 *
 * Stocks. Robinhood's stock tokens are beacon proxies behind one beacon, and a
 * beacon proxy emits BeaconUpgraded(beacon) when it is created. The script reads
 * the beacon out of a known stock (AAPL) and collects every contract that
 * emitted that event and was deployed by Robinhood's own account through its
 * stock factory (anyone can put a proxy on a public beacon and name it Apple).
 *
 * Pools. For every stock, and for ETH/USDG itself, the script looks for:
 *   - Uniswap v3 pools against WETH or USDG, at each fee tier, via the factory;
 *   - Uniswap v4 pools against native ETH or USDG, via the PoolManager's
 *     Initialize events. Only pools without hooks and with a fee of at most 1%
 *     are kept: a hook can charge or behave differently at swap time from what
 *     the quote showed, and some pools carry fees of 50% or more as a trap.
 * and keeps the ones with liquidity in range right now that also survive a
 * round-trip test trade (buy ~$25, sell it back, lose under 10%).
 *
 * The public RPC caps log queries (30,000 blocks with no address filter,
 * 10,000,000 with one), so both scans are chunked and cached in
 * scripts/chain-cache.json; a rerun only reads the blocks since the last one.
 * Run it again when new stocks or pools appear. Node 18+, no dependencies. */
const fs = require('fs');
const path = require('path');

const RPC = process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const V3_FACTORY = '0x1f7d7550b1b028f7571e69a784071f0205fd2efa';
const POOL_MANAGER = '0x8366a39cc670b4001a1121b8f6a443a643e40951';
const STATE_VIEW = '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b';
const QUOTER_V3 = '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7';
const QUOTER_V4 = '0x8dc178efb8111bb0973dd9d722ebeff267c98f94';
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';
const USDG = '0x5fc5360d0400a0fd4f2af552add042d716f1d168';
const ZERO = '0x0000000000000000000000000000000000000000';
const SEED_STOCK = '0xaf3d76f1834a1d425780943c99ea8a608f8a93f9'; // AAPL
/* every Robinhood stock token was created by this account calling this factory */
const STOCK_DEPLOYER = '0x5516b3451d4d6c9f63353fe7bc9537477ecce000';
const STOCK_FACTORY = '0x4783c67b63de2b358ac5951a7d41f47a38f3c046';
const BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const BEACON_UPGRADED = '0x1cf3b03a6cf19fa2baba4df148e9dcabedea7f8a5c07840e207e5c089be95d3e';
const V4_INITIALIZE = '0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438';
const V3_FEES = [100, 500, 3000, 10000];
const POOLS_PER_BASE = 4;
const MAX_FEE = 10000; // 1%
const CACHE = path.join(__dirname, 'chain-cache.json');
const OUT = path.join(__dirname, '..', 'tokens.js');

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
      if (body.error) throw Object.assign(new Error(body.error.message), { fatal: true });
      return body.result;
    } catch (e) {
      if (e.fatal || attempt >= 8) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
}
/* many eth_calls in one HTTP request; null where a call failed */
async function callBatch(calls, size = 20) {
  const out = [];
  for (let i = 0; i < calls.length; i += size) {
    const chunk = calls.slice(i, i + size);
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(RPC, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(chunk.map(([to, data], j) => ({ jsonrpc: '2.0', id: j, method: 'eth_call', params: [{ to, data }, 'latest'] }))),
          signal: AbortSignal.timeout(60_000)
        });
        if (res.status === 429) throw new Error('rate limited');
        const body = await res.json();
        if (!Array.isArray(body)) throw new Error('batch refused');
        const byId = new Map(body.map((r) => [r.id, r.error ? null : r.result]));
        out.push(...chunk.map((_, j) => byId.get(j) ?? null));
        await sleep(150);
        break;
      } catch (e) {
        if (attempt >= 12) throw e;
        await sleep(2000 * (attempt + 1));
      }
    }
  }
  return out;
}
const word = (a) => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
const hexNum = (n) => '0x' + n.toString(16);
const call = (to, data) => rpc('eth_call', [{ to, data }, 'latest']);
const uint = (hex, i = 0) => BigInt('0x' + hex.slice(2 + i * 64, 2 + (i + 1) * 64));
const int24 = (v) => { const n = Number(v & 0xffffffn); return n >= 0x800000 ? n - 0x1000000 : n; };

function decodeString(hex) {
  if (!hex || hex === '0x') return '';
  const buf = Buffer.from(hex.slice(2), 'hex');
  if (buf.length >= 64) {
    const len = Number(BigInt('0x' + buf.subarray(32, 64).toString('hex')));
    if (len < 256 && 64 + len <= buf.length) return buf.subarray(64, 64 + len).toString('utf8');
  }
  return buf.toString('utf8').replace(/\0+$/, '');
}

/* Run jobs with a few requests in flight; the RPC rate-limits past that. */
async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

async function discoverStocks(cache, head) {
  const beacon = '0x' + (await rpc('eth_getStorageAt', [SEED_STOCK, BEACON_SLOT, 'latest'])).slice(-40);
  if (cache.beacon !== beacon) Object.assign(cache, { beacon, stocksScannedTo: -1, stocks: [] });
  const ranges = [];
  for (let s = cache.stocksScannedTo + 1; s <= head; s += 30_000) ranges.push([s, Math.min(head, s + 29_999)]);
  console.log(`stocks: beacon ${beacon}, ${ranges.length} windows to scan`);
  const found = new Set(cache.stocks);
  const candidates = [];
  let done = 0;
  await pool(ranges, 6, async ([a, b]) => {
    const logs = await rpc('eth_getLogs', [{ fromBlock: hexNum(a), toBlock: hexNum(b), topics: [BEACON_UPGRADED, '0x' + word(beacon)] }]);
    for (const l of logs) if (!found.has(l.address.toLowerCase())) candidates.push(l);
    if (++done % 250 === 0) console.log(`  ${done}/${ranges.length} windows, ${found.size + candidates.length} candidates`);
  });
  /* Anyone can deploy a proxy on a public beacon, or emit the event from any
     contract, and call it "Apple". Only proxies Robinhood deployed through its
     own factory count. */
  for (const l of candidates) {
    const tx = await rpc('eth_getTransactionByHash', [l.transactionHash]);
    const slot = await rpc('eth_getStorageAt', [l.address, BEACON_SLOT, 'latest']);
    const ok = tx && tx.from.toLowerCase() === STOCK_DEPLOYER && (tx.to || '').toLowerCase() === STOCK_FACTORY && '0x' + slot.slice(-40) === beacon;
    if (ok) found.add(l.address.toLowerCase());
    else console.warn(`  ignored ${l.address}: not deployed by Robinhood's stock factory`);
  }
  cache.stocks = [...found].sort();
  cache.stocksScannedTo = head;
}

/* v4 pools pairing `token` with native ETH or USDG. A log query takes one value
   per topic, so each (currency0, currency1) pair is its own query. */
async function discoverV4(cache, head) {
  cache.v4 = cache.v4 || { scannedTo: -1, tokens: [], pools: [] };
  const v4 = cache.v4;
  const tokens = [...cache.stocks, USDG];
  const known = new Set(v4.tokens);
  const jobs = [];
  for (const t of tokens) {
    const start = known.has(t) ? v4.scannedTo + 1 : 0;
    const pairs = t === USDG ? [[ZERO, USDG]] : [[ZERO, t], [USDG, t].sort()];
    for (const [c0, c1] of pairs) for (let s = start; s <= head; s += 10_000_000) jobs.push({ c0, c1, from: s, to: Math.min(head, s + 9_999_999) });
  }
  console.log(`v4: ${jobs.length} log queries`);
  const seen = new Set(v4.pools.map((p) => p.id));
  let done = 0;
  await pool(jobs, 8, async (j) => {
    const logs = await rpc('eth_getLogs', [{ address: POOL_MANAGER, fromBlock: hexNum(j.from), toBlock: hexNum(j.to), topics: [V4_INITIALIZE, null, '0x' + word(j.c0), '0x' + word(j.c1)] }]);
    for (const l of logs) {
      if (seen.has(l.topics[1])) continue;
      seen.add(l.topics[1]);
      const hooks = '0x' + l.data.slice(2 + 64 * 2 + 24, 2 + 64 * 3);
      v4.pools.push({
        id: l.topics[1],
        currency0: '0x' + l.topics[2].slice(26),
        currency1: '0x' + l.topics[3].slice(26),
        fee: Number(uint(l.data, 0)),
        tickSpacing: int24(uint(l.data, 1)),
        hooks
      });
    }
    if (++done % 500 === 0) console.log(`  ${done}/${jobs.length} queries, ${v4.pools.length} pools`);
  });
  v4.tokens = tokens;
  v4.scannedTo = head;
}

/* v3 pools of each token against each base and fee tier, with their liquidity */
async function v3Pools(tokens) {
  const probes = [];
  for (const token of tokens) for (const base of token === USDG ? [WETH] : [WETH, USDG]) for (const fee of V3_FEES) probes.push({ token, base, fee });
  const addrs = await callBatch(probes.map((q) => [V3_FACTORY, '0x1698ee82' + word(q.token) + word(q.base) + q.fee.toString(16).padStart(64, '0')]));
  const found = probes.map((q, i) => ({ ...q, pool: addrs[i] ? '0x' + addrs[i].slice(-40) : null })).filter((q) => q.pool && !/^0x0+$/.test(q.pool));
  const liqs = await callBatch(found.map((q) => [q.pool, '0x1a686502']));
  const out = new Map();
  found.forEach((q, i) => {
    const liquidity = liqs[i] ? uint(liqs[i]) : 0n;
    if (liquidity === 0n) return;
    if (!out.has(q.token)) out.set(q.token, []);
    out.get(q.token).push({ v: 3, base: q.base === WETH ? 'ETH' : 'USDG', fee: q.fee, pool: q.pool, liquidity: liquidity.toString() });
  });
  return out;
}

/* Quoter calldata, hand-encoded: QuoterV2.quoteExactInput(bytes path, uint256
   amountIn) and V4Quoter.quoteExactInputSingle((PoolKey, bool zeroForOne,
   uint128 exactAmount, bytes hookData)). Both return amountOut first. */
function v3QuoteData(tokenIn, fee, tokenOut, amount) {
  const path = tokenIn.slice(2) + fee.toString(16).padStart(6, '0') + tokenOut.slice(2);
  return '0xcdca1753' + (0x40).toString(16).padStart(64, '0') + amount.toString(16).padStart(64, '0') +
    (path.length / 2).toString(16).padStart(64, '0') + path.padEnd(128, '0');
}
function v4QuoteData(key, zeroForOne, amount) {
  return '0xaa9d21cb' + (0x20).toString(16).padStart(64, '0') + word(key.currency0) + word(key.currency1) +
    key.fee.toString(16).padStart(64, '0') + key.tickSpacing.toString(16).padStart(64, '0') + word(key.hooks) +
    (zeroForOne ? 1 : 0).toString(16).padStart(64, '0') + amount.toString(16).padStart(64, '0') +
    (0x100).toString(16).padStart(64, '0') + '0'.repeat(64);
}

/* A pool can hold liquidity yet be so thin that a small trade moves it to an
   absurd price. Buy about $25 of the token from each pool and sell it straight
   back; a pool that loses more than 10% on the round trip is dropped. */
async function dropThinPools(tokens) {
  const probes = [];
  for (const t of tokens) for (const p of t.pools) {
    const baseAddr = p.base === 'USDG' ? USDG : p.v === 3 ? WETH : ZERO;
    const tokenAddr = t.address;
    probes.push({ t, p, baseAddr, tokenAddr, amountIn: p.base === 'USDG' ? 25_000_000n : 10n ** 16n });
  }
  const quote = (q, from, to, amount) => {
    if (q.p.v === 3) return [QUOTER_V3, v3QuoteData(from === ZERO ? WETH : from, q.p.fee, to === ZERO ? WETH : to, amount)];
    return [QUOTER_V4, v4QuoteData(q.p.key, from.toLowerCase() === q.p.key.currency0.toLowerCase(), amount)];
  };
  const bought = await callBatch(probes.map((q) => quote(q, q.baseAddr, q.tokenAddr, q.amountIn)));
  const soldCalls = probes.map((q, i) => (bought[i] && uint(bought[i]) > 0n ? quote(q, q.tokenAddr, q.baseAddr, uint(bought[i])) : null));
  const sold = await callBatch(soldCalls.filter(Boolean));
  let k = 0;
  const keep = new Set();
  probes.forEach((q, i) => {
    if (!soldCalls[i]) return;
    const back = sold[k++];
    if (!back) return;
    const loss = 1 - Number(uint(back)) / Number(q.amountIn);
    if (loss < 0.10) keep.add(q.p);
  });
  let dropped = 0;
  for (const t of tokens) {
    const before = t.pools.length;
    t.pools = t.pools.filter((p) => keep.has(p));
    dropped += before - t.pools.length;
  }
  console.log(`dropped ${dropped} thin pools`);
}

(async () => {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { /* first run */ }
  const head = Number(await rpc('eth_blockNumber', []));

  await discoverStocks(cache, head);
  await discoverV4(cache, head);
  fs.writeFileSync(CACHE, JSON.stringify(cache) + '\n');

  /* no hooks, and a fee no higher than Uniswap's top standard tier: some pools
     are set up with 50-95% fees to catch careless routers */
  const hookless = cache.v4.pools.filter((p) => p.hooks === ZERO && p.fee <= MAX_FEE);
  console.log(`${cache.stocks.length} stocks, ${cache.v4.pools.length} v4 pools (${hookless.length} with no hooks and a fee of 1% or less); checking liquidity`);

  const v4ByToken = new Map();
  const liqs = await callBatch(hookless.map((p) => [STATE_VIEW, '0xfa6793d5' + p.id.slice(2)])); // getLiquidity(bytes32)
  hookless.forEach((p, i) => {
    const liquidity = liqs[i] ? uint(liqs[i]) : 0n;
    if (liquidity === 0n) return;
    const [c0, c1] = [p.currency0, p.currency1];
    const token = c0 === ZERO || (c0 === USDG && c1 !== USDG) ? c1 : c0;
    const base = token === USDG ? 'ETH' : (c0 === ZERO ? 'ETH' : 'USDG');
    const entry = { v: 4, base, fee: p.fee, id: p.id, key: { currency0: c0, currency1: c1, fee: p.fee, tickSpacing: p.tickSpacing, hooks: ZERO }, liquidity: liquidity.toString() };
    if (!v4ByToken.has(token)) v4ByToken.set(token, []);
    v4ByToken.get(token).push(entry);
  });

  const all = [...cache.stocks, USDG];
  const v3ByToken = await v3Pools(all);
  const live = all.filter((a) => v3ByToken.has(a) || v4ByToken.has(a));
  const meta = await callBatch(live.flatMap((a) => [[a, '0x95d89b41'], [a, '0x06fdde03'], [a, '0x313ce567']]));
  const tokens = [];
  live.forEach((address, i) => {
    const [sym, nm, dec] = meta.slice(i * 3, i * 3 + 3);
    if (!sym || !dec) return;
    /* liquidity is only comparable between pools of the same pair, so rank per
       base and keep the deepest few; the swap never needs more */
    const all = [...(v3ByToken.get(address) || []), ...(v4ByToken.get(address) || [])];
    const pools = ['ETH', 'USDG'].flatMap((b) => all.filter((p) => p.base === b)
      .sort((x, y) => (BigInt(y.liquidity) > BigInt(x.liquidity) ? 1 : -1))
      .slice(0, POOLS_PER_BASE));
    const t = { symbol: decodeString(sym), name: decodeString(nm), address, decimals: Number(uint(dec)), pools };
    tokens.push(t);
    console.log(`  ${t.symbol.padEnd(6)} ${pools.map((p) => `v${p.v}/${p.base}/${p.fee}`).join(' ')}`);
  });
  await dropThinPools(tokens);
  for (let i = tokens.length - 1; i >= 0; i--) if (!tokens[i].pools.length) tokens.splice(i, 1);
  tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));
  /* the page keys prices and balances by symbol, so two tokens can't share one */
  const dupes = tokens.map((t) => t.symbol).filter((s, i, all) => all.indexOf(s) !== i);
  if (dupes.length) throw new Error(`duplicate symbols: ${[...new Set(dupes)].join(', ')}`);

  fs.writeFileSync(OUT,
    `/* Generated by scripts/build-tokens.js at block ${head}. Do not edit by hand. */\n` +
    `window.CHAIN_TOKENS = ${JSON.stringify(tokens)};\n`);
  console.log(`wrote ${tokens.length} tokens with live pools`);
})().catch((e) => { console.error(e); process.exit(1); });
