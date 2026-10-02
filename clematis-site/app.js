/* Clematis — swap tokenized stocks on Robinhood Chain through Uniswap v3 and v4.
 *
 * Reads (prices, quotes, balances) go straight to the public Robinhood Chain RPC.
 * Writes go through the visitor's own wallet to Uniswap's Universal Router;
 * nothing is custodied and nothing passes through a server of ours.
 *
 * Contract addresses are Uniswap's own deployments for chain 4663, as listed in
 * @uniswap/sdk-core and @uniswap/universal-router-sdk. The token and pool list
 * comes from tokens.js, which scripts/build-tokens.js generates from the chain. */
(() => {
  'use strict';

  const BRAND = 'Clematis';
  const CHAIN = {
    id: 4663,
    hex: '0x1237',
    name: 'Robinhood Chain',
    rpc: 'https://rpc.mainnet.chain.robinhood.com',
    explorer: 'https://robinhoodchain.blockscout.com'
  };
  const WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
  const UNIVERSAL_ROUTER = '0x204FAca1764B154221e35c0d20aBb3c525710498'; // v2.1.2
  const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
  const QUOTER_V3 = '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7';
  const QUOTER_V4 = '0x8dc178efb8111bb0973dd9d722ebeff267c98f94';
  const STATE_VIEW = '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b';
  const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
  const ZERO = '0x0000000000000000000000000000000000000000';
  const FEATURED = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'COIN'];
  const DEFAULT_SLIPPAGE = 0.5;
  const DEADLINE_SECONDS = 20 * 60;
  const PERMIT_SECONDS = 30 * 60;
  const ETH_GAS_RESERVE = 0.0005;
  const POOLS_PER_HOP = 3; // quote the deepest few pools on each hop
  /* WalletConnect project ID from cloud.reown.com. Empty hides the option;
     with one set, phone wallets can connect by QR code or deep link. */
  const WALLETCONNECT_PROJECT_ID = '';

  const { ethers } = window;
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const read = new ethers.JsonRpcProvider(CHAIN.rpc, CHAIN.id, { staticNetwork: true, batchMaxCount: 50 });

  const POOL_KEY = '(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)';
  const quoterV3 = new ethers.Contract(QUOTER_V3, [
    'function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)',
    'function quoteExactOutput(bytes path, uint256 amountOut) returns (uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)'
  ], read);
  const quoterV4 = new ethers.Contract(QUOTER_V4, [
    `function quoteExactInputSingle((${POOL_KEY} poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)`,
    `function quoteExactOutputSingle((${POOL_KEY} poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountIn, uint256 gasEstimate)`
  ], read);
  const mc3 = new ethers.Contract(MULTICALL3, ['function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])'], read);
  const erc20Iface = new ethers.Interface([
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)'
  ]);
  const v3PoolIface = new ethers.Interface(['function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)']);
  const stateViewIface = new ethers.Interface(['function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)']);
  const permit2 = new ethers.Contract(PERMIT2, ['function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)'], read);
  const urIface = new ethers.Interface(['function execute(bytes commands, bytes[] inputs, uint256 deadline) payable']);

  /* ---------------- tokens ---------------- */

  const ETH = { symbol: 'ETH', name: 'Ether', sub: 'Robinhood Chain (native)', address: null, decimals: 18, native: true, pools: [] };
  const cleanName = (n) => n.replace(/\s*[•·|-]\s*Robinhood Token\s*$/i, '').trim();
  /* a few on-chain names carry share-class boilerplate; show what people call them */
  const NAMES = {
    NET: 'Cloudflare', SKHY: 'SK hynix', SPCX: 'SpaceX', XOM: 'ExxonMobil', GOOGL: 'Alphabet',
    VTI: 'Vanguard Total Stock Market ETF', TTWO: 'Take-Two Interactive', LMT: 'Lockheed Martin',
    PWR: 'Quanta Services', NU: 'Nu Holdings', RKLB: 'Rocket Lab', F: 'Ford', FLY: 'Firefly Aerospace',
    GLXY: 'Galaxy Digital', MSTR: 'Strategy', WYFI: 'WhiteFiber', DJT: 'Trump Media & Technology',
    BB: 'BlackBerry', ASML: 'ASML Holding', SGOV: 'iShares 0-3 Month Treasury ETF', EWY: 'iShares MSCI South Korea ETF'
  };

  const listed = (window.CHAIN_TOKENS || []).map((t) => {
    const stock = /robinhood token/i.test(t.name);
    return {
      symbol: t.symbol,
      name: NAMES[t.symbol] || (stock ? cleanName(t.name) : t.name),
      sub: NAMES[t.symbol] || (stock ? cleanName(t.name) : 'Global Dollar · stablecoin'),
      address: ethers.getAddress(t.address),
      decimals: t.decimals,
      stock,
      pools: t.pools.map((p) => ({ ...p, liquidity: BigInt(p.liquidity) }))
    };
  });
  const USDG = listed.find((t) => t.symbol === 'USDG') || null;
  const STOCKS = listed.filter((t) => t.stock);
  const TOKENS = [ETH, ...(USDG ? [USDG] : []), ...STOCKS];
  const bySymbol = (s) => TOKENS.find((t) => t.symbol === s);
  const BASES = [ETH, USDG].filter(Boolean);

  /* ---------------- state ---------------- */

  const state = {
    pay: ETH,
    recv: bySymbol('AAPL') || STOCKS[0] || USDG,
    quote: null,          // { from, to, amountIn, amountOut, hops: [{ pool, from, to, amountIn, amountOut }] }
    quoting: false,
    quoteError: null,
    quoteId: 0,
    ethPer: new Map(),    // symbol -> price in ETH
    ethUsd: null,
    account: null,
    chainOk: false,
    wallet: null,         // EIP-1193 provider in use
    balances: new Map(),  // symbol -> bigint
    slippage: 'auto'
  };
  try {
    const saved = localStorage.getItem('clematis.slippage');
    if (saved) state.slippage = saved === 'auto' ? 'auto' : Number(saved);
  } catch { /* storage may be blocked */ }

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* ---------------- formatting ---------------- */

  function fmtAmount(x) {
    if (!isFinite(x) || x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e6) return x.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (a >= 1000) return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (a >= 1) return x.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (a >= 0.0001) return x.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    return x.toPrecision(3);
  }
  function fmtUsd(x) {
    if (x === null || !isFinite(x)) return '—';
    if (x > 0 && x < 0.01) return '<$0.01';
    return '$' + x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const toNum = (big, decimals) => Number(ethers.formatUnits(big, decimals));
  const shortAddr = (a) => a.slice(0, 6) + '…' + a.slice(-4);
  const slippagePct = () => (state.slippage === 'auto' ? DEFAULT_SLIPPAGE : state.slippage);
  const feePct = (fee) => (fee / 1e4).toString().replace(/^0\./, '0.') + '%';

  /* ---------------- logos ---------------- */

  function letterAvatar(sym) {
    const letters = sym.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1a2344"/><text x="32" y="39" font-family="Inter,Arial" font-size="${letters.length > 2 ? 18 : 22}" font-weight="700" fill="#60a5fa" text-anchor="middle">${letters}</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  function setLogo(img, token) {
    img.alt = '';
    img.onerror = () => { img.onerror = null; img.src = letterAvatar(token.symbol); };
    img.src = 'logos/' + encodeURIComponent(token.symbol) + '.png';
  }
  function logoImg(token, cls) {
    const img = el('img', cls);
    img.width = 32; img.height = 32; img.loading = 'lazy';
    setLogo(img, token);
    return img;
  }

  /* ---------------- pools ---------------- */

  /* A pool joins a token to one of the two bases, ETH or USDG. In v3 the ETH side
     is WETH; in v4 it is native ETH. These give each side's on-chain address. */
  const v3Addr = (t) => (t.native ? WETH : t.address);
  const v4Addr = (t) => (t.native ? ZERO : t.address);

  /* the pools that trade a directly against b, deepest first */
  function edgePools(a, b) {
    if (a === b) return [];
    if (a.stock && !b.stock) return a.pools.filter((p) => p.base === b.symbol);
    if (b.stock && !a.stock) return b.pools.filter((p) => p.base === a.symbol);
    if (USDG && ((a === ETH && b === USDG) || (a === USDG && b === ETH))) return USDG.pools;
    return [];
  }

  /* price of token0 in token1 from a pool's sqrtPriceX96 */
  function poolPrice(sqrt, dec0, dec1) {
    const r = Number(sqrt) / 2 ** 96;
    return r * r * 10 ** (dec0 - dec1);
  }

  /* ---------------- prices ---------------- */

  async function marketEthUsd() {
    try {
      const res = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', { cache: 'no-store' });
      const v = Number((await res.json()).data.amount);
      return v > 0 ? v : null;
    } catch { return null; }
  }

  /* Spot prices come from slot0 of each token's deepest pool per base, read in
     one multicall. Everything is expressed in ETH; ETH/USD is the USDG price. */
  async function refreshPrices() {
    const reads = [];
    for (const t of listed) {
      for (const base of BASES) {
        const p = t.pools.find((x) => x.base === base.symbol);
        if (!p) continue;
        reads.push({
          token: t, base, pool: p,
          call: p.v === 3
            ? { target: p.pool, allowFailure: true, callData: v3PoolIface.encodeFunctionData('slot0') }
            : { target: STATE_VIEW, allowFailure: true, callData: stateViewIface.encodeFunctionData('getSlot0', [p.id]) }
        });
      }
    }
    let results;
    try {
      results = await mc3.aggregate3.staticCall(reads.map((r) => r.call));
    } catch (e) {
      console.warn('price refresh failed', e);
      return;
    }
    const inBase = new Map(); // `${symbol}|${base}` -> price of token in base units
    const depth = new Map();  // `${symbol}|${base}` -> the pool's base-side virtual reserve, in base units
    reads.forEach((r, i) => {
      const res = results[i];
      if (!res.success || res.returnData === '0x') return;
      const sqrt = (r.pool.v === 3 ? v3PoolIface.decodeFunctionResult('slot0', res.returnData) : stateViewIface.decodeFunctionResult('getSlot0', res.returnData))[0];
      if (sqrt === 0n) return;
      const tokenAddr = (r.pool.v === 3 ? v3Addr(r.token) : v4Addr(r.token)).toLowerCase();
      const baseAddr = (r.pool.v === 3 ? v3Addr(r.base) : v4Addr(r.base)).toLowerCase();
      const tokenIs0 = tokenAddr < baseAddr;
      const p = tokenIs0 ? poolPrice(sqrt, r.token.decimals, r.base.decimals) : 1 / poolPrice(sqrt, r.base.decimals, r.token.decimals);
      if (!(isFinite(p) && p > 0)) return;
      inBase.set(r.token.symbol + '|' + r.base.symbol, p);
      /* virtual reserves of an in-range pool: token1 = L·√P, token0 = L/√P */
      const L = Number(r.pool.liquidity), rootP = Number(sqrt) / 2 ** 96;
      const baseRaw = tokenIs0 ? L * rootP : L / rootP;
      depth.set(r.token.symbol + '|' + r.base.symbol, baseRaw / 10 ** r.base.decimals);
    });
    const usdgInEth = USDG ? inBase.get('USDG|ETH') : null;
    if (usdgInEth) state.ethPer.set('USDG', usdgInEth);
    /* ETH/USD is the market price (Coinbase spot), so it matches what any
       exchange shows; the on-chain USDG pool price is the fallback */
    const market = await marketEthUsd();
    state.ethUsd = market || (usdgInEth ? 1 / usdgInEth : state.ethUsd);
    for (const t of STOCKS) {
      const viaEth = inBase.get(t.symbol + '|ETH');
      const viaUsd = inBase.get(t.symbol + '|USDG') && usdgInEth ? inBase.get(t.symbol + '|USDG') * usdgInEth : null;
      /* believe whichever pool is deeper, comparing both in ETH: a thin pool on
         one side can sit at a stale price */
      const ethDepth = depth.get(t.symbol + '|ETH') ?? 0;
      const usdDepth = (depth.get(t.symbol + '|USDG') ?? 0) * (usdgInEth ?? 0);
      const pick = viaEth && viaUsd ? (ethDepth >= usdDepth ? viaEth : viaUsd) : (viaEth ?? viaUsd);
      if (pick) state.ethPer.set(t.symbol, pick);
    }
    renderPrices();
  }
  function priceEth(token) {
    if (token.native) return 1;
    return state.ethPer.get(token.symbol) ?? null;
  }
  function priceUsd(token) {
    if (token === USDG) return 1;
    const e = priceEth(token);
    return e !== null && state.ethUsd ? e * state.ethUsd : null;
  }

  /* ---------------- quotes ---------------- */

  async function quoteHop(pool, from, to, amountIn) {
    if (pool.v === 3) {
      const path = ethers.solidityPacked(['address', 'uint24', 'address'], [v3Addr(from), pool.fee, v3Addr(to)]);
      return (await quoterV3.quoteExactInput.staticCall(path, amountIn))[0];
    }
    const zeroForOne = v4Addr(from).toLowerCase() === pool.key.currency0.toLowerCase();
    const res = await quoterV4.quoteExactInputSingle.staticCall({ poolKey: pool.key, zeroForOne, exactAmount: amountIn, hookData: '0x' });
    return res[0];
  }

  /* best single hop from a to b over the deepest pools between them */
  async function bestHop(a, b, amountIn) {
    const pools = edgePools(a, b).slice(0, POOLS_PER_HOP);
    const outs = await Promise.allSettled(pools.map((p) => quoteHop(p, a, b, amountIn)));
    let best = null;
    outs.forEach((o, i) => {
      if (o.status === 'fulfilled' && o.value > 0n && (!best || o.value > best.amountOut)) best = { pool: pools[i], from: a, to: b, amountIn, amountOut: o.value };
    });
    return best;
  }

  /* Direct when a pool joins the two; otherwise, or as well, through ETH or USDG.
     Whichever path pays out most wins. */
  async function bestQuote(from, to, amountIn) {
    if (from === to) throw new Error('Pick two different tokens');
    const tries = [bestHop(from, to, amountIn).then((h) => (h ? [h] : null))];
    for (const base of BASES) {
      if (base === from || base === to || !edgePools(from, base).length || !edgePools(base, to).length) continue;
      tries.push((async () => {
        const h1 = await bestHop(from, base, amountIn);
        if (!h1) return null;
        const h2 = await bestHop(base, to, h1.amountOut);
        return h2 ? [h1, h2] : null;
      })());
    }
    const routes = (await Promise.allSettled(tries)).filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
    if (!routes.length) throw new Error(edgePools(from, to).length || tries.length > 1 ? 'Not enough liquidity for this amount' : 'No pool for this pair');
    routes.sort((x, y) => (y.at(-1).amountOut > x.at(-1).amountOut ? 1 : -1));
    const hops = routes[0];
    return { from, to, amountIn, amountOut: hops.at(-1).amountOut, hops };
  }

  /* The other way round: how much `from` it takes to get `amountOut` of `to`. */
  async function quoteHopOut(pool, from, to, amountOut) {
    if (pool.v === 3) {
      const path = ethers.solidityPacked(['address', 'uint24', 'address'], [v3Addr(to), pool.fee, v3Addr(from)]); // exact-out paths run backwards
      return (await quoterV3.quoteExactOutput.staticCall(path, amountOut))[0];
    }
    const zeroForOne = v4Addr(from).toLowerCase() === pool.key.currency0.toLowerCase();
    return (await quoterV4.quoteExactOutputSingle.staticCall({ poolKey: pool.key, zeroForOne, exactAmount: amountOut, hookData: '0x' }))[0];
  }
  async function bestHopOut(a, b, amountOut) {
    const pools = edgePools(a, b).slice(0, POOLS_PER_HOP);
    const ins = await Promise.allSettled(pools.map((p) => quoteHopOut(p, a, b, amountOut)));
    let best = null;
    for (const o of ins) if (o.status === 'fulfilled' && o.value > 0n && (best === null || o.value < best)) best = o.value;
    return best;
  }
  async function bestQuoteOut(from, to, amountOut) {
    if (from === to) throw new Error('Pick two different tokens');
    const tries = [bestHopOut(from, to, amountOut)];
    for (const base of BASES) {
      if (base === from || base === to || !edgePools(from, base).length || !edgePools(base, to).length) continue;
      tries.push((async () => {
        const mid = await bestHopOut(base, to, amountOut);
        return mid ? bestHopOut(from, base, mid) : null;
      })());
    }
    const ins = (await Promise.allSettled(tries)).filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
    if (!ins.length) throw new Error('Not enough liquidity for this amount');
    return ins.reduce((a, b) => (b < a ? b : a));
  }

  /* Typing in "You receive" asks for the input that buys that much, fills it in
     as "You pay", and quotes it the normal way. The swap itself is still exact
     input, so what you pay is exactly what you see, and the minimum received is
     protected by slippage like any other swap. */
  let outTimer = null;
  function requestQuoteOut(delay = 400) {
    clearTimeout(outTimer);
    clearTimeout(quoteTimer);
    const id = ++state.quoteId;
    const amountOut = parseAmount($('recv-amt').value, state.recv.decimals);
    state.quote = null;
    state.quoteError = null;
    if (!amountOut) { state.quoting = false; $('pay-amt').value = ''; render(); return; }
    state.quoting = true;
    render();
    outTimer = setTimeout(async () => {
      try {
        const need = await bestQuoteOut(state.pay, state.recv, amountOut);
        if (id !== state.quoteId) return;
        /* a hair over, so rounding never leaves it short of what was asked */
        const padded = need + need / 10000n + 1n;
        $('pay-amt').value = trimUnits(padded, state.pay.decimals);
        const q = await bestQuote(state.pay, state.recv, padded);
        if (id !== state.quoteId) return;
        state.quote = q;
      } catch (e) {
        if (id !== state.quoteId) return;
        state.quoteError = e.shortMessage || e.message || 'Quote failed';
      }
      state.quoting = false;
      render();
    }, delay);
  }
  function trimUnits(big, decimals) {
    const s = ethers.formatUnits(big, decimals);
    const [w, f = ''] = s.split('.');
    const keep = f.slice(0, 8).replace(/0+$/, '');
    return keep ? `${w}.${keep}` : w;
  }

  function parseAmount(str, decimals) {
    const v = (str || '').trim();
    if (!v || !/^\d*\.?\d*$/.test(v) || v === '.') return null;
    const [w, f = ''] = v.split('.');
    try {
      const big = ethers.parseUnits((w || '0') + (f ? '.' + f.slice(0, decimals) : ''), decimals);
      return big > 0n ? big : null;
    } catch { return null; }
  }

  let quoteTimer = null;
  function requestQuote(delay = 300) {
    clearTimeout(quoteTimer);
    const id = ++state.quoteId;
    const amountIn = parseAmount($('pay-amt').value, state.pay.decimals);
    state.quote = null;
    state.quoteError = null;
    if (!amountIn) {
      state.quoting = false;
      $('recv-amt').value = '';
      render();
      return;
    }
    state.quoting = true;
    render();
    quoteTimer = setTimeout(async () => {
      try {
        const q = await bestQuote(state.pay, state.recv, amountIn);
        if (id !== state.quoteId) return;
        state.quote = q;
      } catch (e) {
        if (id !== state.quoteId) return;
        state.quoteError = e.shortMessage || e.message || 'Quote failed';
      }
      state.quoting = false;
      render();
    }, delay);
  }
  /* keep the number fresh while someone is looking at it */
  setInterval(() => {
    if (!document.hidden && !state.quoting && state.quote && $('tx-modal').hidden) requestQuote(0);
  }, 20000);

  function quoteDetails(q) {
    const inNum = toNum(q.amountIn, q.from.decimals);
    const outNum = toNum(q.amountOut, q.to.decimals);
    const keep = q.hops.reduce((k, h) => k * (1 - h.pool.fee / 1e6), 1);
    const pIn = priceEth(q.from), pOut = priceEth(q.to);
    let impact = null;
    if (pIn && pOut) impact = Math.max(0, 1 - outNum / ((inNum * pIn / pOut) * keep));
    const minOut = q.amountOut * BigInt(Math.round((100 - slippagePct()) * 100)) / 10000n;
    const route = [q.from.symbol, ...q.hops.map((h) => h.to.symbol)].join(' → ') + ' · ' +
      q.hops.map((h) => `v${h.pool.v} ${feePct(h.pool.fee)}`).join(' + ');
    return { inNum, outNum, impact, minOut, lpFee: inNum * (1 - keep), route };
  }

  /* ---------------- wallet ---------------- */

  const wallets = new Map(); // rdns -> { info, provider }
  window.addEventListener('eip6963:announceProvider', (e) => {
    const { info, provider } = e.detail || {};
    if (info && provider) wallets.set(info.rdns || info.uuid, { info, provider });
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  const WC_ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#3b99fc"/><path d="M9.6 12.1c3.5-3.4 9.2-3.4 12.8 0l.4.4c.2.2.2.4 0 .6l-1.5 1.4c-.1.1-.2.1-.3 0l-.6-.6c-2.5-2.4-6.4-2.4-8.9 0l-.6.6c-.1.1-.2.1-.3 0L9.1 13c-.2-.2-.2-.4 0-.6zm15.8 2.9l1.3 1.3c.2.2.2.4 0 .6l-5.9 5.8c-.2.2-.4.2-.6 0l-4.2-4.1h-.2l-4.2 4.1c-.2.2-.4.2-.6 0l-5.9-5.8c-.2-.2-.2-.4 0-.6L6.4 15c.2-.2.4-.2.6 0l4.2 4.1h.2l4.2-4.1c.2-.2.4-.2.6 0l4.2 4.1h.2l4.2-4.1c.2-.2.4-.2.6 0z" fill="#fff"/></svg>');
  /* Wallets we know by name: our own copy of each logo (some wallets announce
     none, or one this page can't show), where to get it, and, for phone apps, a
     link that opens this page inside the app's own browser. */
  const KNOWN_WALLETS = [
    { id: 'metamask', name: 'MetaMask', rdns: ['io.metamask', 'io.metamask.flask'], get: 'https://metamask.io/download/',
      app: (u) => 'https://metamask.app.link/dapp/' + u.replace(/^https?:\/\//, '') },
    { id: 'phantom', name: 'Phantom', rdns: ['app.phantom'], get: 'https://phantom.com/download',
      app: (u) => 'https://phantom.app/ul/browse/' + encodeURIComponent(u) + '?ref=' + encodeURIComponent(location.origin) },
    { id: 'coinbase', name: 'Coinbase Wallet', rdns: ['com.coinbase.wallet'], get: 'https://www.coinbase.com/wallet/downloads',
      app: (u) => 'https://go.cb-w.com/dapp?cb_url=' + encodeURIComponent(u) },
    { id: 'trust', name: 'Trust Wallet', rdns: ['com.trustwallet.app'], get: 'https://trustwallet.com/download',
      app: (u) => 'https://link.trustwallet.com/open_url?coin_id=60&url=' + encodeURIComponent(u) },
    { id: 'okx', name: 'OKX Wallet', rdns: ['com.okex.wallet'], get: 'https://www.okx.com/web3',
      app: (u) => 'https://www.okx.com/download?deeplink=' + encodeURIComponent('okx://wallet/dapp/url?dappUrl=' + encodeURIComponent(u)) },
    { id: 'rabby', name: 'Rabby', rdns: ['io.rabby'], get: 'https://rabby.io/' },
    { id: 'rainbow', name: 'Rainbow', rdns: ['me.rainbow'], get: 'https://rainbow.me/download' }
  ];
  const knownWallet = (rdns) => KNOWN_WALLETS.find((k) => k.rdns.includes(rdns));
  const walletLogo = (k) => 'wallets/' + k.id + '.svg';
  function walletIcon(info) {
    const k = knownWallet(info.rdns);
    if (k) return walletLogo(k);
    return /^data:image\//.test(info.icon || '') ? info.icon : letterAvatar(info.name || '?');
  }

  function walletChoices() {
    const list = [...wallets.values()];
    if (!list.length && window.ethereum) {
      /* an older wallet that doesn't announce itself: name it from its flags */
      const e = window.ethereum;
      const k = e.isPhantom ? KNOWN_WALLETS[1] : e.isCoinbaseWallet ? KNOWN_WALLETS[2] : e.isTrust || e.isTrustWallet ? KNOWN_WALLETS[3]
        : e.isOkxWallet ? KNOWN_WALLETS[4] : e.isRabby ? KNOWN_WALLETS[5] : e.isRainbow ? KNOWN_WALLETS[6] : e.isMetaMask ? KNOWN_WALLETS[0] : null;
      list.push({ info: { name: k ? k.name : 'Browser wallet', rdns: 'injected', icon: k ? walletLogo(k) : '' }, provider: e });
    }
    if (WALLETCONNECT_PROJECT_ID) list.push({ info: { name: 'WalletConnect', rdns: 'walletconnect', icon: WC_ICON }, provider: null, lazy: true });
    return list;
  }

  /* WalletConnect's code is large, so it only loads when someone picks it */
  let wcProvider = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.append(s);
    });
  }
  async function walletConnectProvider() {
    if (wcProvider) return wcProvider;
    if (!window.WalletConnectEthereumProvider) await loadScript('vendor/walletconnect.min.js');
    wcProvider = await window.WalletConnectEthereumProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [CHAIN.id],
      showQrModal: true,
      rpcMap: { [CHAIN.id]: CHAIN.rpc },
      metadata: { name: BRAND, description: 'Swap tokenized stocks on Robinhood Chain', url: location.origin, icons: [] }
    });
    wcProvider.on('disconnect', () => onAccounts([]));
    return wcProvider;
  }

  function walletRow(tag, icon, name, note, noteCls) {
    const row = el(tag, 'wallet-row');
    if (tag === 'button') row.type = 'button';
    const img = el('img');
    img.src = icon; img.alt = ''; img.width = img.height = 32;
    row.append(img, el('span', 'wallet-name', name));
    if (note) row.append(el('span', 'wallet-tag' + (noteCls ? ' ' + noteCls : ''), note));
    return row;
  }
  function walletChip(tag, k) {
    const chip = el(tag, 'wallet-chip');
    if (tag === 'button') chip.type = 'button';
    const img = el('img');
    img.src = walletLogo(k); img.alt = ''; img.width = img.height = 28;
    chip.append(img, el('span', null, k.name));
    return chip;
  }

  const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const pageUrl = () => location.href.split('#')[0].split('?')[0];

  function renderWalletList() {
    const box = $('wallet-list');
    box.replaceChildren();
    const phone = isPhone();
    const found = walletChoices();
    const have = new Set(found.map((w) => (knownWallet(w.info.rdns) || {}).id));
    for (const w of found) {
      const row = walletRow('button', walletIcon(w.info), w.info.name, w.lazy ? 'QR' : 'Detected', w.lazy ? '' : 'ok');
      row.addEventListener('click', () => connect(w));
      box.append(row);
    }
    /* Phone wallet apps. On a phone the link opens this page inside the app; on
       a computer it shows as a QR code to scan with the phone's camera. */
    const apps = KNOWN_WALLETS.filter((k) => k.app);
    box.append(el('div', 'wallet-sec', phone ? 'Open in your wallet app' : 'Phone wallets · scan to open'));
    const grid = el('div', 'wallet-grid');
    for (const k of apps) {
      if (phone) {
        const a = walletChip('a', k);
        a.href = k.app(pageUrl()); a.rel = 'noopener';
        grid.append(a);
      } else {
        const b = walletChip('button', k);
        b.addEventListener('click', () => showWalletQr(k));
        grid.append(b);
      }
    }
    box.append(grid);
    if (!phone) {
      const missing = KNOWN_WALLETS.filter((k) => !have.has(k.id));
      if (missing.length) {
        box.append(el('div', 'wallet-sec', found.length ? 'More browser wallets' : 'Get a browser wallet'));
        const g = el('div', 'wallet-grid');
        for (const k of missing) {
          const a = walletChip('a', k);
          a.href = k.get; a.target = '_blank'; a.rel = 'noopener';
          g.append(a);
        }
        box.append(g);
      }
    }
  }

  async function showWalletQr(k) {
    const box = $('wallet-list');
    box.replaceChildren(el('p', 'wallet-empty', 'Loading…'));
    try {
      if (!window.qrcode) await loadScript('vendor/qrcode.min.js');
    } catch (e) {
      box.replaceChildren(el('p', 'wallet-empty', 'Could not load the QR code. Open this page on your phone instead.'));
      return;
    }
    const q = window.qrcode(0, 'H');
    q.addData(k.app(pageUrl()));
    q.make();
    const wrap = el('div', 'wallet-qr');
    wrap.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    const logo = el('img', 'wallet-qr-logo');
    logo.src = walletLogo(k); logo.alt = '';
    wrap.append(logo);
    const back = el('button', 'btn btn-ghost btn-sm wallet-back', '← All wallets');
    back.type = 'button';
    back.addEventListener('click', renderWalletList);
    box.replaceChildren(wrap,
      el('p', 'wallet-empty wallet-qr-text', `Scan with your phone's camera to open ${BRAND} in ${k.name}, then tap Connect wallet there.`),
      back);
  }

  function openWalletModal() {
    renderWalletList();
    openModal('wallet-modal');
  }

  async function connect(w) {
    closeModal('wallet-modal');
    try {
      if (w.lazy) {
        const provider = await walletConnectProvider();
        if (!provider.session) await provider.connect();
        w = { info: w.info, provider };
      }
      const accounts = await w.provider.request({ method: 'eth_requestAccounts' });
      attachWallet(w, accounts[0]);
      try { localStorage.setItem('clematis.wallet', w.info.rdns || 'injected'); } catch { /* ignore */ }
      await ensureChain();
    } catch (e) {
      toast(humanError(e));
    }
  }

  function attachWallet(w, account) {
    if (state.wallet && state.wallet !== w.provider && state.wallet.removeListener) {
      state.wallet.removeListener('accountsChanged', onAccounts);
      state.wallet.removeListener('chainChanged', onChain);
    }
    state.wallet = w.provider;
    state.account = account ? ethers.getAddress(account) : null;
    if (w.provider.on) {
      w.provider.on('accountsChanged', onAccounts);
      w.provider.on('chainChanged', onChain);
    }
    checkChain();
    refreshBalances();
  }
  function onAccounts(accs) {
    state.account = accs && accs[0] ? ethers.getAddress(accs[0]) : null;
    state.balances.clear();
    render();
    refreshBalances();
  }
  function onChain() { checkChain(); }

  async function checkChain() {
    if (!state.wallet) return;
    try {
      const id = await state.wallet.request({ method: 'eth_chainId' });
      state.chainOk = Number(id) === CHAIN.id;
    } catch { state.chainOk = false; }
    render();
  }

  async function ensureChain() {
    if (!state.wallet) return false;
    await checkChain();
    if (state.chainOk) return true;
    try {
      await state.wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN.hex }] });
    } catch (e) {
      const code = e.code ?? e.data?.originalError?.code;
      if (code !== 4902 && !/unrecognized|not added|unknown chain/i.test(e.message || '')) throw e;
      await state.wallet.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: CHAIN.hex,
          chainName: CHAIN.name,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [CHAIN.rpc],
          blockExplorerUrls: [CHAIN.explorer]
        }]
      });
    }
    await checkChain();
    return state.chainOk;
  }

  /* reconnect silently to the wallet used last time, if it still has us authorised */
  setTimeout(async () => {
    let last = null;
    try { last = localStorage.getItem('clematis.wallet'); } catch { /* ignore */ }
    if (!last) return;
    let w = walletChoices().find((x) => (x.info.rdns || 'injected') === last);
    if (!w) return;
    if (w.lazy) {
      try {
        const provider = await walletConnectProvider();
        if (!provider.session) return;
        w = { info: w.info, provider };
      } catch { return; }
    }
    try {
      const accs = await w.provider.request({ method: 'eth_accounts' });
      if (accs && accs[0]) attachWallet(w, accs[0]);
    } catch { /* ignore */ }
  }, 400);

  async function refreshBalances() {
    if (!state.account) { render(); renderPortfolio(); return; }
    const acct = state.account;
    try {
      const [eth, results] = await Promise.all([
        read.getBalance(acct),
        mc3.aggregate3.staticCall(listed.map((t) => ({ target: t.address, allowFailure: true, callData: erc20Iface.encodeFunctionData('balanceOf', [acct]) })))
      ]);
      if (acct !== state.account) return;
      state.balances.set('ETH', eth);
      listed.forEach((t, i) => {
        const r = results[i];
        if (r.success && r.returnData !== '0x') state.balances.set(t.symbol, erc20Iface.decodeFunctionResult('balanceOf', r.returnData)[0]);
      });
    } catch (e) {
      console.warn('balance refresh failed', e);
    }
    render();
    renderPortfolio();
    if (assetOpen) renderAsset();
  }
  const balanceOf = (t) => state.balances.get(t.symbol) ?? null;

  /* ---------------- swap ---------------- */

  /* Universal Router plan. Commands and action ids are Uniswap's
     (universal-router-sdk routerCommands, v4-sdk v4Planner); the v3 swap input and
     the v4 swap struct are the 2.1.x ones, which carry minHopPriceX36. */
  const CMD = { V3_SWAP_EXACT_IN: 0x00, PERMIT2_PERMIT: 0x0a, WRAP_ETH: 0x0b, UNWRAP_WETH: 0x0c, V4_SWAP: 0x10 };
  const ACT = { SWAP_EXACT_IN_SINGLE: 0x06, SETTLE: 0x0b, SETTLE_ALL: 0x0c, TAKE: 0x0e, TAKE_ALL: 0x0f };
  const MSG_SENDER = '0x0000000000000000000000000000000000000001';
  const ADDRESS_THIS = '0x0000000000000000000000000000000000000002';
  const CONTRACT_BALANCE = 1n << 255n; // "whatever the router holds"
  const OPEN_DELTA = 0n;               // "whatever the pool manager owes / is owed"
  const V4_SWAP_STRUCT = `(${POOL_KEY} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,uint256 minHopPriceX36,bytes hookData)`;

  /* Turn a quote into Universal Router commands. Between hops the funds sit in
     the router: v3 hands over WETH, v4 hands over native ETH, so a wrap or unwrap
     joins a v3 hop to a v4 hop. Only the last hop checks the minimum; the router
     reverts the whole swap if it isn't met. */
  function buildPlan(q, minOut, permit) {
    const commands = [];
    const inputs = [];
    const add = (cmd, types, values) => { commands.push(cmd); inputs.push(coder.encode(types, values)); };

    if (permit) add(CMD.PERMIT2_PERMIT, ['((address token,uint160 amount,uint48 expiration,uint48 nonce) details,address spender,uint256 sigDeadline)', 'bytes'], [permit.value, permit.signature]);

    // where the ETH in hand is: 'native' (msg.value / v4 output) or 'weth' (v3 output)
    let ethForm = q.from.native ? 'native' : null;

    q.hops.forEach((h, i) => {
      const first = i === 0, last = i === q.hops.length - 1;
      const inputFromUser = first && !q.from.native;
      const amountIn = first ? q.amountIn : null; // null: use what the previous hop left in the router

      if (h.pool.v === 3) {
        if (h.from.native && ethForm === 'native') { add(CMD.WRAP_ETH, ['address', 'uint256'], [ADDRESS_THIS, amountIn ?? CONTRACT_BALANCE]); ethForm = 'weth'; }
        const toEthUser = last && h.to.native;
        const path = ethers.solidityPacked(['address', 'uint24', 'address'], [v3Addr(h.from), h.pool.fee, v3Addr(h.to)]);
        add(CMD.V3_SWAP_EXACT_IN, ['address', 'uint256', 'uint256', 'bytes', 'bool', 'uint256[]'], [
          last && !toEthUser ? MSG_SENDER : ADDRESS_THIS,
          amountIn ?? CONTRACT_BALANCE,
          last && !toEthUser ? minOut : 0n,
          path,
          inputFromUser,
          [] // minHopPriceX36: no per-hop floor; the final minimum covers the route
        ]);
        if (h.to.native) ethForm = 'weth';
        if (toEthUser) add(CMD.UNWRAP_WETH, ['address', 'uint256'], [MSG_SENDER, minOut]);
      } else {
        if (h.from.native && ethForm === 'weth') { add(CMD.UNWRAP_WETH, ['address', 'uint256'], [ADDRESS_THIS, 0n]); ethForm = 'native'; }
        const cIn = v4Addr(h.from), cOut = v4Addr(h.to);
        const zeroForOne = cIn.toLowerCase() === h.pool.key.currency0.toLowerCase();
        const actions = [];
        const params = [];
        const act = (a, types, values) => { actions.push(a); params.push(coder.encode(types, values)); };
        if (!first) act(ACT.SETTLE, ['address', 'uint256', 'bool'], [cIn, CONTRACT_BALANCE, false]);
        act(ACT.SWAP_EXACT_IN_SINGLE, [V4_SWAP_STRUCT], [{
          poolKey: h.pool.key, zeroForOne, amountIn: amountIn ?? OPEN_DELTA, amountOutMinimum: 0n, minHopPriceX36: 0n, hookData: '0x'
        }]);
        if (first) act(ACT.SETTLE_ALL, ['address', 'uint256'], [cIn, q.amountIn]);
        if (last) act(ACT.TAKE_ALL, ['address', 'uint256'], [cOut, minOut]);
        else act(ACT.TAKE, ['address', 'address', 'uint256'], [cOut, ADDRESS_THIS, OPEN_DELTA]);
        add(CMD.V4_SWAP, ['bytes', 'bytes[]'], [ethers.hexlify(Uint8Array.from(actions)), params]);
        if (h.to.native) ethForm = 'native';
      }
    });

    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
    return {
      to: UNIVERSAL_ROUTER,
      data: urIface.encodeFunctionData('execute', [ethers.hexlify(Uint8Array.from(commands)), inputs, deadline]),
      value: q.from.native ? q.amountIn : 0n
    };
  }

  /* Selling a token goes through Permit2, Uniswap's approval contract: the token
     is approved to Permit2 for exactly this amount, then a signed permit lets the
     router pull exactly that amount, for the next 30 minutes. */
  async function preparePermit(signer, send, token, amount, onStep) {
    const owner = state.account;
    const erc20Allowance = BigInt(await read.call({ to: token.address, data: erc20Iface.encodeFunctionData('allowance', [owner, PERMIT2]) }));
    if (erc20Allowance < amount) {
      onStep(`Approve ${token.symbol}`, `Step 1 of 3 — allow Uniswap's Permit2 contract to use exactly ${fmtAmount(toNum(amount, token.decimals))} ${token.symbol}.`);
      const tx = await send(signer, { to: token.address, data: erc20Iface.encodeFunctionData('approve', [PERMIT2, amount]) });
      onStep('Approving…', `Waiting for the approval to confirm on ${CHAIN.name}.`);
      const rc = await read.waitForTransaction(tx.hash, 1, 180000);
      if (!rc || rc.status !== 1) throw new Error('The approval did not go through.');
    }
    const [allowed, expiration, nonce] = await permit2.allowance(owner, token.address, UNIVERSAL_ROUTER);
    const now = Math.floor(Date.now() / 1000);
    if (allowed >= amount && Number(expiration) > now + 120) return null;

    onStep('Sign the permit', `Step 2 of 3 — a free signature that lets the Uniswap router move exactly this amount of ${token.symbol}. No transaction, no gas.`);
    const value = {
      details: { token: token.address, amount, expiration: now + PERMIT_SECONDS, nonce },
      spender: UNIVERSAL_ROUTER,
      sigDeadline: now + PERMIT_SECONDS
    };
    const signature = await signer.signTypedData(
      { name: 'Permit2', chainId: CHAIN.id, verifyingContract: PERMIT2 },
      {
        PermitSingle: [{ name: 'details', type: 'PermitDetails' }, { name: 'spender', type: 'address' }, { name: 'sigDeadline', type: 'uint256' }],
        PermitDetails: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }]
      },
      value
    );
    return { value, signature };
  }

  let reviewed = null; // what the user saw on the review screen
  let busy = false;

  function openReview() {
    const q = state.quote;
    if (!q || busy) return;
    const d = quoteDetails(q);
    reviewed = { from: q.from, to: q.to, amountIn: q.amountIn, minOut: d.minOut };
    $('rv-pay').textContent = `${fmtAmount(d.inNum)} ${q.from.symbol}`;
    $('rv-recv').textContent = `${fmtAmount(d.outNum)} ${q.to.symbol}`;
    const uIn = priceUsd(q.from), uOut = priceUsd(q.to);
    $('rv-pay-usd').textContent = uIn ? fmtUsd(d.inNum * uIn) : '';
    $('rv-recv-usd').textContent = uOut ? fmtUsd(d.outNum * uOut) : '';
    $('rv-rate').textContent = rateText(d);
    $('rv-min').textContent = `${fmtAmount(toNum(d.minOut, q.to.decimals))} ${q.to.symbol}`;
    $('rv-route').textContent = d.route;
    $('rv-slip').textContent = slippagePct() + '%';
    showTxStep('review');
    $('tx-title').textContent = 'Confirm swap';
    openModal('tx-modal');
  }

  function showTxStep(step) {
    for (const s of ['review', 'progress', 'done', 'fail']) $('tx-' + s).hidden = s !== step;
  }
  function progress(title, desc) {
    showTxStep('progress');
    $('tx-title').textContent = 'Swapping';
    $('tx-step-title').textContent = title;
    $('tx-step-desc').textContent = desc;
  }

  /* Wallets sign for whatever network they're on when asked. Pin every
     transaction to Robinhood Chain and check again right before each one, so a
     network switch mid-flow can't send the swap somewhere else. */
  async function send(signer, tx) {
    const id = await state.wallet.request({ method: 'eth_chainId' });
    if (Number(id) !== CHAIN.id) throw new Error(`Your wallet switched away from ${CHAIN.name}. Switch back and try again; nothing was sent.`);
    return signer.sendTransaction({ ...tx, chainId: CHAIN.id });
  }

  async function executeSwap() {
    if (busy || !reviewed || !state.account) return;
    busy = true;
    const { from, to, amountIn, minOut: reviewedMin } = reviewed;
    const account = state.account;
    let hash = null;
    progress('Getting ready…', 'Checking your wallet and network.');
    try {
      if (!(await ensureChain())) throw new Error(`Switch your wallet to ${CHAIN.name} to swap.`);
      const signer = await new ethers.BrowserProvider(state.wallet, 'any').getSigner(account);

      const permit = from.native ? null : await preparePermit(signer, send, from, amountIn, progress);

      progress('Checking the price…', 'Getting a fresh quote from the pools.');
      const q = await bestQuote(from, to, amountIn);
      const d = quoteDetails(q);
      /* never accept less than the minimum shown on the review screen */
      if (q.amountOut < reviewedMin) {
        throw Object.assign(new Error(`The price moved since you reviewed it: you'd now get about ${fmtAmount(d.outNum)} ${to.symbol}, below the ${fmtAmount(toNum(reviewedMin, to.decimals))} ${to.symbol} minimum you accepted. Nothing was sent; review the new price and try again.`), { priceMoved: true });
      }
      const minOut = d.minOut > reviewedMin ? d.minOut : reviewedMin;
      const tx = buildPlan(q, minOut, permit);

      /* dry-run first, so a swap that would revert never reaches the wallet */
      try {
        await read.call({ from: account, to: tx.to, data: tx.data, value: tx.value });
      } catch (e) {
        throw new Error(`This swap would fail right now (${e.shortMessage || e.reason || 'reverted'}). The price may have moved; try again or raise your slippage.`);
      }

      progress('Confirm in your wallet', `${from.native ? '' : 'Last step — '}swap ${fmtAmount(d.inNum)} ${from.symbol} for at least ${fmtAmount(toNum(minOut, to.decimals))} ${to.symbol}.`);
      const sent = await send(signer, tx);
      hash = sent.hash;
      saveSwap({ time: Date.now(), hash, from: from.symbol, to: to.symbol, inAmount: fmtAmount(d.inNum), outAmount: fmtAmount(d.outNum), status: 'submitted' });
      progress('Swap submitted', `Waiting for ${CHAIN.name} to confirm it…`);
      const rc = await read.waitForTransaction(hash, 1, 180000);
      if (!rc || rc.status !== 1) throw Object.assign(new Error('The swap reverted on-chain, most likely because the price moved past your slippage limit. Your tokens were not swapped.'), { reverted: true });

      saveSwap({ time: Date.now(), hash, from: from.symbol, to: to.symbol, inAmount: fmtAmount(d.inNum), outAmount: fmtAmount(d.outNum), status: 'confirmed' });
      showTxStep('done');
      $('tx-title').textContent = 'Done';
      $('tx-done-desc').textContent = `You swapped ${fmtAmount(d.inNum)} ${from.symbol} for about ${fmtAmount(d.outNum)} ${to.symbol}.`;
      $('tx-done-link').href = `${CHAIN.explorer}/tx/${hash}`;
      const share = $('tx-share');
      share.href = shareUrl(from, to, d.inNum);
      share.hidden = false;
      $('pay-amt').value = '';
      requestQuote(0);
    } catch (e) {
      if (hash && !e.reverted) {
        /* sent, but we stopped waiting: it may still land, so don't call it failed */
        showTxStep('done');
        $('tx-share').hidden = true;
        $('tx-title').textContent = 'Submitted';
        $('tx-done-desc').textContent = 'Your swap was sent but hasn’t confirmed yet. It may still go through — check the explorer before trying again.';
        $('tx-done-link').href = `${CHAIN.explorer}/tx/${hash}`;
      } else {
        showTxStep('fail');
        $('tx-title').textContent = 'Not swapped';
        $('tx-fail-title').textContent = isRejection(e) ? 'Request cancelled' : e.priceMoved ? 'Price moved' : 'Swap failed';
        $('tx-fail-desc').textContent = humanError(e);
        const link = $('tx-fail-link');
        link.hidden = !hash;
        if (hash) link.href = `${CHAIN.explorer}/tx/${hash}`;
        if (e.priceMoved) requestQuote(0);
      }
    } finally {
      busy = false;
      reviewed = null;
      refreshBalances();
    }
  }

  function isRejection(e) {
    return e?.code === 'ACTION_REJECTED' || e?.code === 4001 || e?.info?.error?.code === 4001 || /user (rejected|denied)/i.test(e?.message || '');
  }
  function humanError(e) {
    if (isRejection(e)) return 'You rejected the request in your wallet. Nothing was sent.';
    const msg = e?.shortMessage || e?.info?.error?.message || e?.message || String(e);
    if (/insufficient funds/i.test(msg)) return 'Not enough ETH to cover this swap plus the network fee.';
    if (/too little received|slippage/i.test(msg)) return 'The price moved past your slippage limit before the swap confirmed. Try again, or raise the limit in settings.';
    if (/transaction too old|deadline/i.test(msg)) return 'The swap took too long to confirm and expired. Try again.';
    return msg.length > 240 ? msg.slice(0, 240) + '…' : msg;
  }

  /* ---------------- rendering ---------------- */

  function rateText(d) {
    if (!state.quote || !d.inNum) return '';
    const q = state.quote;
    const per = d.inNum / d.outNum;
    return `1 ${q.to.symbol} ≈ ${fmtAmount(per)} ${q.from.symbol}`;
  }

  function render() {
    const { pay, recv, quote } = state;
    $('pay-sym').textContent = pay.symbol;
    $('pay-sub').textContent = pay.sub;
    setLogoOnce($('pay-logo'), pay);
    $('recv-sym').textContent = recv.symbol;
    $('recv-sub').textContent = recv.sub;
    setLogoOnce($('recv-logo'), recv);

    const payBal = balanceOf(pay), recvBal = balanceOf(recv);
    $('pay-bal').textContent = payBal === null ? (state.account ? '…' : '0.0000') : fmtAmount(toNum(payBal, pay.decimals));
    $('recv-bal').textContent = recvBal === null ? (state.account ? '…' : '0.0000') : fmtAmount(toNum(recvBal, recv.decimals));

    const amountIn = parseAmount($('pay-amt').value, pay.decimals);
    const inNum = amountIn ? toNum(amountIn, pay.decimals) : 0;
    const uIn = priceUsd(pay);
    $('pay-usd').textContent = uIn !== null ? fmtUsd(inNum * uIn) : '—';

    const recvInput = $('recv-amt');
    recvInput.classList.toggle('loading', state.quoting);
    const d = quote ? quoteDetails(quote) : null;
    const typingOut = document.activeElement === recvInput;
    if (d && !typingOut) recvInput.value = fmtAmount(d.outNum).replace(/,/g, '');
    else if (!d && !state.quoting && !typingOut) recvInput.value = '';
    const uOut = priceUsd(recv);
    $('recv-usd').textContent = d && uOut !== null ? fmtUsd(d.outNum * uOut) : (uOut !== null ? fmtUsd(0) : '—');

    // quote box
    if (d) {
      $('q-rate').textContent = rateText(d);
      $('q-route').textContent = d.route;
      $('q-min').textContent = `${fmtAmount(toNum(d.minOut, recv.decimals))} ${recv.symbol}`;
      const imp = $('q-impact');
      imp.textContent = d.impact === null ? '—' : (d.impact < 0.0001 ? '<0.01%' : (d.impact * 100).toFixed(2) + '%');
      imp.className = d.impact > 0.05 ? 'impact-bad' : d.impact > 0.01 ? 'impact-warn' : '';
      $('q-lpfee').textContent = `${fmtAmount(d.lpFee)} ${pay.symbol}`;
    } else {
      const pw = priceEth(pay), rw = priceEth(recv);
      $('q-rate').textContent = state.quoting ? 'Finding the best route…' : (pw && rw ? `1 ${recv.symbol} ≈ ${fmtAmount(rw / pw)} ${pay.symbol}` : 'Fetching live price…');
      for (const id of ['q-route', 'q-min', 'q-impact', 'q-lpfee']) { $(id).textContent = '—'; $(id).className = ''; }
    }
    $('slip-pill').textContent = state.slippage === 'auto' ? 'Auto' : state.slippage + '%';

    // alert
    const alert = $('swap-alert');
    let alertText = '', warn = false;
    if (state.quoteError) alertText = state.quoteError === 'Not enough liquidity for this amount'
      ? `The ${pay.symbol}/${recv.symbol} pools can't fill this amount right now. Try a smaller one.` : state.quoteError;
    else if (d && d.impact > 0.05) { alertText = `High price impact (${(d.impact * 100).toFixed(1)}%). This trade is large for the pool; you'll get noticeably less than the market price.`; warn = true; }
    alert.hidden = !alertText;
    alert.textContent = alertText;
    alert.classList.toggle('warn', warn);

    // main button
    const btn = $('swap-btn');
    let label = 'Swap', disabled = false;
    if (!state.account) label = 'Connect wallet';
    else if (!state.chainOk) label = `Switch to ${CHAIN.name}`;
    else if (!amountIn) { label = 'Enter an amount'; disabled = true; }
    else if (payBal !== null && amountIn > payBal) { label = `Insufficient ${pay.symbol} balance`; disabled = true; }
    else if (state.quoting && !quote) { label = 'Finding the best price…'; disabled = true; }
    else if (state.quoteError) { label = 'No route for this amount'; disabled = true; }
    else if (!quote) { label = 'Finding the best price…'; disabled = true; }
    else if (d && d.impact > 0.15) label = 'Swap anyway';
    btn.textContent = label;
    btn.disabled = disabled;

    /* nudge toward a bridge when the wallet has (almost) no ETH here */
    const ethBal = state.balances.get('ETH');
    $('get-eth-hint').hidden = !(state.account && state.chainOk && ethBal !== undefined &&
      (ethBal < ethers.parseEther('0.0005') || (pay.native && payBal !== null && amountIn > payBal)));

    renderSide();

    const nav = $('nav-connect');
    nav.textContent = state.account ? (state.chainOk ? shortAddr(state.account) : 'Wrong network') : 'Connect wallet';

    document.querySelectorAll('.pick').forEach((p) => p.classList.toggle('sel', p.dataset.sym === recv.symbol));
  }
  function setLogoOnce(img, token) {
    if (img.dataset.sym === token.symbol) return;
    img.dataset.sym = token.symbol;
    setLogo(img, token);
  }

  function renderSide() {
    const on = !!state.account;
    $('side-wallet-off').hidden = on;
    $('side-wallet-on').hidden = !on;
    if (!on) return;
    const a = $('side-addr');
    a.textContent = shortAddr(state.account);
    a.href = `${CHAIN.explorer}/address/${state.account}`;
    const eth = state.balances.get('ETH');
    $('side-eth').textContent = eth === undefined ? '…' : fmtAmount(toNum(eth, 18));
    const held = STOCKS.filter((t) => (state.balances.get(t.symbol) ?? 0n) > 0n).length;
    $('side-held').textContent = state.balances.size ? String(held) : '…';
  }

  async function refreshBlock() {
    try {
      const n = await read.getBlockNumber();
      $('side-block').textContent = '#' + n.toLocaleString('en-US');
      $('side-dot').classList.add('live');
    } catch {
      $('side-dot').classList.remove('live');
    }
  }

  /* Writes a USD price into a node. Until there is one the node stays empty and
     shows a loading bar; when it changes, it flashes green or red. */
  function paintPrice(n, u) {
    if (u === null || !isFinite(u)) { n.textContent = ''; return; }
    const text = fmtUsd(u);
    const prev = Number(n.dataset.v);
    if (n.dataset.v && text !== n.textContent && u !== prev) {
      n.classList.remove('flash-up', 'flash-down');
      void n.offsetWidth; // restart the animation
      n.classList.add(u > prev ? 'flash-up' : 'flash-down');
    }
    n.dataset.v = u;
    n.textContent = text;
  }
  function renderPrices() {
    const ethUsd = state.ethUsd || null;
    paintPrice($('eth-price'), ethUsd);
    paintPrice($('side-ethusd'), ethUsd);
    document.querySelectorAll('[data-price]').forEach((n) => {
      const t = bySymbol(n.dataset.price);
      paintPrice(n, t ? priceUsd(t) : null);
    });
    render();
  }

  function buildPicks() {
    const grid = $('pick-grid');
    const picks = FEATURED.map(bySymbol).filter(Boolean).slice(0, 4);
    while (picks.length < 4 && STOCKS[picks.length]) picks.push(STOCKS.find((s) => !picks.includes(s)));
    grid.replaceChildren(...picks.filter(Boolean).map((t) => {
      const b = el('button', 'pick');
      b.type = 'button';
      b.dataset.sym = t.symbol;
      const px = el('span', 'px'); px.dataset.price = t.symbol;
      b.append(logoImg(t), el('b', null, t.symbol), el('small', null, t.name), px);
      b.addEventListener('click', () => selectToken('recv', t));
      return b;
    }));
    $('stock-count').textContent = STOCKS.length;
  }

  /* ---------------- 24h stats ---------------- */

  /* The server rebuilds 24h prices and volume from on-chain swaps (see
     market-stats.js). On a static host there is no /api/stats, and the page
     simply goes without the 24h columns. */
  state.stats = null;
  async function refreshStats() {
    try {
      const res = await fetch('api/stats', { cache: 'no-store' });
      if (res.status === 503) { setTimeout(refreshStats, 30000); return; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data && data.tokens) state.stats = data;
    } catch {
      document.body.classList.add('no-stats');
    }
    renderStats();
  }
  const statOf = (t) => (state.stats && state.stats.tokens[t.symbol]) || null;
  function fmtPct(x) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    const v = x * 100;
    return (v > 0 ? '+' : '') + v.toFixed(Math.abs(v) < 10 ? 2 : 1) + '%';
  }
  function fmtCompactUsd(x) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    if (x >= 1e9) return '$' + (x / 1e9).toFixed(2) + 'B';
    if (x >= 1e6) return '$' + (x / 1e6).toFixed(2) + 'M';
    if (x >= 1e3) return '$' + (x / 1e3).toFixed(1) + 'K';
    return '$' + x.toFixed(0);
  }
  const chgClass = (x) => (x > 0.00005 ? 'chg up' : x < -0.00005 ? 'chg down' : 'chg');

  /* a small line chart: hourly points, coloured by direction */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function sparkline(values, w, h, change) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('spark', change > 0.00005 ? 'up' : change < -0.00005 ? 'down' : 'flat');
    const pts = (values || []).filter((v) => v != null && isFinite(v));
    if (pts.length < 2) return svg;
    const lo = Math.min(...pts), hi = Math.max(...pts);
    const span = hi - lo || hi * 0.001 || 1;
    const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, h - 2 - ((v - lo) / span) * (h - 4)]);
    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('points', xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
    svg.append(line);
    return svg;
  }

  /* ---------------- watchlist ---------------- */

  const watch = new Set();
  try { JSON.parse(localStorage.getItem('clematis.watchlist') || '[]').forEach((s) => watch.add(s)); } catch { /* storage may be blocked */ }
  function toggleWatch(t) {
    if (watch.has(t.symbol)) watch.delete(t.symbol); else watch.add(t.symbol);
    try { localStorage.setItem('clematis.watchlist', JSON.stringify([...watch])); } catch { /* ignore */ }
    buildMarketTabs();
    buildMarket();
    if (assetOpen === t) renderAsset();
  }
  function starButton(t) {
    const b = el('button', 'star-btn' + (watch.has(t.symbol) ? ' on' : ''), watch.has(t.symbol) ? '★' : '☆');
    b.type = 'button';
    b.setAttribute('aria-label', (watch.has(t.symbol) ? 'Remove ' : 'Add ') + t.symbol + (watch.has(t.symbol) ? ' from' : ' to') + ' watchlist');
    b.setAttribute('aria-pressed', String(watch.has(t.symbol)));
    b.addEventListener('click', (e) => { e.stopPropagation(); toggleWatch(t); });
    return b;
  }

  /* ---------------- markets ---------------- */

  /* The market list is split into four sectors; anything not named below lands
     in the last one, so a newly listed stock still shows up. The watchlist is a
     fifth tab of the stocks you starred. */
  const SECTORS = [
    { id: 'tech', label: 'Tech & Software', symbols: 'AAPL ADBE AMZN APP BB CRM CTSH DDOG FIG GOOGL IBM META MSFT NET NFLX ORCL PLTR RBLX RDDT SHOP SNAP SNOW TTD TTWO WDAY ZM' },
    { id: 'chips', label: 'Chips & AI', symbols: 'AMD APLD ASML AVGO CRWV DELL INTC IREN LITE MRVL MU NBIS NVDA ON PENG POET QCOM QUBT SKHY SNDK TSM WULF WYFI' },
    { id: 'etf', label: 'ETFs & Commodities', symbols: 'EWY GLD INDA QQQ SGOV SLV SOXX SPY USO VTI' },
    { id: 'more', label: 'Consumer, Energy & More', symbols: '' }
  ];
  const sectorOf = (t) => (SECTORS.find((s) => s.symbols.split(' ').includes(t.symbol)) || SECTORS[3]).id;
  const ROWS_FOLDED = 10;
  const market = { sector: 'tech', expanded: false };

  function poolLabel(t) {
    const p = t.pools[0];
    return p ? `Uniswap v${p.v} · ${feePct(p.fee)}` : '—';
  }

  function buildMarketTabs() {
    const tabs = $('market-tabs');
    const all = [...SECTORS.map((sec) => ({ id: sec.id, label: sec.label, n: STOCKS.filter((t) => sectorOf(t) === sec.id).length })),
      { id: 'watch', label: '★ Watchlist', n: STOCKS.filter((t) => watch.has(t.symbol)).length }];
    tabs.replaceChildren(...all.map((sec) => {
      const b = el('button', 'tab' + (sec.id === 'watch' ? ' tab-watch' : ''));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.sector = sec.id;
      b.append(el('span', null, sec.label), el('small', null, String(sec.n)));
      b.addEventListener('click', () => {
        market.sector = sec.id;
        market.expanded = false;
        $('market-search').value = '';
        buildMarket();
      });
      return b;
    }));
  }

  function tradeButton(t, label = 'Trade') {
    const btn = el('button', 'trade-btn', label);
    btn.type = 'button';
    btn.setAttribute('aria-label', `Trade ${t.symbol}`);
    btn.addEventListener('click', (e) => { e.stopPropagation(); goTrade(t, 'buy'); });
    return btn;
  }
  function goTrade(t, side) {
    if (side === 'sell') { state.pay = t; state.recv = ETH; requestQuote(0); }
    else { if (state.pay === t) state.pay = ETH; selectToken('recv', t); }
    closeModal('asset-modal');
    $('swap').scrollIntoView({ behavior: 'smooth' });
  }

  function buildMarket() {
    const q = $('market-search').value.trim().toLowerCase();
    /* a search looks across every sector */
    const all = q
      ? STOCKS.filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
      : market.sector === 'watch'
        ? STOCKS.filter((t) => watch.has(t.symbol))
        : STOCKS.filter((t) => sectorOf(t) === market.sector);
    document.querySelectorAll('#market-tabs .tab').forEach((b) => {
      const on = !q && b.dataset.sector === market.sector;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    const rows = $('market-rows');
    const more = $('market-more');
    if (!all.length) {
      rows.replaceChildren(el('p', 'market-empty', market.sector === 'watch' && !q
        ? 'Your watchlist is empty. Tap the ☆ next to any stock to keep it here.'
        : 'No stock matches that search.'));
      more.hidden = true;
      return;
    }
    const shown = q || market.expanded ? all : all.slice(0, ROWS_FOLDED);
    rows.replaceChildren(...shown.map((t) => {
      const st = statOf(t);
      const row = el('div', 'mt-row');
      row.setAttribute('role', 'row');
      row.tabIndex = 0;
      row.setAttribute('aria-label', `${t.symbol}, ${t.name}: open chart and details`);
      const asset = el('span', 'mt-asset');
      const text = el('span', 'mkt-text');
      text.append(el('b', null, t.symbol), el('small', null, t.name));
      asset.append(starButton(t), logoImg(t), text);
      const px = el('span', 'mt-num');
      px.dataset.price = t.symbol;
      const chg = el('span', 'mt-num ' + (st ? chgClass(st.change24h) : 'chg sk'), st ? fmtPct(st.change24h) : '');
      const vol = el('span', 'mt-num mt-vol' + (st ? '' : ' sk'), st ? fmtCompactUsd(st.volume24h) : '');
      const spark = el('span', 'mt-spark');
      if (st && st.spark) spark.append(sparkline(st.spark, 96, 30, st.change24h));
      const act = el('span', 'mt-act');
      act.append(tradeButton(t));
      row.append(asset, px, chg, vol, spark, act);
      row.addEventListener('click', () => openAsset(t));
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') openAsset(t); });
      return row;
    }));
    more.hidden = !!q || all.length <= ROWS_FOLDED;
    more.textContent = market.expanded ? 'Show less' : `Show all ${all.length}`;
    renderPrices();
  }
  $('market-more').addEventListener('click', () => {
    market.expanded = !market.expanded;
    buildMarket();
    if (!market.expanded) $('stocks').scrollIntoView({ behavior: 'smooth' });
  });

  /* top gainers, losers and most traded, from the 24h stats */
  function buildMovers() {
    const rows = STOCKS.map((t) => ({ t, st: statOf(t) })).filter((r) => r.st && r.st.trades24h > 0);
    const fill = (id, list, value) => {
      const box = $(id);
      if (!list.length) { box.replaceChildren(el('p', 'mover-wait', state.stats ? 'No trades in the last 24h.' : 'Loading 24h data…')); return; }
      box.replaceChildren(...list.map(({ t, st }) => {
        const b = el('button', 'mover');
        b.type = 'button';
        const text = el('span', 'mkt-text');
        text.append(el('b', null, t.symbol), el('small', null, t.name));
        const right = el('span', 'mover-val');
        const px = el('span', 'mover-px'); px.dataset.price = t.symbol;
        right.append(px, value(st));
        b.append(logoImg(t), text, right);
        b.addEventListener('click', () => openAsset(t));
        return b;
      }));
    };
    const byChange = rows.slice().sort((a, b) => b.st.change24h - a.st.change24h);
    fill('mv-up', byChange.filter((r) => r.st.change24h > 0).slice(0, 4), (st) => el('span', chgClass(st.change24h), fmtPct(st.change24h)));
    fill('mv-down', byChange.filter((r) => r.st.change24h < 0).reverse().slice(0, 4), (st) => el('span', chgClass(st.change24h), fmtPct(st.change24h)));
    fill('mv-vol', rows.slice().sort((a, b) => b.st.volume24h - a.st.volume24h).slice(0, 4), (st) => el('span', 'chg', fmtCompactUsd(st.volume24h)));
  }

  function renderStats() {
    buildMovers();
    buildMarket();
    renderPortfolio();
    if (assetOpen) renderAsset();
  }

  /* ---------------- stock detail ---------------- */

  let assetOpen = null;
  function openAsset(t) {
    assetOpen = t;
    renderAsset();
    openModal('asset-modal');
  }
  function renderAsset() {
    const t = assetOpen;
    if (!t) return;
    const st = statOf(t);
    setLogo($('as-logo'), t);
    $('as-sym').textContent = t.symbol;
    $('as-name').textContent = t.name;
    const star = $('as-star');
    star.textContent = watch.has(t.symbol) ? '★' : '☆';
    star.classList.toggle('on', watch.has(t.symbol));
    star.setAttribute('aria-pressed', String(watch.has(t.symbol)));
    const u = priceUsd(t);
    $('as-price').textContent = u !== null ? fmtUsd(u) : '—';
    const chg = $('as-change');
    chg.textContent = st ? fmtPct(st.change24h) + ' today' : '24h data loading…';
    chg.className = st ? chgClass(st.change24h) : 'chg';
    $('as-high').textContent = st && st.high24h ? fmtUsd(st.high24h) : '—';
    $('as-low').textContent = st && st.low24h ? fmtUsd(st.low24h) : '—';
    $('as-vol').textContent = st ? fmtCompactUsd(st.volume24h) : '—';
    $('as-trades').textContent = st ? st.trades24h.toLocaleString('en-US') : '—';
    $('as-pool').textContent = poolLabel(t);
    const bal = balanceOf(t);
    $('as-hold').textContent = !state.account ? 'Connect wallet' : bal === null ? '…' : `${fmtAmount(toNum(bal, t.decimals))} ${t.symbol}`;
    $('as-addr').textContent = shortAddr(t.address);
    $('as-addr').title = t.address;
    $('as-explorer').href = `${CHAIN.explorer}/token/${t.address}`;
    $('as-sell').disabled = !(bal && bal > 0n);
    drawChart($('as-chart'), st);
  }
  /* the 24h chart: area under the hourly line, with the range on the left and
     the time along the bottom */
  function drawChart(box, st) {
    box.replaceChildren();
    const pts = st && st.spark ? st.spark.filter((v) => v != null) : [];
    if (pts.length < 2) { box.append(el('p', 'mover-wait', state.stats ? 'No trades in the last 24h.' : 'Loading 24h chart…')); return; }
    const W = 560, H = 200, L = 58, R = 8, T = 10, B = 26;
    const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || hi * 0.001 || 1;
    const x = (i) => L + (i / (pts.length - 1)) * (W - L - R);
    const y = (v) => T + (1 - (v - lo) / span) * (H - T - B);
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${assetOpen ? assetOpen.symbol : ''} price over the last 24 hours, from ${fmtUsd(pts[0])} to ${fmtUsd(pts[pts.length - 1])}`);
    svg.classList.add('chart', st.change24h > 0.00005 ? 'up' : st.change24h < -0.00005 ? 'down' : 'flat');
    const mk = (tag, attrs, text) => { const n = document.createElementNS(SVG_NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text) n.textContent = text; svg.append(n); return n; };
    for (const v of [hi, (hi + lo) / 2, lo]) {
      mk('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' });
      mk('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'axis' }, fmtUsd(v));
    }
    [['24h ago', 0, 'start'], ['12h', (pts.length - 1) / 2, 'middle'], ['now', pts.length - 1, 'end']].forEach(([label, i, anchor]) => mk('text', { x: x(i), y: H - 6, 'text-anchor': anchor, class: 'axis' }, label));
    const line = pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    mk('polygon', { points: `${x(0)},${H - B} ${line} ${x(pts.length - 1)},${H - B}`, class: 'area' });
    mk('polyline', { points: line, class: 'line' });
    mk('circle', { cx: x(pts.length - 1), cy: y(pts[pts.length - 1]), r: 4, class: 'dot' });
    box.append(svg);
  }
  $('as-star').addEventListener('click', () => assetOpen && toggleWatch(assetOpen));
  $('as-buy').addEventListener('click', () => assetOpen && goTrade(assetOpen, 'buy'));
  $('as-sell').addEventListener('click', () => assetOpen && goTrade(assetOpen, 'sell'));
  $('as-copy').addEventListener('click', async () => {
    if (!assetOpen) return;
    try { await navigator.clipboard.writeText(assetOpen.address); toast('Contract address copied'); }
    catch { toast(assetOpen.address); }
  });

  /* ---------------- portfolio & history ---------------- */

  const historyKey = () => 'clematis.history.' + (state.account || '').toLowerCase();
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(historyKey()) || '[]'); } catch { return []; }
  }
  function saveSwap(entry) {
    if (!state.account) return;
    const list = loadHistory().filter((h) => h.hash !== entry.hash);
    list.unshift(entry);
    try { localStorage.setItem(historyKey(), JSON.stringify(list.slice(0, 30))); } catch { /* ignore */ }
    renderPortfolio();
  }

  function renderPortfolio() {
    const on = !!state.account;
    $('pf-off').hidden = on;
    $('pf-on').hidden = !on;
    // history
    const hist = on ? loadHistory() : [];
    const hbox = $('pf-history');
    if (!hist.length) hbox.replaceChildren(el('p', 'market-empty', on ? 'Swaps you make here will show up in this list.' : 'Connect your wallet to see the swaps you made here.'));
    else hbox.replaceChildren(...hist.map((h) => {
      const row = el('a', 'hist-row');
      row.href = `${CHAIN.explorer}/tx/${h.hash}`;
      row.target = '_blank';
      row.rel = 'noopener';
      const when = new Date(h.time);
      const left = el('span', 'hist-main');
      left.append(el('b', null, `${h.inAmount} ${h.from} → ${h.outAmount} ${h.to}`), el('small', null, when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })));
      row.append(left, el('span', 'hist-status ' + (h.status === 'confirmed' ? 'ok' : 'pending'), h.status === 'confirmed' ? 'Confirmed' : 'Submitted'), el('span', 'hist-link', 'View ↗'));
      return row;
    }));
    if (!on) return;
    const held = [ETH, ...(USDG ? [USDG] : []), ...STOCKS]
      .map((t) => {
        const bal = balanceOf(t);
        const amount = bal ? toNum(bal, t.decimals) : 0;
        const px = priceUsd(t);
        return { t, amount, px, value: px !== null ? amount * px : null };
      })
      .filter((r) => r.amount > 0);
    const stockRows = held.filter((r) => r.t.stock).sort((a, b) => (b.value || 0) - (a.value || 0));
    const cash = held.filter((r) => !r.t.stock);
    const sum = (rows) => rows.reduce((n, r) => n + (r.value || 0), 0);
    const total = sum(held);
    $('pf-total').textContent = state.balances.size ? fmtUsd(total) : '…';
    $('pf-stocks').textContent = state.balances.size ? fmtUsd(sum(stockRows)) : '…';
    $('pf-cash').textContent = state.balances.size ? fmtUsd(sum(cash)) : '…';
    $('pf-count').textContent = state.balances.size ? String(stockRows.length) : '…';
    const rows = $('pf-rows');
    const list = [...stockRows, ...cash];
    if (!list.length) {
      rows.replaceChildren(el('p', 'market-empty', state.balances.size ? 'No stocks in this wallet yet. Pick one in Markets or swap above.' : 'Reading your balances…'));
      return;
    }
    rows.replaceChildren(...list.map((r) => {
      const st = r.t.stock ? statOf(r.t) : null;
      const row = el('div', 'mt-row pf-row');
      const asset = el('span', 'mt-asset');
      const text = el('span', 'mkt-text');
      text.append(el('b', null, r.t.symbol), el('small', null, r.t.name));
      asset.append(logoImg(r.t), text);
      const share = total > 0 && r.value ? r.value / total : 0;
      const bar = el('span', 'pf-share');
      const fillBar = el('i'); fillBar.style.width = (share * 100).toFixed(1) + '%';
      bar.append(fillBar);
      text.append(bar);
      row.append(asset,
        el('span', 'mt-num', fmtAmount(r.amount)),
        el('span', 'mt-num', r.px !== null ? fmtUsd(r.px) : '—'),
        el('span', 'mt-num', r.value !== null ? fmtUsd(r.value) : '—'),
        el('span', 'mt-num mt-vol ' + (st ? chgClass(st.change24h) : 'chg'), st ? fmtPct(st.change24h) : '—'));
      if (r.t.stock) { row.tabIndex = 0; row.addEventListener('click', () => openAsset(r.t)); }
      return row;
    }));
  }
  $('pf-connect').addEventListener('click', () => openWalletModal());

  /* Scrolling strip of live prices under the hero. The list is laid out twice so
     the loop has no seam. */
  function buildTape() {
    const picks = [...FEATURED, 'SPY', 'QQQ', 'PLTR', 'AMD', 'NFLX', 'TSM', 'MSTR', 'SPCX', 'GLD']
      .map(bySymbol).filter(Boolean);
    const items = () => picks.map((t) => {
      const b = el('button', 'tape-item');
      b.type = 'button';
      const px = el('span');
      px.dataset.price = t.symbol;
      b.append(logoImg(t), el('b', null, t.symbol), px);
      b.addEventListener('click', () => {
        if (state.pay === t) state.pay = ETH;
        selectToken('recv', t);
        $('swap').scrollIntoView({ behavior: 'smooth' });
      });
      return b;
    });
    const second = items();
    second.forEach((n) => { n.tabIndex = -1; n.setAttribute('aria-hidden', 'true'); });
    $('tape-track').replaceChildren(...items(), ...second);
  }

  /* A ready-made post for X after a swap. Stocks get a cashtag. */
  function shareUrl(from, to, inNum) {
    const tag = (t) => (t.native || t.symbol === 'USDG' ? t.symbol : '$' + t.symbol);
    const site = (document.querySelector('meta[property="og:url"]') || {}).content || location.origin + '/';
    const text = `Just swapped ${fmtAmount(inNum)} ${tag(from)} for ${tag(to)} on ${BRAND}, on-chain on Robinhood Chain.`;
    return 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(site);
  }

  /* ---------------- floating hero assets ---------------- */

  /* Spots around the headline, as % of the hero box, with a size factor. The
     centre column stays clear for the text. */
  const ORBIT_WIDE = [
    [6, 16, 1.1], [19, 7, .8], [14, 34, 1.2], [4, 54, .85], [23, 56, .95], [9, 80, 1], [25, 88, .75], [34, 7, .7],
    [94, 16, 1.1], [81, 7, .8], [86, 34, 1.2], [96, 54, .85], [77, 56, .95], [91, 80, 1], [75, 88, .75], [66, 7, .7],
    /* extra spots, used when the hero is wide enough */
    [3, 32, .7], [26, 24, .68], [16, 67, .8], [29, 74, .62], [3, 93, .72],
    [97, 32, .7], [74, 24, .68], [84, 67, .8], [71, 74, .62], [97, 93, .72]
  ];
  const ORBIT_NARROW = [[9, 6, .8], [30, 5, .65], [70, 5, .65], [91, 6, .8], [6, 95, .7], [94, 95, .7]];
  const ORBIT_TOKENS = [...FEATURED, 'NFLX', 'PLTR', 'AMD', 'SPY', 'QQQ', 'TSM', 'MSTR', 'SPCX', 'GLD', 'RBLX',
    'INTC', 'SHOP', 'BABA', 'LLY', 'RDDT', 'RKLB', 'GME', 'COST', 'CRCL', 'HIMS', 'SNAP', 'MU', 'BA', 'NU'];
  const orbitMode = (w) => (w < 760 ? 'narrow' : w < 1100 ? 'mid' : 'wide');

  function buildOrbit() {
    const hero = $('hero'), layer = $('orbit');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mode = null;
    const items = [];

    const place = (animate) => {
      mode = orbitMode(hero.clientWidth);
      const slots = mode === 'narrow' ? ORBIT_NARROW : mode === 'mid' ? ORBIT_WIDE.slice(0, 16) : ORBIT_WIDE;
      const base = mode === 'narrow' ? 40 : 60;
      const picks = ORBIT_TOKENS.map(bySymbol).filter(Boolean).slice(0, slots.length);
      const box = hero.getBoundingClientRect();
      const title = hero.querySelector('h1').getBoundingClientRect();
      const cx = title.left + title.width / 2 - box.left, cy = title.top + title.height / 2 - box.top;
      items.length = 0;
      layer.replaceChildren(...picks.map((t, i) => {
        const [px, py, k] = slots[i];
        const size = Math.round(base * k);
        const node = el('div', 'fa');
        node.style.left = px + '%';
        node.style.top = py + '%';
        node.style.setProperty('--s', size + 'px');
        node.style.setProperty('--o', (0.7 + 0.3 * Math.min(1, k)).toFixed(2));
        const burst = el('div', 'fa-burst');
        const float = el('div', 'fa-float');
        const rnd = (a, b) => a + Math.random() * (b - a);
        float.style.setProperty('--fd', rnd(5, 8.5).toFixed(2) + 's');
        float.style.setProperty('--fdel', (-rnd(0, 8)).toFixed(2) + 's');
        float.style.setProperty('--fx', rnd(-8, 8).toFixed(1) + 'px');
        float.style.setProperty('--fy', rnd(-16, -8).toFixed(1) + 'px');
        float.style.setProperty('--r0', rnd(-6, -1).toFixed(1) + 'deg');
        float.style.setProperty('--r1', rnd(1, 6).toFixed(1) + 'deg');
        const img = logoImg(t);
        img.loading = 'eager';
        img.width = img.height = size;
        img.draggable = false;
        float.append(img);
        burst.append(float);
        node.append(burst);
        node.title = t.symbol;
        const item = { t, node, x: 0, y: 0, vx: 0, vy: 0, raf: 0 };
        items.push(item);
        drag(item);
        if (animate && !reduce) {
          const dx = cx - (px / 100) * box.width, dy = cy - (py / 100) * box.height;
          burst.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(.15)`, opacity: 0 },
            { opacity: 1, offset: 0.3 },
            { transform: 'translate(0, 0) scale(1)', opacity: 1 }
          ], { duration: 1300, delay: 250 + i * 45, easing: 'cubic-bezier(.2, 1.25, .35, 1)', fill: 'backwards' });
        }
        return node;
      }));
    };

    /* keep a tile's centre inside the hero */
    const bounds = (item) => {
      const W = hero.clientWidth, H = hero.clientHeight;
      const r = item.node.offsetWidth / 2;
      const ox = item.node.offsetLeft, oy = item.node.offsetTop;
      return { minX: r - ox, maxX: W - r - ox, minY: r - oy, maxY: H - r - oy };
    };
    const apply = (item) => {
      item.node.style.setProperty('--mx', item.x.toFixed(1) + 'px');
      item.node.style.setProperty('--my', item.y.toFixed(1) + 'px');
    };
    const clamp = (item) => {
      const b = bounds(item);
      item.x = Math.min(b.maxX, Math.max(b.minX, item.x));
      item.y = Math.min(b.maxY, Math.max(b.minY, item.y));
      apply(item);
    };

    /* a thrown tile glides, slows down and bounces off the hero's edges */
    const glide = (item) => {
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min(32, now - last);
        last = now;
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        const b = bounds(item);
        if (item.x < b.minX || item.x > b.maxX) { item.x = Math.min(b.maxX, Math.max(b.minX, item.x)); item.vx *= -0.6; }
        if (item.y < b.minY || item.y > b.maxY) { item.y = Math.min(b.maxY, Math.max(b.minY, item.y)); item.vy *= -0.6; }
        const f = Math.pow(0.94, dt / 16);
        item.vx *= f; item.vy *= f;
        apply(item);
        item.raf = Math.hypot(item.vx, item.vy) > 0.01 ? requestAnimationFrame(step) : 0;
      };
      item.raf = requestAnimationFrame(step);
    };

    function drag(item) {
      const { node } = item;
      let start = null;
      node.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        cancelAnimationFrame(item.raf);
        node.setPointerCapture(e.pointerId);
        node.classList.add('grab');
        start = { px: e.clientX, py: e.clientY, x: item.x, y: item.y, t: performance.now(), moved: 0, samples: [] };
        e.preventDefault();
      });
      node.addEventListener('pointermove', (e) => {
        if (!start) return;
        const dx = e.clientX - start.px, dy = e.clientY - start.py;
        start.moved = Math.max(start.moved, Math.hypot(dx, dy));
        item.x = start.x + dx;
        item.y = start.y + dy;
        clamp(item);
        const now = performance.now();
        start.samples.push({ x: e.clientX, y: e.clientY, t: now });
        while (start.samples.length > 2 && now - start.samples[0].t > 90) start.samples.shift();
      });
      const end = (e) => {
        if (!start) return;
        node.classList.remove('grab');
        const s = start.samples, quick = performance.now() - start.t < 400;
        if (start.moved < 6 && quick && e.type === 'pointerup') openAsset(item.t);
        else if (s.length >= 2) {
          const a = s[0], b = s[s.length - 1], dt = Math.max(1, b.t - a.t);
          item.vx = Math.max(-3, Math.min(3, (b.x - a.x) / dt));
          item.vy = Math.max(-3, Math.min(3, (b.y - a.y) / dt));
          if (performance.now() - b.t < 80) glide(item);
        }
        start = null;
      };
      node.addEventListener('pointerup', end);
      node.addEventListener('pointercancel', end);
    }

    place(true);
    let resizeTimer = 0;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (orbitMode(hero.clientWidth) !== mode) place(false);
        else items.forEach(clamp);
      }, 120);
    });
  }

  /* ---------------- token picker ---------------- */

  let pickerSide = 'pay';
  function openPicker(side) {
    pickerSide = side;
    $('token-modal-title').textContent = side === 'pay' ? 'You pay with' : 'You receive';
    $('token-search').value = '';
    fillPicker();
    openModal('token-modal');
    setTimeout(() => $('token-search').focus(), 50);
  }
  function fillPicker() {
    const q = $('token-search').value.trim().toLowerCase();
    const current = pickerSide === 'pay' ? state.pay : state.recv;
    const list = TOKENS
      .filter((t) => !q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const ba = balanceOf(a), bb = balanceOf(b);
        const va = ba ? toNum(ba, a.decimals) * (priceUsd(a) || 0) : 0;
        const vb = bb ? toNum(bb, b.decimals) * (priceUsd(b) || 0) : 0;
        if (a.native) return -1;
        if (b.native) return 1;
        return vb - va || a.symbol.localeCompare(b.symbol);
      });
    const box = $('token-list');
    if (!list.length) { box.replaceChildren(el('p', 'market-empty', 'Nothing matches that search.')); return; }
    box.replaceChildren(...list.map((t) => {
      const row = el('button', 'tok-row' + (t === current ? ' sel' : ''));
      row.type = 'button';
      const text = el('span', 'tok-text');
      text.append(el('b', null, t.symbol), el('small', null, t.sub));
      const bal = balanceOf(t);
      const right = el('span', 'row-bal', bal && bal > 0n ? fmtAmount(toNum(bal, t.decimals)) : '');
      row.append(logoImg(t, 'tok-logo'), text, right);
      row.addEventListener('click', () => { selectToken(pickerSide, t); closeModal('token-modal'); });
      return row;
    }));
  }

  function selectToken(side, t) {
    const other = side === 'pay' ? 'recv' : 'pay';
    if (state[other] === t) state[other] = state[side];
    state[side] = t;
    if (state.pay === state.recv) state[other] = t.native ? (bySymbol('AAPL') || STOCKS[0]) : ETH;
    requestQuote(0);
  }

  /* ---------------- modals, toast ---------------- */

  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    $(id).hidden = false;
  }
  function closeModal(id) {
    $(id).hidden = true;
    if (id === 'asset-modal') assetOpen = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('[data-close]')) {
        if (m.id === 'tx-modal' && !$('tx-progress').hidden) return; // don't lose a swap in flight
        closeModal(m.id);
      }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal')].find((m) => !m.hidden);
    if (open && !(open.id === 'tx-modal' && !$('tx-progress').hidden)) closeModal(open.id);
    $('settings-pop').hidden = true;
  });

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 4200);
  }

  /* ---------------- events ---------------- */

  $('pay-amt').addEventListener('input', (e) => {
    let v = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
    const i = v.indexOf('.');
    if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');
    e.target.value = v;
    requestQuote();
  });
  $('recv-amt').addEventListener('input', (e) => {
    let v = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
    const i = v.indexOf('.');
    if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');
    e.target.value = v;
    requestQuoteOut();
  });
  $('pay-select').addEventListener('click', () => openPicker('pay'));
  $('recv-select').addEventListener('click', () => openPicker('recv'));
  $('token-search').addEventListener('input', fillPicker);
  $('more-stocks').addEventListener('click', () => openPicker('recv'));
  $('market-search').addEventListener('input', buildMarket);

  $('flip-btn').addEventListener('click', () => {
    const out = state.quote ? quoteDetails(state.quote).outNum : null;
    [state.pay, state.recv] = [state.recv, state.pay];
    if (out) $('pay-amt').value = String(Number(out.toPrecision(8)));
    requestQuote(0);
  });

  $('max-btn').addEventListener('click', () => {
    if (!state.account) { openWalletModal(); return; }
    const bal = balanceOf(state.pay);
    if (bal === null) return;
    let amt = bal;
    if (state.pay.native) {
      const reserve = ethers.parseEther(String(ETH_GAS_RESERVE));
      amt = bal > reserve ? bal - reserve : 0n;
    }
    $('pay-amt').value = ethers.formatUnits(amt, state.pay.decimals).replace(/\.0$/, '');
    requestQuote(0);
  });

  $('swap-btn').addEventListener('click', async () => {
    if (!state.account) { openWalletModal(); return; }
    if (!state.chainOk) {
      try { await ensureChain(); } catch (e) { toast(humanError(e)); }
      return;
    }
    openReview();
  });
  $('rv-confirm').addEventListener('click', executeSwap);

  $('side-connect').addEventListener('click', () => openWalletModal());
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-get-eth]')) openModal('eth-modal');
  });
  $('nav-connect').addEventListener('click', async () => {
    if (!state.account) { openWalletModal(); return; }
    if (!state.chainOk) { try { await ensureChain(); } catch (e) { toast(humanError(e)); } return; }
    window.open(`${CHAIN.explorer}/address/${state.account}`, '_blank', 'noopener');
  });

  // slippage settings
  const pop = $('settings-pop');
  $('settings-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    $('settings-btn').setAttribute('aria-expanded', String(!pop.hidden));
    markSlip();
  });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) pop.hidden = true; });
  function markSlip() {
    pop.querySelectorAll('.slip-opt').forEach((b) => b.classList.toggle('sel', String(state.slippage) === b.dataset.slip));
    $('slip-input').value = state.slippage !== 'auto' && ![0.1, 0.5, 1].includes(state.slippage) ? state.slippage : '';
  }
  function setSlippage(v) {
    state.slippage = v;
    try { localStorage.setItem('clematis.slippage', String(v)); } catch { /* ignore */ }
    markSlip();
    render();
  }
  pop.querySelectorAll('.slip-opt').forEach((b) => b.addEventListener('click', () => setSlippage(b.dataset.slip === 'auto' ? 'auto' : Number(b.dataset.slip))));
  $('slip-input').addEventListener('input', (e) => {
    const v = Number(e.target.value.replace(',', '.'));
    if (v > 0 && v <= 50) setSlippage(v);
  });

  // FAQ
  document.querySelectorAll('.faq-q').forEach((q) => q.addEventListener('click', () => {
    const item = q.parentElement;
    const open = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach((i) => { i.classList.remove('open'); i.querySelector('.faq-a').style.maxHeight = 0; });
    if (!open) { item.classList.add('open'); const a = item.querySelector('.faq-a'); a.style.maxHeight = a.scrollHeight + 'px'; }
  }));

  // reveal on scroll + active nav
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach((n) => io.observe(n));
  const navLinks = [...document.querySelectorAll('.main-nav a, .side-nav a')];
  const navIo = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['swap', 'stocks', 'portfolio', 'how', 'features', 'faq'].forEach((id) => $(id) && navIo.observe($(id)));

  /* ---------------- start ---------------- */

  /* ?simulate exposes the router for scripted dry-runs against the live chain;
     it can only read and build calldata, never sign or send. */
  if (new URLSearchParams(location.search).has('simulate')) {
    window.clematisSim = { tokens: TOKENS, bestQuote, quoteHop, edgePools, quoteDetails, buildPlan, addresses: { UNIVERSAL_ROUTER, PERMIT2, CHAIN_ID: CHAIN.id } };
  }

  document.title = BRAND;
  $('stat-stocks').textContent = STOCKS.length;
  $('side-count').textContent = STOCKS.length;
  refreshBlock();
  setInterval(() => { if (!document.hidden) refreshBlock(); }, 12000);
  $('stat-pools').textContent = listed.reduce((n, t) => n + t.pools.length, 0);
  buildPicks();
  buildTape();
  buildOrbit();
  buildMarketTabs();
  buildMarket();
  buildMovers();
  renderPortfolio();
  refreshStats();
  setInterval(() => { if (!document.hidden) refreshStats(); }, 5 * 60 * 1000);
  render();
  requestQuote(0);
  refreshPrices();
  setInterval(() => { if (!document.hidden) refreshPrices(); }, 30000);
  setInterval(() => { if (!document.hidden && state.account) refreshBalances(); }, 30000);
})();
