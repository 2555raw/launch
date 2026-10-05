/* UnyHooks — what the builder, the liquidity form and "My hooks" share.

   The wallet session, read access to Robinhood Chain, token and pool reads,
   error messages people can act on, the list of hooks this browser follows,
   links out (explorer, Uniswap, DexScreener, Sourcify), and publishing a
   hook's source on Sourcify. Needs ethers (window.ethers), wallet.js and
   pool-math.js. Exposes window.UnyChain. */

(() => {
  'use strict';

  const CONFIG = window.UNYHOOKS || {};
  const NET = CONFIG.NETWORK || {};
  const { ethers } = window;
  const W = window.UnyWallet;
  const M = window.UnyPoolMath;
  if (!ethers || !W || !M) return;

  const ZERO = ethers.ZeroAddress;
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  /* ---------- ABIs ---------- */

  const PM_ABI = [
    'function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) returns (int24 tick)',
    'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)',
    'error PoolAlreadyInitialized()',
    'error PoolNotInitialized()',
    'error CurrenciesOutOfOrderOrEqual(address currency0, address currency1)',
    'error TickSpacingTooLarge(int24 tickSpacing)',
    'error TickSpacingTooSmall(int24 tickSpacing)',
    'error LPFeeTooLarge(uint24 fee)',
    'error HookAddressNotValid(address hooks)',
    'error InvalidHookResponse()',
    'error WrappedError(address target, bytes4 selector, bytes reason, bytes details)'
  ];
  const STATE_VIEW_ABI = [
    'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
    'function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)'
  ];
  const ERC20_ABI = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)'
  ];
  const PERMIT2_ABI = [
    'function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
    'function approve(address token, address spender, uint160 amount, uint48 expiration)',
    'error AllowanceExpired(uint256 deadline)',
    'error InsufficientAllowance(uint256 amount)'
  ];
  const POSM_ABI = [
    'function modifyLiquidities(bytes unlockData, uint256 deadline) payable',
    'function nextTokenId() view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed id)',
    'error MaximumAmountExceeded(uint128 maximumAmount, uint128 amountRequested)',
    'error DeadlinePassed(uint256 deadline)',
    'error NotApproved(address caller)'
  ];

  /* ---------- reading the chain ---------- */

  let publicReader = null;
  const reader = () => session.browser
    || publicReader
    || (publicReader = new ethers.JsonRpcProvider(NET.rpcUrl, Number(NET.chainId), { staticNetwork: true }));

  const tokenCache = new Map();
  // { address, symbol, decimals }. ETH is the zero address. decimals() is required, symbol() is not.
  const tokenInfo = async (address) => {
    const a = ethers.getAddress(address);
    if (tokenCache.has(a)) return tokenCache.get(a);
    const known = (CONFIG.TOKENS || []).find((t) => t.address.toLowerCase() === a.toLowerCase());
    if (known) { const k = { ...known, address: a }; tokenCache.set(a, k); return k; }
    const c = new ethers.Contract(a, ERC20_ABI, reader());
    const decimals = Number(await c.decimals());
    const symbol = await c.symbol().catch(() => short(a));
    const info = { address: a, decimals, symbol };
    tokenCache.set(a, info);
    return info;
  };

  const balanceOf = async (token, owner) => (token === ZERO || BigInt(token) === 0n
    ? reader().getBalance(owner)
    : new ethers.Contract(token, ERC20_ABI, reader()).balanceOf(owner));

  const poolId = (key) => ethers.keccak256(coder.encode(
    ['address', 'address', 'uint24', 'int24', 'address'],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  ));

  const readPool = async (key) => {
    const sv = new ethers.Contract(NET.stateView, STATE_VIEW_ABI, reader());
    const id = poolId(key);
    const [slot, liquidity] = await Promise.all([sv.getSlot0(id), sv.getLiquidity(id)]);
    return { id, sqrtPriceX96: slot.sqrtPriceX96, tick: Number(slot.tick), lpFee: Number(slot.lpFee), liquidity };
  };

  // A pool's key from its ID, through the PoolManager's Initialize event. The
  // public RPC answers at most 10 million blocks per query, so it asks in slices.
  const findPool = async (id) => {
    const p = reader();
    const latest = await p.getBlockNumber();
    const iface = new ethers.Interface(PM_ABI);
    const topic = iface.getEvent('Initialize').topicHash;
    const span = 10_000_000;
    const slices = [];
    for (let to = latest; to > 0; to -= span) slices.push([Math.max(0, to - span + 1), to]);
    const logs = (await Promise.all(slices.map(([fromBlock, toBlock]) =>
      p.getLogs({ address: NET.poolManager, fromBlock, toBlock, topics: [topic, id] })))).flat();
    if (!logs.length) return null;
    const ev = iface.parseLog(logs[0]).args;
    return { currency0: ev.currency0, currency1: ev.currency1, fee: Number(ev.fee), tickSpacing: Number(ev.tickSpacing), hooks: ev.hooks };
  };

  /* ---------- the wallet session ---------- */

  const session = { eip1193: null, browser: null, signer: null, address: null, name: '' };

  const connect = async (wallet) => {
    const address = await W.connect(wallet.provider);
    const onChain = await W.ensureChain(wallet.provider);
    if (!onChain) throw new Error(`${wallet.name} is still on another network. Switch it to ${NET.name} and try again.`);
    session.eip1193 = wallet.provider;
    session.browser = new ethers.BrowserProvider(wallet.provider, 'any');
    session.signer = await session.browser.getSigner(address);
    session.address = ethers.getAddress(address);
    session.name = wallet.name;
    if (wallet.provider.on) {
      wallet.provider.on('accountsChanged', () => window.location.reload());
      wallet.provider.on('chainChanged', (id) => { if (parseInt(id, 16) !== Number(NET.chainId)) window.location.reload(); });
    }
    document.dispatchEvent(new CustomEvent('unyhooks:wallet', { detail: { ...session } }));
    return session;
  };

  /* ---------- explaining failures ---------- */

  const FRIENDLY = {
    PoolAlreadyInitialized: 'A pool with exactly this pair, fee and hook already exists.',
    PoolNotInitialized: 'That pool does not exist yet.',
    CurrenciesOutOfOrderOrEqual: 'The two tokens must be different.',
    MustUseDynamicFee: 'This hook needs a dynamic-fee pool.',
    TokenNotInPool: 'This launch hook only works in a pool that includes the token it protects.',
    HookAddressNotValid: 'The hook address does not match its permissions.',
    MaximumAmountExceeded: 'The price moved and the deposit needs more than you entered. Refresh the amounts and try again.',
    DeadlinePassed: 'The transaction waited too long in the wallet. Try again.',
    InsufficientAllowance: 'The token approval is too low. Approve again.',
    AllowanceExpired: 'The token approval expired. Approve again.',
    MarketClosed: 'This pool only trades during its hours.'
  };
  const ERR_IFACES = [PM_ABI, POSM_ABI, PERMIT2_ABI].map((a) => new ethers.Interface(a));

  const explain = (err, extraAbis = []) => {
    const data = err && (err.data || (err.info && err.info.error && err.info.error.data) || (err.error && err.error.data));
    const ifaces = [...ERR_IFACES, ...extraAbis.filter(Boolean).map((a) => new ethers.Interface(a))];
    const parse = (d) => { for (const i of ifaces) { try { const e = i.parseError(d); if (e) return e; } catch (_) { /* next */ } } return null; };
    if (typeof data === 'string' && data.length >= 10) {
      const top = parse(data);
      if (top && top.name === 'WrappedError') {
        const inner = parse(top.args.reason);
        return inner ? (FRIENDLY[inner.name] || `The hook refused: ${inner.name}.`) : 'The hook refused this.';
      }
      if (top) return FRIENDLY[top.name] || `Refused: ${top.name}.`;
    }
    if (/insufficient funds/i.test((err && (err.shortMessage || err.message)) || '')) return `Not enough ETH on ${NET.name} for this, including gas.`;
    return (err && (err.shortMessage || err.message)) || String(err);
  };

  /* ---------- links ---------- */

  const explorer = (kind, v) => `${NET.explorerUrl}/${kind}/${v}`;
  const link = (kind, v, text) => `<a href="${esc(explorer(kind, v))}" target="_blank" rel="noopener">${esc(text || short(v))}</a>`;
  const uniCurrency = (a) => (BigInt(a) === 0n ? 'NATIVE' : a);
  const uniswapAddLiquidity = (key) => `https://app.uniswap.org/positions/create/v4?${new URLSearchParams({
    chain: NET.uniswapChain || 'robinhood',
    currencyA: uniCurrency(key.currency0),
    currencyB: uniCurrency(key.currency1),
    fee: JSON.stringify({ feeAmount: key.fee, tickSpacing: key.tickSpacing, isDynamic: key.fee === 0x800000 }),
    hook: key.hooks
  })}`;
  const uniswapPosition = (tokenId) => `https://app.uniswap.org/positions/v4/${NET.uniswapChain || 'robinhood'}/${tokenId}`;
  const dexscreenerPool = (id) => `https://dexscreener.com/${NET.dexscreenerChain || 'robinhood'}/${id}`;
  const sourcifyPage = (address) => `https://repo.sourcify.dev/${NET.chainId}/${ethers.getAddress(address)}`;

  /* ---------- hooks this browser follows ---------- */

  // [{ address, chainId, recipe, settings, contract, file, source, compiler, input,
  //    tx, deployer, at, imported, verified, pools: [{ id, key, a, b, tx, at, positions: [{ tokenId, tx, at }] }] }]
  const STORE = 'unyhooks-deployed';
  const read = () => {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (_) { /* storage blocked */ }
    // Older records kept one pool in `pool`.
    return list.map((r) => ({ ...r, pools: r.pools || (r.pool ? [{ ...r.pool, positions: [] }] : []) }));
  };
  const write = (list) => {
    try { localStorage.setItem(STORE, JSON.stringify(list.slice(0, 30))); } catch (_) {
      // Too big (verification inputs are large): keep the list without them.
      try { localStorage.setItem(STORE, JSON.stringify(list.slice(0, 30).map((r) => ({ ...r, input: undefined })))); } catch (__) { /* storage blocked */ }
    }
  };
  const store = {
    all: () => read().filter((r) => r.chainId === Number(NET.chainId)),
    get: (address) => read().find((r) => r.address.toLowerCase() === String(address).toLowerCase()),
    put: (rec) => {
      const list = read().filter((r) => r.address.toLowerCase() !== rec.address.toLowerCase());
      list.unshift({ pools: [], ...rec });
      write(list);
      document.dispatchEvent(new CustomEvent('unyhooks:store'));
    },
    update: (address, fn) => {
      const list = read();
      const i = list.findIndex((r) => r.address.toLowerCase() === String(address).toLowerCase());
      if (i < 0) return null;
      list[i] = fn({ ...list[i] }) || list[i];
      write(list);
      document.dispatchEvent(new CustomEvent('unyhooks:store'));
      return list[i];
    },
    remove: (address) => { write(read().filter((r) => r.address.toLowerCase() !== String(address).toLowerCase())); document.dispatchEvent(new CustomEvent('unyhooks:store')); },
    addPool: (hookAddress, pool) => store.update(hookAddress, (r) => {
      r.pools = (r.pools || []).filter((p) => p.id !== pool.id);
      r.pools.unshift({ positions: [], ...pool });
      return r;
    }),
    addPosition: (hookAddress, id, position) => store.update(hookAddress, (r) => {
      const p = (r.pools || []).find((x) => x.id === id);
      if (p) p.positions = [position, ...(p.positions || []).filter((x) => String(x.tokenId) !== String(position.tokenId))];
      return r;
    })
  };

  /* ---------- creating a pool ---------- */

  const DYNAMIC_FEE_FLAG = 0x800000;
  const SPACING = { 100: 1, 500: 10, 3000: 60, 10000: 200 };

  // a, b: token infos; price: "1 A = price B" as text; fee: fee tier or 'dynamic'.
  const createPool = async ({ hook, a, b, price, fee, hookAbi, onStatus = () => {} }) => {
    const p = M.fraction(price);
    if (!p) throw new Error('Enter a starting price above zero, like 0.0001.');
    if (a.address.toLowerCase() === b.address.toLowerCase()) throw new Error('The two tokens must be different.');
    const dynamic = fee === 'dynamic';
    const feeValue = dynamic ? DYNAMIC_FEE_FLAG : Number(fee);
    const tickSpacing = dynamic ? 60 : SPACING[feeValue];
    const [c0, c1] = BigInt(a.address) < BigInt(b.address) ? [a.address, b.address] : [b.address, a.address];
    const key = { currency0: c0, currency1: c1, fee: feeValue, tickSpacing, hooks: hook };
    const sqrtPriceX96 = M.sqrtPriceFor(a, b, p);
    if (sqrtPriceX96 < M.MIN_SQRT_PRICE || sqrtPriceX96 >= M.MAX_SQRT_PRICE) throw new Error('That starting price is outside what Uniswap allows. Check the number and the token order.');

    const pm = new ethers.Contract(NET.poolManager, PM_ABI, session.signer);
    onStatus('Checking the pool before you sign…');
    try { await pm.initialize.staticCall(key, sqrtPriceX96); } catch (err) { throw new Error(explain(err, [hookAbi])); }
    onStatus('Confirm the pool in your wallet…');
    const tx = await pm.initialize(key, sqrtPriceX96);
    onStatus(`Waiting for ${NET.name}…`, tx.hash);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('The pool transaction failed on chain.');
    return { id: poolId(key), key, tx: tx.hash, a: { ...a }, b: { ...b }, price: price.trim(), at: new Date().toISOString() };
  };

  /* ---------- publishing source on Sourcify ---------- */

  const SOURCIFY = 'https://sourcify.dev/server';

  // Is the source already public? 'exact_match', 'match' or null.
  const sourcifyStatus = async (address) => {
    const res = await fetch(`${SOURCIFY}/v2/contract/${NET.chainId}/${address}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Sourcify answered ${res.status}`);
    const d = await res.json();
    return d.match || null;
  };

  // Sends the exact compiler input the hook was built from, then waits for the
  // result. A just-deployed contract can take a few seconds to show up for
  // Sourcify's own node, so "not deployed" is retried a few times.
  const verify = async ({ address, input, compiler, file, contract, tx }, onStatus = () => {}) => {
    const body = {
      stdJsonInput: input,
      compilerVersion: String(compiler).replace(/\.Emscripten\.clang$/, ''),
      contractIdentifier: `${file}:${contract}`,
      ...(tx ? { creationTransactionHash: tx } : {})
    };
    for (let attempt = 1; attempt <= 4; attempt++) {
      onStatus('Publishing the source on Sourcify…');
      const res = await fetch(`${SOURCIFY}/v2/verify/${NET.chainId}/${address}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      });
      const start = await res.json().catch(() => ({}));
      if (res.status === 409 || start.customCode === 'already_verified') return 'match';
      if (!start.verificationId) throw new Error(start.message || `Sourcify answered ${res.status}`);
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const job = await (await fetch(`${SOURCIFY}/v2/verify/${start.verificationId}`)).json();
        if (!job.isJobCompleted) continue;
        if (job.contract && job.contract.match) return job.contract.match;
        const code = job.error && job.error.customCode;
        if (code === 'already_verified') return 'match';
        if (code === 'contract_not_deployed' && attempt < 4) break;
        throw new Error((job.error && job.error.message) || 'Sourcify could not match the source.');
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error('Sourcify did not see the contract yet. Try again in a minute.');
  };

  window.UnyChain = {
    CONFIG, NET, ZERO, ABI: { PM: PM_ABI, ERC20: ERC20_ABI, PERMIT2: PERMIT2_ABI, POSM: POSM_ABI, STATE_VIEW: STATE_VIEW_ABI },
    esc, short, session, connect, reader, tokenInfo, balanceOf, poolId, readPool, findPool, explain,
    explorer, link, uniswapAddLiquidity, uniswapPosition, dexscreenerPool, sourcifyPage,
    store, createPool, sourcifyStatus, verify, isRejection: W.isRejection, wallets: W.list
  };
})();
