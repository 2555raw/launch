/* Playground mode: the whole pad, simulated in this browser with the same math
 * the contracts run. A connected wallet only lends its address; nothing is
 * signed and no real money moves. A small crowd of bots keeps trading so the
 * board is alive, and the "keeper" nudges rates the way the real one would.
 * State is saved in localStorage, so a visitor's coins survive a reload. */
import { getAddress, keccak256, toHex } from 'viem';
import { CURRENCIES, currencyColor } from '../data/currencies';
import { DEMO_COINS, LATE_COINS } from '../data/demoCoins';
import {
  applyBuy,
  applySell,
  fromUsd,
  newMarket,
  quoteBuy,
  quoteConvert,
  quoteSell,
  virtualQuoteFor,
  WAD,
} from '../lib/math';
import { MAX_META_BYTES } from '../lib/meta';
import type { Address, Backend, Coin, CreateCoinInput, Currency, Params, RateMove, Snapshot, Trade, TxOptions } from './types';

const KEY = 'downpour:playground:v1';
const MAX_TRADES = 2600;
const STARTING_USD = 1_000n * WAD; // every currency, for every new address
export const PLAYGROUND_TREASURY = '0x000000000000000000000000000000000000dEaD' as Address;

interface World {
  v: 1;
  born: number;
  currencies: Currency[];
  coins: Coin[];
  trades: Trade[];
  rateMoves: RateMove[];
  balances: Record<string, Record<string, bigint>>;
  fees: Record<string, Record<string, bigint>>;
  faucetLast: Record<string, Record<string, number>>;
  params: Params;
  nonce: number;
  lateLaunched: number;
}

/* ------------------------------ helpers ------------------------------ */

const addr = (seed: string) => getAddress(`0x${keccak256(toHex(seed)).slice(-40)}`) as Address;
const now = () => Math.floor(Date.now() / 1000);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lc = (a: string) => a.toLowerCase();

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wad(n: number) {
  return BigInt(Math.round(n * 1e6)) * 10n ** 12n;
}

function rateWad(rate: number) {
  // keep 12 significant digits of small rates like XAU's 0.000274
  const s = rate.toPrecision(12);
  const [m, e] = s.split('e');
  const [w, f = ''] = m.split('.');
  let digits = w.replace('-', '') + f;
  let exp = -f.length + (e ? Number(e) : 0) + 18;
  if (exp < 0) {
    digits = digits.slice(0, digits.length + exp) || '0';
    exp = 0;
  }
  return BigInt(digits) * 10n ** BigInt(exp);
}

const replacer = (_: string, v: unknown) => (typeof v === 'bigint' ? { $b: v.toString() } : v);
const reviver = (_: string, v: any) => (v && typeof v === 'object' && '$b' in v ? BigInt(v.$b) : v);

const BOTS: Address[] = Array.from({ length: 9 }, (_, i) => addr(`downpour:playground:bot:${i}`));

/* ------------------------------ genesis ------------------------------ */

function genesis(): World {
  const t0 = now();
  const rnd = prng(20260926);
  const currencies: Currency[] = CURRENCIES.map((c) => ({
    token: addr(`downpour:playground:currency:${c.code}`),
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    region: c.region,
    kind: c.kind,
    decimals: 18,
    rate: rateWad(c.rate),
    updatedAt: t0 - 600,
    mintable: true,
    color: currencyColor(c.code),
  }));
  const params: Params = {
    targetRaiseUsd: 12_000n * WAD,
    protocolFeeBps: 50,
    creatorFeeBps: 50,
    snipeTaxBps: 2000,
    snipeWindow: 15,
    deskFeeBps: 10,
    faucetUsd: 1_000n * WAD,
    faucetCooldown: 3600,
    treasury: PLAYGROUND_TREASURY,
  };
  const w: World = {
    v: 1,
    born: t0,
    currencies,
    coins: [],
    trades: [],
    rateMoves: [],
    balances: {},
    fees: {},
    faucetLast: {},
    params,
    nonce: 0,
    lateLaunched: 0,
  };
  const byCode = new Map(currencies.map((c) => [c.code, c]));

  DEMO_COINS.forEach(([name, symbol, code, description, fill], i) => {
    const cur = byCode.get(code)!;
    const createdAt = t0 - Math.round((0.4 + rnd() * 3.5) * 86400);
    const creator = BOTS[i % BOTS.length];
    const coin = openCoin(w, creator, { name, symbol, meta: { description, image: '', links: {} }, currency: cur.token }, createdAt);
    const raiseTarget = fromUsd(cur, params.targetRaiseUsd);
    const trades = 26 + Math.floor(rnd() * 30);
    const span = t0 - createdAt - 120;
    let t = createdAt;
    // creator's first buy
    simBuy(w, coin, creator, fromUsd(cur, wad(40 + rnd() * 160)), createdAt, true);
    for (let k = 0; k < trades; k++) {
      t = Math.min(t0 - 30, t + Math.round((span / trades) * (0.3 + rnd() * 1.4)));
      const bot = BOTS[Math.floor(rnd() * BOTS.length)];
      const c = w.coins.find((x) => x.address === coin)!;
      const want = (raiseTarget * BigInt(Math.round(fill * 1000))) / 1000n;
      const held = w.balances[lc(bot)]?.[lc(coin)] ?? 0n;
      if ((c.realQuote >= want && fill < 1) || (rnd() < 0.27 && held > 0n)) {
        if (held > 0n) simSell(w, coin, bot, (held * BigInt(15 + Math.floor(rnd() * 60))) / 100n, t);
        continue;
      }
      const remaining = want > c.realQuote ? want - c.realQuote : fromUsd(cur, wad(30));
      let spend = (remaining * BigInt(Math.round((1.6 / Math.max(1, trades - k)) * 1000 * (0.5 + rnd())))) / 1000n;
      const floor = fromUsd(cur, wad(8 + rnd() * 60));
      if (spend < floor) spend = floor;
      if (fill >= 1 && k === trades - 3) spend = raiseTarget * 2n;
      simBuy(w, coin, bot, spend, t);
    }
  });
  return w;
}

function openCoin(w: World, creator: Address, input: Omit<CreateCoinInput, 'firstBuy' | 'minTokensOut'>, createdAt: number): Address {
  const cur = w.currencies.find((c) => lc(c.token) === lc(input.currency))!;
  const address = addr(`downpour:playground:coin:${w.born}:${w.nonce++}:${input.symbol}`);
  const m = newMarket(virtualQuoteFor(cur, w.params.targetRaiseUsd), createdAt);
  w.coins.push({ ...m, address, name: input.name, symbol: input.symbol, creator, currency: cur.token, meta: input.meta });
  return address;
}

function credit(w: World, who: string, token: string, amount: bigint) {
  const b = (w.balances[lc(who)] ||= {});
  b[lc(token)] = (b[lc(token)] ?? 0n) + amount;
}

function debit(w: World, who: string, token: string, amount: bigint, label: string) {
  const b = (w.balances[lc(who)] ||= {});
  const have = b[lc(token)] ?? 0n;
  if (have < amount) throw new Error(`Not enough ${label} for that.`);
  b[lc(token)] = have - amount;
}

function accrue(w: World, who: string, currency: string, amount: bigint) {
  if (amount === 0n) return;
  const f = (w.fees[lc(who)] ||= {});
  f[lc(currency)] = (f[lc(currency)] ?? 0n) + amount;
}

function record(w: World, t: Omit<Trade, 'id'>) {
  w.trades.push({ ...t, id: `pg:${w.nonce++}` });
  if (w.trades.length > MAX_TRADES) w.trades.splice(0, w.trades.length - MAX_TRADES);
}

/** Buy for a bot (bots always have the money). */
function simBuy(w: World, coinAddr: Address, who: Address, quoteIn: bigint, t: number, exempt = false) {
  const i = w.coins.findIndex((c) => c.address === coinAddr);
  const c = w.coins[i];
  credit(w, who, c.currency, quoteIn);
  executeBuy(w, i, who, quoteIn, t, exempt);
}

function simSell(w: World, coinAddr: Address, who: Address, tokens: bigint, t: number) {
  const i = w.coins.findIndex((c) => c.address === coinAddr);
  if (tokens > 0n) executeSell(w, i, who, tokens, t);
}

function executeBuy(w: World, i: number, who: Address, quoteIn: bigint, t: number, exempt = false, minOut = 0n) {
  const c = w.coins[i];
  const q = quoteBuy(c, quoteIn, w.params, t, exempt);
  if (q.tokensOut === 0n || q.tokensOut < minOut) throw new Error('The price moved past your slippage limit. Try again or allow more slippage.');
  debit(w, who, c.currency, q.quoteUsed, currencyCode(w, c.currency));
  const next = applyBuy(c, q);
  w.coins[i] = { ...c, ...next };
  credit(w, who, c.address, q.tokensOut);
  accrue(w, c.creator, c.currency, q.creatorFee);
  accrue(w, w.params.treasury, c.currency, q.protocolFee + q.snipeTax);
  const after = w.coins[i];
  // Record the reserves at the moment of the fill (before a graduation reset), like the event does.
  const tradeReserveToken = next.graduated && !c.graduated ? c.reserveToken - q.tokensOut : after.reserveToken;
  const tradeReserveQuote = next.graduated && !c.graduated ? c.reserveQuote + q.net : after.reserveQuote;
  record(w, {
    coin: c.address,
    trader: who,
    isBuy: true,
    quoteAmount: q.quoteUsed,
    tokenAmount: q.tokensOut,
    fees: q.protocolFee + q.creatorFee,
    snipeTax: q.snipeTax,
    reserveToken: tradeReserveToken,
    reserveQuote: tradeReserveQuote,
    timestamp: t,
  });
  return q;
}

function executeSell(w: World, i: number, who: Address, tokens: bigint, t: number, minOut = 0n) {
  const c = w.coins[i];
  const q = quoteSell(c, tokens, w.params);
  if (q.quoteOut === 0n || q.quoteOut < minOut) throw new Error('The price moved past your slippage limit. Try again or allow more slippage.');
  debit(w, who, c.address, tokens, c.symbol);
  w.coins[i] = { ...c, ...applySell(c, tokens, q) };
  credit(w, who, c.currency, q.quoteOut);
  accrue(w, c.creator, c.currency, q.creatorFee);
  accrue(w, w.params.treasury, c.currency, q.protocolFee);
  record(w, {
    coin: c.address,
    trader: who,
    isBuy: false,
    quoteAmount: q.quoteOut,
    tokenAmount: tokens,
    fees: q.protocolFee + q.creatorFee,
    snipeTax: 0n,
    reserveToken: w.coins[i].reserveToken,
    reserveQuote: w.coins[i].reserveQuote,
    timestamp: t,
  });
  return q;
}

function currencyCode(w: World, token: string) {
  return w.currencies.find((c) => lc(c.token) === lc(token))?.code ?? 'currency';
}

/* ------------------------------ backend ------------------------------ */

export class PlaygroundBackend implements Backend {
  kind = 'playground' as const;
  private w: World;
  private listeners = new Set<() => void>();
  private timers: number[] = [];
  private saveTimer?: number;
  private rnd = prng(Date.now() & 0xffffffff);

  constructor() {
    this.w = this.restore() ?? genesis();
    this.save();
    this.startCrowd();
  }

  private restore(): World | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const w = JSON.parse(raw, reviver) as World;
      if (w.v !== 1 || !Array.isArray(w.coins) || w.currencies.length !== CURRENCIES.length) return null;
      return w;
    } catch {
      return null;
    }
  }

  private save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.w, replacer));
      } catch {
        // storage full: keep fewer trades and try once more
        this.w.trades = this.w.trades.slice(-800);
        try {
          localStorage.setItem(KEY, JSON.stringify(this.w, replacer));
        } catch {
          /* the playground still works, it just won't survive a reload */
        }
      }
    }, 600);
  }

  private changed() {
    this.save();
    this.listeners.forEach((l) => l());
  }

  /** Bots trade every few seconds; the keeper moves a rate now and then; new coins appear. */
  private startCrowd() {
    const tick = () => {
      try {
        this.botTrade();
      } catch {
        /* a bot hit an edge; it tries again next tick */
      }
      this.timers.push(window.setTimeout(tick, 2500 + this.rnd() * 4500));
    };
    this.timers.push(window.setTimeout(tick, 1500));
    this.timers.push(window.setInterval(() => this.keeperTick(), 27_000));
    this.timers.push(window.setInterval(() => this.lateLaunch(), 150_000));
  }

  dispose() {
    this.timers.forEach((t) => clearTimeout(t));
    this.listeners.clear();
  }

  private botTrade() {
    const w = this.w;
    if (!w.coins.length) return;
    const open = w.coins.filter((c) => !c.graduated);
    const pool = open.length && this.rnd() < 0.85 ? open : w.coins;
    const coin = pool[Math.floor(this.rnd() * pool.length)];
    const i = w.coins.indexOf(coin);
    const bot = BOTS[Math.floor(this.rnd() * BOTS.length)];
    const cur = w.currencies.find((c) => c.token === coin.currency)!;
    const held = w.balances[lc(bot)]?.[lc(coin.address)] ?? 0n;
    const progress = Number(800_000_000n * WAD - coin.curveLeft) / Number(800_000_000n * WAD);
    // Near the top of a curve the crowd takes profit more often, so few coins graduate by themselves.
    const sellBias = coin.graduated ? 0.45 : 0.22 + progress * 0.35;
    const t = now();
    if (held > 0n && this.rnd() < sellBias) {
      executeSell(w, i, bot, (held * BigInt(10 + Math.floor(this.rnd() * 70))) / 100n, t);
    } else {
      const usd = 4 + this.rnd() ** 2 * 380;
      const spend = fromUsd(cur, wad(usd));
      credit(w, bot, coin.currency, spend);
      executeBuy(w, i, bot, spend, t);
    }
    this.changed();
  }

  private keeperTick() {
    const w = this.w;
    const n = 1 + Math.floor(this.rnd() * 3);
    const t = now();
    for (let k = 0; k < n; k++) {
      const c = w.currencies[Math.floor(this.rnd() * w.currencies.length)];
      if (c.code === 'USD') continue;
      const moveBps = BigInt(2 + Math.floor(this.rnd() * 24)) * (this.rnd() < 0.5 ? -1n : 1n);
      const next = c.rate + (c.rate * moveBps) / 10_000n;
      w.rateMoves.push({ token: c.token, oldRate: c.rate, newRate: next, timestamp: t });
      c.rate = next;
      c.updatedAt = t;
    }
    if (w.rateMoves.length > 400) w.rateMoves = w.rateMoves.slice(-400);
    this.changed();
  }

  private lateLaunch() {
    const w = this.w;
    if (w.lateLaunched >= LATE_COINS.length || this.rnd() < 0.35) return;
    const [name, symbol, code, description] = LATE_COINS[w.lateLaunched++];
    const cur = w.currencies.find((c) => c.code === code);
    if (!cur) return;
    const bot = BOTS[Math.floor(this.rnd() * BOTS.length)];
    const coin = openCoin(w, bot, { name, symbol, meta: { description, image: '', links: {} }, currency: cur.token }, now());
    simBuy(w, coin, bot, fromUsd(cur, wad(30 + this.rnd() * 120)), now(), true);
    this.changed();
  }

  /** Real rates for the playground, when two public feeds agree (best effort, silent on failure). */
  applyAgreedRates(rates: Record<string, number>) {
    const t = now();
    let moved = false;
    for (const c of this.w.currencies) {
      const r = rates[c.code];
      if (!r || c.code === 'USD') continue;
      const next = rateWad(r);
      const drift = Number(next > c.rate ? next - c.rate : c.rate - next) / Number(c.rate);
      if (drift < 0.001) continue;
      this.w.rateMoves.push({ token: c.token, oldRate: c.rate, newRate: next, timestamp: t });
      c.rate = next;
      c.updatedAt = t;
      moved = true;
    }
    if (moved) this.changed();
  }

  /** Forget everything and start from the opening cast again. */
  reset() {
    this.w = genesis();
    this.changed();
  }

  subscribe(onChange: () => void) {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  }

  async load(): Promise<Snapshot> {
    const w = this.w;
    return {
      currencies: w.currencies.map((c) => ({ ...c })),
      coins: w.coins.map((c) => ({ ...c })),
      trades: w.trades.slice(),
      rateMoves: w.rateMoves.slice(),
      params: { ...w.params },
      clockSkew: 0,
      loadedAt: Date.now(),
    };
  }

  private ensureAccount(account: Address) {
    const key = lc(account);
    if (this.w.balances[key]?.__seeded !== undefined) return;
    const b = (this.w.balances[key] ||= {});
    for (const c of this.w.currencies) b[lc(c.token)] = (b[lc(c.token)] ?? 0n) + fromUsd(c, STARTING_USD);
    b.__seeded = 1n;
    this.changed();
  }

  async balances(account: Address, tokens: Address[]) {
    this.ensureAccount(account);
    const b = this.w.balances[lc(account)] ?? {};
    return Object.fromEntries(tokens.map((t) => [lc(t), b[lc(t)] ?? 0n]));
  }

  async allowances(_account: Address, _spender: string, tokens: Address[]) {
    // Nothing to approve in the playground.
    return Object.fromEntries(tokens.map((t) => [lc(t), 2n ** 255n]));
  }

  async feesOwed(account: Address, currencies: Address[]) {
    const f = this.w.fees[lc(account)] ?? {};
    return Object.fromEntries(currencies.map((c) => [lc(c), f[lc(c)] ?? 0n]));
  }

  async faucetReadyAt(account: Address, token: Address) {
    const last = this.w.faucetLast[lc(account)]?.[lc(token)] ?? 0;
    return last ? last + this.w.params.faucetCooldown : 0;
  }

  private async step(o?: TxOptions) {
    o?.onStage?.('pending');
    await wait(350 + Math.random() * 350);
  }

  private done(o?: TxOptions) {
    const hash = `playground:${this.w.nonce++}`;
    o?.onStage?.('done', hash);
    this.changed();
    return { hash };
  }

  async faucet(account: Address, token: Address, o?: TxOptions) {
    this.ensureAccount(account);
    const ready = await this.faucetReadyAt(account, token);
    if (ready && now() < ready) throw new Error('You already used the faucet for this currency recently. It refills every hour.');
    await this.step(o);
    const c = this.w.currencies.find((x) => lc(x.token) === lc(token));
    if (!c) throw new Error('Unknown currency.');
    credit(this.w, account, token, fromUsd(c, this.w.params.faucetUsd));
    (this.w.faucetLast[lc(account)] ||= {})[lc(token)] = now();
    return this.done(o);
  }

  async createCoin(account: Address, input: CreateCoinInput, o?: TxOptions) {
    this.ensureAccount(account);
    const nameBytes = new TextEncoder().encode(input.name).length;
    if (!nameBytes || nameBytes > 40) throw new Error('Names are 1-40 characters.');
    if (!/^[A-Z0-9]{1,10}$/.test(input.symbol)) throw new Error('Tickers are 1-10 capital letters or digits.');
    if (new TextEncoder().encode(JSON.stringify(input.meta)).length > MAX_META_BYTES) throw new Error('The image or description is too large. Try a smaller image.');
    const cur = this.w.currencies.find((c) => lc(c.token) === lc(input.currency));
    if (!cur) throw new Error('That currency is not on the desk.');
    if (input.firstBuy > 0n) {
      const have = this.w.balances[lc(account)]?.[lc(cur.token)] ?? 0n;
      if (have < input.firstBuy) throw new Error(`Not enough ${cur.code} for that first buy.`);
    }
    await this.step(o);
    const t = now();
    const coin = openCoin(this.w, account, input, t);
    if (input.firstBuy > 0n) {
      const i = this.w.coins.findIndex((c) => c.address === coin);
      executeBuy(this.w, i, account, input.firstBuy, t, true, input.minTokensOut);
    }
    return { ...this.done(o), coin };
  }

  async buy(account: Address, coin: Address, quoteIn: bigint, minOut: bigint, o?: TxOptions) {
    this.ensureAccount(account);
    const i = this.w.coins.findIndex((c) => lc(c.address) === lc(coin));
    if (i < 0) throw new Error('Unknown coin.');
    await this.step(o);
    executeBuy(this.w, i, account, quoteIn, now(), false, minOut);
    return this.done(o);
  }

  async sell(account: Address, coin: Address, tokensIn: bigint, minOut: bigint, o?: TxOptions) {
    this.ensureAccount(account);
    const i = this.w.coins.findIndex((c) => lc(c.address) === lc(coin));
    if (i < 0) throw new Error('Unknown coin.');
    await this.step(o);
    executeSell(this.w, i, account, tokensIn, now(), minOut);
    return this.done(o);
  }

  async swap(account: Address, tokenIn: Address, tokenOut: Address, amountIn: bigint, minOut: bigint, o?: TxOptions) {
    this.ensureAccount(account);
    const w = this.w;
    const cur = (t: string) => w.currencies.find((c) => lc(c.token) === lc(t));
    const coinIdx = (t: string) => w.coins.findIndex((c) => lc(c.address) === lc(t));
    const a = cur(tokenIn);
    const b = cur(tokenOut);
    const ia = coinIdx(tokenIn);
    const ib = coinIdx(tokenOut);
    if ((!a && ia < 0) || (!b && ib < 0)) throw new Error('Unknown token.');
    if (lc(tokenIn) === lc(tokenOut)) throw new Error('Pick two different tokens.');
    await this.step(o);
    const t = now();
    // Work on a copy so a failed leg leaves nothing half-done.
    const snapshot = JSON.stringify(w, replacer);
    try {
      const convert = (from: Currency, to: Currency, amount: bigint) => {
        const q = quoteConvert(from, to, amount, w.params.deskFeeBps);
        debit(w, account, from.token, amount, from.code);
        credit(w, account, to.token, q.amountOut);
        return q.amountOut;
      };
      const balanceOf = (token: string) => w.balances[lc(account)]?.[lc(token)] ?? 0n;
      let out = 0n;
      if (a && b) {
        out = convert(a, b, amountIn);
      } else if (a && ib >= 0) {
        const target = cur(w.coins[ib].currency)!;
        const spend = lc(a.token) === lc(target.token) ? amountIn : convert(a, target, amountIn);
        const before = balanceOf(w.coins[ib].address);
        executeBuy(w, ib, account, spend, t);
        out = balanceOf(w.coins[ib].address) - before;
      } else if (ia >= 0 && b) {
        const source = cur(w.coins[ia].currency)!;
        const before = balanceOf(source.token);
        executeSell(w, ia, account, amountIn, t);
        const got = balanceOf(source.token) - before;
        out = lc(source.token) === lc(b.token) ? got : convert(source, b, got);
      } else {
        const sa = cur(w.coins[ia].currency)!;
        const sb = cur(w.coins[ib].currency)!;
        const beforeA = balanceOf(sa.token);
        executeSell(w, ia, account, amountIn, t);
        let got = balanceOf(sa.token) - beforeA;
        if (lc(sa.token) !== lc(sb.token)) got = convert(sa, sb, got);
        const before = balanceOf(w.coins[ib].address);
        executeBuy(w, ib, account, got, t);
        out = balanceOf(w.coins[ib].address) - before;
      }
      if (out < minOut) throw new Error('The price moved past your slippage limit. Try again or allow more slippage.');
    } catch (e) {
      this.w = JSON.parse(snapshot, reviver);
      throw e;
    }
    return this.done(o);
  }

  async claimFees(account: Address, currency: Address, o?: TxOptions) {
    const f = this.w.fees[lc(account)] ?? {};
    const amount = f[lc(currency)] ?? 0n;
    if (amount === 0n) throw new Error('Nothing to claim in that currency.');
    await this.step(o);
    f[lc(currency)] = 0n;
    credit(this.w, account, currency, amount);
    return this.done(o);
  }
}
