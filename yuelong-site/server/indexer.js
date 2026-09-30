/* Follows one Yuelong deployment on one chain and keeps what the site shows: every coin the
 * factory launched, every trade on its curve, its pool once it graduates, and the live
 * reserves. State lives in DATA_DIR as JSON, so a restart picks up where it stopped.
 *
 * Trades are read from three places. The router's Trade event names the real trader for
 * everything bought or sold through the site; curve Buy/Sell and pool Swap events catch
 * anyone who trades those contracts directly (those sent by the router are skipped, the
 * router already reported them). Only curves the factory created count, so nobody can feed
 * the index fake trades through the router. */
const fs = require('fs');
const path = require('path');
const { JsonRpcProvider, Interface, Contract, getAddress } = require('ethers');
const ABI = require('../assets/chain/abi.json');

const F = new Interface(ABI.YuelongFactory);
const C = new Interface(ABI.YuelongCurve);
const R = new Interface(ABI.YuelongRouter);
const P = new Interface(ABI.YuelongPool);
const topic = (i, name) => i.getEvent(name).topicHash;
const T = {
  pair: topic(F, 'PairCreated'), buy: topic(C, 'Buy'), sell: topic(C, 'Sell'),
  grad: topic(C, 'Graduated'), swap: topic(P, 'Swap'), trade: topic(R, 'Trade'),
};
const E18 = 10n ** 18n;
const SUPPLY = 1_000_000_000n * E18;
const MAX_TRADES = 5000;
const POLL_MS = 5000;
const ADDR_GROUP = 100;

const lc = (a) => String(a).toLowerCase();
const clip = (s, n) => (typeof s === 'string' ? s.slice(0, n) : '');
const httpsUrl = (s, n = 300) => (typeof s === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(s) ? s.slice(0, n) : '');

/* metadata is whatever the creator put in the launch transaction: keep only known fields */
function parseMeta(raw) {
  let m = {};
  try { m = JSON.parse(raw); } catch (_) { m = { description: raw }; }
  if (!m || typeof m !== 'object') m = {};
  const image = typeof m.image === 'string' && /^\/u\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(m.image) ? m.image : httpsUrl(m.image);
  const cat = ['subnet', 'candidate', 'ecosystem'].includes(m.category) ? m.category : 'ecosystem';
  const sn = Number.isInteger(m.subnet) && m.subnet >= 0 && m.subnet < 4096 ? m.subnet : null;
  return {
    image, category: cat, subnet: cat === 'subnet' ? sn : null,
    description: clip(m.description, 600),
    website: httpsUrl(m.website, 200), x: httpsUrl(m.x, 200), telegram: httpsUrl(m.telegram, 200),
  };
}

class Indexer {
  constructor(net, dep, dataDir) {
    this.net = net;
    this.dep = dep;
    this.file = path.join(dataDir, `index-${net.chainId}-${lc(dep.factory).slice(2, 10)}.json`);
    this.provider = new JsonRpcProvider(net.rpc, net.chainId, { staticNetwork: true, batchMaxCount: 1 });
    this.router = lc(dep.router);
    this.factory = lc(dep.factory);
    this.head = 0;
    this.error = null;
    this.stopped = false;
    this.state = this.load();
    this.poolToCurve = {};
    for (const [c, t] of Object.entries(this.state.tokens)) if (t.pool) this.poolToCurve[lc(t.pool)] = c;
  }

  load() {
    try {
      const s = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (s && s.v === 1) return s;
    } catch (_) { /* first run */ }
    return { v: 1, lastBlock: Number(this.dep.startBlock || 0) - 1, tokens: {}, trades: {} };
  }

  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.state));
    fs.renameSync(tmp, this.file);
  }

  start() { this.loop(); return this; }
  stop() { this.stopped = true; clearTimeout(this.timer); }

  /* a page that just sent a transaction asks for a quick look instead of waiting for the poll */
  poke() {
    if (this.busy) { this.again = true; return; }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.loop(), 250);
  }

  async loop() {
    if (this.stopped) return;
    this.busy = true;
    let caughtUp = true;
    try { caughtUp = await this.tick(); this.error = null; }
    catch (e) { this.error = String(e.shortMessage || e.message || e).slice(0, 200); console.error(`[index ${this.net.chainId}]`, this.error); }
    this.busy = false;
    if (this.stopped) return;
    const delay = this.again ? 250 : caughtUp ? POLL_MS : 50;
    this.again = false;
    this.timer = setTimeout(() => this.loop(), delay);
  }

  async logs(addresses, topics, fromBlock, toBlock) {
    const out = [];
    for (let i = 0; i < addresses.length; i += ADDR_GROUP) {
      out.push(...await this.provider.getLogs({ address: addresses.slice(i, i + ADDR_GROUP), topics, fromBlock, toBlock }));
    }
    return out;
  }

  async tick() {
    const head = await this.provider.getBlockNumber();
    this.head = head;
    const from = this.state.lastBlock + 1;
    if (from > head) return true;
    const to = Math.min(head, from + this.net.logChunk - 1);

    const created = await this.provider.getLogs({ address: this.dep.factory, topics: [T.pair], fromBlock: from, toBlock: to });
    for (const log of created) await this.addToken(log);

    const curves = Object.keys(this.state.tokens);
    const pools = Object.keys(this.poolToCurve);
    const venueTopics = [[T.buy, T.sell, T.grad, T.swap, T.trade]];
    let logs = curves.length ? await this.logs([this.dep.router, ...curves, ...pools], venueTopics, from, to) : [];
    logs.sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);

    const times = await this.blockTimes(logs.concat(created));
    const touched = new Set(created.map((l) => lc(F.parseLog(l).args.curve)));
    const viaRouter = {};
    for (const log of logs) if (lc(log.address) === this.router) viaRouter[log.transactionHash] = getAddress(R.parseLog(log).args.trader);
    const newPools = [];
    for (const log of logs) this.handle(log, times, touched, newPools, viaRouter);
    // a pool born in this range may already have swaps in it
    for (const { pool, block } of newPools) {
      const more = (await this.logs([pool], [[T.swap]], block, to)).filter((l) => !logs.some((x) => x.transactionHash === l.transactionHash && x.index === l.index));
      const t2 = await this.blockTimes(more);
      for (const log of more) this.handle(log, t2, touched, [], viaRouter);
    }

    for (const c of touched) await this.refresh(c);
    this.state.lastBlock = to;
    this.save();
    return to >= head;
  }

  async blockTimes(logs) {
    const nums = [...new Set(logs.map((l) => l.blockNumber))];
    const out = {};
    for (let i = 0; i < nums.length; i += 10) {
      const blocks = await Promise.all(nums.slice(i, i + 10).map((n) => this.provider.getBlock(n)));
      blocks.forEach((b, j) => { out[nums[i + j]] = b ? Number(b.timestamp) : Math.floor(Date.now() / 1000); });
    }
    return out;
  }

  async addToken(log) {
    const { args } = F.parseLog(log);
    const curve = lc(args.curve);
    if (this.state.tokens[curve]) return;
    const c = new Contract(args.curve, ABI.YuelongCurve, this.provider);
    const [phantom, threshold, feeBps, creatorTaxBps, snipeTaxBps, snipeWindow, launchBlock] = await Promise.all([
      c.phantomQuote(), c.graduationThreshold(), c.feeBps(), c.creatorTaxBps(), c.snipeTaxBps(), c.snipeWindow(), c.launchBlock(),
    ]);
    this.state.tokens[curve] = {
      curve: getAddress(args.curve), token: getAddress(args.token), creator: getAddress(args.creator), quote: getAddress(args.stock),
      name: clip(args.name, 40), symbol: clip(args.symbol, 8), meta: parseMeta(args.metadata),
      block: log.blockNumber, tx: log.transactionHash, createdAt: 0,
      phantom: String(phantom), threshold: String(threshold), feeBps: Number(feeBps), creatorTaxBps: Number(creatorTaxBps),
      snipeTaxBps: Number(snipeTaxBps), snipeWindow: Number(snipeWindow), launchBlock: Number(launchBlock),
      quoteReserve: '0', tokenReserve: String(SUPPLY), graduated: false, pool: null, poolToken: null, poolQuote: null,
    };
    this.state.trades[curve] = [];
  }

  /* Curve and pool events carry the amounts and let us replay the reserves, so every trade
   * records the spot price right after it. Trades sent through the router name the router as
   * buyer or seller; the router's own Trade event in the same transaction names the person. */
  handle(log, times, touched, newPools, viaRouter) {
    const addr = lc(log.address);
    if (addr === this.router) return;
    const t = times[log.blockNumber] || Math.floor(Date.now() / 1000);
    const base = { tx: log.transactionHash, b: log.blockNumber, i: log.index, t };
    const who = (a, fallback) => (lc(a) === this.router ? viaRouter[log.transactionHash] || fallback : getAddress(a));

    const tk = this.state.tokens[addr];
    if (tk) {
      const { name, args } = C.parseLog(log);
      let rq = BigInt(tk.rq ?? '0'), rt = BigInt(tk.rt ?? String(SUPPLY));
      if (name === 'Graduated') {
        tk.graduated = true;
        tk.pool = getAddress(args.pool);
        tk.graduatedAt = t;
        tk.pq = String(args.quoteToPool);
        tk.pt = String(args.tokensToPool);
        tk.rq = '0'; tk.rt = '0';
        this.poolToCurve[lc(args.pool)] = addr;
        newPools.push({ pool: tk.pool, block: log.blockNumber });
      } else if (name === 'Buy') {
        rq += args.quoteIn - args.fee - args.creatorFee; rt -= args.tokensOut;
        tk.rq = String(rq); tk.rt = String(rt);
        const buyer = lc(args.buyer) === this.factory ? getAddress(args.recipient) : who(args.buyer, getAddress(args.recipient));
        this.push(addr, { ...base, s: 'b', w: buyer, q: String(args.quoteIn), n: String(args.tokensOut), v: 'c', p: String(rt ? (BigInt(tk.phantom) + rq) * E18 / rt : 0n) });
      } else if (name === 'Sell') {
        rq -= args.quoteOut + args.fee + args.creatorFee; rt += args.tokensIn;
        tk.rq = String(rq); tk.rt = String(rt);
        this.push(addr, { ...base, s: 's', w: who(args.seller, getAddress(args.seller)), q: String(args.quoteOut), n: String(args.tokensIn), v: 'c', p: String((BigInt(tk.phantom) + rq) * E18 / rt) });
      }
      touched.add(addr);
      return;
    }

    const curve = this.poolToCurve[addr];
    if (curve) {
      const { args } = P.parseLog(log);
      const tk2 = this.state.tokens[curve];
      tk2.pt = String(args.tokenReserve); tk2.pq = String(args.quoteReserve);
      const p = args.tokenReserve ? args.quoteReserve * E18 / args.tokenReserve : 0n;
      this.push(curve, args.buy
        ? { ...base, s: 'b', w: who(args.sender, getAddress(args.recipient)), q: String(args.amountIn), n: String(args.amountOut), v: 'p', p: String(p) }
        : { ...base, s: 's', w: who(args.sender, getAddress(args.sender)), q: String(args.amountOut), n: String(args.amountIn), v: 'p', p: String(p) });
      touched.add(curve);
    }
  }

  push(curve, trade) {
    const list = this.state.trades[curve] || (this.state.trades[curve] = []);
    if (list.some((x) => x.tx === trade.tx && x.i === trade.i)) return;
    list.push(trade);
    if (list.length > MAX_TRADES) list.splice(0, list.length - MAX_TRADES);
    const tk = this.state.tokens[curve];
    tk.volume = String(BigInt(tk.volume || 0) + BigInt(trade.q));
    tk.tradeCount = (tk.tradeCount || 0) + 1;
    tk.lastTradeAt = trade.t;
    if (!tk.createdAt || trade.t < tk.createdAt) tk.createdAt = trade.t;
  }

  async refresh(curve) {
    const tk = this.state.tokens[curve];
    const c = new Contract(tk.curve, ABI.YuelongCurve, this.provider);
    const [qr, tr, grad, pool] = await Promise.all([c.quoteReserve(), c.tokenReserve(), c.graduated(), c.pool()]);
    tk.quoteReserve = String(qr);
    tk.tokenReserve = String(tr);
    tk.graduated = grad;
    if (grad && pool !== '0x0000000000000000000000000000000000000000') {
      tk.pool = getAddress(pool);
      this.poolToCurve[lc(pool)] = curve;
      try {
        const [pt, pq] = await new Contract(pool, ABI.YuelongPool, this.provider).getReserves();
        tk.poolToken = String(pt);
        tk.poolQuote = String(pq);
      } catch (_) { /* graduated into an outside DEX: no reserves to read here */ }
    }
    if (!tk.createdAt) {
      const b = await this.provider.getBlock(tk.block);
      tk.createdAt = b ? Number(b.timestamp) : Math.floor(Date.now() / 1000);
    }
  }

  /* ------------------------------------------------------------ views for the API */

  static price(tk) {
    if (tk.graduated && tk.poolToken && tk.poolToken !== '0') return BigInt(tk.poolQuote) * E18 / BigInt(tk.poolToken);
    const tr = BigInt(tk.tokenReserve);
    return tr === 0n ? 0n : (BigInt(tk.phantom) + BigInt(tk.quoteReserve)) * E18 / tr;
  }

  summary(tk) {
    const price = Indexer.price(tk);
    const trades = this.state.trades[lc(tk.curve)] || [];
    const dayAgo = Date.now() / 1000 - 86400;
    let vol24 = 0n;
    let open24 = BigInt(tk.phantom) * E18 / SUPPLY;   // the launch price
    for (const tr of trades) { if (tr.t < dayAgo) open24 = BigInt(tr.p || 0); else vol24 += BigInt(tr.q); }
    const threshold = BigInt(tk.threshold);
    const progress = tk.graduated ? 1 : threshold === 0n ? 0 : Number(BigInt(tk.quoteReserve) * 10000n / threshold) / 10000;
    const pair = (this.dep.pairs || []).find((p) => lc(p.address) === lc(tk.quote));
    return {
      chainId: this.net.chainId, network: this.net.key, curve: tk.curve, token: tk.token, creator: tk.creator,
      name: tk.name, symbol: tk.symbol, ...tk.meta, quote: tk.quote, quoteSymbol: pair ? pair.symbol : '?', quoteDecimals: pair ? pair.decimals : 18,
      createdAt: tk.createdAt, block: tk.block, tx: tk.tx,
      price: String(price), mcap: String(price * SUPPLY / E18),
      change24h: open24 > 0n ? Number((price - open24) * 10000n / open24) / 100 : 0,
      volume: tk.volume || '0', volume24h: String(vol24), trades: tk.tradeCount || 0, lastTradeAt: tk.lastTradeAt || tk.createdAt,
      progress, graduated: tk.graduated, pool: tk.pool, graduatedAt: tk.graduatedAt || null,
      quoteReserve: tk.quoteReserve, tokenReserve: tk.tokenReserve, phantom: tk.phantom, threshold: tk.threshold,
      poolToken: tk.poolToken, poolQuote: tk.poolQuote,
      feeBps: tk.feeBps, creatorTaxBps: tk.creatorTaxBps, snipeTaxBps: tk.snipeTaxBps, snipeWindow: tk.snipeWindow, launchBlock: tk.launchBlock,
    };
  }

  tokens() { return Object.values(this.state.tokens).map((tk) => this.summary(tk)); }
  token(curve) { const tk = this.state.tokens[lc(curve)]; return tk ? this.summary(tk) : null; }
  trades(curve, limit = 200) { return (this.state.trades[lc(curve)] || []).slice(-limit); }

  recentTrades(limit = 30) {
    const all = [];
    for (const [c, list] of Object.entries(this.state.trades)) {
      const tk = this.state.tokens[c];
      for (const tr of list.slice(-limit)) all.push({ ...tr, chainId: this.net.chainId, curve: tk.curve, symbol: tk.symbol, name: tk.name, image: tk.meta.image });
    }
    return all.sort((a, b) => b.t - a.t || b.b - a.b || b.i - a.i).slice(0, limit);
  }

  stats() {
    const toks = Object.values(this.state.tokens);
    const traders = new Set();
    let volume = 0n;
    for (const list of Object.values(this.state.trades)) for (const tr of list) { traders.add(tr.w); volume += BigInt(tr.q); }
    return {
      chainId: this.net.chainId, launches: toks.length, graduated: toks.filter((t) => t.graduated).length,
      traders: traders.size, volume: String(volume), head: this.head, indexed: this.state.lastBlock, error: this.error,
    };
  }
}

module.exports = { Indexer, parseMeta };
