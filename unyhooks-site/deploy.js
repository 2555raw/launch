/* UnyHooks builder — deploying from the browser.

   1. Connect a wallet and move it to Robinhood Chain.
   2. Compile the hook on screen (compile-worker.js), encode its constructor
      arguments, search CREATE2 salts until the hook's address carries its
      permission bits, dry-run the deployment, then send it through the
      standard CREATE2 deployer: one signature. The source is then published
      on Sourcify automatically, so anyone can read what was deployed.
   3. Create the pool: PoolManager.initialize with the pair, fee, the hook and
      a starting price: one signature.
   4. Add liquidity (liquidity.js), without leaving the page.

   Nothing is signed or sent without the wallet asking first. Every hook
   deployed here is remembered in this browser and listed on "My hooks".
   Needs chain.js, wallet.js and pool-math.js. */

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const msgEl = $('#dp-msg');
  const say = (html, kind = '') => {
    if (!msgEl) return;
    msgEl.innerHTML = html;
    msgEl.className = `dp-msg${kind ? ` is-${kind}` : ''}`;
  };

  const C = window.UnyChain;
  const { ethers } = window;
  if (!C || !ethers || !$('#deploy')) {
    say('The wallet library did not load, so deploying is off. Check your connection and reload the page.', 'error');
    return;
  }
  const { NET, CONFIG, esc, short, link, session } = C;
  const coder = ethers.AbiCoder.defaultAbiCoder();

  /* ---------- state ---------- */

  let view = window.UnyBuild ? window.UnyBuild.current() : null;
  let deployed = null;   // the hook record deployed from here (see chain.js store)
  let pool = null;       // the pool created for it here
  let busy = false;

  const step = (id, state) => { const li = $(`#dp-step-${id}`); if (li) li.dataset.state = state; };
  const canDeploy = () => !!(session.signer && view && view.hook && view.hook.problems.length === 0);
  const setBusy = (on) => {
    busy = on;
    $('#dp-deploy').disabled = on || !canDeploy();
    $('#dp-create').disabled = on || !deployed || !session.signer;
    $('#dp-connect').disabled = on;
  };

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
    try {
      say(`Approve the connection in ${esc(w.name)}…`);
      await C.connect(w);
      step('connect', 'done');
      $('#dp-connect').textContent = 'Connected';
      $('#dp-connect-note').textContent = `${short(session.address)} on ${NET.name}.`;
      showAccount();
      say('');
      const bal = await session.browser.getBalance(session.address);
      if (bal === 0n) say(`This wallet has no ETH on ${esc(NET.name)}, and deploying needs a little for gas. Bridge some in first.`, 'warn');
      if (pool) mountLiquidity();
    } catch (err) {
      say(C.isRejection(err) ? 'Connection cancelled in the wallet.' : esc(err.shortMessage || err.message || String(err)), C.isRejection(err) ? '' : 'error');
    } finally {
      setBusy(false);
      refreshHookStep();
    }
  };

  const openConnect = () => {
    if (session.signer) return;
    const wallets = C.wallets();
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

  const compile = (hook) => C.compile({ file: hook.file, contract: hook.contract, source: hook.source })
    .catch((err) => { throw new Error(err.message.replace(/^It did not compile/, 'The hook did not compile')); });

  // Searches salts until the CREATE2 address ends in the hook's permission
  // bits and nothing is deployed there yet. About 16,000 tries on average.
  const mine = async (initHash, flags, provider, onProgress) => {
    const want = BigInt(flags);
    const start = BigInt(Math.floor(Math.random() * 2 ** 40)) << 32n;
    for (let i = 0n; i < 5_000_000n; i++) {
      const salt = ethers.zeroPadValue(ethers.toBeHex(start + i), 32);
      const addr = ethers.getCreate2Address(NET.create2Deployer, salt, initHash);
      if ((BigInt(addr) & 0x3fffn) === want) {
        if ((await provider.getCode(addr)) === '0x') return { salt, address: addr };
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
      note.textContent = C.isCompiled({ file: hook.file, contract: hook.contract, source: hook.source })
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
        address: found.address, tx: tx.hash, chainId: Number(NET.chainId), deployer: session.address,
        recipe: snapshot.recipe, settings: snapshot.settings,
        contract: hook.contract, file: hook.file, source: hook.source, abi: c.abi,
        compiler: c.version, input: c.input, at: new Date().toISOString(), pools: []
      };
      pool = null;
      C.store.put(deployed);
      showDeployed();
      prefillPool();
      say('');
      publishSource();
    } catch (err) {
      step('hook', 'active');
      say(C.isRejection(err) ? 'Deployment cancelled in the wallet. Nothing was sent.' : esc(err.shortMessage || err.message || String(err)), C.isRejection(err) ? '' : 'error');
    } finally {
      setBusy(false);
      refreshHookStep();
    }
  };

  /* ---------- publishing the source ---------- */

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

  const showSource = (state, detail = '') => {
    const box = $('#dp-source');
    if (!box) return;
    if (state === 'done') {
      box.className = 'dp-source is-done';
      box.innerHTML = `Source published: anyone can read the exact code at this address. <a href="${esc(C.sourcifyPage(deployed.address))}" target="_blank" rel="noopener">View on Sourcify</a>`;
    } else if (state === 'busy') {
      box.className = 'dp-source is-busy';
      box.textContent = detail || 'Publishing the source on Sourcify…';
    } else {
      box.className = 'dp-source is-error';
      box.innerHTML = `Could not publish the source automatically${detail ? ` (${esc(detail)})` : ''}. <button type="button" class="dp-linkbtn" data-act="retry">Try again</button> · <button type="button" class="dp-linkbtn" data-act="file">Download verification file</button>`;
    }
  };

  const publishSource = async () => {
    if (!deployed || !deployed.input) return;
    showSource('busy');
    try {
      const match = await C.verify(deployed, (m) => showSource('busy', m));
      C.store.update(deployed.address, (r) => { r.verified = match; return r; });
      deployed.verified = match;
      showSource('done');
    } catch (err) {
      showSource('error', err.message);
    }
  };

  const showDeployed = () => {
    const box = $('#dp-hook-result');
    box.hidden = false;
    box.innerHTML = `
      <p><b>${esc(deployed.contract)}</b> is live at ${link('address', deployed.address, deployed.address)}</p>
      <p class="dp-links">${deployed.tx ? link('tx', deployed.tx, 'Deployment transaction') : ''} · <a href="hooks.html">My hooks</a></p>
      <p class="dp-source" id="dp-source"></p>`;
    box.onclick = (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      if (act === 'retry') publishSource();
      if (act === 'file') verificationFile();
    };
    if (deployed.verified) showSource('done');
    else if (!deployed.input) $('#dp-source').hidden = true;
    $('#dp-hook-note').textContent = `Deployed on ${NET.name}.`;
    step('hook', 'done');
    $('#dp-pool').hidden = false;
    $('#dp-pool-result').hidden = true;
    step('pool', 'active');
    step('liquidity', 'todo');
    $('#dp-liquidity').innerHTML = '';
    setBusy(false);
  };

  $('#dp-deploy').addEventListener('click', deploy);

  /* ---------- 3. create the pool ---------- */

  const showToken = async (inputId, infoId) => {
    const el = $(infoId);
    const v = $(inputId).value.trim();
    if (!v) { el.textContent = ''; return null; }
    if (!ethers.isAddress(v)) { el.textContent = 'That is not an address (0x followed by 40 characters).'; el.className = 'dp-token-info is-bad'; return null; }
    el.textContent = 'Reading the token…';
    el.className = 'dp-token-info';
    try {
      const t = await C.tokenInfo(v);
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
    if (!$('#dp-token-b').value) $('#dp-token-b').value = C.ZERO;
    syncPriceUnit();
  };

  const createPool = async (e) => {
    e.preventDefault();
    if (!deployed || busy) return;
    say('');
    const aAddr = $('#dp-token-a').value.trim();
    const bAddr = $('#dp-token-b').value.trim();
    if (!ethers.isAddress(aAddr) || !ethers.isAddress(bAddr)) { say('Enter both token addresses.', 'error'); return; }
    if (aAddr.toLowerCase() === bAddr.toLowerCase()) { say('The two tokens must be different.', 'error'); return; }
    if (!window.UnyPoolMath.fraction($('#dp-price').value)) { say('Enter a starting price above zero, like 0.0001.', 'error'); return; }

    setBusy(true);
    step('pool', 'busy');
    const note = $('#dp-pool-note');
    try {
      const [a, b] = await Promise.all([C.tokenInfo(aAddr), C.tokenInfo(bAddr)]);
      pool = await C.createPool({
        hook: deployed.address, a, b,
        price: $('#dp-price').value,
        fee: deployed.recipe === 'dynamic' ? 'dynamic' : $('#dp-fee').value,
        hookAbi: deployed.abi,
        onStatus: (text, hash) => { note.innerHTML = `${esc(text)}${hash ? ` ${link('tx', hash, 'view transaction')}` : ''}`; }
      });
      C.store.addPool(deployed.address, pool);
      step('pool', 'done');
      $('#dp-pool').hidden = true;
      note.textContent = `${a.symbol}/${b.symbol} is live on Uniswap V4 with your hook.`;
      const box = $('#dp-pool-result');
      box.hidden = false;
      box.innerHTML = `
        <p><b>${esc(a.symbol)}/${esc(b.symbol)}</b> · starts at 1 ${esc(a.symbol)} = ${esc(pool.price)} ${esc(b.symbol)}</p>
        <p class="dp-mono">Pool ID ${esc(pool.id)}</p>
        <p class="dp-links">${link('tx', pool.tx, 'Pool transaction')} · <a href="${esc(C.dexscreenerPool(pool.id))}" target="_blank" rel="noopener">DexScreener</a> (after the first trade)</p>`;
      mountLiquidity();
      say('');
    } catch (err) {
      step('pool', 'active');
      note.textContent = 'Pick the pair and a starting price. The pool goes live on Uniswap V4 with your hook.';
      say(C.isRejection(err) ? 'Cancelled in the wallet. Nothing was sent.' : esc(err.message || String(err)), C.isRejection(err) ? '' : 'error');
    } finally {
      setBusy(false);
    }
  };

  $('#dp-pool').addEventListener('submit', createPool);

  /* ---------- 4. add liquidity ---------- */

  const mountLiquidity = () => {
    if (!pool || !window.UnyLiquidity) return;
    step('liquidity', 'active');
    $('#dp-liquidity-note').innerHTML = `Nobody can trade until the pool has liquidity. Deposit both tokens here, or <a href="${esc(C.uniswapAddLiquidity(pool.key))}" target="_blank" rel="noopener">use the Uniswap app</a>.`;
    window.UnyLiquidity.mount($('#dp-liquidity'), {
      hook: deployed.address,
      pool,
      abi: deployed.abi,
      onDone: () => step('liquidity', 'done')
    });
  };

  /* ---------- start ---------- */

  // A hook deployed from this browser for exactly the code on screen is
  // picked up again after a reload, with its newest pool.
  const previous = view && C.store.all().find((r) => r.source === view.hook.source);
  if (previous) {
    deployed = previous;
    showDeployed();
    if (previous.pools && previous.pools.length) {
      pool = previous.pools[0];
      step('pool', 'done');
      $('#dp-pool').hidden = true;
      $('#dp-pool-note').textContent = `${pool.a.symbol}/${pool.b.symbol} is live on Uniswap V4 with your hook.`;
      mountLiquidity();
    }
    step('connect', 'active');
  }
  prefillPool();
  refreshHookStep();
})();
