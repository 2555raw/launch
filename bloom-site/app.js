/* Bloom — swap tokenized stocks on Robinhood Chain through Uniswap v3 and v4.
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

  const BRAND = 'Bloom';
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

  const { ethers } = window;
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const read = new ethers.JsonRpcProvider(CHAIN.rpc, CHAIN.id, { staticNetwork: true, batchMaxCount: 50 });

  const POOL_KEY = '(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)';
  const quoterV3 = new ethers.Contract(QUOTER_V3, ['function quoteExactInput(bytes path, uint256 amountIn) returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)'], read);
  const quoterV4 = new ethers.Contract(QUOTER_V4, [`function quoteExactInputSingle((${POOL_KEY} poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)`], read);
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

  const listed = (window.CHAIN_TOKENS || []).map((t) => {
    const stock = /robinhood token/i.test(t.name);
    return {
      symbol: t.symbol,
      name: stock ? cleanName(t.name) : t.name,
      sub: stock ? cleanName(t.name) : 'Global Dollar · stablecoin',
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
    const saved = localStorage.getItem('bloom.slippage');
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
    reads.forEach((r, i) => {
      const res = results[i];
      if (!res.success || res.returnData === '0x') return;
      const sqrt = (r.pool.v === 3 ? v3PoolIface.decodeFunctionResult('slot0', res.returnData) : stateViewIface.decodeFunctionResult('getSlot0', res.returnData))[0];
      if (sqrt === 0n) return;
      const tokenAddr = (r.pool.v === 3 ? v3Addr(r.token) : v4Addr(r.token)).toLowerCase();
      const baseAddr = (r.pool.v === 3 ? v3Addr(r.base) : v4Addr(r.base)).toLowerCase();
      const tokenIs0 = tokenAddr < baseAddr;
      const p = tokenIs0 ? poolPrice(sqrt, r.token.decimals, r.base.decimals) : 1 / poolPrice(sqrt, r.base.decimals, r.token.decimals);
      if (isFinite(p) && p > 0) inBase.set(r.token.symbol + '|' + r.base.symbol, p);
    });
    const usdgInEth = USDG ? inBase.get('USDG|ETH') : null;
    if (usdgInEth) { state.ethPer.set('USDG', usdgInEth); state.ethUsd = 1 / usdgInEth; }
    for (const t of STOCKS) {
      const viaEth = inBase.get(t.symbol + '|ETH');
      const viaUsd = inBase.get(t.symbol + '|USDG');
      /* the deepest pool decides which base to believe */
      const deepest = t.pools[0];
      const pick = deepest && deepest.base === 'USDG' && viaUsd && usdgInEth ? viaUsd * usdgInEth : (viaEth ?? (viaUsd && usdgInEth ? viaUsd * usdgInEth : null));
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

  function walletChoices() {
    const list = [...wallets.values()];
    if (!list.length && window.ethereum) list.push({ info: { name: 'Browser wallet', rdns: 'injected', icon: '' }, provider: window.ethereum });
    return list;
  }

  function openWalletModal() {
    const box = $('wallet-list');
    box.replaceChildren();
    const list = walletChoices();
    if (!list.length) {
      const p = el('p', 'wallet-empty');
      p.append('No browser wallet found. Install ');
      const a = el('a', null, 'MetaMask');
      a.href = 'https://metamask.io/download/'; a.target = '_blank'; a.rel = 'noopener';
      p.append(a, ' or ');
      const b = el('a', null, 'Rabby');
      b.href = 'https://rabby.io/'; b.target = '_blank'; b.rel = 'noopener';
      p.append(b, ', then reload this page. On a phone, open this page inside your wallet app’s browser.');
      box.append(p);
    }
    for (const w of list) {
      const row = el('button', 'wallet-row');
      row.type = 'button';
      if (w.info.icon && /^data:image\//.test(w.info.icon)) {
        const img = el('img'); img.src = w.info.icon; img.alt = ''; row.append(img);
      }
      row.append(el('span', null, w.info.name));
      row.addEventListener('click', () => connect(w));
      box.append(row);
    }
    openModal('wallet-modal');
  }

  async function connect(w) {
    closeModal('wallet-modal');
    try {
      const accounts = await w.provider.request({ method: 'eth_requestAccounts' });
      attachWallet(w, accounts[0]);
      try { localStorage.setItem('bloom.wallet', w.info.rdns || 'injected'); } catch { /* ignore */ }
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
    try { last = localStorage.getItem('bloom.wallet'); } catch { /* ignore */ }
    if (!last) return;
    const w = walletChoices().find((x) => (x.info.rdns || 'injected') === last);
    if (!w) return;
    try {
      const accs = await w.provider.request({ method: 'eth_accounts' });
      if (accs && accs[0]) attachWallet(w, accs[0]);
    } catch { /* ignore */ }
  }, 400);

  async function refreshBalances() {
    if (!state.account) { render(); return; }
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
  async function preparePermit(signer, token, amount, onStep) {
    const owner = state.account;
    const erc20Allowance = BigInt(await read.call({ to: token.address, data: erc20Iface.encodeFunctionData('allowance', [owner, PERMIT2]) }));
    if (erc20Allowance < amount) {
      onStep(`Approve ${token.symbol}`, `Step 1 of 3 — allow Uniswap's Permit2 contract to use exactly ${fmtAmount(toNum(amount, token.decimals))} ${token.symbol}.`);
      const tx = await signer.sendTransaction({ to: token.address, data: erc20Iface.encodeFunctionData('approve', [PERMIT2, amount]) });
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

  function openReview() {
    const q = state.quote;
    if (!q) return;
    const d = quoteDetails(q);
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

  async function executeSwap() {
    const from = state.pay, to = state.recv;
    const amountIn = state.quote?.amountIn;
    if (!amountIn || !state.account) return;
    let hash = null;
    try {
      if (!(await ensureChain())) throw new Error(`Switch your wallet to ${CHAIN.name} to swap.`);
      const signer = await new ethers.BrowserProvider(state.wallet, 'any').getSigner(state.account);

      const permit = from.native ? null : await preparePermit(signer, from, amountIn, progress);

      progress('Checking the price…', 'Getting a fresh quote from the pools.');
      const q = await bestQuote(from, to, amountIn);
      const d = quoteDetails(q);
      const tx = buildPlan(q, d.minOut, permit);

      /* dry-run first, so a swap that would revert never reaches the wallet */
      try {
        await read.call({ from: state.account, to: tx.to, data: tx.data, value: tx.value });
      } catch (e) {
        throw new Error(`This swap would fail right now (${e.shortMessage || e.reason || 'reverted'}). The price may have moved; try again or raise your slippage.`);
      }

      progress('Confirm in your wallet', `${from.native ? '' : 'Last step — '}swap ${fmtAmount(d.inNum)} ${from.symbol} for at least ${fmtAmount(toNum(d.minOut, to.decimals))} ${to.symbol}.`);
      const sent = await signer.sendTransaction(tx);
      hash = sent.hash;
      progress('Swap submitted', `Waiting for ${CHAIN.name} to confirm it…`);
      const rc = await read.waitForTransaction(hash, 1, 180000);
      if (!rc) throw new Error('Still waiting for confirmation. Check the explorer for its status.');
      if (rc.status !== 1) throw new Error('The swap reverted on-chain, most likely because the price moved past your slippage limit. Your tokens were not swapped.');

      showTxStep('done');
      $('tx-title').textContent = 'Done';
      $('tx-done-desc').textContent = `You swapped ${fmtAmount(d.inNum)} ${from.symbol} for about ${fmtAmount(d.outNum)} ${to.symbol}.`;
      $('tx-done-link').href = `${CHAIN.explorer}/tx/${hash}`;
      $('pay-amt').value = '';
      requestQuote(0);
      refreshBalances();
    } catch (e) {
      showTxStep('fail');
      $('tx-title').textContent = 'Not swapped';
      $('tx-fail-title').textContent = isRejection(e) ? 'Request cancelled' : 'Swap failed';
      $('tx-fail-desc').textContent = humanError(e);
      const link = $('tx-fail-link');
      link.hidden = !hash;
      if (hash) link.href = `${CHAIN.explorer}/tx/${hash}`;
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
    if (d) recvInput.value = fmtAmount(d.outNum).replace(/,/g, '');
    else if (!state.quoting) recvInput.value = '';
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

    const nav = $('nav-connect');
    nav.textContent = state.account ? (state.chainOk ? shortAddr(state.account) : 'Wrong network') : 'Connect wallet';

    document.querySelectorAll('.pick').forEach((p) => p.classList.toggle('sel', p.dataset.sym === recv.symbol));
  }
  function setLogoOnce(img, token) {
    if (img.dataset.sym === token.symbol) return;
    img.dataset.sym = token.symbol;
    setLogo(img, token);
  }

  function renderPrices() {
    const ethUsd = state.ethUsd;
    $('eth-price').textContent = ethUsd ? fmtUsd(ethUsd) : '—';
    document.querySelectorAll('[data-price]').forEach((n) => {
      const t = bySymbol(n.dataset.price);
      const u = t ? priceUsd(t) : null;
      n.textContent = u !== null ? fmtUsd(u) : '—';
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
      const px = el('span', 'px', '—'); px.dataset.price = t.symbol;
      b.append(logoImg(t), el('b', null, t.symbol), el('small', null, t.name), px);
      b.addEventListener('click', () => selectToken('recv', t));
      return b;
    }));
    $('stock-count').textContent = STOCKS.length;
  }

  function buildMarket() {
    const grid = $('market-grid');
    const q = $('market-search').value.trim().toLowerCase();
    const items = STOCKS.filter((t) => !q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
    if (!items.length) { grid.replaceChildren(el('p', 'market-empty', 'No stock matches that search.')); return; }
    grid.replaceChildren(...items.map((t) => {
      const b = el('button', 'mkt');
      b.type = 'button';
      const text = el('span', 'mkt-text');
      text.append(el('b', null, t.symbol), el('small', null, t.name));
      const px = el('span', 'mkt-px');
      const val = el('span', null, '—'); val.dataset.price = t.symbol;
      px.append(val, el('small', null, 'Trade →'));
      b.append(logoImg(t), text, px);
      b.addEventListener('click', () => {
        if (state.pay === t) state.pay = ETH;
        selectToken('recv', t);
        $('swap').scrollIntoView({ behavior: 'smooth' });
      });
      return b;
    }));
    renderPrices();
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
    try { localStorage.setItem('bloom.slippage', String(v)); } catch { /* ignore */ }
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
  const navLinks = [...document.querySelectorAll('.main-nav a')];
  const navIo = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['swap', 'stocks', 'how', 'faq'].forEach((id) => $(id) && navIo.observe($(id)));

  /* ---------------- start ---------------- */

  /* ?simulate exposes the router for scripted dry-runs against the live chain;
     it can only read and build calldata, never sign or send. */
  if (new URLSearchParams(location.search).has('simulate')) {
    window.bloomSim = { tokens: TOKENS, bestQuote, quoteDetails, buildPlan, addresses: { UNIVERSAL_ROUTER, PERMIT2, CHAIN_ID: CHAIN.id } };
  }

  document.title = `${BRAND} — Swap tokenized stocks on ${CHAIN.name}`;
  $('stat-stocks').textContent = STOCKS.length;
  $('stat-pools').textContent = listed.reduce((n, t) => n + t.pools.length, 0);
  buildPicks();
  buildMarket();
  render();
  requestQuote(0);
  refreshPrices();
  setInterval(() => { if (!document.hidden) refreshPrices(); }, 30000);
  setInterval(() => { if (!document.hidden && state.account) refreshBalances(); }, 30000);
})();
