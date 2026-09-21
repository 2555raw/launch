/* Bonded × Pons V2 — the real adapter.
   Launches through the open Pons V2 LaunchFactory on Robinhood Chain (4663) and
   pairs every coin with the tokenized stock the creator picked: the stock token
   IS the curve's quote asset, so the coin can only be bought and sold with it.

   Live is the default. ?demo=1 switches this browser to the demo adapter in app.js
   (remembered in localStorage 'bonded-demo'); ?demo=0 switches back.
   Needs pons/wallet.js, pons/keccak.js and pons/abi.js before it, and a wallet (MetaMask, Phantom, Rabby…).

   Stock token addresses: pass them in window.BONDED_STOCK_TOKENS = { TSLA: '0x…' }
   before this script, or let the adapter discover them from recent launches on the
   factory. Every address is checked with approvedPairTokens() before it is used.
   Run scripts/verify-pons.mjs from your machine to confirm all of this on-chain. */
(function () {
  const url = new URL(location.href);
  const demo = url.searchParams.get('demo');
  try {
    if (demo === '1') localStorage.setItem('bonded-demo', '1');
    if (demo === '0') localStorage.removeItem('bonded-demo');
    if (localStorage.getItem('bonded-demo') === '1') return;
  } catch (_) { if (demo === '1') return; }
  if (location.protocol === 'file:') return;   // opened from disk: no server, no proxy, stay on the demo
  if (!globalThis.bdAbi || !globalThis.bdKeccak256) { console.error('pons: load pons/keccak.js and pons/abi.js first'); return; }

  const A = globalThis.bdAbi;
  const PONS = Object.assign({
    chainId: 4663,
    chainHex: '0x1237',
    chainName: 'Robinhood Chain',
    rpc: '/rpc',               // the site's own proxy (server.js) to the public RPC: browsers cannot call it directly
    publicRpc: 'https://rpc.mainnet.chain.robinhood.com',
    explorer: 'https://robinhoodchain.blockscout.com',
    factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
    launcher: null,            // LilyPadLauncher address (contracts/pons/), bundles the first buy into the launch tx
    launchConfigId: null,      // null = first enabled config
    creatorTaxBps: 100,        // 1% of every curve trade, paid to feeRecipient
    feeRecipient: null,        // defaults to BONDED_OWNER (config.js), else the launching wallet
    slippageBps: 300,          // shown on the pair page; snipe tax on young curves can exceed 1%
    lookbackBlocks: 60_000,    // how far back to index launches on the first visit; later visits scan only new blocks
    maxPairs: 60,              // newest launches kept from the shared factory (LilyPad's own are always kept)
    chunk: 10_000,             // eth_getLogs window
    parallel: 3,               // concurrent RPC requests while indexing (the public RPC is rate-limited)
    pollMs: 12_000,
  }, window.BONDED_PONS || {});

  // ---- ABI -------------------------------------------------------------
  const SOCIALS = { tuple: ['string', 'string', 'string', 'string', 'string'] };
  const TOKEN_PARAMS = { tuple: ['string', 'string', 'string', 'string', SOCIALS, 'address', 'uint16', 'bool', 'bytes32', 'bytes32'] };
  const LAUNCH_CONFIG = { tuple: ['uint256', 'uint256', 'uint256', 'uint256', 'uint24', 'int24', 'bool'] };
  const LAUNCH_TYPES = [TOKEN_PARAMS, 'uint256', 'address', 'address[]'];
  const LAUNCHER_TYPES = [TOKEN_PARAMS, 'uint256', 'address', 'address[]', 'uint256', 'uint256'];
  const T_LAUNCHER = A.topic('Launched', ['address', 'address', 'address', 'address', 'uint256', 'uint256']);
  const launcherAddr = () => PONS.launcher ? String(PONS.launcher).toLowerCase() : null;
  const creators = {};   // token(lower) -> human creator, when the launch went through the launcher
  const T_LAUNCHED = A.topic('TokenLaunched', ['address', 'address', 'address', 'address', 'uint256', 'uint256']);
  const T_BUY = A.topic('CurveBuy', ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256']);
  const T_SELL = A.topic('CurveSell', ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256']);

  // transport: the wallet when it sits on Robinhood Chain (its own RPC, no CORS, no shared rate limit),
  // the public RPC otherwise; a network failure reads as a sentence instead of "Failed to fetch"
  const httpRpc = A.makeRpc(PONS.rpc);
  const publicHttpRpc = A.makeRpc(PONS.publicRpc);
  let walletChain = null;
  async function rpc(method, params = []) {
    const w = window.bdWallet ? window.bdWallet.provider() : window.ethereum;
    if (w && w.request) {
      if (walletChain == null) {
        try { walletChain = parseInt(await w.request({ method: 'eth_chainId' }), 16); if (w.on) w.on('chainChanged', c => { walletChain = parseInt(c, 16); }); } catch (_) { walletChain = 0; }
      }
      if (walletChain === PONS.chainId) return w.request({ method, params });
    }
    try { return await httpRpc(method, params); }
    catch (e) {
      const network = e instanceof TypeError || /Failed to fetch|NetworkError|Load failed|HTTP 5\d\d|HTTP 404/i.test(e.message);
      if (!network) throw e;
      try { return await publicHttpRpc(method, params); }
      catch (e2) {
        if (e2 instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(e2.message)) throw new Error(`Cannot reach ${PONS.chainName} right now. Connect a wallet set to ${PONS.chainName} (chain ${PONS.chainId}) and try again.`);
        throw e2;
      }
    }
  }
  // map with a concurrency cap, so indexing does not fire hundreds of requests at once
  async function pmap(items, fn, n = PONS.parallel) {
    const out = new Array(items.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
    return out;
  }
  const call = async (to, name, types, args, outTypes, extra = {}) => {
    const data = A.encodeCall(name, types, args);
    const res = await rpc('eth_call', [{ to, data, ...extra }, 'latest']);
    return A.decodeResult(outTypes, res);
  };
  const factory = {
    launchFee: () => call(PONS.factory, 'launchFee', [], [], ['uint256']).then(r => r[0]),
    launchEnabled: () => call(PONS.factory, 'launchEnabled', [], [], ['bool']).then(r => r[0]),
    approved: (t) => call(PONS.factory, 'approvedPairTokens', ['address'], [t], ['bool']).then(r => r[0]),
    canLaunch: (who) => call(PONS.factory, 'canLaunch', ['address'], [who], ['bool']).then(r => r[0]),
    maxCreatorTaxBps: () => call(PONS.factory, 'maxCreatorTaxBps', [], [], ['uint256']).then(r => Number(r[0])).catch(() => null),
    configCount: () => call(PONS.factory, 'launchConfigCount', [], [], ['uint256']).then(r => Number(r[0])),
    config: (id) => call(PONS.factory, 'getLaunchConfig', ['uint256'], [id], [LAUNCH_CONFIG]).then(([c]) => ({ supply: c[0], curveFeeBps: c[1], phantomQuote: c[2], graduationThreshold: c[3], poolFee: c[4], tickSpacing: c[5], enabled: c[6] })),
    economics: (id, quote) => call(PONS.factory, 'previewLaunchEconomics', ['uint256', 'address'], [id, quote], ['bytes32']).then(r => r[0]),
    pairEconomics: (quote) => call(PONS.factory, 'pairTokenEconomics', ['address'], [quote], ['uint256', 'uint256', 'uint8']),
  };
  const curve = {
    reserves: (c) => call(c, 'getReserves', [], [], ['uint256', 'uint256']).then(([q, t]) => ({ q, t })),
    feeBps: (c) => call(c, 'feeBps', [], [], ['uint256']).then(r => r[0]),
    graduated: (c) => call(c, 'graduated', [], [], ['bool']).then(r => r[0]),
    launchSupply: (c) => call(c, 'launchSupply', [], [], ['uint256']).then(r => r[0]),
  };
  const erc20 = {
    symbol: (t) => call(t, 'symbol', [], [], ['string']).then(r => r[0]).catch(() => '?'),
    name: (t) => call(t, 'name', [], [], ['string']).then(r => r[0]).catch(() => '?'),
    decimals: (t) => call(t, 'decimals', [], [], ['uint8']).then(r => Number(r[0])).catch(() => 18),
    balanceOf: (t, who) => call(t, 'balanceOf', ['address'], [who], ['uint256']).then(r => r[0]),
    allowance: (t, o, s) => call(t, 'allowance', ['address', 'address'], [o, s], ['uint256']).then(r => r[0]),
  };

  // ---- wallet ----------------------------------------------------------
  const eth = () => { const w = window.bdWallet ? window.bdWallet.provider() : window.ethereum; if (!w || !w.request) throw new Error('No wallet found. Install MetaMask, Phantom or Rabby and reload.'); return w; };
  async function ensureChain() {
    const w = eth();
    const cur = await w.request({ method: 'eth_chainId' });
    if (parseInt(cur, 16) === PONS.chainId) return;
    try { await w.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: PONS.chainHex }] }); }
    catch (e) {
      if (e.code === 4001) throw new Error('You declined the switch to ' + PONS.chainName + '.');
      try {
        await w.request({ method: 'wallet_addEthereumChain', params: [{ chainId: PONS.chainHex, chainName: PONS.chainName, rpcUrls: [PONS.publicRpc], blockExplorerUrls: [PONS.explorer], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } }] });
      } catch (e2) {
        const who = w.isPhantom ? 'Phantom' : 'This wallet';
        throw new Error(`${who} could not switch to ${PONS.chainName} (chain ${PONS.chainId}): ${e2.message || e2.code}. If it does not let you add custom networks, use MetaMask or Rabby.`);
      }
    }
    walletChain = null;
  }
  let account = null;
  // eth_call for simulations: the proxy / public RPC keep the revert data that wallets strip
  async function simulate(tx) {
    const params = [tx, 'latest'];
    try { return await httpRpc('eth_call', params); }
    catch (e) {
      const network = e instanceof TypeError || /Failed to fetch|NetworkError|Load failed|HTTP 5\d\d|HTTP 404|upstream/i.test(e.message);
      if (!network) throw e;
      try { return await publicHttpRpc('eth_call', params); }
      catch (e2) { if (e2 instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(e2.message)) return rpc('eth_call', params); throw e2; }
    }
  }
  async function sendTx(tx) {
    await ensureChain();
    const from = account || (await eth().request({ method: 'eth_requestAccounts' }))[0];
    // simulate first so a revert reads as a sentence, not a wallet error code. The wallet's own node
    // is the freshest after a transaction it just mined (an approval, say), so it goes first; a
    // revert without data is re-run on the public RPC to recover the reason; an allowance or
    // balance that is not visible yet is retried for a few seconds before giving up.
    const call = { from, ...tx };
    let reason = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try { await rpc('eth_call', [call, 'latest']); reason = null; break; }
      catch (e) {
        reason = A.revertReason(e);
        if (/execution reverted$|^rpc eth_call: execution reverted/.test(reason)) { try { await simulate(call); reason = null; break; } catch (e2) { reason = A.revertReason(e2); } }
        if (!/InsufficientAllowance|InsufficientBalance|TransferFailed|SafeERC20/i.test(reason)) break;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    if (reason) throw new Error('Would revert: ' + reason);
    const hash = await eth().request({ method: 'eth_sendTransaction', params: [{ from, ...tx }] });
    return waitReceipt(hash);
  }
  async function waitReceipt(hash, ms = 180_000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const r = await rpc('eth_getTransactionReceipt', [hash]);
      if (r) { if (r.status !== '0x1') throw new Error('Transaction reverted: ' + hash); return r; }
      await new Promise(r => setTimeout(r, 1500));
    }
    throw new Error('Timed out waiting for ' + hash);
  }
  async function approveIfNeeded(token, spender, amount) {
    const have = await erc20.allowance(token, account, spender);
    if (have >= amount) return;
    await sendTx({ to: token, data: A.encodeCall('approve', ['address', 'uint256'], [spender, amount]) });
  }

  // ---- index of launches paired with stocks ------------------------------
  const stocksMeta = () => window.Bonded?.stocks || [];
  const priceOf = (sym) => window.BONDED_PRICES?.[sym] ?? stocksMeta().find(s => s.sym === sym)?.price ?? 0;
  // an on-chain symbol like 'NVDA', 'NVDAon' or 'tNVDA' maps to the Bonded ticker it contains
  const matchTicker = (raw) => {
    const up = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const syms = stocksMeta().map(s => s.sym).sort((a, b) => b.length - a.length);
    return syms.find(s => up === s) || syms.find(s => (up.startsWith(s) || up.endsWith(s)) && up.length - s.length <= 3) || null;
  };
  const stockTokens = {};   // sym -> { address, decimals }
  const byToken = {};       // address(lower) -> sym
  const index = { launches: [], lastBlock: 0, ready: null };
  // the index is remembered per browser, so a return visit paints at once and only scans new blocks
  const CACHE_KEY = 'bonded-pons-index-v1';
  const bigOut = (k, v) => typeof v === 'bigint' ? v.toString() + 'n' : v;
  const bigIn = (k, v) => typeof v === 'string' && /^\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null', bigIn);
    if (c && c.factory === PONS.factory.toLowerCase() && Array.isArray(c.launches)) { index.launches = c.launches; index.lastBlock = c.lastBlock || 0; Object.assign(creators, c.creators || {}); }
  } catch (_) {}
  const saveIndex = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ factory: PONS.factory.toLowerCase(), lastBlock: index.lastBlock, launches: index.launches.slice(0, 400), creators }, bigOut)); } catch (_) {} };
  const announce = name => { try { document.dispatchEvent(new CustomEvent(name)); } catch (_) {} };
  // launches made through LilyPad: the site's registry (/launches) plus this browser's own
  const MINE_KEY = 'bonded-pons-mine';
  const lilypadTokens = new Set();
  try { for (const t of JSON.parse(localStorage.getItem(MINE_KEY) || '[]')) lilypadTokens.add(String(t).toLowerCase()); } catch (_) {}
  const markLilypad = () => { for (const p of index.launches) if (lilypadTokens.has(p.address.toLowerCase())) p.lilypad = true; };
  const registryLoaded = fetch('/launches', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(list => { for (const l of list) if (l && l.token) lilypadTokens.add(String(l.token).toLowerCase()); markLilypad(); announce('bonded:index'); }).catch(() => {});
  const recordLaunch = rec => {
    lilypadTokens.add(rec.token.toLowerCase());
    try { localStorage.setItem(MINE_KEY, JSON.stringify([...lilypadTokens].slice(-500))); } catch (_) {}
    fetch('/launches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rec) }).catch(() => {});
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function registerStock(sym, address) {
    const a = address.toLowerCase();
    if (byToken[a] !== undefined) return byToken[a] || null;
    if (!(await factory.approved(a))) { console.warn(`pons: ${sym} ${address} is not an approved quote token, skipping`); return null; }
    const [phantom, , dec] = await factory.pairEconomics(a).catch(() => [0n, 0n, 18]);
    const onchainSym = await erc20.symbol(a);
    const key = sym ? sym.toUpperCase() : matchTicker(onchainSym);
    if (!key) { byToken[a] = false; return null; }   // USDG, cbBTC, ETH…: approved, but not a stock Bonded lists
    stockTokens[key] = { address: a, decimals: Number(dec), onchainSym, phantom };
    byToken[a] = key;
    return key;
  }

  function parseLaunched(log) {
    const [pairToken, launchConfigId, graduationThreshold] = A.decodeTuple(['address', 'uint256', 'uint256'], A.strip(log.data));
    return {
      token: '0x' + log.topics[1].slice(26), curve: '0x' + log.topics[2].slice(26), deployer: '0x' + log.topics[3].slice(26),
      pairToken, launchConfigId, graduationThreshold, block: parseInt(log.blockNumber, 16), tx: log.transactionHash,
    };
  }

  async function getLogsRange(filter, from, to) {
    const windows = [];
    for (let a = from; a <= to; a += PONS.chunk) windows.push([a, Math.min(to, a + PONS.chunk - 1)]);
    const parts = await pmap(windows, ([a, b]) => rpc('eth_getLogs', [{ ...filter, fromBlock: A.hex(a), toBlock: A.hex(b) }]));
    return parts.flat();
  }
  const blockTimes = {};
  async function timestampsFor(blockHexes) {
    const missing = [...new Set(blockHexes)].filter(b => !blockTimes[b]);
    await pmap(missing, async b => { blockTimes[b] = parseInt((await rpc('eth_getBlockByNumber', [b, false])).timestamp, 16) * 1000; });
    return blockTimes;
  }

  // market cap and real liquidity from a curve's reserves; an emptied (graduated) curve keeps a threshold-based value
  function valueOf(sym, q, t) {
    const st = stockTokens[sym]; const px = priceOf(sym);
    const tokens = Number(t) / 1e18, quote = Number(q) / 10 ** st.decimals, phantom = Number(st.phantom || 0n) / 10 ** st.decimals;
    const real = Math.max(0, quote - phantom);
    if (tokens < 1_000_000) return { mcap: quote / 1e6 * 1e9 * px, liquidityUsd: real * px, graduated: true };   // curve emptied at graduation: value it at the last curve price
    return { mcap: quote / tokens * 1e9 * px, liquidityUsd: real * px, graduated: false };
  }
  async function hydrate(l) {
    const sym = byToken[l.pairToken.toLowerCase()];
    if (!sym) return null;
    const [name, ticker, { q, t }] = await Promise.all([erc20.name(l.token), erc20.symbol(l.token), curve.reserves(l.curve)]);
    const times = await timestampsFor([A.hex(l.block)]);
    const st = stockTokens[sym];
    const { mcap, liquidityUsd, graduated } = valueOf(sym, q, t);
    return {
      name, ticker, stock: sym, desc: '', image: '', x: '', site: '',
      address: l.token, curve: l.curve, creator: creators[l.token.toLowerCase()] || l.deployer, createdAt: times[A.hex(l.block)],
      mcap, liquidityUsd, graduated, volume: 0, change: 0, holders: 1,
      launch: l,
    };
  }

  // the launcher's Launched(user, token, curve, …) tells us who the human behind a launch is
  async function noteLauncherLogs(from, to) {
    if (!launcherAddr()) return;
    const logs = await getLogsRange({ address: launcherAddr(), topics: [T_LAUNCHER] }, from, to).catch(() => []);
    for (const l of logs) creators['0x' + l.topics[2].slice(26)] = '0x' + l.topics[1].slice(26);
  }
  // the configured stock tokens, checked with approvedPairTokens(): a handful of calls, independent of the index
  let stocksPromise = null, stocksVerified = false;
  const STOCKS_KEY = 'bonded-pons-stocks-v1';
  try {
    const c = JSON.parse(localStorage.getItem(STOCKS_KEY) || 'null', bigIn);
    if (c && c.factory === PONS.factory.toLowerCase() && c.tokens) { for (const [sym, tk] of Object.entries(c.tokens)) { stockTokens[sym] = tk; byToken[tk.address] = sym; } stocksVerified = Object.keys(stockTokens).length > 0; }
  } catch (_) {}
  const saveStocks = () => { try { localStorage.setItem(STOCKS_KEY, JSON.stringify({ factory: PONS.factory.toLowerCase(), tokens: stockTokens }, bigOut)); } catch (_) {} };
  const stocksReady = () => stocksPromise || (stocksPromise = (async () => {
    // re-check the configured list; a cached entry is trusted until the factory says otherwise
    await pmap(Object.entries(window.BONDED_STOCK_TOKENS || {}), async ([sym, addr]) => {
      const a = addr.toLowerCase();
      if (byToken[a] !== undefined) { if (!(await factory.approved(a).catch(() => true))) { delete stockTokens[byToken[a]]; delete byToken[a]; } return; }
      await registerStock(sym, addr);
    }, 4);
    stocksVerified = true;
    saveStocks();
    announce('bonded:stocks');
    return stockTokens;
  })().catch(e => { stocksPromise = null; throw e; }));

  async function buildIndex() {
    await stocksReady();
    const head = parseInt(await rpc('eth_blockNumber'), 16);
    const from = index.lastBlock ? index.lastBlock + 1 : Math.max(0, head - PONS.lookbackBlocks);
    if (from <= head) {
      const logs = await getLogsRange({ address: PONS.factory, topics: [T_LAUNCHED] }, from, head);
      const launches = logs.map(parseLaunched).filter(l => !index.launches.some(p => p.address.toLowerCase() === l.token.toLowerCase()));
      await noteLauncherLogs(from, head);
      // any other quote token seen on the factory
      const seen = new Set(launches.map(l => l.pairToken.toLowerCase()));
      for (const a of seen) if (byToken[a] === undefined) await registerStock(null, a);
      saveStocks();
      const newest = launches.sort((a, b) => b.block - a.block).slice(0, PONS.maxPairs);
      const fresh = (await pmap(newest, hydrate)).filter(Boolean);
      const merged = [...fresh, ...index.launches].sort((a, b) => b.createdAt - a.createdAt);
      const keep = merged.filter((p, i) => i < PONS.maxPairs || p.lilypad || p.mine || lilypadTokens.has(p.address.toLowerCase()));
      index.launches = keep;
      index.lastBlock = head;
    }
    await Promise.race([registryLoaded, sleep(800)]);
    markLilypad();
    // reserves move; refresh the price of the most recent pairs without blocking anyone
    pmap(index.launches.slice(0, 20), async p => {
      try { const { q, t } = await curve.reserves(p.curve); if (!stockTokens[p.stock]) return; Object.assign(p, valueOf(p.stock, q, t)); } catch (_) {}
    }, 3).then(() => { saveIndex(); announce('bonded:index'); });
    saveIndex();
    return index.launches;
  }
  const ready = () => index.ready || (index.ready = buildIndex().then(r => { announce('bonded:index'); return r; }).catch(e => { index.ready = null; throw e; }));
  // a page never waits more than this for the chain: it paints what it has and refreshes on 'bonded:index'
  const budget = (p, ms = 700) => index.launches.length ? Promise.race([p, sleep(0)]) : Promise.race([p, sleep(ms)]);
  // the read paths degrade to empty when the RPC is unreachable, so the pages still render
  const safe = (fn, fallback) => fn().catch(e => { console.warn('pons: cannot reach the chain —', e.message); return fallback; });
  const find = async (ticker) => (await ready()).find(p => p.ticker.toUpperCase() === String(ticker).toUpperCase());

  async function tradesOf(p, fromBlock) {
    const head = parseInt(await rpc('eth_blockNumber'), 16);
    const all = await getLogsRange({ address: p.curve, topics: [[T_BUY, T_SELL]] }, fromBlock ?? Math.max(p.launch.block, head - PONS.lookbackBlocks), head);
    const logs = all.slice(-300);   // the tape keeps the last 300 trades, each with its real block time
    const st = stockTokens[p.stock];
    const blocks = await timestampsFor(logs.map(l => l.blockNumber));
    return logs.map(l => {
      const buy = l.topics[0] === T_BUY;
      const [inAmt, outAmt] = A.decodeTuple(['uint256', 'uint256', 'uint256', 'uint256'], A.strip(l.data));
      const amountStock = Number(buy ? inAmt : outAmt) / 10 ** st.decimals;
      const amountToken = Number(buy ? outAmt : inAmt) / 1e18;
      return { side: buy ? 'buy' : 'sell', amountStock, amountToken, price: amountToken ? amountStock / amountToken : 0, wallet: '0x' + l.topics[1].slice(26), ts: blocks[l.blockNumber], tx: l.transactionHash, block: parseInt(l.blockNumber, 16) };
    });
  }

  const listeners = new Set();
  const emit = (ev) => listeners.forEach(fn => { try { fn(ev); } catch (e) { console.warn(e); } });

  // ---- the adapter -----------------------------------------------------
  const adapter = {
    pons: PONS, stockTokens, ready, stocksReady,
    async stats() {
      await budget(safe(ready, [])); const pairs = index.launches;
      return { pairs: pairs.length, volumeUsd: pairs.reduce((s, p) => s + p.volume, 0), lockedUsd: pairs.reduce((s, p) => s + (p.liquidityUsd ?? p.mcap * 0.31), 0) };
    },
    async stocks() {
      await budget(safe(stocksReady, null), 900);
      ready().catch(() => {});          // warm the index in the background; the list does not wait for it
      const pairs = index.launches;
      const all = stocksMeta().map(s => ({ ...s, pairs: pairs.filter(p => p.stock === s.sym).length, change: 0, live: !!stockTokens[s.sym] }));
      // only stocks whose token passed approvedPairTokens(); nothing until the factory has answered
      const live = all.filter(s => s.live);
      return (stocksVerified || live.length) ? live : [];
    },
    async pairs() { await budget(safe(ready, [])); return index.launches.slice(); },
    async pair(ticker) {
      const p = await safe(() => find(ticker), null); if (!p) return null;
      const [{ q, t }, trades] = await Promise.all([curve.reserves(p.curve), tradesOf(p)]);
      const st = stockTokens[p.stock];
      const now = Number(q) / 10 ** st.decimals / (Number(t) / 1e18 || 1);
      p.mcap = now * 1e9 * priceOf(p.stock);
      const day = Date.now() - 86400e3;
      const recent = trades.filter(x => x.ts >= day);
      p.volume = recent.reduce((s, x) => s + x.amountStock * priceOf(p.stock), 0);
      p.change = recent.length ? (now / recent[0].price - 1) * 100 : 0;
      p.holders = new Set(trades.filter(x => x.side === 'buy').map(x => x.wallet)).size || 1;
      p.graduated = await curve.graduated(p.curve).catch(() => false);
      p.threshold = Number(p.launch.graduationThreshold) / 10 ** st.decimals;
      // 168 hourly points carried forward from the trade tape, ending at the live price
      const series = []; let px = trades[0]?.price || now, k = 0;
      for (let h = 167; h >= 0; h--) { const cut = Date.now() - h * 3600e3; while (k < trades.length && trades[k].ts <= cut) px = trades[k++].price; series.push(px); }
      series[series.length - 1] = now;
      return { ...p, liquidityUsd: Number(q) / 10 ** st.decimals * priceOf(p.stock), series, trades: trades.slice().reverse().slice(0, 40) };
    },
    async connect() {
      if (window.bdWallet) await window.bdWallet.pick();   // MetaMask, Phantom, Rabby…: one is used directly, several get a chooser
      walletChain = null;
      await ensureChain();
      [account] = await eth().request({ method: 'eth_requestAccounts' });
      return { address: account };
    },
    async createPair(payload) {
      if (!account) await this.connect();
      walletChain = PONS.chainId;       // connected and switched: reads go through the wallet from here
      await stocksReady();
      ready().catch(() => {});
      const st = stockTokens[payload.stock];
      if (!st) throw new Error(`No approved ${payload.stock} token is configured. Add it to BONDED_STOCK_TOKENS (see docs).`);
      if (!(await factory.launchEnabled())) throw new Error('Pons launches are paused right now.');
      if (!(await factory.approved(st.address))) throw new Error(`${payload.stock} is no longer an approved quote token.`);
      // pre-flight, each with its own sentence
      if (!(await factory.canLaunch(account).catch(() => true))) throw new Error(`The factory does not let ${account.slice(0, 6)}… launch right now (canLaunch is false: a cooldown or an allowlist). Try again later or from another wallet.`);
      const fee = await factory.launchFee();
      const bal = BigInt(await rpc('eth_getBalance', [account, 'latest']).catch(() => '0x' + 'f'.repeat(20)));
      if (bal < fee) throw new Error(`The launch fee is ${Number(fee) / 1e18} ETH on ${PONS.chainName} and this wallet holds ${(Number(bal) / 1e18).toFixed(5)} ETH.`);
      const maxTax = await factory.maxCreatorTaxBps();
      const wantedTax = Math.min(PONS.creatorTaxBps, maxTax == null ? PONS.creatorTaxBps : maxTax);
      // enabled configs, the configured one first
      const n = await factory.configCount();
      const configs = [];
      for (let i = 0; i < n; i++) if ((await factory.config(i)).enabled) configs.push(i);
      if (!configs.length) throw new Error('No enabled launch config on the factory.');
      if (PONS.launchConfigId != null) configs.sort((a, b) => (a === PONS.launchConfigId ? -1 : b === PONS.launchConfigId ? 1 : 0));
      // the coin's picture: the stock's frog, served by the site, unless the creator gave an image
      const logo = payload.image || `${location.origin}/frogs/${encodeURIComponent(payload.stock)}.png`;
      const recipient = (PONS.feeRecipient || window.BONDED_OWNER || account);
      // the creator's own first buy should not pay the launch-window snipe tax
      const buying = Number(payload.buy) > 0;
      const viaLauncher = buying && !!launcherAddr();
      const exemptions = buying ? (viaLauncher ? [account, launcherAddr()] : [account]) : [];
      const randomSalt = () => A.toHex(crypto.getRandomValues(new Uint8Array(32)));
      const senderSalt = () => account.toLowerCase() + A.strip(A.toHex(crypto.getRandomValues(new Uint8Array(12))));
      const buildParams = (economics, tax, salt) => [payload.name, payload.ticker, logo, payload.desc || '', [payload.x || '', '', '', payload.site || '', ''], recipient, tax, false, economics, salt];
      // find a combination the factory accepts: config × creator tax × salt shape, cheapest first
      let configId = null, params = null, lastReason = null;
      outer: for (const cid of configs) {
        const eco = await factory.economics(cid, st.address).catch(() => null);
        if (!eco) { lastReason = `previewLaunchEconomics(${cid}, ${payload.stock}) reverted`; continue; }
        for (const tax of [...new Set([wantedTax, 0])]) {
          for (const salt of [randomSalt(), senderSalt(), '0x' + '00'.repeat(32)]) {
            const trial = buildParams(eco, tax, salt);
            const data = A.encodeCall('launchToken', LAUNCH_TYPES, [trial, cid, st.address, exemptions]);
            try { await simulate({ from: account, to: PONS.factory, data, value: A.hex(fee) }); configId = cid; params = trial; break outer; }
            catch (e) { lastReason = `config ${cid}, creator tax ${tax} bps, salt ${salt.slice(0, 6)}…: ${A.revertReason(e)}`; }
          }
        }
      }
      if (params == null) throw new Error(`The factory rejects this launch. Last attempt — ${lastReason}. Run scripts/verify-pons.mjs --from ${account} for the full picture.`);
      let quoteIn = 0n, minOut = 0n;
      if (buying) {
        quoteIn = A.toUnits(payload.buy, st.decimals);
        // price the first buy from the launch config's phantom reserve: the curve does not exist yet
        const cfg = await factory.config(configId);
        const [phantom] = await factory.pairEconomics(st.address);
        const feeBps = cfg.curveFeeBps;
        const net = quoteIn - quoteIn * feeBps / 10000n;
        const out = net * cfg.supply / (phantom + net);
        minOut = out - out * BigInt(PONS.slippageBps) / 10000n;
      }
      let receipt;
      if (viaLauncher) {
        // one approval of the stock to the launcher, then one transaction that launches and buys
        await approveIfNeeded(st.address, launcherAddr(), quoteIn);
        const data = A.encodeCall('launch', LAUNCHER_TYPES, [params, configId, st.address, exemptions, quoteIn, minOut]);
        receipt = await sendTx({ to: launcherAddr(), data, value: A.hex(fee) });
      } else {
        const data = A.encodeCall('launchToken', LAUNCH_TYPES, [params, configId, st.address, exemptions]);
        receipt = await sendTx({ to: PONS.factory, data, value: A.hex(fee) });
      }
      const log = receipt.logs.find(l => l.address.toLowerCase() === PONS.factory.toLowerCase() && l.topics[0] === T_LAUNCHED);
      if (!log) throw new Error('Launch mined but no TokenLaunched event found: ' + receipt.transactionHash);
      const l = parseLaunched(log);
      // the proof of the pairing: the curve's quote asset is the stock the creator chose
      if (l.pairToken.toLowerCase() !== st.address) throw new Error(`Pairing mismatch: curve quote is ${l.pairToken}, expected ${payload.stock} ${st.address}`);
      if (viaLauncher) creators[l.token.toLowerCase()] = account;
      const pair = await hydrate(l);
      Object.assign(pair, { desc: payload.desc || '', image: payload.image || '', x: payload.x || '', site: payload.site || '', mine: true, lilypad: true });
      recordLaunch({ token: l.token, curve: l.curve, creator: account, stock: payload.stock, ticker: payload.ticker, name: payload.name, tx: receipt.transactionHash, ts: Date.now() });
      if (!index.launches.some(x => x.address.toLowerCase() === pair.address.toLowerCase())) index.launches.unshift(pair);
      emit({ kind: 'launch', pair, wallet: account, ts: Date.now() });
      // without the launcher, the first buy is a second transaction straight into the new curve
      if (buying && !viaLauncher) {
        const { q, t } = await curve.reserves(l.curve);
        const feeBps = await curve.feeBps(l.curve);
        const net = quoteIn - quoteIn * feeBps / 10000n;
        const out = net * t / (q + net);
        const floor = out - out * BigInt(PONS.slippageBps) / 10000n;
        await approveIfNeeded(st.address, l.curve, quoteIn);
        await sendTx({ to: l.curve, data: A.encodeCall('buy', ['uint256', 'uint256', 'address'], [quoteIn, floor, account]) });
      }
      return { txHash: receipt.transactionHash, tokenAddress: l.token, pairAddress: l.curve, launch: l };
    },
    async quote({ ticker, side, amount }) {
      const p = await find(ticker); if (!p) throw new Error('Unknown pair ' + ticker);
      if (await curve.graduated(p.curve)) throw new Error('This pair graduated: trade it on Uniswap v4.');
      const st = stockTokens[p.stock];
      const [{ q, t }, feeBps] = await Promise.all([curve.reserves(p.curve), curve.feeBps(p.curve)]);
      const bps = Number(feeBps) / 10000;
      if (side === 'buy') {
        const fee = amount * bps, net = amount - fee;
        const netU = A.toUnits(net.toFixed(st.decimals), st.decimals);
        const out = Number(netU * t / (q + netU)) / 1e18;
        return { out, priceImpact: Number(netU) / Number(q + netU), fee, feeUnit: p.stock };
      }
      const inU = A.toUnits(Number(amount).toFixed(18), 18);
      const gross = Number(inU * q / (t + inU)) / 10 ** st.decimals;
      const fee = gross * bps;
      return { out: gross - fee, priceImpact: Number(inU) / Number(t + inU), fee, feeUnit: p.stock };
    },
    async swap({ ticker, side, amount }) {
      const p = await find(ticker); if (!p) throw new Error('Unknown pair ' + ticker);
      if (!account) await this.connect();
      const st = stockTokens[p.stock];
      const qte = await this.quote({ ticker, side, amount });
      const slip = (x) => x - x * BigInt(PONS.slippageBps) / 10000n;
      let receipt;
      if (side === 'buy') {
        const quoteIn = A.toUnits(Number(amount).toFixed(st.decimals), st.decimals);
        const minOut = slip(A.toUnits(qte.out.toFixed(18), 18));
        await approveIfNeeded(st.address, p.curve, quoteIn);
        receipt = await sendTx({ to: p.curve, data: A.encodeCall('buy', ['uint256', 'uint256', 'address'], [quoteIn, minOut, account]) });
      } else {
        const tokensIn = A.toUnits(Number(amount).toFixed(18), 18);
        const minOut = slip(A.toUnits(qte.out.toFixed(st.decimals), st.decimals));
        await approveIfNeeded(p.address, p.curve, tokensIn);
        receipt = await sendTx({ to: p.curve, data: A.encodeCall('sell', ['uint256', 'uint256', 'address'], [tokensIn, minOut, account]) });
      }
      const log = receipt.logs.find(l => l.address.toLowerCase() === p.curve.toLowerCase() && (l.topics[0] === T_BUY || l.topics[0] === T_SELL));
      const [inAmt, outAmt] = log ? A.decodeTuple(['uint256', 'uint256', 'uint256', 'uint256'], A.strip(log.data)) : [0n, 0n];
      const amountStock = side === 'buy' ? Number(inAmt) / 10 ** st.decimals : Number(outAmt) / 10 ** st.decimals;
      const amountToken = side === 'buy' ? Number(outAmt) / 1e18 : Number(inAmt) / 1e18;
      const trade = { side, amountStock, amountToken, price: amountToken ? amountStock / amountToken : 0, wallet: account, ts: Date.now(), tx: receipt.transactionHash };
      emit({ kind: side, pair: p, ...trade });
      return { txHash: receipt.transactionHash, trade };
    },
    async holdings(address) {
      if (!address) return [];
      const pairs = await safe(ready, []);
      const bals = await Promise.all(pairs.map(p => erc20.balanceOf(p.address, address).catch(() => 0n)));
      return pairs.map((p, i) => ({ ticker: p.ticker, amount: Number(bals[i]) / 1e18 })).filter(h => h.amount > 0);
    },
    async balances(address) {
      if (!address) return [];
      await safe(ready, []);
      const entries = Object.entries(stockTokens);
      const bals = await Promise.all(entries.map(([, tk]) => erc20.balanceOf(tk.address, address).catch(() => 0n)));
      return entries.map(([sym, tk], i) => ({ sym, amount: Number(bals[i]) / 10 ** tk.decimals }));
    },
    async launched(address) {
      if (!address) return [];
      return (await safe(ready, [])).filter(p => p.creator.toLowerCase() === address.toLowerCase()).map(p => p.ticker);
    },
    subscribe(fn) {
      listeners.add(fn);
      if (listeners.size === 1 && !adapter._timer) {
        const tick = async () => {
          try {
            const pairs = await ready();
            const head = parseInt(await rpc('eth_blockNumber'), 16);
            if (head > index.lastBlock) {
              const from = index.lastBlock + 1;
              const launched = await getLogsRange({ address: PONS.factory, topics: [T_LAUNCHED] }, from, head);
              if (launched.length) await noteLauncherLogs(from, head);
              for (const log of launched) {
                const l = parseLaunched(log);
                if (byToken[l.pairToken.toLowerCase()] === undefined) await registerStock(null, l.pairToken);
                if (index.launches.some(p => p.address.toLowerCase() === l.token.toLowerCase())) continue;
                const pair = await hydrate(l); if (!pair) continue;
                index.launches.unshift(pair); emit({ kind: 'launch', pair, wallet: pair.creator, ts: pair.createdAt });
              }
              if (pairs.length) {
                const trades = await getLogsRange({ address: pairs.map(p => p.curve), topics: [[T_BUY, T_SELL]] }, from, head);
                for (const l of trades) {
                  const p = pairs.find(x => x.curve.toLowerCase() === l.address.toLowerCase()); if (!p) continue;
                  const st = stockTokens[p.stock]; const buy = l.topics[0] === T_BUY;
                  const [inAmt, outAmt] = A.decodeTuple(['uint256', 'uint256', 'uint256', 'uint256'], A.strip(l.data));
                  const amountStock = Number(buy ? inAmt : outAmt) / 10 ** st.decimals, amountToken = Number(buy ? outAmt : inAmt) / 1e18;
                  emit({ kind: buy ? 'buy' : 'sell', pair: p, amountStock, amountToken, price: amountToken ? amountStock / amountToken : 0, wallet: '0x' + l.topics[1].slice(26), ts: Date.now(), tx: l.transactionHash });
                }
              }
              index.lastBlock = head;
            }
          } catch (e) { console.warn('pons poll', e); }
          adapter._timer = setTimeout(tick, PONS.pollMs);
        };
        adapter._timer = setTimeout(tick, PONS.pollMs);
      }
      return () => listeners.delete(fn);
    },
  };

  window.BONDED_ADAPTER = adapter;
  document.documentElement.classList.add('is-pons');
  console.info(`LilyPad: live on Pons V2 · ${PONS.chainName} (${PONS.chainId}) · factory ${PONS.factory}`);
})();
