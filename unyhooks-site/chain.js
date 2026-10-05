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

  // Prices as DEX screens show them: 0.0₈1111 for 0.000000001111, 1.25M for big ones.
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const price = (v) => {
    if (!Number.isFinite(v)) return '—';
    if (v === 0) return '0';
    if (v >= 1e6) return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v);
    if (v >= 1e-4) return String(Number(v.toPrecision(4)));
    let zeros = Math.floor(-Math.log10(v));
    let digits = Math.round(v * 10 ** (zeros + 4));
    if (digits >= 10000) { digits = 1000; zeros -= 1; }
    return `0.0${String(zeros).split('').map((d) => SUB[d]).join('')}${String(digits).replace(/0+$/, '')}`;
  };

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

  // Logs over the whole chain. The public RPC answers at most 10 million blocks
  // per query, so it asks in slices.
  const allLogs = async (filter) => {
    const p = reader();
    const latest = await p.getBlockNumber();
    const span = 10_000_000;
    const slices = [];
    for (let to = latest; to > 0; to -= span) slices.push([Math.max(0, to - span + 1), to]);
    const logs = (await Promise.all(slices.map(([fromBlock, toBlock]) => p.getLogs({ ...filter, fromBlock, toBlock })))).flat();
    return logs.sort((x, y) => x.blockNumber - y.blockNumber || x.index - y.index);
  };

  // A pool's key from its ID, through the PoolManager's Initialize event.
  const findPool = async (id) => {
    const iface = new ethers.Interface(PM_ABI);
    const topic = iface.getEvent('Initialize').topicHash;
    const logs = await allLogs({ address: NET.poolManager, topics: [topic, id] });
    if (!logs.length) return null;
    const ev = iface.parseLog(logs[0]).args;
    return { currency0: ev.currency0, currency1: ev.currency1, fee: Number(ev.fee), tickSpacing: Number(ev.tickSpacing), hooks: ev.hooks };
  };

  /* ---------- launches and liquidity locks (launch-kit.js) ---------- */

  const LOCK_ABI = [
    'function owner() view returns (address)',
    'function unlockAt() view returns (uint256)',
    'function collectFees(uint256 tokenId)',
    'function withdraw(uint256 tokenId)',
    'function extend(uint256 newUnlockAt)',
    'event Locked(bytes32 indexed poolId, uint256 indexed tokenId, address indexed owner, uint256 unlockAt)',
    'error NotOwner()', 'error NotHeld()', 'error OnlyPositions()', 'error StillLocked(uint256 unlockAt)', 'error NotLater()'
  ];
  const POSITIONS_READ_ABI = [
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function getPositionLiquidity(uint256 tokenId) view returns (uint128)',
    'function safeTransferFrom(address from, address to, uint256 tokenId)'
  ];
  const kit = () => window.UnyLaunchKit || {};
  const codeHash = async (address) => ethers.keccak256(await reader().getCode(address));
  // Is this the UnyHooks token / lock, byte for byte? (Their code has no immutables.)
  const isGenuine = async (kind, address) => { try { return (await codeHash(address)) === (kit().CODEHASH || {})[kind]; } catch (_) { return false; } };

  // A lock's state, and whether it really is a LiquidityLock.
  const lockInfo = async (address) => {
    const c = new ethers.Contract(address, LOCK_ABI, reader());
    const [owner, unlockAt, genuine] = await Promise.all([c.owner(), c.unlockAt(), isGenuine('lock', address)]);
    return { address: ethers.getAddress(address), owner, unlockAt, genuine, forever: unlockAt === (kit().MAX_UINT256 || -1n) };
  };

  // Positions of a pool held by genuine locks: Locked events give candidates,
  // the PositionManager's ownerOf and the lock's code confirm them.
  const locksForPool = async (poolIdHex) => {
    const iface = new ethers.Interface(LOCK_ABI);
    const logs = await allLogs({ topics: [iface.getEvent('Locked').topicHash, poolIdHex] });
    const seen = new Map();
    for (const l of logs) {
      const ev = iface.parseLog(l);
      seen.set(`${l.address.toLowerCase()}:${ev.args.tokenId}`, { lock: ethers.getAddress(l.address), tokenId: ev.args.tokenId });
    }
    const posm = new ethers.Contract(NET.positionManager, POSITIONS_READ_ABI, reader());
    const out = [];
    for (const c of seen.values()) {
      try {
        if ((await posm.ownerOf(c.tokenId)) !== c.lock) continue;
        const info = await lockInfo(c.lock);
        if (!info.genuine) continue;
        out.push({ ...info, tokenId: c.tokenId.toString(), liquidity: await posm.getPositionLiquidity(c.tokenId) });
      } catch (_) { /* burned or not a lock */ }
    }
    return out;
  };

  // The Launched event for a hook, if it was launched with UnyLaunch.
  const launchOf = async (hook) => {
    if (!kit().LAUNCHED) return null;
    const iface = new ethers.Interface([kit().LAUNCHED]);
    const logs = await allLogs({ topics: [iface.getEvent('Launched').topicHash, null, null, ethers.zeroPadValue(hook, 32)] });
    if (!logs.length) return null;
    const ev = iface.parseLog(logs[0]).args;
    return { creator: ev.creator, token: ev.token, hook: ev.hook, poolId: ev.poolId, tokenId: ev.tokenId.toString(), lock: BigInt(ev.lock) === 0n ? null : ev.lock, tx: logs[0].transactionHash, launcher: logs[0].address, block: logs[0].blockNumber };
  };

  /* ---------- recognising a hook ---------- */

  // Reads the public settings UnyHooks templates expose; null when it is some other hook.
  const recognise = async (address) => {
    const r = reader();
    const call = (sig, ...args) => new ethers.Contract(address, [`function ${sig}`], r)[sig.split('(')[0]](...args);
    const tryAll = async (fns) => { try { return await Promise.all(fns.map((f) => f())); } catch (_) { return null; } };

    let v = await tryAll([() => call('FEE_BPS() view returns (uint256)'), () => call('recipient() view returns (address)')]);
    if (v) return { recipe: 'fee', contract: 'SwapFeeHook', settings: { feePercent: Number(v[0]) / 100, recipient: v[1] } };
    v = await tryAll([() => call('MIN_FEE() view returns (uint24)'), () => call('MAX_FEE() view returns (uint24)'), () => call('FULL_MOVE_TICKS() view returns (uint256)'), () => call('WINDOW() view returns (uint256)')]);
    if (v) return { recipe: 'dynamic', contract: 'DynamicFeeHook', settings: { floorPercent: Number(v[0]) / 10000, ceilingPercent: Number(v[1]) / 10000, fullMovePercent: Number(((1.0001 ** Number(v[2]) - 1) * 100).toFixed(1)), windowMinutes: Number(v[3]) / 60 } };
    v = await tryAll([() => call('LAUNCH_WINDOW() view returns (uint256)'), () => call('MAX_BUY() view returns (uint256)'), () => call('COOLDOWN() view returns (uint256)'), () => call('token() view returns (address)')]);
    if (v) return { recipe: 'launch', contract: 'LaunchGuardHook', settings: { windowMinutes: Number(v[0]) / 60, maxBuy: Number(M.fromUnits(v[1], 18, 18)), cooldownSeconds: Number(v[2]), token: v[3], pairDecimals: 18 } };
    v = await tryAll([() => call('OPEN_MINUTE() view returns (uint256)'), () => call('CLOSE_MINUTE() view returns (uint256)'), () => call('WEEKDAYS_ONLY() view returns (bool)')]);
    if (v) {
      const hhmm = (m) => `${String(Math.floor(Number(m) / 60)).padStart(2, '0')}:${String(Number(m) % 60).padStart(2, '0')}`;
      return { recipe: 'hours', contract: 'TradingHoursHook', settings: { open: hhmm(v[0]), close: hhmm(v[1]), weekdaysOnly: v[2] } };
    }
    return null;
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

  // Connects, asking which wallet when the browser has several. box: an element
  // for the choice; say(html, kind): where to talk to the person.
  const NO_WALLET = 'No browser wallet found. Install <a href="https://metamask.io/download/" target="_blank" rel="noopener">MetaMask</a> or <a href="https://phantom.com/download" target="_blank" rel="noopener">Phantom</a>, then reload this page. On a phone, open this page in your wallet app\'s browser.';
  const connectUI = (box, say) => new Promise((resolve, reject) => {
    if (session.signer) { resolve(session); return; }
    const wallets = W.list();
    if (!wallets.length) { say(NO_WALLET, 'error'); reject(Object.assign(new Error('No wallet'), { handled: true })); return; }
    const go = async (w) => {
      box.hidden = true;
      try { say(`Approve the connection in ${esc(w.name)}…`); await connect(w); say(''); resolve(session); } catch (err) { reject(err); }
    };
    if (wallets.length === 1) { go(wallets[0]); return; }
    box.innerHTML = wallets.map((w, i) => `<button type="button" class="dp-wallet" data-i="${i}">${w.icon ? `<img src="${esc(w.icon)}" alt="" width="22" height="22">` : ''}<span>${esc(w.name)}</span></button>`).join('');
    box.hidden = false;
    say('Pick your wallet.');
    box.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) go(wallets[Number(b.dataset.i)]); };
  });

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
    MarketClosed: 'This pool only trades during its hours.',
    StillLocked: 'This liquidity is still locked.',
    NotLater: 'The new date must be later than the current one.',
    NotOwner: 'Only the lock\'s owner can do that.',
    NoLiquidity: 'Add some ETH and tokens to the pool.'
  };
  const ERR_IFACES = [PM_ABI, POSM_ABI, PERMIT2_ABI, LOCK_ABI].map((a) => new ethers.Interface(a));

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
  const uniswapSwap = (token) => `https://app.uniswap.org/swap?${new URLSearchParams({ chain: NET.uniswapChain || 'robinhood', inputCurrency: 'NATIVE', outputCurrency: token })}`;
  const hookPage = (hook) => new URL(`hook.html?a=${ethers.getAddress(hook)}`, window.location.href).href;
  // "until 3 Jan 2027", "forever"
  const unlockText = (unlockAt) => {
    const v = BigInt(unlockAt);
    if (v === 0n) return 'not locked';
    if (v === (window.UnyLaunchKit || {}).MAX_UINT256) return 'forever';
    return `until ${new Date(Number(v) * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };
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

  /* ---------- compiling in the browser ---------- */

  // compile-worker.js in one shared worker; results kept per input.
  // job: { file, contract, source, extra?, want? } -> { abi, bytecode, input, version, contracts }
  let worker = null;
  let jobs = 0;
  const compiled = new Map();
  const compile = (job) => {
    const cacheKey = JSON.stringify([job.file, job.contract, job.source, job.extra || null, job.want || null]);
    if (compiled.has(cacheKey)) return Promise.resolve(compiled.get(cacheKey));
    if (!worker) worker = new Worker('compile-worker.js');
    const id = ++jobs;
    return new Promise((resolve, reject) => {
      const onMsg = (e) => {
        if (e.data.id !== id) return;
        worker.removeEventListener('message', onMsg);
        if (!e.data.ok) return reject(new Error(`It did not compile: ${e.data.error}`));
        compiled.set(cacheKey, e.data);
        resolve(e.data);
      };
      worker.addEventListener('message', onMsg);
      worker.addEventListener('error', (err) => reject(new Error(`The compiler failed to start: ${err.message || 'check your connection'}`)), { once: true });
      worker.postMessage({ id, file: job.file, contract: job.contract, source: job.source, extra: job.extra, want: job.want });
    });
  };
  const isCompiled = (job) => compiled.has(JSON.stringify([job.file, job.contract, job.source, job.extra || null, job.want || null]));

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
    CONFIG, NET, ZERO, ABI: { PM: PM_ABI, ERC20: ERC20_ABI, PERMIT2: PERMIT2_ABI, POSM: POSM_ABI, STATE_VIEW: STATE_VIEW_ABI, LOCK: LOCK_ABI, POSITIONS: POSITIONS_READ_ABI },
    esc, short, price, session, connect, connectUI, reader, tokenInfo, balanceOf, poolId, readPool, allLogs, findPool, explain,
    recognise, isGenuine, lockInfo, locksForPool, launchOf,
    explorer, link, uniswapAddLiquidity, uniswapPosition, uniswapSwap, hookPage, unlockText, dexscreenerPool, sourcifyPage,
    store, createPool, compile, isCompiled, sourcifyStatus, verify, isRejection: W.isRejection, wallets: W.list
  };
})();
