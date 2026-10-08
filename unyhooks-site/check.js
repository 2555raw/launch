/* UnyHooks — check.html: a safety check for any token on Robinhood Chain.

   Paste a token, a hook or a Uniswap V4 pool ID. A hook goes to its own
   public page (hook.html). For a token, everything is read live:
     - the token: an UnyHooks token (checked byte for byte), or else its owner,
       whether it is an upgradeable proxy, and which rule-changing functions
       its code carries (found by their 4-byte selectors)
     - whether its source is public on Sourcify
     - its Uniswap V4 pools, the hook on each and what that hook does, and how
       much of the liquidity sits in genuine LiquidityLocks
   Then one verdict: clean, be careful, or high risk. Needs chain.js,
   builder.js and launch-kit.js. */

(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const msg = $('#msg');
  const say = (html, kind = '') => { msg.innerHTML = html; msg.className = `dp-msg${kind ? ` is-${kind}` : ''}`; };

  const C = window.UnyChain;
  const B = window.UnyBuilder;
  const M = window.UnyPoolMath;
  const { ethers } = window;
  if (!C || !B || !M || !ethers) { say('The page\'s libraries did not load. Check your connection and reload.', 'error'); return; }
  const { NET, esc, link } = C;
  document.querySelectorAll('[data-net="name"]').forEach((el) => { el.textContent = NET.name; });

  const date = (s) => new Date(Number(s) * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const num = (v) => (v >= 1e6 ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v) : String(Number(Number(v).toPrecision(6))));
  const check = (kind, html) => `<div class="hk-check is-${kind}"><span class="hk-dot" aria-hidden="true"></span><p>${html}</p></div>`;

  // Functions that let someone change a token's rules after launch, by the
  // 4-byte selector the compiler puts in its code.
  const RISKY = [
    ['mint more tokens', ['mint(address,uint256)', 'mint(uint256)', 'mintTo(address,uint256)']],
    ['pause transfers', ['pause()', 'setPaused(bool)']],
    ['block wallets', ['blacklist(address)', 'addToBlacklist(address)', 'setBlacklist(address,bool)', 'blacklistAddress(address,bool)', 'setBot(address,bool)', 'setBots(address[],bool)']],
    ['change fees or taxes', ['setTaxFee(uint256)', 'setFee(uint256)', 'setFees(uint256,uint256)', 'setBuyFee(uint256)', 'setSellFee(uint256)', 'setTaxes(uint256,uint256)', 'updateFees(uint256,uint256)']],
    ['cap transactions or wallets', ['setMaxTxAmount(uint256)', 'setMaxWallet(uint256)', 'setMaxWalletSize(uint256)']],
    ['switch trading on or off', ['enableTrading()', 'setTradingEnabled(bool)', 'openTrading()']]
  ].map(([what, sigs]) => [what, sigs.map((sig) => ethers.id(sig).slice(2, 10))]);
  const EIP1967_IMPL = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

  const pm = new ethers.Interface(C.ABI.PM);
  const INIT = pm.getEvent('Initialize').topicHash;

  /* ---------- reading ---------- */

  const tokenFacts = async (address) => {
    const r = C.reader();
    const info = await C.tokenInfo(address);
    const c = new ethers.Contract(address, ['function name() view returns (string)', 'function totalSupply() view returns (uint256)', 'function owner() view returns (address)'], r);
    const [name, supply, owner, genuine, source, code, impl] = await Promise.all([
      c.name().catch(() => info.symbol), c.totalSupply().catch(() => null), c.owner().catch(() => undefined),
      C.isGenuine('token', address), C.sourcifyStatus(address).catch(() => undefined),
      r.getCode(address), r.getStorage(address, EIP1967_IMPL).catch(() => ethers.ZeroHash)
    ]);
    const risky = RISKY.filter(([, sels]) => sels.some((s) => code.includes(`63${s}`))).map(([what]) => what);
    return { ...info, name, supply, owner, genuine, source, risky, proxy: BigInt(impl) !== 0n ? ethers.getAddress(`0x${impl.slice(26)}`) : null };
  };

  // Every Uniswap V4 pool the token is in, from the PoolManager's Initialize events.
  const poolsOf = async (token) => {
    const t = ethers.zeroPadValue(token, 32);
    const [as1, as0] = await Promise.all([
      C.allLogs({ address: NET.poolManager, topics: [INIT, null, null, t] }),
      C.allLogs({ address: NET.poolManager, topics: [INIT, null, t] })
    ]);
    return [...as1, ...as0].map((l) => {
      const a = pm.parseLog(l).args;
      return { id: a.id, key: { currency0: a.currency0, currency1: a.currency1, fee: Number(a.fee), tickSpacing: Number(a.tickSpacing), hooks: a.hooks }, block: l.blockNumber };
    });
  };

  const poolFacts = async (p, token) => {
    const hook = p.key.hooks;
    const noHook = BigInt(hook) === 0n;
    const [state, known, source] = await Promise.all([
      C.readPool(p.key).catch(() => null),
      noHook ? null : C.recognise(hook).catch(() => null),
      noHook ? null : C.sourcifyStatus(hook).catch(() => undefined)
    ]);
    const live = !!(state && state.liquidity > 0n);
    const [locks, launch] = await Promise.all([
      live ? C.locksForPool(p.id).catch(() => []) : [],
      known && known.recipe === 'launch' ? C.launchOf(hook, token).catch(() => null) : null
    ]);
    const locked = locks.reduce((s, l) => s + l.liquidity, 0n);
    const share = live ? Number((locked * 10000n) / state.liquidity) / 100 : 0;
    const soonest = locks.length ? locks.reduce((a, l) => (l.unlockAt < a ? l.unlockAt : a), locks[0].unlockAt) : null;
    return { ...p, noHook, known, source, state, live, locks, share, soonest, forever: locks.length > 0 && locks.every((l) => l.forever), launch };
  };

  /* ---------- the check ---------- */

  let running = 0;
  const run = async (q) => {
    const my = ++running;
    q = q.trim();
    $('#verdict').hidden = true; $('#checks').hidden = true; $('#pools-card').hidden = true;
    history.replaceState(null, '', `?q=${encodeURIComponent(q)}`);
    let token = null;
    let only = null;

    if (/^0x[0-9a-fA-F]{64}$/.test(q)) {
      say('Finding the pool…');
      const key = await C.findPool(q.toLowerCase());
      if (!key) { say(`No Uniswap V4 pool with that ID on ${esc(NET.name)}.`, 'error'); return; }
      token = BigInt(key.currency0) === 0n ? key.currency1 : key.currency0;
      only = q.toLowerCase();
    } else if (ethers.isAddress(q)) {
      say('Reading the contract…');
      const code = await C.reader().getCode(q);
      if (code === '0x') { say('There is no contract at this address: it is a wallet, not a token.', 'error'); return; }
      const known = await C.recognise(q).catch(() => null);
      if (known) { say('That is a hook. Opening its page…'); window.location.href = `hook.html?a=${ethers.getAddress(q)}`; return; }
      token = ethers.getAddress(q);
    } else {
      say('Paste a 0x address (42 characters) or a pool ID (66 characters).', 'error');
      return;
    }

    let t;
    try { t = await tokenFacts(token); } catch (_) { say('This contract is not an ERC-20 token, so there is nothing to check here.', 'error'); return; }
    if (my !== running) return;
    say(`Checking $${esc(t.symbol)}'s pools…`);
    let poolsFailed = false;
    let pools = await poolsOf(token).catch(() => { poolsFailed = true; return []; });
    if (only) pools = pools.filter((p) => p.id.toLowerCase() === only);
    // newest first; at most four, the ETH pairs before the rest
    pools = pools.sort((a, b) => (BigInt(b.key.currency0) === 0n) - (BigInt(a.key.currency0) === 0n) || b.block - a.block).slice(0, 4);
    const facts = await Promise.all(pools.map((p) => poolFacts(p, token)));
    if (my !== running) return;
    const main = facts.filter((p) => p.live).sort((a, b) => (b.state.liquidity > a.state.liquidity ? 1 : -1))[0] || facts[0] || null;

    /* checks */
    const out = [];
    const tally = { ok: 0, warn: 0, bad: 0 };
    const add = (kind, html) => { if (tally[kind] !== undefined) tally[kind]++; out.push(check(kind, html)); };

    if (t.genuine) {
      add('ok', `An UnyHooks token, checked byte for byte: fixed supply of ${esc(num(Number(M.fromUnits(t.supply, t.decimals, 0))))}, no owner. Nobody can mint more, tax or block transfers.`);
    } else {
      if (t.proxy) add('bad', `It is an upgradeable proxy: whoever controls it can swap in new code at any time (now ${link('address', t.proxy)}).`);
      if (t.owner === undefined) add('info', 'It has no <code>owner()</code> function.');
      else if (BigInt(t.owner) === 0n) add('ok', 'Its owner is the zero address: ownership was given up.');
      else add('warn', `It has an owner, ${link('address', t.owner)}. Read what the owner can do in its code before you buy.`);
      if (t.risky.length) add(t.owner && BigInt(t.owner) !== 0n ? 'bad' : 'warn', `Its code has functions to <b>${esc(t.risky.join(', '))}</b>.`);
      else add('ok', 'No functions to mint, pause, block wallets or change fees were found in its code.');
    }
    if (t.source) add('ok', `Source <a href="${esc(C.sourcifyPage(token))}" target="_blank" rel="noopener">published on Sourcify</a>.`);
    else if (t.source === null) add('warn', 'Its source is not published on Sourcify, so its code can\'t be read here. It may be verified on the explorer.');

    if (poolsFailed) {
      add('warn', `Could not read its pools from ${esc(NET.name)} right now, so its liquidity was not checked. Try again in a minute.`);
    } else if (!facts.length) {
      add('warn', 'No Uniswap V4 pool found for it. Pools on Uniswap V2 or V3 are not checked here.');
    } else if (main) {
      if (!main.live) add('warn', 'Its pools have no liquidity yet.');
      else if (main.share > 0) add('ok', `<b>${main.share >= 99.9 ? 'All' : `${main.share}%`}</b> of the main pool's liquidity is locked ${main.forever ? 'forever' : `until ${esc(date(main.soonest))}`}.`);
      else add('bad', 'The main pool\'s liquidity is not locked: whoever added it can pull it at any time.');
      const unknown = facts.filter((p) => !p.noHook && !p.known);
      if (unknown.some((p) => !p.source)) add('bad', 'A pool runs a hook whose code is not public: it could change or refuse any swap.');
      else if (unknown.length) add('warn', 'A pool runs a hook that is not one of UnyHooks\'. Its code is public; read what it does.');
      if (main.launch) add('ok', `Launched with UnyHooks by ${link('address', main.launch.creator)} in ${link('tx', main.launch.tx, 'one transaction')}.`);
    }

    const verdict = tally.bad ? ['bad', '×', 'High risk', 'Something here lets someone take money out or change the rules. Read the red points.']
      : tally.warn ? ['warn', '!', 'Be careful', 'Nothing alarming, but some things could not be confirmed. Read the yellow points.']
        : ['ok', '✓', 'Looks clean', 'Every check passed. That is not a guarantee: a token can still lose value.'];
    $('#verdict').className = `bd-card hk-card ck-verdict is-${verdict[0]}`;
    $('#verdict').innerHTML = `<span class="ck-badge" aria-hidden="true">${verdict[1]}</span><h2>$${esc(t.symbol)}: ${esc(verdict[2])}</h2><p>${esc(verdict[3])} ${esc(t.name && t.name !== t.symbol ? t.name : '')} · ${link('address', token, C.short(token))}</p>`;
    $('#verdict').hidden = false;
    $('#checks').innerHTML = out.join('');
    $('#checks').hidden = false;

    /* pools */
    if (facts.length) {
      const sym = async (a) => (BigInt(a) === 0n ? 'ETH' : (await C.tokenInfo(a).catch(() => ({ symbol: C.short(a) }))).symbol);
      const rows = await Promise.all(facts.map(async (p) => {
        const pair = `${await sym(p.key.currency0)} / ${await sym(p.key.currency1)}`;
        const fee = p.key.fee === 0x800000 ? 'fee set by the hook' : `${p.key.fee / 10000}% fee`;
        const hookLine = p.noHook ? 'No hook: a plain pool.'
          : p.known ? `${esc(B.RECIPES[p.known.recipe].title)} hook: ${B.describe(p.known.recipe, { ...B.defaults(p.known.recipe), ...p.known.settings }).join(' ')}`
            : `Unknown hook ${link('address', p.key.hooks)}${p.source ? ' (source public)' : ' (source not public)'}.`;
        const lock = !p.live ? 'No liquidity yet.' : p.share > 0 ? `${p.share >= 99.9 ? 'All' : `${p.share}%`} of the liquidity locked ${p.forever ? 'forever' : `until ${esc(date(p.soonest))}`}.` : 'Liquidity not locked.';
        return `<div class="ck-pool">
          <div class="ck-pool-head"><b>${esc(pair)}</b><span class="hk-note">${esc(fee)}</span>${p.noHook ? '' : `<a href="hook.html?a=${esc(p.key.hooks)}&pool=${esc(p.id)}">Open the pool's page</a>`}</div>
          <ul><li>${hookLine}</li><li>${lock}</li></ul>
        </div>`;
      }));
      $('#pools').innerHTML = rows.join('');
      $('#pools-card').hidden = false;
    }
    say('');
  };

  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    run($('#q').value).catch((err) => say(esc(C.explain(err)), 'error'));
  });
  const q = new URLSearchParams(window.location.search).get('q');
  if (q) { $('#q').value = q; run(q).catch((err) => say(esc(C.explain(err)), 'error')); }
})();
