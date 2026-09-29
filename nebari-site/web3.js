// Nebari — everything that touches the chain.
//
// Read-only calls go through the public RPC in config.js so the pages work before a
// wallet is connected. Writes go through the injected wallet (EIP-1193, with EIP-6963
// discovery when several wallets are installed), after switching it to Robinhood Chain.
window.Nebari = (function () {
  'use strict';
  const C = window.NEBARI_CONFIG;
  const E = window.ethers;
  const ZERO = '0x0000000000000000000000000000000000000000';

  const LAUNCH_TUPLE = 'tuple(address token,address creator,address pair,tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,int24 tickLower,int24 tickUpper,uint128 liquidity,uint64 createdAt,uint160 startSqrtPriceX96)';
  const KEY_TUPLE = 'tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)';

  const ABI = {
    factory: [
      'function tokenCount() view returns (uint256)',
      'function tokenAt(uint256) view returns (address)',
      `function getLaunch(address) view returns (${LAUNCH_TUPLE})`,
      `function getLaunches(uint256,uint256) view returns (${LAUNCH_TUPLE}[])`,
      'function launch(string name,string symbol,string metadataURI,address pair,uint256 startPrice) returns (address)',
      'function collectFees(address token)',
      'function protocolBps() view returns (uint256)',
      'function treasury() view returns (address)',
      'function poolManager() view returns (address)',
      'event Launched(address indexed token,address indexed creator,address indexed pair,bytes32 poolId,string name,string symbol,string metadataURI,uint160 sqrtPriceX96)',
      'event FeesCollected(address indexed token,uint256 pairAmount,uint256 toHolders,uint256 toCreator,uint256 toProtocol,uint256 burned)',
      'error BadPrice()', 'error PairIsToken()', 'error UnknownToken()', 'error NotPoolManager()',
    ],
    token: [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)',
      'function balanceOf(address) view returns (uint256)',
      'function allowance(address,address) view returns (uint256)',
      'function approve(address,uint256) returns (bool)',
      'function transfer(address,uint256) returns (bool)',
      'function claimable(address) view returns (uint256)',
      'function accumulated(address) view returns (uint256)',
      'function totalDistributed() view returns (uint256)',
      'function circulatingSupply() view returns (uint256)',
      'function metadataURI() view returns (string)',
      'function creator() view returns (address)',
      'function rewardCurrency() view returns (address)',
      'function claim() returns (uint256)',
      'error NothingToClaim()',
    ],
    erc20: [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function balanceOf(address) view returns (uint256)',
      'function allowance(address,address) view returns (uint256)',
      'function approve(address,uint256) returns (bool)',
    ],
    router: [
      `function swapExactIn(${KEY_TUPLE} key,bool zeroForOne,uint256 amountIn,uint256 minOut,address to) payable returns (uint256)`,
      `function quoteExactIn(${KEY_TUPLE} key,bool zeroForOne,uint256 amountIn) returns (uint256)`,
      'error Slippage(uint256 got,uint256 minOut)', 'error WrongValue()',
    ],
    poolManager: [
      'function extsload(bytes32) view returns (bytes32)',
      'function extsload(bytes32,uint256) view returns (bytes32[])',
    ],
  };

  // ------------------------------------------------------------ providers

  let readProvider;
  function provider() {
    if (!readProvider) {
      readProvider = new E.JsonRpcProvider(C.network.rpc, { chainId: C.network.chainId, name: C.network.name }, { staticNetwork: true, batchMaxCount: 10 });
    }
    return readProvider;
  }

  const wallet = { account: null, eip1193: null, browser: null, chainId: null, name: null };
  const listeners = new Set();
  function emit() { listeners.forEach((f) => { try { f(wallet); } catch (e) { console.error(e); } }); }
  function onWallet(f) { listeners.add(f); return () => listeners.delete(f); }

  // EIP-6963: collect every wallet that announces itself
  const discovered = [];
  if (typeof window !== 'undefined') {
    window.addEventListener('eip6963:announceProvider', (ev) => {
      const d = ev.detail;
      if (d && d.provider && !discovered.some((x) => x.info.uuid === d.info.uuid)) discovered.push(d);
    });
    try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch (_) { /* ignore */ }
  }

  function chooseWallet() {
    return new Promise((resolve, reject) => {
      const list = discovered.slice();
      if (list.length === 0) {
        if (window.ethereum) return resolve({ provider: window.ethereum, info: { name: 'Browser wallet' } });
        return reject(new Error('No wallet found. Install MetaMask, Rabby or Coinbase Wallet and reload.'));
      }
      if (list.length === 1) return resolve(list[0]);
      const box = document.createElement('div');
      box.className = 'chooser';
      box.innerHTML = '<div class="chooser-box"><h3>Choose a wallet</h3></div>';
      const inner = box.firstChild;
      list.forEach((d) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = `<img alt="" src="${d.info.icon}"><span>${d.info.name}</span>`;
        b.onclick = () => { box.remove(); resolve(d); };
        inner.appendChild(b);
      });
      const cancel = document.createElement('button');
      cancel.type = 'button'; cancel.textContent = 'Cancel';
      cancel.onclick = () => { box.remove(); reject(new Error('Cancelled')); };
      inner.appendChild(cancel);
      document.body.appendChild(box);
    });
  }

  async function ensureChain(p) {
    const current = await p.request({ method: 'eth_chainId' });
    if (parseInt(current, 16) === C.network.chainId) return;
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: C.network.chainIdHex }] });
    } catch (e) {
      const code = e && (e.code || (e.data && e.data.originalError && e.data.originalError.code));
      if (code === 4902 || /unrecognized|not added|add(ed)? the chain|Unrecognized chain/i.test(String(e && e.message))) {
        await p.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: C.network.chainIdHex, chainName: C.network.name, rpcUrls: [C.network.rpc],
            nativeCurrency: C.network.currency, blockExplorerUrls: [C.network.explorer],
          }],
        });
      } else {
        throw e;
      }
    }
  }

  async function connect() {
    const d = await chooseWallet();
    const p = d.provider;
    const accounts = await p.request({ method: 'eth_requestAccounts' });
    await ensureChain(p);
    wallet.eip1193 = p;
    wallet.browser = new E.BrowserProvider(p, 'any');
    wallet.account = E.getAddress(accounts[0]);
    wallet.chainId = parseInt(await p.request({ method: 'eth_chainId' }), 16);
    wallet.name = d.info.name;
    p.on && p.on('accountsChanged', (a) => { wallet.account = a && a[0] ? E.getAddress(a[0]) : null; emit(); });
    p.on && p.on('chainChanged', (id) => { wallet.chainId = parseInt(id, 16); emit(); });
    try { localStorage.setItem('nebari:wallet', '1'); } catch (_) { /* ignore */ }
    emit();
    return wallet;
  }

  function disconnect() {
    wallet.account = null; wallet.browser = null; wallet.eip1193 = null;
    try { localStorage.removeItem('nebari:wallet'); } catch (_) { /* ignore */ }
    emit();
  }

  // reconnect quietly if the user connected before
  async function autoConnect() {
    let want = false;
    try { want = localStorage.getItem('nebari:wallet') === '1'; } catch (_) { /* ignore */ }
    if (!want) return;
    await new Promise((r) => setTimeout(r, 150)); // give EIP-6963 wallets a beat to announce
    const d = discovered[0] || (window.ethereum ? { provider: window.ethereum, info: { name: 'Browser wallet' } } : null);
    if (!d) return;
    try {
      const accounts = await d.provider.request({ method: 'eth_accounts' });
      if (!accounts || !accounts.length) return;
      wallet.eip1193 = d.provider;
      wallet.browser = new E.BrowserProvider(d.provider, 'any');
      wallet.account = E.getAddress(accounts[0]);
      wallet.chainId = parseInt(await d.provider.request({ method: 'eth_chainId' }), 16);
      wallet.name = d.info.name;
      d.provider.on && d.provider.on('accountsChanged', (a) => { wallet.account = a && a[0] ? E.getAddress(a[0]) : null; emit(); });
      d.provider.on && d.provider.on('chainChanged', (id) => { wallet.chainId = parseInt(id, 16); emit(); });
      emit();
    } catch (e) { console.warn('auto connect failed', e); }
  }

  async function signer() {
    if (!wallet.browser) await connect();
    await ensureChain(wallet.eip1193);
    wallet.chainId = C.network.chainId;
    return wallet.browser.getSigner();
  }

  // ------------------------------------------------------------ contracts

  const configured = () => !!(C.factory && C.factory !== ZERO);
  const factory = (s) => new E.Contract(C.factory, ABI.factory, s || provider());
  const router = (s) => new E.Contract(C.router, ABI.router, s || provider());
  const token = (addr, s) => new E.Contract(addr, ABI.token, s || provider());
  const erc20 = (addr, s) => new E.Contract(addr, ABI.erc20, s || provider());
  const poolManager = () => new E.Contract(C.poolManager, ABI.poolManager, provider());

  function poolId(key) {
    return E.keccak256(E.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]));
  }
  function stateSlot(id) { return E.keccak256(E.concat([id, E.zeroPadValue('0x06', 32)])); }

  async function slot0(id) {
    const w = await poolManager()['extsload(bytes32)'](stateSlot(id));
    const v = BigInt(w);
    return { sqrtPriceX96: v & ((1n << 160n) - 1n), tick: Number(BigInt.asIntN(24, (v >> 160n) & 0xffffffn)) };
  }
  async function feeGrowth(id) {
    const base = BigInt(stateSlot(id)) + 1n;
    const words = await poolManager()['extsload(bytes32,uint256)'](E.toBeHex(base, 32), 2);
    return [BigInt(words[0]), BigInt(words[1])];
  }

  // ------------------------------------------------------------- assets

  const assetCache = new Map();
  async function resolveAsset(address) {
    const a = (address || ZERO).toLowerCase();
    if (a === ZERO) return { address: ZERO, symbol: 'ETH', name: 'Ether', decimals: 18, native: true };
    if (assetCache.has(a)) return assetCache.get(a);
    const c = erc20(address);
    const p = Promise.all([c.symbol(), c.name(), c.decimals()]).then(([symbol, name, decimals]) => ({ address: E.getAddress(address), symbol, name, decimals: Number(decimals), native: false }));
    assetCache.set(a, p);
    try { return await p; } catch (e) { assetCache.delete(a); throw e; }
  }

  let picksPromise;
  // Quick picks whose on-chain symbol matches config, so a stale address never shows.
  function quickPicks() {
    if (!picksPromise) {
      picksPromise = Promise.all(C.quickPicks.map(async (p) => {
        if (p.address === ZERO) return { ...p, verified: true };
        try {
          const a = await resolveAsset(p.address);
          if (a.symbol.toUpperCase().replace(/[^A-Z]/g, '').startsWith(p.symbol.toUpperCase())) return { ...p, name: p.name || a.name, decimals: a.decimals, verified: true };
          console.warn('quick pick hidden, symbol mismatch', p.symbol, a.symbol, p.address);
          return { ...p, verified: false };
        } catch (e) {
          // a revert means no such token; anything else means the RPC could not be reached
          const noCode = e && (e.code === 'BAD_DATA' || e.code === 'CALL_EXCEPTION');
          if (noCode) { console.warn('quick pick hidden, not a token', p.symbol, p.address); return { ...p, verified: false }; }
          return { ...p, verified: true, unchecked: true };
        }
      })).then((list) => {
        if (list.some((p) => p.unchecked)) console.warn('RPC unreachable, quick picks shown unverified');
        return list;
      });
    }
    return picksPromise;
  }

  // --------------------------------------------------------------- math

  const Q96 = 2n ** 96n;
  const Q192 = 2n ** 192n;

  // sqrtPriceX96 -> pair units per whole token, as a float
  function priceFromSqrt(sqrtPriceX96, tokenIsZero, pairDecimals) {
    const s = Number(sqrtPriceX96) / Number(Q96);
    const raw = s * s; // currency1 per currency0, raw units
    const pairPerTokenRaw = tokenIsZero ? raw : 1 / raw;
    return pairPerTokenRaw * Math.pow(10, 18 - pairDecimals);
  }

  // pair units per token (float) -> startPrice in raw pair units per 1e18 tokens (bigint)
  function startPriceRaw(pairPerToken, pairDecimals) {
    const v = Number(pairPerToken);
    if (!(v > 0)) throw new Error('Start price must be above zero');
    const scaled = v * Math.pow(10, pairDecimals);
    if (scaled < 1) throw new Error('That price is below one raw unit of the pair asset. Raise it.');
    return BigInt(Math.round(scaled));
  }

  async function tokenStats(L) {
    const tokenIsZero = L.key.currency0.toLowerCase() === L.token.toLowerCase();
    const pair = await resolveAsset(L.pair);
    const id = poolId(L.key);
    const [s0, fg, t] = await Promise.all([slot0(id), feeGrowth(id), (async () => {
      const c = token(L.token);
      const [name, symbol, totalSupply, totalDistributed, metadataURI] = await Promise.all([c.name(), c.symbol(), c.totalSupply(), c.totalDistributed(), c.metadataURI()]);
      return { name, symbol, totalSupply, totalDistributed, metadataURI };
    })()]);
    const price = priceFromSqrt(s0.sqrtPriceX96, tokenIsZero, pair.decimals);
    const startPrice = priceFromSqrt(L.startSqrtPriceX96, tokenIsZero, pair.decimals);
    const supply = Number(E.formatUnits(t.totalSupply, 18));
    const L128 = Number(L.liquidity);
    // fees the locked position has earned, in each currency, from the global growth counters
    const feePairRaw = Number(tokenIsZero ? fg[1] : fg[0]) * L128 / Math.pow(2, 128);
    const feeTokenRaw = Number(tokenIsZero ? fg[0] : fg[1]) * L128 / Math.pow(2, 128);
    const feePair = feePairRaw / Math.pow(10, pair.decimals);
    const feeToken = feeTokenRaw / 1e18;
    const feeRate = Number(L.key.fee) / 1e6;
    const volume = feePair / feeRate + (feeToken / feeRate) * price; // buy side + sell side, in pair units
    const marketCap = price * supply;
    const startCap = startPrice * 1e9;
    const ratio = startCap > 0 ? volume / startCap : 0;
    const growth = Math.min(1, 0.2 + 0.8 * Math.min(1, Math.log10(1 + 9 * ratio)));
    let meta = {};
    try { if (t.metadataURI.startsWith('data:,')) meta = JSON.parse(decodeURIComponent(t.metadataURI.slice(6))); } catch (_) { meta = {}; }
    return { ...t, pair, tokenIsZero, price, startPrice, supply, marketCap, volume, feePair, feeToken, growth, tick: s0.tick, sqrtPriceX96: s0.sqrtPriceX96, meta, poolId: id };
  }

  // ------------------------------------------------------------ helpers

  function explainError(e) {
    if (!e) return 'Unknown error';
    if (e.code === 'ACTION_REJECTED' || e.code === 4001) return 'You rejected the request in your wallet.';
    if (e.code === 'INSUFFICIENT_FUNDS') return 'Not enough ETH for gas.';
    const data = e.data || (e.info && e.info.error && e.info.error.data);
    if (typeof data === 'string' && data.length >= 10) {
      for (const abi of [ABI.factory, ABI.token, ABI.router]) {
        try { const parsed = new E.Interface(abi).parseError(data); if (parsed) return 'Reverted: ' + parsed.name + (parsed.args.length ? ' ' + parsed.args.map(String).join(', ') : ''); } catch (_) { /* next */ }
      }
    }
    return e.shortMessage || e.reason || (e.info && e.info.error && e.info.error.message) || e.message || String(e);
  }

  const fmt = {
    addr: (a) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : ''),
    units: (v, d, max) => {
      const n = Number(E.formatUnits(v, d));
      return fmt.num(n, max);
    },
    num: (n, max) => {
      if (!isFinite(n)) return '–';
      if (n === 0) return '0';
      const abs = Math.abs(n);
      // 999,999,999.9 rounds to "1000.00M"; show it as billions instead
      if (abs >= 1e9 || abs / 1e6 >= 999.995) return (n / 1e9).toFixed(2) + 'B';
      if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
      if (abs >= 1e3) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
      if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: max == null ? 4 : max });
      return n.toLocaleString(undefined, { maximumSignificantDigits: 4 });
    },
    txLink: (hash) => `${C.network.explorer}/tx/${hash}`,
    addrLink: (a) => `${C.network.explorer}/address/${a}`,
    tokenLink: (a) => `${C.network.explorer}/token/${a}`,
  };

  return {
    C, ZERO, ABI, provider, wallet, onWallet, connect, disconnect, autoConnect, signer, ensureChain,
    configured, factory, router, token, erc20, poolManager, poolId, slot0, feeGrowth,
    resolveAsset, quickPicks, priceFromSqrt, startPriceRaw, tokenStats, explainError, fmt,
  };
})();
