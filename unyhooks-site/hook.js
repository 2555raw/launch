/* UnyHooks — a hook's public page: hook.html?a=0x… (or /h/0x… through server.js).

   For people deciding whether to trust a pool, so every claim is checked on
   chain rather than taken from a database:
     - what the hook does, read from the contract's own settings
     - whether its source (and the token's, and the lock's) is public on Sourcify
     - whether the token is an UnyHooks token (fixed supply, no owner): its
       code hash must match, byte for byte
     - how much of the pool's liquidity sits in genuine LiquidityLocks, and
       until when: Locked events find candidates, the PositionManager's
       ownerOf and the lock's code hash confirm them
     - whether launch protection is still on, from the hook's own clock
   Prices come from the pool itself; USD figures from DexScreener once it lists
   the pool. Needs chain.js and launch-kit.js. */

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const msg = $('#msg');
  const say = (html, kind = '') => { msg.innerHTML = html; msg.className = `dp-msg${kind ? ` is-${kind}` : ''}`; };

  const C = window.UnyChain;
  const B = window.UnyBuilder;
  const M = window.UnyPoolMath;
  const { ethers } = window;
  if (!C || !B || !M || !ethers) { $('#title').textContent = 'Could not load'; say('The page\'s libraries did not load. Check your connection and reload.', 'error'); return; }
  const { NET, esc, short, link } = C;
  document.querySelectorAll('[data-net="name"]').forEach((el) => { el.textContent = NET.name; });

  const usd = (n) => (Number.isFinite(Number(n)) && n !== null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: Number(n) >= 1e5 ? 'compact' : 'standard', maximumFractionDigits: Number(n) >= 1 ? 2 : 6 }).format(Number(n)) : null);
  const num = (v) => (v === 0 ? '0' : v >= 1e6 ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v) : v >= 1e-4 ? String(Number(v.toPrecision(5))) : v.toExponential(3));
  const date = (s) => new Date(Number(s) * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const left = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}:${String(s % 60).padStart(2, '0')} left`;
  };
  const ERC20_EXTRA = ['function name() view returns (string)', 'function totalSupply() view returns (uint256)'];

  /* ---------- which hook ---------- */

  const params = new URLSearchParams(window.location.search);
  const fromPath = (window.location.pathname.match(/\/h\/(0x[0-9a-fA-F]{40})/) || [])[1];
  const raw = params.get('a') || fromPath || '';
  if (!ethers.isAddress(raw)) {
    $('#title').textContent = 'No hook address';
    say('This page shows one hook. Open it from a link like <code>hook.html?a=0x…</code>, or from <a href="hooks.html">My hooks</a>.', 'error');
    return;
  }
  const hook = ethers.getAddress(raw);
  $('#addr').innerHTML = `Hook ${link('address', hook, hook)}`;

  /* ---------- reading ---------- */

  // The pools to show: the launch's, one named in the link, the ones this
  // browser knows, or, failing those, every pool on the chain that uses the hook.
  const findPools = async (launch) => {
    const ids = [];
    if (launch) ids.push(launch.poolId);
    if (/^0x[0-9a-fA-F]{64}$/.test(params.get('pool') || '')) ids.push(params.get('pool').toLowerCase());
    const mine = C.store.get(hook);
    (mine && mine.pools || []).forEach((p) => ids.push(p.id));
    const unique = [...new Set(ids.map((x) => x.toLowerCase()))];
    const keys = [];
    for (const id of unique) {
      const known = mine && (mine.pools || []).find((p) => p.id.toLowerCase() === id);
      const key = known ? known.key : await C.findPool(id);
      if (key && key.hooks.toLowerCase() === hook.toLowerCase()) keys.push({ id, key });
    }
    if (keys.length) return keys;
    const iface = new ethers.Interface(C.ABI.PM);
    const logs = await C.allLogs({ address: NET.poolManager, topics: [iface.getEvent('Initialize').topicHash] });
    return logs.map((l) => iface.parseLog(l).args).filter((a) => a.hooks.toLowerCase() === hook.toLowerCase()).slice(0, 3)
      .map((a) => ({ id: a.id, key: { currency0: a.currency0, currency1: a.currency1, fee: Number(a.fee), tickSpacing: Number(a.tickSpacing), hooks: a.hooks } }));
  };

  const tokenFacts = async (address) => {
    const info = await C.tokenInfo(address);
    const c = new ethers.Contract(address, ERC20_EXTRA, C.reader());
    const [name, supply, genuine, source] = await Promise.all([
      c.name().catch(() => info.symbol), c.totalSupply().catch(() => null), C.isGenuine('token', address), C.sourcifyStatus(address).catch(() => undefined)
    ]);
    return { ...info, name, supply, genuine, source };
  };

  const dex = async (id) => {
    try {
      const d = await (await fetch(`https://api.dexscreener.com/latest/dex/pairs/${NET.dexscreenerChain || 'robinhood'}/${id}`)).json();
      return (d && d.pairs && d.pairs[0]) || null;
    } catch (_) { return null; }
  };

  /* ---------- drawing ---------- */

  const check = (kind, html) => `<div class="hk-check is-${kind}"><span class="hk-dot" aria-hidden="true"></span><p>${html}</p></div>`;
  const timers = [];
  const tick = () => timers.forEach((t) => t());

  const load = async () => {
    const code = await C.reader().getCode(hook);
    if (code === '0x') {
      $('#title').textContent = 'No contract here';
      say(`There is no contract at this address on ${esc(NET.name)}.`, 'error');
      return;
    }
    const [known, , launch, source] = await Promise.all([
      C.recognise(hook).catch(() => null),
      // read the chain's clock now, so the countdowns below follow it
      C.chainNow().catch(() => 0).then(() => null),
      C.launchOf(hook).catch(() => null),
      C.sourcifyStatus(hook).catch(() => undefined)
    ]);
    const pools = await findPools(launch).catch(() => []);
    const main = pools[0] || null;
    const tokenAddr = launch ? launch.token
      : known && known.recipe === 'launch' ? known.settings.token
        : main ? (BigInt(main.key.currency0) === 0n ? main.key.currency1 : main.key.currency0) : null;
    const token = tokenAddr ? await tokenFacts(tokenAddr).catch(() => null) : null;

    /* title */
    const title = token ? `$${token.symbol}` : known ? known.contract : 'Uniswap V4 hook';
    $('#title').innerHTML = `${esc(title)}${token && token.name && token.name !== token.symbol ? ` <span class="hk-name">${esc(token.name)}</span>` : ''}`;
    document.title = 'UnyHooks';
    $('#kicker').innerHTML = `${launch ? 'Launched with UnyHooks' : known ? `${esc(B.RECIPES[known.recipe].title)} hook` : 'Uniswap V4 hook'} on ${esc(NET.name)}`;
    if (token) $('#addr').innerHTML = `Token ${link('address', token.address, token.address)} <button type="button" class="hk-copy" data-copy="${esc(token.address)}">Copy</button>`;

    /* the pool now */
    let state = null;
    let pair = null;
    let locks = [];
    if (main) {
      [state, pair, locks] = await Promise.all([C.readPool(main.key).catch(() => null), dex(main.id), C.locksForPool(main.id).catch(() => [])]);
    }
    const eth = { address: C.ZERO, symbol: 'ETH', decimals: 18 };
    const other = main && token ? (BigInt(main.key.currency0) === BigInt(token.address) ? await C.tokenInfo(main.key.currency1) : await C.tokenInfo(main.key.currency0)) : eth;
    const live = state && state.sqrtPriceX96 > 0n;
    const priceIn = live && token ? M.priceOf(state.sqrtPriceX96, token, other) : null;

    if (live && token) {
      const change = pair && pair.priceChange && Number(pair.priceChange.h24);
      $('#price').hidden = false;
      $('#price').innerHTML = `
        <b>${pair && pair.priceUsd ? esc(usd(pair.priceUsd)) : `${esc(C.price(priceIn))} ${esc(other.symbol)}`}</b>
        <span>${pair && pair.priceUsd ? `${esc(C.price(priceIn))} ${esc(other.symbol)} · ` : ''}1 ${esc(other.symbol)} = ${esc(C.price(1 / priceIn))} ${esc(token.symbol)}</span>
        ${Number.isFinite(change) ? `<span class="hk-change ${change >= 0 ? 'is-up' : 'is-down'}">${change >= 0 ? '+' : ''}${change.toFixed(2)}% 24h</span>` : ''}`;
    }

    /* actions */
    const page = window.location.href;
    const shareText = token ? `$${token.symbol} on ${NET.name}${locks.length ? ', liquidity locked' : ''}. Checked on chain with @${C.CONFIG.X_HANDLE || 'UnyHooks'}` : `A Uniswap V4 hook on ${NET.name}, checked with @${C.CONFIG.X_HANDLE || 'UnyHooks'}`;
    $('#actions').hidden = false;
    $('#actions').innerHTML = `
      ${token ? `<a class="uh-btn uh-btn-pink uh-btn-sm" href="${esc(C.uniswapSwap(token.address))}" target="_blank" rel="noopener">Buy $${esc(token.symbol)}</a>` : ''}
      <a class="uh-btn uh-btn-ghost uh-btn-sm" href="https://x.com/intent/post?${new URLSearchParams({ text: shareText, url: page })}" target="_blank" rel="noopener">Share on X</a>
      <button class="uh-btn uh-btn-ghost uh-btn-sm" type="button" data-copy="${esc(page)}">Copy link</button>
      ${main ? `<a class="hk-link" href="${esc(C.dexscreenerPool(main.id))}" target="_blank" rel="noopener">DexScreener</a>` : ''}`;

    /* checks */
    const checks = [];
    checks.push(source
      ? check('ok', `Hook source <a href="${esc(C.sourcifyPage(hook))}" target="_blank" rel="noopener">published on Sourcify</a>: anyone can read the exact code.`)
      : source === null ? check('warn', 'The hook\'s source is not published. Nobody can read what it does from its code.')
        : check('info', 'Could not reach Sourcify to check the hook\'s source.'));
    if (token) {
      checks.push(token.genuine
        ? check('ok', `Token: fixed supply of ${esc(num(Number(M.fromUnits(token.supply, token.decimals, 0))))}, no owner. Nobody can mint more, tax or block transfers${token.source ? ` (<a href="${esc(C.sourcifyPage(token.address))}" target="_blank" rel="noopener">source</a>)` : ''}.`)
        : check('info', 'The token was not made with UnyHooks, so its rules are unknown here. Read its code before buying.'));
    }
    const lockedL = locks.reduce((sum, l) => sum + l.liquidity, 0n);
    if (live && state.liquidity > 0n) {
      if (lockedL > 0n) {
        const share = Number((lockedL * 10000n) / state.liquidity) / 100;
        const soonest = locks.reduce((a, l) => (l.unlockAt < a ? l.unlockAt : a), locks[0].unlockAt);
        const until = soonest === (window.UnyLaunchKit || {}).MAX_UINT256 ? 'forever' : `until ${date(soonest)}`;
        checks.push(check('ok', `<b>${share >= 99.9 ? 'All' : `${share}%`}</b> of the pool's liquidity is locked ${esc(until)}. Nobody can pull it before then.`));
      } else {
        checks.push(check('warn', 'The pool\'s liquidity is not locked: whoever added it can remove it at any time.'));
      }
    } else if (main) {
      checks.push(check('warn', 'The pool has no liquidity yet.'));
    }
    if (known && known.recipe === 'launch' && main) {
      const h = new ethers.Contract(hook, ['function launchedAt(bytes32) view returns (uint256)'], C.reader());
      const started = Number(await h.launchedAt(main.id).catch(() => 0n));
      const ends = started + known.settings.windowMinutes * 60;
      if (started) {
        const id = `hk-prot-${timers.length}`;
        const s = known.settings;
        checks.push(check('info', `<span id="${id}"></span> Buys up to ${esc(String(s.maxBuy))} ETH, one per wallet every ${esc(String(s.cooldownSeconds))}s.`));
        timers.push(() => {
          const el = document.getElementById(id);
          if (!el) return;
          const rest = ends - C.chainNowSync();
          el.innerHTML = rest > 0 ? `<b>Launch protection on</b>, ${esc(left(rest))}.` : `Launch protection ended ${esc(date(ends))}.`;
        });
      }
    }
    if (launch) {
      const blk = await C.reader().getBlock(launch.block).catch(() => null);
      checks.push(check('info', `Launched by ${link('address', launch.creator)}${blk ? ` on ${esc(date(blk.timestamp))}` : ''} in ${link('tx', launch.tx, 'one transaction')}.`));
    }
    $('#checks').hidden = false;
    $('#checks').innerHTML = checks.join('');

    /* market */
    if (main) {
      const stats = [];
      if (pair && pair.marketCap) stats.push(['Market cap', usd(pair.marketCap)]);
      else if (token && priceIn !== null && token.supply !== null && other.address === C.ZERO) stats.push(['Market cap', `${C.price(priceIn * Number(M.fromUnits(token.supply, token.decimals, 6)))} ETH`]);
      if (pair && pair.liquidity && pair.liquidity.usd) stats.push(['Liquidity', usd(pair.liquidity.usd)]);
      else if (live && BigInt(main.key.currency0) === 0n && state.liquidity > 0n) stats.push(['ETH in the pool', `about ${Number(Number(M.fromUnits((state.liquidity * M.Q96) / state.sqrtPriceX96, 18, 6)).toPrecision(3))}`]);
      if (pair && pair.volume) stats.push(['24h volume', usd(pair.volume.h24) || '$0']);
      if (pair && pair.txns && pair.txns.h24) stats.push(['24h trades', String((pair.txns.h24.buys || 0) + (pair.txns.h24.sells || 0))]);
      stats.push(['Pool fee', main.key.fee === 0x800000 ? 'set by the hook' : `${main.key.fee / 10000}%`]);
      $('#stats-card').hidden = false;
      $('#stats').innerHTML = stats.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
      $('#stats-note').textContent = pair ? '' : 'USD figures appear once DexScreener lists the pool, usually after the first trades.';
    }

    /* what it does */
    if (known) {
      $('#does-card').hidden = false;
      $('#does').innerHTML = B.describe(known.recipe, { ...B.defaults(known.recipe), ...known.settings }).map((l) => `<li>${l}</li>`).join('');
    }

    /* locks */
    if (main) {
      $('#locks-card').hidden = false;
      $('#locks').innerHTML = locks.length
        ? `<ul class="hk-locks">${locks.map((l, i) => `
            <li>
              <div><b>Position #${esc(l.tokenId)}</b> <span class="hk-tag">LiquidityLock ✓</span></div>
              <div class="hk-lock-time" data-lock="${i}"></div>
              <div class="hk-lock-links">${link('address', l.address, `Lock ${short(l.address)}`)} · <a href="${esc(C.sourcifyPage(l.address))}" target="_blank" rel="noopener">source</a> · <a href="${esc(C.uniswapPosition(l.tokenId))}" target="_blank" rel="noopener">position on Uniswap</a></div>
            </li>`).join('')}</ul>
            <p class="hk-note">A LiquidityLock lets its owner collect trading fees, and push the date later, but not take the liquidity out before the date. Its code is checked byte for byte against the published one.</p>`
        : '<p class="hk-note">No locked positions found for this pool.</p>';
      locks.forEach((l, i) => timers.push(() => {
        const el = document.querySelector(`[data-lock="${i}"]`);
        if (!el) return;
        if (l.forever) { el.textContent = 'Locked forever'; return; }
        const rest = Number(l.unlockAt) - C.chainNowSync();
        el.textContent = rest > 0 ? `Locked until ${date(l.unlockAt)} · ${left(rest)}` : `Unlocked since ${date(l.unlockAt)}`;
      }));
    }

    /* contracts */
    const rows = [];
    if (token) rows.push(['Token', link('address', token.address, token.address)]);
    rows.push(['Hook', link('address', hook, hook)]);
    if (main) rows.push(['Pool ID', `<code>${esc(main.id)}</code>`]);
    if (launch && launch.lock) rows.push(['Lock', link('address', launch.lock, launch.lock)]);
    if (launch) rows.push(['Launch', link('tx', launch.tx, launch.tx)]);
    $('#contracts-card').hidden = false;
    $('#contracts').innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('');

    tick();
    setInterval(tick, 1000);
  };

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); const t = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = t; }, 1400); } catch (_) { /* no clipboard */ }
  });

  load().catch((err) => {
    if (window.console) console.error(err);
    $('#title').textContent = 'Could not read this hook';
    say(esc(C.explain(err)), 'error');
  });
})();
