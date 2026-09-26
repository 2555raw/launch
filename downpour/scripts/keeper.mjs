/* The rate keeper: reads independent FX feeds and posts a currency's rate to the
 * desk only when at least two feeds agree on it and it has drifted from what is
 * on chain. Disagreement means the rate holds.
 *
 *   RPC_URL=... PRIVATE_KEY=<keeper key> npm run keeper          # every 60s, forever
 *   npm run keeper -- --once                                     # one pass, then exit
 *   npm run keeper -- --once --mock                              # local demo: jittered feeds, no internet
 *
 * Options (flags or environment):
 *   --every   seconds between passes        (60)
 *   --agree   feeds must agree within, bps   (50  = 0.5%)
 *   --move    post when drift exceeds, bps   (10  = 0.1%)
 * The desk itself refuses any single post that moves a rate more than 20%; the
 * keeper skips those and says so, since only the owner can force such a move. */
import { artifacts, args, connect, readDeployment, send, sleep, toWad } from './lib/common.mjs';

const opts = args();
const EVERY = Number(opts.every || process.env.KEEPER_EVERY || 60);
const AGREE = Number(opts.agree || process.env.KEEPER_AGREE_BPS || 50) / 10_000;
const MOVE = Number(opts.move || process.env.KEEPER_MOVE_BPS || 10) / 10_000;
const MAX_MOVE = 0.19;

const ctx = await connect({ rpc: opts.rpc });
if (!ctx.walletClient) throw new Error('set PRIVATE_KEY (the desk keeper) to post rates');
const dep = readDeployment(ctx.chainId);
const D = artifacts.CurrencyDesk;

async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

const FEEDS = {
  'open.er-api.com': async () => (await json('https://open.er-api.com/v6/latest/USD')).rates,
  'fawazahmed0/currency-api': async () => {
    let j;
    try {
      j = await json('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    } catch {
      j = await json('https://latest.currency-api.pages.dev/v1/currencies/usd.json');
    }
    return Object.fromEntries(Object.entries(j.usd).map(([k, v]) => [k.toUpperCase(), Number(v)]));
  },
  'coinbase': async () => {
    const j = await json('https://api.coinbase.com/v2/exchange-rates?currency=USD');
    return Object.fromEntries(Object.entries(j.data.rates).map(([k, v]) => [k, Number(v)]));
  },
};

/** Two made-up feeds for a local chain: the on-chain rate, nudged a little. */
function mockFeeds(onchain) {
  const a = {};
  const b = {};
  for (const [code, rate] of Object.entries(onchain)) {
    if (Math.random() < 0.85) continue; // most currencies do not move in a given pass
    const drift = 1 + (Math.random() - 0.5) * 0.006;
    a[code] = rate * drift;
    b[code] = rate * drift * (1 + (Math.random() - 0.5) * (Math.random() < 0.2 ? 0.02 : 0.002));
  }
  return { mockA: a, mockB: b };
}

/** The agreed rate for one currency, or null: the average of the closest pair that agrees. */
function agree(values) {
  let best = null;
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      const [x, y] = [values[i], values[j]];
      const gap = Math.abs(x - y) / Math.max(x, y);
      if (gap <= AGREE && (!best || gap < best.gap)) best = { gap, rate: (x + y) / 2 };
    }
  }
  return best?.rate ?? null;
}

async function pass() {
  const list = await ctx.publicClient.readContract({ address: dep.desk, abi: D.abi, functionName: 'getCurrencies' });
  const onchain = Object.fromEntries(list.map((c) => [c.code, Number(c.rate) / 1e18]));

  let feeds = {};
  if (opts.mock === 'true') feeds = mockFeeds(onchain);
  else {
    const got = await Promise.allSettled(Object.entries(FEEDS).map(async ([name, f]) => [name, await f()]));
    for (const g of got) if (g.status === 'fulfilled') feeds[g.value[0]] = g.value[1];
    const down = Object.keys(FEEDS).filter((n) => !feeds[n]);
    if (down.length) console.log(`  feeds unreachable: ${down.join(', ')}`);
  }

  const tokens = [];
  const rates = [];
  let held = 0;
  let skipped = 0;
  for (const c of list) {
    if (c.code === 'USD') continue;
    const values = Object.values(feeds)
      .map((f) => f?.[c.code])
      .filter((v) => typeof v === 'number' && v > 0 && Number.isFinite(v));
    if (values.length < 2) continue;
    const rate = agree(values);
    if (rate === null) {
      held++;
      continue;
    }
    const current = onchain[c.code];
    const drift = Math.abs(rate - current) / current;
    if (drift < MOVE) continue;
    if (drift > MAX_MOVE) {
      console.log(`  ${c.code}: feeds say ${rate}, chain has ${current} (${(drift * 100).toFixed(1)}%): too far for the keeper, owner must forceRate`);
      skipped++;
      continue;
    }
    tokens.push(c.token);
    rates.push(toWad(rate));
    console.log(`  ${c.code.padEnd(4)} ${current.toPrecision(6)} → ${rate.toPrecision(6)}  (${((rate / current - 1) * 100).toFixed(3)}%)`);
  }

  for (let i = 0; i < tokens.length; i += 60) {
    await send(ctx, { address: dep.desk, abi: D.abi, functionName: 'setRates', args: [tokens.slice(i, i + 60), rates.slice(i, i + 60)] });
  }
  console.log(`${new Date().toISOString()}  posted ${tokens.length}, held ${held} (feeds disagreed), skipped ${skipped}`);
}

do {
  try {
    await pass();
  } catch (e) {
    console.error('pass failed:', e.shortMessage || e.message);
  }
  if (opts.once === 'true') break;
  await sleep(EVERY * 1000);
} while (true);
