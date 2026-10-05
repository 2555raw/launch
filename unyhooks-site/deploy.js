/* UnyHooks builder — deploying from the browser.

   1. Connect a wallet and move it to Robinhood Chain (wallet.js).
   2. Compile the hook on screen (compile-worker.js), encode its constructor
      arguments, search CREATE2 salts until the hook's address carries its
      permission bits, dry-run the deployment, then send it through the
      standard CREATE2 deployer. One signature.
   3. Create the pool: PoolManager.initialize with the pair, fee, tick spacing,
      the hook and a starting price. One signature.

   Nothing is signed or sent without the wallet asking first. Hooks deployed
   from this browser are remembered locally so a reload does not lose them. */

(() => {
  'use strict';

  const CONFIG = window.UNYHOOKS || {};
  const NET = CONFIG.NETWORK || {};
  const { ethers } = window;
  const W = window.UnyWallet;

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const link = (kind, v, text) => `<a href="${esc(`${NET.explorerUrl}/${kind}/${v}`)}" target="_blank" rel="noopener">${esc(text || short(v))}</a>`;

  const msgEl = $('#dp-msg');
  const say = (html, kind = '') => {
    msgEl.innerHTML = html;
    msgEl.className = `dp-msg${kind ? ` is-${kind}` : ''}`;
  };

  if (!ethers || !W || !$('#deploy')) {
    if (msgEl) say('The wallet library did not load, so deploying is off. Check your connection and reload the page.', 'error');
    return;
  }

  const coder = ethers.AbiCoder.defaultAbiCoder();
  const ZERO = ethers.ZeroAddress;
  const MIN_SQRT_PRICE = 4295128739n;
  const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;
  const DYNAMIC_FEE_FLAG = 0x800000;
  const SPACING = { 500: 10, 3000: 60, 10000: 200 };

  const PM_ABI = [
    'function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) returns (int24 tick)',
    'error PoolAlreadyInitialized()',
    'error CurrenciesOutOfOrderOrEqual(address currency0, address currency1)',
    'error TickSpacingTooLarge(int24 tickSpacing)',
    'error TickSpacingTooSmall(int24 tickSpacing)',
    'error LPFeeTooLarge(uint24 fee)',
    'error HookAddressNotValid(address hooks)',
    'error InvalidHookResponse()',
    'error WrappedError(address target, bytes4 selector, bytes reason, bytes details)'
  ];
  const ERC20_ABI = ['function decimals() view returns (uint8)', 'function symbol() view returns (string)'];

  /* ---------- state ---------- */

  const session = { eip1193: null, browser: null, signer: null, address: null, name: '' };
  let view = window.UnyBuild ? window.UnyBuild.current() : null;
  let deployed = null;   // the hook deployed from here: { address, tx, recipe, settings, contract, source, abi }
  let busy = false;

  const STORE = 'unyhooks-deployed';
  const loadDeployed = () => { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (_) { return []; } };
  const remember = (rec) => {
    try {
      const all = loadDeployed().filter((r) => r.address !== rec.address);
      all.unshift(rec);
      localStorage.setItem(STORE, JSON.stringify(all.slice(0, 20)));
    } catch (_) { /* storage blocked */ }
  };

  const reader = () => session.browser || new ethers.JsonRpcProvider(NET.rpcUrl, Number(NET.chainId), { staticNetwork: true });

  /* ---------- steps ---------- */

  const step = (id, state) => { $(`#dp-step-${id}`).dataset.state = state; };
  const setBusy = (on) => {
    busy = on;
    $('#dp-deploy').disabled = on || !canDeploy();
    $('#dp-create').disabled = on || !deployed || !session.signer;
    $('#dp-connect').disabled = on;
  };
  const canDeploy = () => !!(session.signer && view && view.hook && view.hook.problems.length === 0);

  const refreshHookStep = () => {
    const btn = $('#dp-deploy');
    const note = $('#dp-hook-note');
    btn.disabled = busy || !canDeploy();
    if (!view) return;
    const changed = deployed && deployed.source !== view.hook.source;
    if (deployed && !changed) {
      step('hook', 'done');
      btn.textContent = 'Deployed';
      btn.disabled = true;
      return;
    }
    btn.textContent = deployed ? 'Deploy new version' : 'Deploy hook';
    if (view.hook.problems.length) {
      note.textContent = `Finish the settings first: ${view.hook.problems[0]}`;
      step('hook', session.signer ? 'active' : 'todo');
    } else if (changed) {
      note.textContent = 'You changed the hook after deploying it. Deploy the new version to use it; the deployed one stays as it is.';
      step('hook', 'active');
    } else {
      note.textContent = 'Compiles in your browser, finds an address with the right permission bits, then asks for one signature.';
      step('hook', session.signer ? 'active' : 'todo');
    }
  };

  document.addEventListener('unyhooks:hook', (e) => {
    view = e.detail;
    refreshHookStep();
    if (!deployed) prefillPool();
  });

  /* ---------- 1. connect ---------- */

  const showAccount = () => {
    $('#dp-account').innerHTML = session.address ? `${esc(session.name)} · ${link('address', session.address)}` : '';
    const chip = $('#wallet');
    if (chip && session.address) {
      chip.classList.add('is-on');
      chip.innerHTML = `<code>${esc(short(session.address))}</code>`;
      chip.title = session.address;
    }
  };

  const connectWith = async (w) => {
    $('#dp-wallets').hidden = true;
    setBusy(true);
    say('');
    try {
      say(`Approve the connection in ${esc(w.name)}…`);
      const address = await W.connect(w.provider);
      say(`Switching ${esc(w.name)} to ${esc(NET.name)}…`);
      const onChain = await W.ensureChain(w.provider);
      if (!onChain) throw new Error(`${w.name} is still on another network. Switch it to ${NET.name} and try again.`);
      session.eip1193 = w.provider;
      session.browser = new ethers.BrowserProvider(w.provider, 'any');
      session.signer = await session.browser.getSigner(address);
      session.address = ethers.getAddress(address);
      session.name = w.name;
      step('connect', 'done');
      $('#dp-connect').textContent = 'Connected';
      $('#dp-connect-note').textContent = `${short(session.address)} on ${NET.name}.`;
      showAccount();
      say('');
      if (w.provider.on) {
        w.provider.on('accountsChanged', () => window.location.reload());
        w.provider.on('chainChanged', (id) => { if (parseInt(id, 16) !== Number(NET.chainId)) window.location.reload(); });
      }
      const bal = await session.browser.getBalance(session.address);
      if (bal === 0n) say(`This wallet has no ETH on ${esc(NET.name)}, and deploying needs a little for gas. Bridge some in first.`, 'warn');
    } catch (err) {
      say(W.isRejection(err) ? 'Connection cancelled in the wallet.' : esc(err.shortMessage || err.message || String(err)), W.isRejection(err) ? '' : 'error');
    } finally {
      setBusy(false);
      refreshHookStep();
    }
  };

  const openConnect = () => {
    if (session.signer) return;
    const wallets = W.list();
    if (!wallets.length) {
      say('No browser wallet found. Install <a href="https://metamask.io/download/" target="_blank" rel="noopener">MetaMask</a> or <a href="https://phantom.com/download" target="_blank" rel="noopener">Phantom</a>, then reload this page. On a phone, open this page in your wallet app\'s browser.', 'error');
      return;
    }
    if (wallets.length === 1) { connectWith(wallets[0]); return; }
    const box = $('#dp-wallets');
    box.innerHTML = wallets.map((w, i) =>
      `<button type="button" class="dp-wallet" data-i="${i}">${w.icon ? `<img src="${esc(w.icon)}" alt="" width="22" height="22">` : ''}<span>${esc(w.name)}</span></button>`
    ).join('');
    box.hidden = false;
    box.onclick = (e) => {
      const b = e.target.closest('[data-i]');
      if (b) connectWith(wallets[Number(b.dataset.i)]);
    };
  };

  $('#dp-connect').addEventListener('click', openConnect);
  const chip = $('#wallet');
  if (chip) chip.addEventListener('click', (e) => {
    e.preventDefault();
    if (!session.signer) {
      $('#deploy').scrollIntoView({ behavior: 'smooth', block: 'start' });
      openConnect();
    }
  });

  /* ---------- 2. deploy the hook ---------- */

  let worker = null;
  const compiled = new Map();
  let jobs = 0;
  const compile = (hook) => {
    if (compiled.has(hook.source)) return Promise.resolve(compiled.get(hook.source));
    if (!worker) worker = new Worker('compile-worker.js');
    const id = ++jobs;
    return new Promise((resolve, reject) => {
      const onMsg = (e) => {
        if (e.data.id !== id) return;
        worker.removeEventListener('message', onMsg);
        if (!e.data.ok) return reject(new Error(`The hook did not compile: ${e.data.error}`));
        compiled.set(hook.source, e.data);
        resolve(e.data);
      };
      worker.addEventListener('message', onMsg);
      worker.addEventListener('error', (err) => reject(new Error(`The compiler failed to start: ${err.message || 'check your connection'}`)), { once: true });
      worker.postMessage({ id, file: hook.file, contract: hook.contract, source: hook.source });
    });
  };

  // Searches salts until the CREATE2 address ends in the hook's permission
  // bits and nothing is deployed there yet. About 16,000 tries on average.
  const mine = async (initHash, flags, provider, onProgress) => {
    const want = BigInt(flags);
    const start = BigInt(Math.floor(Math.random() * 2 ** 40)) << 32n;
    for (let i = 0n; i < 5_000_000n; i++) {
      const salt = ethers.zeroPadValue(ethers.toBeHex(start + i), 32);
      const addr = ethers.getCreate2Address(NET.create2Deployer, salt, initHash);
      if ((BigInt(addr) & 0x3fffn) === want) {
        if ((await provider.getCode(addr)) === '0x') return { salt, address: addr, tries: Number(i) + 1 };
      }
      if (i % 2000n === 0n) {
        onProgress(Number(i));
        await new Promise((r) => setTimeout(r));
      }
    }
    throw new Error('Could not find a free hook address. Try again.');
  };

  const deploy = async () => {
    if (!canDeploy() || busy) return;
    const hook = view.hook;
    const snapshot = { recipe: view.recipe, settings: view.settings };
    setBusy(true);
    step('hook', 'busy');
    const note = $('#dp-hook-note');
    say('');
    try {
      note.textContent = compiled.has(hook.source)
        ? 'Compiling…'
        : 'Compiling in your browser. The first time this downloads the Solidity compiler (about 9 MB).';
      const c = await compile(hook);

      const types = ['address', ...hook.args.map((a) => a.type)];
      const values = [NET.poolManager, ...hook.args.map((a) => ethers.getAddress(a.value))];
      const initcode = ethers.concat([c.bytecode, coder.encode(types, values)]);

      note.textContent = 'Finding an address with the right permission bits…';
      const found = await mine(ethers.keccak256(initcode), hook.flags, session.browser, (n) => {
        note.textContent = `Finding an address with the right permission bits… ${n.toLocaleString()} tried`;
      });
      const data = ethers.concat([found.salt, initcode]);

      note.textContent = 'Checking the deployment before you sign…';
      let landed;
      try {
        landed = await session.browser.call({ from: session.address, to: NET.create2Deployer, data });
      } catch (err) {
        throw new Error(`A dry run of the deployment failed, so nothing was sent. ${err.shortMessage || err.message}`);
      }
      if (!landed || landed.toLowerCase() !== found.address.toLowerCase()) {
        throw new Error('A dry run of the deployment did not land on the expected address, so nothing was sent.');
      }

      note.textContent = 'Confirm the deployment in your wallet…';
      const tx = await session.signer.sendTransaction({ to: NET.create2Deployer, data });
      note.innerHTML = `Waiting for ${esc(NET.name)}… ${link('tx', tx.hash, 'view transaction')}`;
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('The deployment transaction failed on chain.');
      if ((await session.browser.getCode(found.address)) === '0x') throw new Error(`The transaction went through but there is no contract at ${found.address}.`);

      deployed = {
        address: found.address, tx: tx.hash, chainId: Number(NET.chainId),
        recipe: snapshot.recipe, settings: snapshot.settings,
        contract: hook.contract, file: hook.file, source: hook.source, abi: c.abi,
        compiler: c.version, input: c.input, at: new Date().toISOString()
      };
      remember({ ...deployed, input: undefined });
      showDeployed();
      prefillPool();
      say('');
    } catch (err) {
      step('hook', 'active');
      say(W.isRejection(err) ? 'Deployment cancelled in the wallet. Nothing was sent.' : esc(err.shortMessage || err.message || String(err)), W.isRejection(err) ? '' : 'error');
      refreshHookStep();
    } finally {
      setBusy(false);
      refreshHookStep();
    }
  };

  const verificationFile = () => {
    if (!deployed || !deployed.input) return;
    const blob = new Blob([JSON.stringify(deployed.input, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deployed.contract}-standard-input.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const showDeployed = () => {
    const box = $('#dp-hook-result');
    box.hidden = false;
    box.innerHTML = `
      <p><b>${esc(deployed.contract)}</b> is live at ${link('address', deployed.address, deployed.address)}</p>
      <p class="dp-links">${link('tx', deployed.tx, 'Deployment transaction')}${deployed.input ? ' · <button type="button" class="dp-linkbtn" id="dp-verify">Download verification file</button>' : ''}</p>
      ${deployed.input ? `<p class="dp-note">To publish the source on the explorer: open the hook there, choose Verify &amp; publish, then "Solidity (Standard JSON input)", compiler ${esc(deployed.compiler.replace('.Emscripten.clang', ''))}, and upload that file.</p>` : ''}`;
    const v = $('#dp-verify');
    if (v) v.addEventListener('click', verificationFile);
    step('hook', 'done');
    $('#dp-pool').hidden = false;
    step('pool', 'active');
    setBusy(false);
  };

  $('#dp-deploy').addEventListener('click', deploy);

  /* ---------- 3. create the pool ---------- */

  const tokenCache = new Map();
  const tokenInfo = async (address) => {
    const a = ethers.getAddress(address);
    if (tokenCache.has(a)) return tokenCache.get(a);
    const known = (CONFIG.TOKENS || []).find((t) => t.address.toLowerCase() === a.toLowerCase());
    if (known) { tokenCache.set(a, known); return known; }
    const c = new ethers.Contract(a, ERC20_ABI, reader());
    // decimals() is needed for the price; a token without symbol() still works.
    const decimals = await c.decimals();
    const symbol = await c.symbol().catch(() => short(a));
    const info = { address: a, decimals: Number(decimals), symbol };
    tokenCache.set(a, info);
    return info;
  };

  const showToken = async (inputId, infoId) => {
    const el = $(infoId);
    const v = $(inputId).value.trim();
    if (!v) { el.textContent = ''; return null; }
    if (!ethers.isAddress(v)) { el.textContent = 'That is not an address (0x followed by 40 characters).'; el.className = 'dp-token-info is-bad'; return null; }
    el.textContent = 'Reading the token…';
    el.className = 'dp-token-info';
    try {
      const t = await tokenInfo(v);
      el.textContent = `${t.symbol} · ${t.decimals} decimals`;
      return t;
    } catch (_) {
      el.textContent = `No token found at that address on ${NET.name}.`;
      el.className = 'dp-token-info is-bad';
      return null;
    }
  };

  const syncPriceUnit = async () => {
    const [a, b] = await Promise.all([showToken('#dp-token-a', '#dp-token-a-info'), showToken('#dp-token-b', '#dp-token-b-info')]);
    $('#dp-price-pre').textContent = `1 ${a ? a.symbol : 'token'} =`;
    $('#dp-price-unit').textContent = b ? b.symbol : '';
  };

  $('#dp-picks').innerHTML = (CONFIG.TOKENS || []).map((t) =>
    `<button type="button" class="dp-pick" data-address="${esc(t.address)}">${esc(t.symbol)}</button>`).join('');
  $('#dp-picks').addEventListener('click', (e) => {
    const b = e.target.closest('[data-address]');
    if (!b) return;
    $('#dp-token-b').value = b.dataset.address;
    syncPriceUnit();
  });
  ['#dp-token-a', '#dp-token-b'].forEach((id) => $(id).addEventListener('change', syncPriceUnit));

  const prefillPool = () => {
    const src = deployed || view;
    if (!src) return;
    const dynamic = src.recipe === 'dynamic';
    $('#dp-fee-field').hidden = dynamic;
    $('#dp-fee-dynamic').hidden = !dynamic;
    if (src.recipe === 'launch' && src.settings.token && ethers.isAddress(src.settings.token)) {
      $('#dp-token-a').value = src.settings.token;
      $('#dp-token-a').readOnly = true;
    } else {
      $('#dp-token-a').readOnly = false;
    }
    if (!$('#dp-token-b').value) $('#dp-token-b').value = ZERO;
    syncPriceUnit();
  };

  // "1.5" -> { num: 15n, den: 10n }, exactly.
  const fraction = (text) => {
    const t = String(text).trim().replace(',', '.');
    if (!/^\d*\.?\d+$/.test(t) && !/^\d+\.$/.test(t)) return null;
    const [w, f = ''] = t.split('.');
    const num = BigInt((w || '0') + f);
    const den = 10n ** BigInt(f.length);
    return num > 0n ? { num, den } : null;
  };

  // floor(sqrt(n)) for a BigInt. Newton's method from a start that is at or
  // above the root, so it only ever steps down and ends on the exact floor.
  const isqrt = (n) => {
    if (n < 2n) return n;
    let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
    for (;;) {
      const y = (x + n / x) >> 1n;
      if (y >= x) return x;
      x = y;
    }
  };

  // Price "1 A = p B" -> sqrtPriceX96 for the sorted pair (price of currency0 in currency1, raw units).
  const sqrtPriceFor = (a, b, p) => {
    const aIs0 = BigInt(a.address) < BigInt(b.address);
    const scaleA = 10n ** BigInt(a.decimals);
    const scaleB = 10n ** BigInt(b.decimals);
    // raw amount1 / raw amount0
    const num = aIs0 ? p.num * scaleB : p.den * scaleA;
    const den = aIs0 ? p.den * scaleA : p.num * scaleB;
    return isqrt((num << 192n) / den);
  };

  // app.uniswap.org's new-position page, prefilled. Native ETH is "NATIVE" there.
  const addLiquidityUrl = (key, dynamic) => {
    const cur = (a) => (a === ZERO ? 'NATIVE' : a);
    const q = new URLSearchParams({
      chain: NET.uniswapChain || 'robinhood',
      currencyA: cur(key.currency0),
      currencyB: cur(key.currency1),
      fee: JSON.stringify({ feeAmount: key.fee, tickSpacing: key.tickSpacing, isDynamic: dynamic }),
      hook: key.hooks
    });
    return `https://app.uniswap.org/positions/create/v4?${q}`;
  };

  const explain = (err, hookAbi) => {
    const data = err && (err.data || (err.info && err.info.error && err.info.error.data) || (err.error && err.error.data));
    const pm = new ethers.Interface(PM_ABI);
    const hookIface = hookAbi ? new ethers.Interface(hookAbi) : null;
    const friendly = {
      PoolAlreadyInitialized: 'A pool with exactly this pair, fee and hook already exists.',
      CurrenciesOutOfOrderOrEqual: 'The two tokens must be different.',
      MustUseDynamicFee: 'This hook needs a dynamic-fee pool.',
      TokenNotInPool: 'This launch hook only works in a pool that includes the token it protects.',
      HookAddressNotValid: 'The hook address does not match its permissions.'
    };
    const name = (iface, d) => { try { return iface.parseError(d); } catch (_) { return null; } };
    if (typeof data === 'string' && data.length >= 10) {
      const top = name(pm, data);
      if (top && top.name === 'WrappedError') {
        const inner = hookIface && name(hookIface, top.args.reason);
        return inner ? (friendly[inner.name] || `The hook refused: ${inner.name}.`) : 'The hook refused to create this pool.';
      }
      if (top) return friendly[top.name] || `Uniswap refused: ${top.name}.`;
      const h = hookIface && name(hookIface, data);
      if (h) return friendly[h.name] || `The hook refused: ${h.name}.`;
    }
    return err.shortMessage || err.message || String(err);
  };

  const createPool = async (e) => {
    e.preventDefault();
    if (!deployed || busy) return;
    say('');
    const aAddr = $('#dp-token-a').value.trim();
    const bAddr = $('#dp-token-b').value.trim();
    if (!ethers.isAddress(aAddr) || !ethers.isAddress(bAddr)) { say('Enter both token addresses.', 'error'); return; }
    if (aAddr.toLowerCase() === bAddr.toLowerCase()) { say('The two tokens must be different.', 'error'); return; }
    const p = fraction($('#dp-price').value);
    if (!p) { say('Enter a starting price above zero, like 0.0001.', 'error'); return; }

    setBusy(true);
    step('pool', 'busy');
    try {
      const [a, b] = await Promise.all([tokenInfo(aAddr), tokenInfo(bAddr)]);
      const dynamic = deployed.recipe === 'dynamic';
      const fee = dynamic ? DYNAMIC_FEE_FLAG : Number($('#dp-fee').value);
      const tickSpacing = dynamic ? 60 : SPACING[fee];
      const [c0, c1] = BigInt(a.address) < BigInt(b.address) ? [a.address, b.address] : [b.address, a.address];
      const key = { currency0: c0, currency1: c1, fee, tickSpacing, hooks: deployed.address };
      const sqrtPriceX96 = sqrtPriceFor(a, b, p);
      if (sqrtPriceX96 < MIN_SQRT_PRICE || sqrtPriceX96 >= MAX_SQRT_PRICE) throw new Error('That starting price is outside what Uniswap allows. Check the number and the token order.');

      const pm = new ethers.Contract(NET.poolManager, PM_ABI, session.signer);
      $('#dp-pool-note').textContent = 'Checking the pool before you sign…';
      try {
        await pm.initialize.staticCall(key, sqrtPriceX96);
      } catch (err) {
        throw new Error(explain(err, deployed.abi));
      }
      $('#dp-pool-note').textContent = 'Confirm the pool in your wallet…';
      const tx = await pm.initialize(key, sqrtPriceX96);
      $('#dp-pool-note').innerHTML = `Waiting for ${esc(NET.name)}… ${link('tx', tx.hash, 'view transaction')}`;
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('The pool transaction failed on chain.');

      const poolId = ethers.keccak256(coder.encode(['address', 'address', 'uint24', 'int24', 'address'], [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]));
      step('pool', 'done');
      $('#dp-pool').hidden = true;
      $('#dp-pool-note').textContent = `${a.symbol}/${b.symbol} is live on Uniswap V4 with your hook.`;
      const box = $('#dp-pool-result');
      box.hidden = false;
      box.innerHTML = `
        <p><b>${esc(a.symbol)}/${esc(b.symbol)}</b> · starts at 1 ${esc(a.symbol)} = ${esc($('#dp-price').value.trim())} ${esc(b.symbol)}</p>
        <p class="dp-mono">Pool ID ${esc(poolId)}</p>
        <p class="dp-links">${link('tx', tx.hash, 'Pool transaction')} · <a href="https://dexscreener.com/${esc(NET.dexscreenerChain)}/${esc(poolId)}" target="_blank" rel="noopener">DexScreener</a> (after the first trade)</p>
        <p class="dp-next"><b>Next: add liquidity.</b> The pool has no liquidity yet, so nobody can trade. <a href="${esc(addLiquidityUrl(key, dynamic))}" target="_blank" rel="noopener">Add liquidity on Uniswap</a> opens with this pair, fee and hook filled in. Check that the hook shown there is <code>${esc(deployed.address)}</code>.</p>`;
      remember({ ...deployed, input: undefined, pool: { id: poolId, key: { ...key }, tx: tx.hash } });
      say('');
    } catch (err) {
      step('pool', 'active');
      $('#dp-pool-note').textContent = 'Pick the pair and a starting price. The pool goes live on Uniswap V4 with your hook.';
      say(W.isRejection(err) ? 'Cancelled in the wallet. Nothing was sent.' : esc(err.message || String(err)), W.isRejection(err) ? '' : 'error');
    } finally {
      setBusy(false);
    }
  };

  $('#dp-pool').addEventListener('submit', createPool);

  /* ---------- start ---------- */

  // A hook deployed from this browser for exactly the code on screen is
  // picked up again after a reload, so its pool can still be created.
  const previous = view && loadDeployed().find((r) => r.source === view.hook.source && r.chainId === Number(NET.chainId) && !r.pool);
  if (previous) {
    deployed = previous;
    showDeployed();
    step('connect', 'active');
  }
  prefillPool();
  refreshHookStep();
})();
