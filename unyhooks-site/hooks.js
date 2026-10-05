/* UnyHooks — "My hooks".

   Lists the hooks this browser deployed or follows (chain.js store), each with
   what it does, whether its source is public on Sourcify, and its pools with
   live price and liquidity (StateView on chain, USD figures from DexScreener
   once the pool trades). From here: publish a hook's source, create another
   pool, add a pool by its ID, and add liquidity to any of them. Any hook can be
   followed by address; UnyHooks hooks are recognised by their settings. */

(() => {
  'use strict';

  const C = window.UnyChain;
  const B = window.UnyBuilder;
  const M = window.UnyPoolMath;
  const { ethers } = window;
  const $ = (sel, root = document) => root.querySelector(sel);
  const msg = $('#msg');
  const say = (html, kind = '') => { msg.innerHTML = html; msg.className = `dp-msg${kind ? ` is-${kind}` : ''}`; };
  if (!C || !B || !M || !ethers) { say('The wallet library did not load. Check your connection and reload the page.', 'error'); return; }

  const { NET, esc, short, link, session } = C;
  document.querySelectorAll('[data-net="name"]').forEach((el) => { el.textContent = NET.name; });

  const num = (v) => (v >= 1e6 || (v > 0 && v < 1e-6) ? v.toPrecision(4) : String(Number(v.toPrecision(6))));
  const usd = (n) => (Number.isFinite(Number(n)) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(Number(n)) : '—');
  const day = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return ''; } };

  /* ---------- wallet ---------- */

  const chip = $('#wallet');
  const showChip = () => {
    if (!session.address) return;
    chip.classList.add('is-on');
    chip.innerHTML = `<code>${esc(short(session.address))}</code>`;
    chip.title = session.address;
  };
  const connectWith = async (w) => {
    $('#wallets').hidden = true;
    try {
      say(`Approve the connection in ${esc(w.name)}…`);
      await C.connect(w);
      showChip();
      say('');
      render();
    } catch (err) {
      say(C.isRejection(err) ? 'Connection cancelled in the wallet.' : esc(err.message || String(err)), C.isRejection(err) ? '' : 'error');
    }
  };
  const openConnect = () => {
    if (session.signer) return;
    const wallets = C.wallets();
    if (!wallets.length) { say('No browser wallet found. Install <a href="https://metamask.io/download/" target="_blank" rel="noopener">MetaMask</a> or <a href="https://phantom.com/download" target="_blank" rel="noopener">Phantom</a>, then reload.', 'error'); return; }
    if (wallets.length === 1) { connectWith(wallets[0]); return; }
    const box = $('#wallets');
    box.innerHTML = wallets.map((w, i) => `<button type="button" class="dp-wallet" data-i="${i}">${w.icon ? `<img src="${esc(w.icon)}" alt="" width="22" height="22">` : ''}<span>${esc(w.name)}</span></button>`).join('');
    box.hidden = false;
    box.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) connectWith(wallets[Number(b.dataset.i)]); };
  };
  chip.addEventListener('click', openConnect);

  const recognise = C.recognise;

  const follow = async (e) => {
    e.preventDefault();
    const v = $('#follow-input').value.trim();
    if (!ethers.isAddress(v)) { say('That is not an address (0x followed by 40 characters).', 'error'); return; }
    const address = ethers.getAddress(v);
    if (C.store.get(address)) { say('You already follow this hook.'); return; }
    say('Reading the hook…');
    try {
      if ((await C.reader().getCode(address)) === '0x') { say(`There is no contract at that address on ${esc(NET.name)}.`, 'error'); return; }
      const known = await recognise(address);
      C.store.put({
        address, chainId: Number(NET.chainId), imported: true, at: new Date().toISOString(), pools: [],
        ...(known || { recipe: null, contract: 'Hook', settings: {} })
      });
      $('#follow-input').value = '';
      say(known ? `Following this ${esc(B.RECIPES[known.recipe].title.toLowerCase())} hook.` : 'Following this hook. It was not made with UnyHooks, so its settings are not shown.', 'ok');
      render();
    } catch (err) {
      say(esc(C.explain(err)), 'error');
    }
  };
  $('#follow').addEventListener('submit', follow);

  /* ---------- drawing ---------- */

  const permissions = (address) => {
    const bits = Number(BigInt(address) & 0x3fffn);
    const names = ['afterRemoveLiquidityReturnDelta', 'afterAddLiquidityReturnDelta', 'afterSwapReturnDelta', 'beforeSwapReturnDelta', 'afterDonate', 'beforeDonate', 'afterSwap', 'beforeSwap', 'afterRemoveLiquidity', 'beforeRemoveLiquidity', 'afterAddLiquidity', 'beforeAddLiquidity', 'afterInitialize', 'beforeInitialize'];
    return names.filter((_, i) => bits & (1 << i)).reverse();
  };

  const positionLinks = (positions) => (positions.length
    ? positions.map((x) => `<a href="${esc(C.uniswapPosition(x.tokenId))}" target="_blank" rel="noopener">#${esc(x.tokenId)}</a>`).join(' ')
    : 'none yet');

  const poolRow = (rec, p) => {
    const positions = (p.positions || []).filter((x) => x.tokenId);
    return `
      <div class="mh-pool" data-pool="${esc(p.id)}">
        <div class="mh-pool-top">
          <b>${esc(p.a.symbol)}/${esc(p.b.symbol)}</b>
          <span class="mh-pool-fee">${p.key.fee === 0x800000 ? 'dynamic fee' : `${p.key.fee / 10000}%`}</span>
          <span class="mh-live" data-live>Reading…</span>
        </div>
        <dl class="mh-stats">
          <div><dt>Liquidity</dt><dd data-liq>—</dd></div>
          <div><dt>24h volume</dt><dd data-vol>—</dd></div>
          <div><dt>Your positions</dt><dd data-pos>${positionLinks(positions)}</dd></div>
        </dl>
        <div class="mh-actions">
          <button type="button" class="uh-btn uh-btn-pink uh-btn-sm" data-act="liquidity">Add liquidity</button>
          <a class="mh-link" href="${esc(C.dexscreenerPool(p.id))}" target="_blank" rel="noopener">DexScreener</a>
          <a class="mh-link" href="${esc(C.uniswapAddLiquidity(p.key))}" target="_blank" rel="noopener">Uniswap</a>
          ${p.tx ? `<span class="mh-link">${link('tx', p.tx, 'created')}</span>` : ''}
        </div>
        <div class="mh-posl" data-posl></div>
        <div class="mh-liquidity" data-liquidity hidden></div>
      </div>`;
  };

  const card = (rec) => {
    const lines = rec.recipe && B.RECIPES[rec.recipe] ? B.describe(rec.recipe, { ...B.defaults(rec.recipe), ...rec.settings }) : [];
    const perms = permissions(rec.address);
    return `
      <article class="bd-card mh-card" data-hook="${esc(rec.address)}">
        <header class="mh-card-head">
          <div>
            <h2>${esc(rec.contract || 'Hook')} <span class="mh-recipe">${rec.recipe ? esc(B.RECIPES[rec.recipe].title) : 'not made with UnyHooks'}</span></h2>
            <p class="mh-addr">${link('address', rec.address, rec.address)}${rec.at ? ` · ${rec.imported ? 'followed' : rec.launch ? 'launched' : 'deployed'} ${esc(day(rec.at))}` : ''}${rec.tx ? ` · ${link('tx', rec.tx, 'tx')}` : ''}</p>
            ${rec.launch ? `<p class="mh-token">Token <b>$${esc(rec.launch.symbol)}</b> ${link('address', rec.launch.token)}</p>` : ''}
            <p class="mh-public"><a href="${esc(C.hookPage(rec.address))}">Public page</a> <span class="bd-muted">to share with buyers</span></p>
          </div>
          <span class="mh-source" data-source>Checking source…</span>
        </header>
        ${lines.length ? `<ul class="mh-does">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}
        <p class="mh-perms">${perms.map((p) => `<span class="bd-chip">${esc(p)}</span>`).join('')}</p>
        <section class="mh-pools">
          <h3>Pools</h3>
          ${(rec.pools || []).length ? rec.pools.map((p) => poolRow(rec, p)).join('') : '<p class="bd-muted">No pools yet.</p>'}
          <div class="mh-pool-actions">
            <button type="button" class="mh-link" data-act="new-pool">+ Create a pool</button>
            <button type="button" class="mh-link" data-act="find-pool">+ Add a pool by its ID</button>
          </div>
          <div class="mh-form" data-form hidden></div>
        </section>
        <footer class="mh-card-foot"><button type="button" class="mh-link mh-quiet" data-act="unfollow">Stop following</button></footer>
      </article>`;
  };

  /* ---------- live data ---------- */

  const sourceBadge = async (el, rec) => {
    const badge = el.querySelector('[data-source]');
    try {
      const match = rec.verified || await C.sourcifyStatus(rec.address);
      if (match) {
        badge.className = 'mh-source is-ok';
        badge.innerHTML = `<a href="${esc(C.sourcifyPage(rec.address))}" target="_blank" rel="noopener">Source published</a>`;
        if (!rec.verified) C.store.update(rec.address, (r) => { r.verified = match; return r; });
        return;
      }
      badge.className = 'mh-source is-todo';
      badge.innerHTML = rec.input ? 'Source not published · <button type="button" class="dp-linkbtn" data-act="publish">Publish</button>' : 'Source not published';
    } catch (_) {
      badge.className = 'mh-source';
      badge.textContent = 'Source status unavailable';
    }
  };

  const poolLive = async (el, p) => {
    const live = el.querySelector('[data-live]');
    try {
      const s = await C.readPool(p.key);
      if (s.sqrtPriceX96 === 0n) { live.textContent = 'not created on chain'; return; }
      live.textContent = `1 ${p.a.symbol} = ${C.price(M.priceOf(s.sqrtPriceX96, p.a, p.b))} ${p.b.symbol}`;
      el.querySelector('[data-liq]').textContent = s.liquidity === 0n ? 'none yet' : 'added';
    } catch (_) {
      live.textContent = 'price unavailable';
    }
    try {
      const d = await (await fetch(`https://api.dexscreener.com/latest/dex/pairs/${NET.dexscreenerChain}/${p.id}`)).json();
      const pair = d && d.pairs && d.pairs[0];
      if (pair) {
        el.querySelector('[data-liq]').textContent = usd(pair.liquidity && pair.liquidity.usd);
        el.querySelector('[data-vol]').textContent = usd(pair.volume && pair.volume.h24);
      }
    } catch (_) { /* not indexed yet */ }
  };

  /* ---------- positions and locks ---------- */

  const K = window.UnyLaunchKit;
  const LOCK_CHOICES = K ? K.LOCKS.filter((l) => l.days !== 0) : [];
  const posmRead = () => new ethers.Contract(NET.positionManager, C.ABI.POSITIONS, C.reader());
  // now: the chain's clock (latest block), which is what the lock checks.
  const when = (unlockAt, now) => {
    if (BigInt(unlockAt) === K.MAX_UINT256) return 'forever';
    const rest = Number(unlockAt) - now;
    if (rest <= 0) return `until ${day(new Date(Number(unlockAt) * 1000))}, now open`;
    const d = Math.floor(rest / 86400);
    return `until ${day(new Date(Number(unlockAt) * 1000))} (${d > 0 ? `${d}d ${Math.floor((rest % 86400) / 3600)}h` : `${Math.floor(rest / 3600)}h ${Math.floor((rest % 3600) / 60)}m`} left)`;
  };

  // Each recorded position: who holds it now, and what can be done with it.
  const positionsLive = async (el, rec, p) => {
    const box = el.querySelector('[data-posl]');
    const positions = (p.positions || []).filter((x) => x.tokenId);
    if (!positions.length || !K) { box.innerHTML = ''; return; }
    const now = await C.reader().getBlock('latest').then((b) => b.timestamp).catch(() => Date.now() / 1000);
    const rows = await Promise.all(positions.map(async (x) => {
      const id = esc(x.tokenId);
      const head = `<a href="${esc(C.uniswapPosition(x.tokenId))}" target="_blank" rel="noopener">#${id}</a>`;
      try {
        const holder = await posmRead().ownerOf(x.tokenId);
        if (await C.isGenuine('lock', holder)) {
          const info = await C.lockInfo(holder);
          const open = !info.forever && Number(info.unlockAt) <= now;
          return `<div class="mh-posrow is-locked" data-token="${id}" data-lock="${esc(holder)}">
            ${head} <span class="mh-lockbadge">Locked ${esc(when(info.unlockAt, now))}</span>
            <span class="mh-posact"><button type="button" class="mh-link" data-act="collect">Collect fees</button>${open ? ' <button type="button" class="mh-link" data-act="withdraw">Take back</button>' : ''} ${link('address', holder, 'lock')}</span>
            <p class="dp-msg" data-posmsg></p></div>`;
        }
        if (session.address && holder !== session.address) return `<div class="mh-posrow" data-token="${id}">${head} <span class="bd-muted">held by ${link('address', holder)}</span></div>`;
        return `<div class="mh-posrow" data-token="${id}">
          ${head} <span class="mh-unlocked">Not locked</span>
          <span class="mh-posact"><button type="button" class="mh-link" data-act="lock-open">Lock it</button></span>
          <div class="mh-lockform" data-lockform hidden>
            <div class="ln-chips">${LOCK_CHOICES.map((l, i) => `<label><input type="radio" name="lock-${id}" value="${i}"${i === 1 ? ' checked' : ''}> ${esc(l.label)}</label>`).join('')}</div>
            <p class="lq-note">Two signatures: create your lock, then move the position into it. Until the date nobody can remove this liquidity, you included. You keep collecting its fees.</p>
            <button type="button" class="uh-btn uh-btn-pink uh-btn-sm" data-act="lock-go">Lock position #${id}</button>
          </div>
          <p class="dp-msg" data-posmsg></p></div>`;
      } catch (_) {
        return `<div class="mh-posrow" data-token="${id}">${head} <span class="bd-muted">closed or unreadable</span></div>`;
      }
    }));
    box.innerHTML = `<p class="mh-posl-title">Positions</p>${rows.join('')}`;
  };

  const needWallet = async (fsay) => {
    if (session.signer) return true;
    fsay('Connect your wallet first (top right).', 'error');
    return false;
  };

  // Two signatures: deploy a LiquidityLock through the CREATE2 deployer, then
  // safeTransferFrom the position into it (the lock announces it on arrival).
  const lockPosition = async (rec, p, tokenId, choice, fsay) => {
    const posm = new ethers.Contract(NET.positionManager, C.ABI.POSITIONS, session.signer);
    if ((await posm.ownerOf(tokenId)) !== session.address) throw new Error(`This wallet does not hold position #${tokenId}.`);
    const position = (p.positions || []).find((x) => String(x.tokenId) === String(tokenId)) || {};
    let lockAddr = position.pendingLock && position.pendingLock.days === String(choice.days) ? position.pendingLock.address : null;
    let unlockAt = lockAddr ? BigInt(position.pendingLock.unlockAt) : null;

    if (!lockAddr || (await session.browser.getCode(lockAddr)) === '0x') {
      fsay('Compiling the lock…');
      const c = await C.compile({ file: 'LiquidityLock.sol', contract: 'LiquidityLock', source: K.lock(ethers.getAddress(NET.positionManager)) });
      const block = await session.browser.getBlock('latest');
      unlockAt = K.unlockAtFor(choice.days, block.timestamp);
      const initcode = ethers.concat([c.bytecode, ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [session.address, unlockAt])]);
      const salt = ethers.hexlify(ethers.randomBytes(32));
      lockAddr = ethers.getCreate2Address(NET.create2Deployer, salt, ethers.keccak256(initcode));
      const data = ethers.concat([salt, initcode]);
      fsay('Checking before you sign…');
      const landed = await session.browser.call({ from: session.address, to: NET.create2Deployer, data });
      if (!landed || landed.toLowerCase() !== lockAddr.toLowerCase()) throw new Error('A dry run of the lock did not land where expected, so nothing was sent.');
      fsay('Confirm the lock in your wallet (1 of 2)…');
      const tx = await session.signer.sendTransaction({ to: NET.create2Deployer, data });
      fsay(`Creating the lock… ${link('tx', tx.hash, 'view')}`);
      const r = await tx.wait();
      if (!r || r.status !== 1) throw new Error('Creating the lock failed on chain.');
      C.store.update(rec.address, (h) => {
        const pos = (h.pools.find((x) => x.id === p.id) || { positions: [] }).positions.find((x) => String(x.tokenId) === String(tokenId));
        if (pos) pos.pendingLock = { address: lockAddr, unlockAt: unlockAt.toString(), days: String(choice.days) };
        return h;
      });
      // Publish the lock's source in the background.
      C.verify({ address: lockAddr, input: c.input, compiler: c.version, file: 'LiquidityLock.sol', contract: 'LiquidityLock', tx: tx.hash }).catch(() => {});
    }

    fsay('Checking the move before you sign…');
    await posm['safeTransferFrom(address,address,uint256)'].staticCall(session.address, lockAddr, tokenId);
    fsay('Confirm moving the position into the lock (2 of 2)…');
    const tx2 = await posm['safeTransferFrom(address,address,uint256)'](session.address, lockAddr, tokenId);
    fsay(`Locking… ${link('tx', tx2.hash, 'view')}`);
    const r2 = await tx2.wait();
    if (!r2 || r2.status !== 1) throw new Error('Moving the position failed on chain.');
    C.store.update(rec.address, (h) => {
      const pos = (h.pools.find((x) => x.id === p.id) || { positions: [] }).positions.find((x) => String(x.tokenId) === String(tokenId));
      if (pos) { pos.lock = lockAddr; pos.unlockAt = unlockAt.toString(); delete pos.pendingLock; }
      return h;
    });
  };

  /* ---------- forms inside a card ---------- */

  const newPoolForm = (rec, box) => {
    const dynamic = rec.recipe === 'dynamic';
    const lockA = rec.recipe === 'launch' && rec.settings && rec.settings.token;
    box.innerHTML = `
      <form class="lq" data-new-pool>
        <div class="lq-amounts">
          <div class="bd-field"><label>Token</label><div class="bd-input"><input name="a" spellcheck="false" placeholder="0x…" value="${lockA ? esc(rec.settings.token) : ''}" ${lockA ? 'readonly' : ''}></div></div>
          <div class="bd-field"><label>Paired with</label><div class="bd-input"><input name="b" spellcheck="false" value="${esc(C.ZERO)}"></div>
            <div class="dp-picks">${(C.CONFIG.TOKENS || []).map((t) => `<button type="button" class="dp-pick" data-pick="${esc(t.address)}">${esc(t.symbol)}</button>`).join('')}</div></div>
        </div>
        <div class="bd-field"><label>Starting price: 1 token = how much of the pair?</label><div class="bd-input"><input name="price" inputmode="decimal" placeholder="0.0001"></div></div>
        ${dynamic ? '<p class="lq-note">This hook sets the fee itself, so the pool uses the dynamic-fee flag.</p>' : `<div class="bd-field"><label>Pool fee</label><div class="bd-input"><select name="fee"><option value="500">0.05%</option><option value="3000" selected>0.3%</option><option value="10000">1%</option></select></div></div>`}
        <button class="uh-btn uh-btn-pink uh-btn-sm" type="submit">Create pool</button>
        <p class="dp-msg" data-msg></p>
      </form>`;
    const form = box.querySelector('form');
    const fsay = (html, kind = '') => { const m = form.querySelector('[data-msg]'); m.innerHTML = html; m.className = `dp-msg${kind ? ` is-${kind}` : ''}`; };
    form.addEventListener('click', (e) => { const p = e.target.dataset && e.target.dataset.pick; if (p) form.b.value = p; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!session.signer) { fsay('Connect your wallet first (top right).', 'error'); return; }
      if (!ethers.isAddress(form.a.value.trim()) || !ethers.isAddress(form.b.value.trim())) { fsay('Enter both token addresses.', 'error'); return; }
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        const [a, b] = await Promise.all([C.tokenInfo(form.a.value.trim()), C.tokenInfo(form.b.value.trim())]);
        const created = await C.createPool({
          hook: rec.address, a, b, price: form.price.value, fee: dynamic ? 'dynamic' : form.fee.value, hookAbi: rec.abi,
          onStatus: (text, hash) => fsay(`${esc(text)}${hash ? ` ${link('tx', hash, 'view')}` : ''}`)
        });
        C.store.addPool(rec.address, created);
        render();
        say(`${esc(a.symbol)}/${esc(b.symbol)} is live. Add liquidity so people can trade.`, 'ok');
      } catch (err) {
        fsay(C.isRejection(err) ? 'Cancelled in the wallet.' : esc(err.message || String(err)), C.isRejection(err) ? '' : 'error');
      } finally {
        btn.disabled = false;
      }
    });
  };

  const findPoolForm = (rec, box) => {
    box.innerHTML = `
      <form class="lq" data-find-pool>
        <div class="bd-field"><label>Pool ID</label><div class="bd-input"><input name="poolid" spellcheck="false" placeholder="0x… (64 characters, from DexScreener or the pool transaction)"></div></div>
        <button class="uh-btn uh-btn-ghost uh-btn-sm" type="submit">Find pool</button>
        <p class="dp-msg" data-msg></p>
      </form>`;
    const form = box.querySelector('form');
    const fsay = (html, kind = '') => { const m = form.querySelector('[data-msg]'); m.innerHTML = html; m.className = `dp-msg${kind ? ` is-${kind}` : ''}`; };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = form.poolid.value.trim().toLowerCase();
      if (!/^0x[0-9a-f]{64}$/.test(id)) { fsay('A pool ID is 0x followed by 64 characters.', 'error'); return; }
      fsay('Looking for the pool…');
      try {
        const key = await C.findPool(id);
        if (!key) { fsay(`No pool with that ID on ${esc(NET.name)}.`, 'error'); return; }
        if (key.hooks.toLowerCase() !== rec.address.toLowerCase()) { fsay('That pool uses a different hook.', 'error'); return; }
        const [t0, t1] = await Promise.all([C.tokenInfo(key.currency0), C.tokenInfo(key.currency1)]);
        // Show the non-ETH token first, priced in the other.
        const [a, b] = BigInt(key.currency0) === 0n ? [t1, t0] : [t0, t1];
        C.store.addPool(rec.address, { id, key, a, b, at: new Date().toISOString() });
        render();
      } catch (err) {
        fsay(esc(C.explain(err)), 'error');
      }
    });
  };

  /* ---------- page ---------- */

  const list = $('#list');
  const render = () => {
    const hooks = C.store.all();
    $('#empty').hidden = hooks.length > 0;
    list.innerHTML = hooks.map(card).join('');
    hooks.forEach((rec) => {
      const el = list.querySelector(`[data-hook="${rec.address}"]`);
      sourceBadge(el, rec);
      (rec.pools || []).forEach((p) => {
        const poolEl = el.querySelector(`[data-pool="${p.id}"]`);
        poolLive(poolEl, p);
        positionsLive(poolEl, rec, p);
      });
    });
  };

  list.addEventListener('click', async (e) => {
    const act = e.target.dataset && e.target.dataset.act;
    if (!act) return;
    const cardEl = e.target.closest('[data-hook]');
    const rec = C.store.get(cardEl.dataset.hook);
    if (!rec) return;
    if (act === 'unfollow') { C.store.remove(rec.address); render(); return; }
    if (act === 'publish') {
      const badge = cardEl.querySelector('[data-source]');
      badge.className = 'mh-source';
      try {
        const match = await C.verify(rec.launch ? { ...rec, tx: undefined } : rec, (m) => { badge.textContent = m; });
        C.store.update(rec.address, (r) => { r.verified = match; return r; });
        sourceBadge(cardEl, { ...rec, verified: match });
      } catch (err) {
        badge.className = 'mh-source is-todo';
        badge.textContent = `Could not publish: ${err.message}`;
      }
      return;
    }
    const row = e.target.closest('[data-token]');
    if (row && ['lock-open', 'lock-go', 'collect', 'withdraw'].includes(act)) {
      const poolEl = e.target.closest('[data-pool]');
      const p = (rec.pools || []).find((x) => x.id === poolEl.dataset.pool);
      const tokenId = row.dataset.token;
      const m = row.querySelector('[data-posmsg]');
      const fsay = (html, kind = '') => { m.innerHTML = html; m.className = `dp-msg${kind ? ` is-${kind}` : ''}`; };
      if (act === 'lock-open') { const f = row.querySelector('[data-lockform]'); f.hidden = !f.hidden; return; }
      if (!(await needWallet(fsay))) return;
      e.target.disabled = true;
      try {
        if (act === 'lock-go') {
          const choice = LOCK_CHOICES[Number((row.querySelector('input[type=radio]:checked') || {}).value || 0)];
          await lockPosition(rec, p, tokenId, choice, fsay);
          say(`Position #${esc(tokenId)} is locked ${esc(choice.days === Infinity ? 'forever' : `for ${choice.label}`)}.`, 'ok');
        } else {
          const lock = new ethers.Contract(row.dataset.lock, C.ABI.LOCK, session.signer);
          const fn = act === 'collect' ? 'collectFees' : 'withdraw';
          fsay('Checking before you sign…');
          await lock[fn].staticCall(tokenId);
          fsay('Confirm in your wallet…');
          const tx = await lock[fn](tokenId);
          fsay(`Waiting… ${link('tx', tx.hash, 'view')}`);
          await tx.wait();
          if (act === 'withdraw') C.store.update(rec.address, (h) => {
            const pos = (h.pools.find((x) => x.id === p.id) || { positions: [] }).positions.find((x) => String(x.tokenId) === String(tokenId));
            if (pos) { delete pos.lock; delete pos.unlockAt; }
            return h;
          });
          say(act === 'collect' ? `Fees from position #${esc(tokenId)} sent to the lock's owner. ${link('tx', tx.hash, 'transaction')}` : `Position #${esc(tokenId)} is back in your wallet.`, 'ok');
        }
        positionsLive(poolEl, C.store.get(rec.address), (C.store.get(rec.address).pools || []).find((x) => x.id === p.id) || p);
      } catch (err) {
        fsay(C.isRejection(err) ? 'Cancelled in the wallet.' : esc(C.explain(err, [C.ABI.LOCK])), C.isRejection(err) ? '' : 'error');
        e.target.disabled = false;
      }
      return;
    }
    const form = cardEl.querySelector('[data-form]');
    if (act === 'new-pool') { form.hidden = false; newPoolForm(rec, form); return; }
    if (act === 'find-pool') { form.hidden = false; findPoolForm(rec, form); return; }
    if (act === 'liquidity') {
      const poolEl = e.target.closest('[data-pool]');
      const p = (rec.pools || []).find((x) => x.id === poolEl.dataset.pool);
      const box = poolEl.querySelector('[data-liquidity]');
      box.hidden = !box.hidden;
      if (!box.hidden && !box.childElementCount) {
        if (!session.signer) say('Connect your wallet (top right) to add liquidity.');
        // After a deposit only this pool's figures change; the form and its message stay.
        window.UnyLiquidity.mount(box, {
          hook: rec.address, pool: p, abi: rec.abi,
          onDone: () => {
            const fresh = (C.store.get(rec.address).pools || []).find((x) => x.id === p.id) || p;
            poolEl.querySelector('[data-pos]').innerHTML = positionLinks((fresh.positions || []).filter((x) => x.tokenId));
            poolLive(poolEl, p);
            positionsLive(poolEl, C.store.get(rec.address), fresh);
          }
        });
      }
    }
  });

  render();
})();
