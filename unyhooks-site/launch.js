/* UnyHooks — Launch a token.

   The form fills a UnyLaunch transaction (launch-kit.js): the token, the
   launch-protection hook, the token/ETH pool, a full-range position with the
   ETH and the share of supply chosen, and a lock on that position. Before the
   wallet asks for the one signature, the page compiles the contracts in the
   browser, works out every address (the launcher's from the wallet's next
   transaction number, the token's from the launcher, the hook's from a mined
   salt) and dry-runs the whole launch. Afterwards the source of the token, the
   hook and the lock goes to Sourcify, and the launch is listed on My hooks.
   Needs chain.js, launch-kit.js, builder.js and pool-math.js. */

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const msgEl = $('#ln-msg');
  const say = (html, kind = '') => { msgEl.innerHTML = html; msgEl.className = `dp-msg${kind ? ` is-${kind}` : ''}`; };

  const C = window.UnyChain;
  const K = window.UnyLaunchKit;
  const B = window.UnyBuilder;
  const M = window.UnyPoolMath;
  const { ethers } = window;
  if (!C || !K || !B || !M || !ethers) {
    say('The wallet library did not load, so launching is off. Check your connection and reload the page.', 'error');
    $('#ln-go').disabled = true;
    return;
  }
  const { NET, esc, short, link, session } = C;
  document.querySelectorAll('[data-net="name"]').forEach((el) => { el.textContent = NET.name; });
  const net = { poolManager: ethers.getAddress(NET.poolManager), positionManager: ethers.getAddress(NET.positionManager), permit2: ethers.getAddress(NET.permit2) };
  const SPACING = { 3000: 60, 10000: 200 };
  const GAS_ROOM = ethers.parseEther('0.002'); // kept for gas when checking the balance
  // The hook's source does not depend on the token (it is a constructor argument),
  // so it is generated with a stand-in address and deployed with the real one.
  const STAND_IN = '0x0000000000000000000000000000000000000001';

  /* ---------- the form ---------- */

  $('#ln-lock').innerHTML = K.LOCKS.map((l, i) => `<label><input type="radio" name="lock" value="${i}"${l.days === 90 ? ' checked' : ''}> ${esc(l.label)}</label>`).join('');

  const val = (id) => $(id).value.trim();
  const decimal = (v) => String(v).replace(/[\s_]/g, '').replace(',', '.');
  const big = (v) => new Intl.NumberFormat('en-US', { notation: v >= 1e6 ? 'compact' : 'standard', maximumFractionDigits: v >= 1e6 ? 2 : 4 }).format(v);
  const small = (v) => (v === 0 ? '0' : v >= 1e-4 ? String(Number(v.toPrecision(4))) : v.toExponential(3));

  const read = () => {
    const problems = [];
    const name = val('#ln-name');
    const symbol = val('#ln-symbol').replace(/^\$/, '').toUpperCase();
    if (!name) problems.push('Give your token a name.');
    if (!/^[A-Z0-9]{1,11}$/.test(symbol)) problems.push('The symbol is 1 to 11 letters or numbers, like PINK.');
    const supplyText = decimal(val('#ln-supply')).replace(/,/g, '');
    const supplyNum = Number(supplyText);
    if (!/^\d+$/.test(supplyText) || supplyNum < 1000 || supplyNum > 1e15) problems.push('Total supply is a whole number between 1,000 and 1,000,000,000,000,000.');
    const supply = /^\d+$/.test(supplyText) ? BigInt(supplyText) * 10n ** 18n : 0n;
    const share = Number(decimal(val('#ln-share')));
    if (!(share >= 1 && share <= 100)) problems.push('Put between 1% and 100% of the supply in the pool.');
    const ethText = decimal(val('#ln-eth'));
    const eth = M.toUnits(ethText, 18);
    const ethNum = Number(ethText);
    if (eth === null || !(ethNum >= 0.0001)) problems.push('Pair the token with at least 0.0001 ETH.');
    const poolTokens = share >= 1 && share <= 100 ? (supply * BigInt(Math.round(share * 100))) / 10000n : 0n;
    const fee = Number((document.querySelector('input[name=fee]:checked') || {}).value || 10000);
    const lock = K.LOCKS[Number((document.querySelector('input[name=lock]:checked') || {}).value || 0)];
    const settings = { token: STAND_IN, windowMinutes: Number(val('#ln-window')), maxBuy: decimal(val('#ln-maxbuy')), cooldownSeconds: Number(val('#ln-cool')), pairDecimals: 18 };
    const hook = B.generate('launch', settings);
    problems.push(...hook.problems);
    return { name, symbol, supply, supplyNum, share, poolTokens, eth: eth || 0n, ethNum, fee, spacing: SPACING[fee], lock, settings, hook, problems };
  };

  let balance = null;
  const refresh = () => {
    const f = read();
    const sym = f.symbol || 'TOKEN';
    document.querySelectorAll('[data-sym]').forEach((el) => { el.textContent = sym; });
    $('#ln-go').textContent = `Launch ${f.symbol ? `$${f.symbol}` : 'token'}`;
    const keep = 100 - (f.share || 0);
    $('#ln-keep').textContent = keep > 0 ? `${big(f.supplyNum * keep / 100)} ${sym} (${Number(keep.toFixed(2))}%) go to your wallet.` : 'All of it goes into the pool: a fair launch.';
    $('#ln-bal').textContent = `Any amount from 0.0001 ETH.${balance === null ? '' : ` You have ${small(Number(ethers.formatEther(balance)))} ETH.`}`;
    $('#ln-bal').className = `ln-hint${balance !== null && f.eth + GAS_ROOM > balance ? ' is-bad' : ''}`;

    // The biggest buy against a full-range pool of `eth` moves the price by about ((x + b) / x)^2.
    const maxBuy = Number(f.settings.maxBuy);
    $('#ln-impact').textContent = f.ethNum > 0 && maxBuy > 0
      ? `At this pool size the biggest buy moves the price about ${Math.round(((1 + maxBuy / f.ethNum) ** 2 - 1) * 100)}%.`
      : '';

    const rows = [];
    if (f.ethNum > 0 && f.poolTokens > 0n) {
      const perEth = Number(ethers.formatEther(f.poolTokens)) / f.ethNum;
      const cap = f.ethNum * f.supplyNum / Number(ethers.formatEther(f.poolTokens));
      rows.push(['Starting price', `1 ETH = ${big(perEth)} ${sym}`]);
      rows.push(['Starting market cap', `${small(cap)} ETH`, true]);
      rows.push(['In the pool', `${big(Number(ethers.formatEther(f.poolTokens)))} ${sym} + ${small(f.ethNum)} ETH`]);
    }
    if (f.share < 100) rows.push(['To your wallet', `${big(f.supplyNum * (100 - f.share) / 100)} ${sym}`]);
    rows.push(['Protection', `${Number(f.settings.windowMinutes) || '—'} min, ${f.settings.maxBuy || '—'} ETH max buy`]);
    rows.push(['Liquidity', f.lock.days === 0 ? 'not locked' : f.lock.days === Infinity ? 'locked forever' : `locked ${f.lock.label}`]);
    rows.push(['Pool fee', `${f.fee / 10000}%, to you`]);
    rows.push(['Signatures', '1']);
    $('#ln-summary').innerHTML = rows.map(([k, v, bigRow]) => `<div${bigRow ? ' class="ln-big"' : ''}><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    return f;
  };
  // Until the biggest buy is set by hand, it follows the pool: a fifth of its ETH.
  let maxBuyTouched = false, ethTouched = false;
  $('#ln-maxbuy').addEventListener('input', () => { maxBuyTouched = true; });
  $('#ln-eth').addEventListener('input', () => {
    ethTouched = true;
    if (maxBuyTouched) return;
    const eth = Number(decimal(val('#ln-eth')));
    if (eth > 0) $('#ln-maxbuy').value = String(Number((eth / 5).toPrecision(2)));
  });
  $('#launch-form').addEventListener('input', refresh);
  $('#launch-form').addEventListener('change', refresh);

  /* ---------- wallet ---------- */

  const chip = $('#wallet');
  const showChip = async () => {
    if (!session.address) return;
    chip.classList.add('is-on');
    chip.innerHTML = `<code>${esc(short(session.address))}</code>`;
    chip.title = session.address;
    try { balance = await session.browser.getBalance(session.address); } catch (_) { /* later */ }
    // The suggested amount doesn't fit the wallet: suggest what does.
    if (balance !== null && !ethTouched) {
      const room = Number(ethers.formatEther(balance - GAS_ROOM));
      if (room >= 0.0001 && Number(decimal(val('#ln-eth'))) > room) {
        const fit = String(Math.floor(room * 10000) / 10000);
        $('#ln-eth').value = fit;
        if (!maxBuyTouched) $('#ln-maxbuy').value = String(Number((Number(fit) / 5).toPrecision(2)));
      }
    }
    refresh();
  };
  const connect = async () => {
    await C.connectUI($('#ln-wallets'), say);
    await showChip();
  };
  chip.addEventListener('click', () => connect().catch((err) => {
    if (!err.handled) say(C.isRejection(err) ? 'Connection cancelled in the wallet.' : esc(err.message || String(err)), C.isRejection(err) ? '' : 'error');
  }));

  /* ---------- progress ---------- */

  const steps = [];
  const showSteps = () => {
    const list = $('#ln-steps');
    list.hidden = !steps.length;
    list.innerHTML = steps.map((s) => `<li class="is-${s.state}"><span class="dm-dot"></span><span>${esc(s.label)}${s.detail ? ` <small>${esc(s.detail)}</small>` : ''}</span>${s.tx ? `<em>${link('tx', s.tx, 'tx')}</em>` : ''}</li>`).join('');
  };
  const begin = (label) => { const s = { label, state: 'busy' }; steps.push(s); showSteps(); return s; };
  const end = (s, state = 'done') => { s.state = state; showSteps(); };

  /* ---------- launching ---------- */

  let busy = false;

  const launch = async () => {
    if (busy) return;
    const f = refresh();
    say('');
    if (f.problems.length) { say(esc(f.problems[0]), 'error'); return; }
    busy = true;
    $('#ln-go').disabled = true;
    $('#ln-done').hidden = true;
    steps.length = 0;
    showSteps();
    let current = null;
    try {
      if (!session.signer) await connect();
      balance = await session.browser.getBalance(session.address);
      refresh();
      if (balance < f.eth + GAS_ROOM) throw new Error(`Not enough ETH on ${NET.name}: you have ${small(Number(ethers.formatEther(balance)))} ETH and this pool needs ${small(f.ethNum)} ETH plus a little for gas. Put less ETH in the pool, anything from 0.0001 ETH works.`);

      const files = K.files(net, f.hook.source);
      const job = {
        file: 'UnyLaunch.sol', contract: 'UnyLaunch', source: files['UnyLaunch.sol'],
        extra: { 'UnyToken.sol': files['UnyToken.sol'], 'LiquidityLock.sol': files['LiquidityLock.sol'], 'LaunchGuardHook.sol': files['LaunchGuardHook.sol'] },
        want: [['LaunchGuardHook.sol', 'LaunchGuardHook'], ['UnyToken.sol', 'UnyToken'], ['LiquidityLock.sol', 'LiquidityLock']]
      };
      current = begin(C.isCompiled(job) ? 'Compile the contracts' : 'Compile the contracts (first time: downloads the compiler, about 9 MB)');
      const c = await C.compile(job);
      end(current);

      current = begin('Work out the addresses');
      const [nonce, block] = await Promise.all([session.browser.getTransactionCount(session.address, 'pending'), session.browser.getBlock('latest')]);
      const unlockAt = K.unlockAtFor(f.lock.days, block.timestamp);
      const plan = await K.prepare({
        ethers, math: M, net, creator: session.address, nonce,
        launcherBytecode: c.bytecode, hookBytecode: c.contracts.LaunchGuardHook.bytecode, flags: f.hook.flags,
        name: f.name, symbol: f.symbol, supply: f.supply, poolTokens: f.poolTokens, eth: f.eth,
        fee: f.fee, tickSpacing: f.spacing, unlockAt
      }, (n) => { current.detail = `${n.toLocaleString()} tried`; showSteps(); });
      current.detail = '';
      end(current);

      const abis = [c.abi, c.contracts.LaunchGuardHook.abi, c.contracts.LiquidityLock.abi];
      current = begin('Check the launch before you sign');
      try {
        await session.browser.call({ from: session.address, data: plan.data, value: plan.value });
      } catch (err) {
        throw new Error(`A dry run of the launch failed, so nothing was sent. ${C.explain(err, abis)}`);
      }
      end(current);

      current = begin('Confirm in your wallet');
      const tx = await session.signer.sendTransaction({ data: plan.data, value: plan.value, nonce });
      end(current);
      current = begin(`Launching on ${NET.name}`);
      current.tx = tx.hash;
      showSteps();
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error('The launch was refused on chain, so nothing was created and your ETH is back in your wallet (minus gas). This happens if another transaction from this wallet went first; try again.');
      }
      const iface = new ethers.Interface([K.LAUNCHED]);
      const log = receipt.logs.find((l) => { try { return iface.parseLog(l).name === 'Launched'; } catch (_) { return false; } });
      if (!log) throw new Error('The transaction went through but did not report a launch.');
      const ev = iface.parseLog(log).args;
      end(current);

      const lock = BigInt(ev.lock) === 0n ? null : ev.lock;
      const key = { currency0: C.ZERO, currency1: ev.token, fee: f.fee, tickSpacing: f.spacing, hooks: ev.hook };
      const tokenInfo = { address: ev.token, symbol: f.symbol, decimals: 18 };
      const record = {
        address: ev.hook, tx: tx.hash, chainId: Number(NET.chainId), deployer: session.address,
        recipe: 'launch', settings: { ...f.settings, token: ev.token },
        contract: 'LaunchGuardHook', file: 'LaunchGuardHook.sol', source: f.hook.source, abi: c.contracts.LaunchGuardHook.abi,
        compiler: c.version, input: c.input, at: new Date().toISOString(),
        launch: { token: ev.token, name: f.name, symbol: f.symbol, supply: f.supply.toString(), launcher: log.address, lock, unlockAt: unlockAt.toString(), tokenId: ev.tokenId.toString() },
        pools: [{
          id: ev.poolId, key, a: tokenInfo, b: { address: C.ZERO, symbol: 'ETH', decimals: 18 }, tx: tx.hash,
          price: small(Number(ethers.formatEther(f.eth)) / Number(ethers.formatEther(f.poolTokens))), at: new Date().toISOString(),
          positions: [{ tokenId: ev.tokenId.toString(), tx: tx.hash, lock, unlockAt: unlockAt.toString(), at: new Date().toISOString() }]
        }]
      };
      C.store.put(record);
      showDone(record, f, unlockAt);
      current = null;
      publishAll(record);
      balance = await session.browser.getBalance(session.address).catch(() => balance);
      refresh();
    } catch (err) {
      if (current) end(current, 'error');
      if (!err.handled) say(C.isRejection(err) ? 'Cancelled in the wallet. Nothing was sent.' : esc(err.message || String(err)), C.isRejection(err) ? '' : 'error');
    } finally {
      busy = false;
      $('#ln-go').disabled = false;
    }
  };
  $('#ln-go').addEventListener('click', launch);

  /* ---------- done ---------- */

  const showDone = (rec, f, unlockAt) => {
    const L = rec.launch;
    const page = C.hookPage(rec.address);
    const share = `https://x.com/intent/post?${new URLSearchParams({
      text: `$${L.symbol} is live on ${NET.name}: launch protection on, liquidity ${L.lock ? `locked ${C.unlockText(unlockAt)}` : 'in the pool'}. Made with @${C.CONFIG.X_HANDLE || 'UnyHooks'}`,
      url: page
    })}`;
    const box = $('#ln-done');
    box.hidden = false;
    box.innerHTML = `
      <h3>$${esc(L.symbol)} is live</h3>
      <p>${esc(L.name)} · ${link('address', L.token, L.token)}</p>
      <p>Pool ${esc(L.symbol)}/ETH with launch protection${L.lock ? `, liquidity locked ${esc(C.unlockText(unlockAt))}` : ''}. Position #${esc(L.tokenId)}.</p>
      <div class="ln-done-actions">
        <a class="uh-btn uh-btn-pink uh-btn-sm" href="${esc(page)}">Open its page</a>
        <a class="uh-btn uh-btn-ghost uh-btn-sm" href="${esc(share)}" target="_blank" rel="noopener">Share on X</a>
        <button class="uh-btn uh-btn-ghost uh-btn-sm" type="button" data-act="watch">Add $${esc(L.symbol)} to wallet</button>
      </div>
      <p class="ln-done-links">
        <a href="${esc(C.uniswapSwap(L.token))}" target="_blank" rel="noopener">Buy on Uniswap</a>
        <a href="hooks.html">My hooks</a>
        ${link('tx', rec.tx, 'Transaction')}
      </p>
      <div class="ln-sources"><b>Source code</b><ul id="ln-sources"></ul></div>`;
    box.onclick = async (e) => {
      if (e.target.dataset.act !== 'watch') return;
      try {
        await session.eip1193.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: { address: L.token, symbol: L.symbol.slice(0, 11), decimals: 18 } } });
      } catch (_) { /* the wallet said no or does not support it */ }
    };
  };

  const publishAll = async (rec) => {
    const L = rec.launch;
    const items = [
      { label: `${L.symbol} token`, address: L.token, file: 'UnyToken.sol', contract: 'UnyToken', key: 'tokenVerified' },
      { label: 'Launch protection hook', address: rec.address, file: 'LaunchGuardHook.sol', contract: 'LaunchGuardHook', key: 'verified' },
      ...(L.lock ? [{ label: 'Liquidity lock', address: L.lock, file: 'LiquidityLock.sol', contract: 'LiquidityLock', key: 'lockVerified' }] : [])
    ];
    const list = $('#ln-sources');
    const draw = () => {
      list.innerHTML = items.map((it) => `<li class="${it.state === 'done' ? 'ln-ok' : ''}">${esc(it.label)}: ${
        it.state === 'done' ? `<a href="${esc(C.sourcifyPage(it.address))}" target="_blank" rel="noopener">published</a>`
          : it.state === 'error' ? `not published yet (${esc(it.error)}). It can be published later from My hooks.`
            : 'publishing…'}</li>`).join('');
    };
    draw();
    for (const it of items) {
      try {
        // These contracts were created by the launch transaction, not sent on their
        // own, so Sourcify matches them by their code on chain.
        const match = await C.verify({ address: it.address, input: rec.input, compiler: rec.compiler, file: it.file, contract: it.contract });
        it.state = 'done';
        C.store.update(rec.address, (r) => { r[it.key] = match; return r; });
      } catch (err) {
        it.state = 'error';
        it.error = err.message;
      }
      draw();
    }
  };

  refresh();
})();
