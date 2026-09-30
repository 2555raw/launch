/* Yuelong — one coin's page (token.html?chain=<id>&c=<curve>).
   The indexer supplies the coin, its history and its trades; the chain's public RPC supplies
   live quotes and balances; the visitor's wallet signs. Buys and sells go through the router,
   which trades on the curve until it fills and in the coin's pool after that. */

(() => {
  'use strict';

  const Y = window.YL;
  if (!Y || !document.getElementById('tk')) return;
  const { $, $$, esc } = Y;
  const W = Y.wallet;

  const qs = new URLSearchParams(location.search);
  const chainId = Number(qs.get('chain'));
  const curveAddr = qs.get('c') || '';
  const E18 = 10n ** 18n;
  const SUPPLY = 10n ** 27n;
  const KIND = { subnet: 'Subnet Coin', candidate: 'Subnet Candidate', ecosystem: 'TAO Ecosystem' };

  let net = null, tk = null, trades = [], C = null;
  let range = 0, side = 'buy', slipBps = 300n, busy = false, qseq = 0, lastQuote = null;
  const bal = { native: 0n, token: 0n, quote: 0n, tokenAllow: 0n, quoteAllow: 0n, block: 0 };

  const state = (html) => { const s = $('#tk-state'); s.innerHTML = html; s.hidden = !html; };
  const qd = () => tk.quoteDecimals || 18;
  const sym = () => tk.quoteSymbol;
  const pair = () => net.pairs.find((p) => p.address.toLowerCase() === tk.quote.toLowerCase()) || { native: false, symbol: sym() };
  const fq = (w) => Y.fmtAmt(Y.toNum(w, qd()));
  const ft = (w) => Y.fmtAmt(Y.toNum(w));
  const px = (raw) => Y.toNum(raw, qd());   // raw price is quote units × 1e18 per coin unit
  const usd = (v) => (net.usd && pair().native ? Y.fmtUsd(v * net.usd) : '');
  const parseAmt = (v, dec) => {
    const s = String(v || '').trim().replace(/,/g, '');
    if (!/^\d*\.?\d*$/.test(s) || !s || s === '.') return null;
    const [i, f = ''] = s.split('.');
    const r = BigInt(i || '0') * 10n ** BigInt(dec) + BigInt((f + '0'.repeat(dec)).slice(0, dec) || '0');
    return r > 0n ? r : null;
  };
  const toStr = (w, dec) => {
    const s = w.toString().padStart(dec + 1, '0');
    const i = s.slice(0, -dec), f = s.slice(-dec).replace(/0+$/, '');
    return f ? `${i}.${f}` : i;
  };

  /* ------------------------------------------------------------ loading */

  let tries = 0;
  async function load(first) {
    let j;
    try { j = await Y.api(`/api/token/${chainId}/${curveAddr}`); if (!j.token) throw new Error('not indexed'); }
    catch (_) {
      if (!first) return;
      // a coin launched seconds ago may not be indexed yet: nudge the indexer and wait
      if (tries++ === 0) fetch(`/api/poke/${chainId}`, { method: 'POST' }).catch(() => {});
      if (tries > 40) { state('<h2>Coin not found</h2><p>Nothing on this address has been indexed. Check the link, or <a href="launch.html">find your launch by its transaction</a>.</p>'); return; }
      state('<h2>Indexing this coin…</h2><p>It was just created. This takes a few seconds.</p>');
      setTimeout(() => load(true), 1500);
      return;
    }
    tk = j.token;
    trades = j.trades;
    if (first) await setup();
    render();
    refreshChain();
  }

  async function setup() {
    state('');
    $('#tk').hidden = false;
    const [e, A, p] = await Promise.all([Y.ethers(), Y.abi(), Y.reader(net)]);
    C = {
      e, A, p,
      router: new e.Contract(net.router, A.YuelongRouter, p),
      token: new e.Contract(tk.token, A.YuelongToken, p),
      quote: new e.Contract(tk.quote, A.YuelongToken, p),
    };
    document.title = `$${tk.symbol} · ${tk.name} · Yuelong`;
    $('#crumb').textContent = '$' + tk.symbol;
    $('#tk-unit').textContent = sym();
    $('#tk-th-q').textContent = sym();
    if (qs.get('new')) {
      Y.toast(`<b>$${esc(tk.symbol)} is live.</b> Share the link: anyone can trade it now.`, 'is-good', 8000);
      history.replaceState(null, '', `token.html?chain=${chainId}&c=${tk.curve}`);
    }
    setSide('buy');
    setInterval(() => { if (!document.hidden) load(false); }, 10000);
    W.onChange(() => refreshChain());
    new ResizeObserver(() => drawChart()).observe($('#tk-chart'));
  }

  /* ------------------------------------------------------------ rendering */

  function render() {
    const art = window.YLart ? window.YLart(tk.symbol) : '';
    const av = $('#tk-av');
    if (!av.dataset.set) {
      av.src = tk.image || art;
      av.onerror = () => { if (av.src !== art) av.src = art; };
      av.dataset.set = '1';
    }
    $('#tk-kind').textContent = `${KIND[tk.category] || KIND.ecosystem}${tk.subnet != null ? ' · SN' + tk.subnet : ''} · ${net.short}`;
    $('#tk-name').textContent = tk.name;
    $('#tk-sym').textContent = '$' + tk.symbol;
    const me = W.state.account && W.state.account.toLowerCase() === tk.creator.toLowerCase();
    $('#tk-by').innerHTML = `by ${addrLink(tk.creator)}${me ? ' <em class="yl-you">you</em>' : ''} · created ${Y.ago(tk.createdAt)} ago`;

    const p = px(tk.price);
    $('#tk-price').innerHTML = `${esc(Y.fmtPrice(p))} <small>${esc(sym())}</small>`;
    const ch = tk.change24h || 0;
    const chEl = $('#tk-change');
    chEl.textContent = `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}% · 24h${usd(p) ? ' · ' + usd(p) : ''}`;
    chEl.className = ch > 0 ? 'is-up' : ch < 0 ? 'is-down' : '';

    const mcap = px(tk.price) * 1e9;
    $('#tk-mcap').innerHTML = `${esc(Y.fmtAmt(mcap))} ${esc(sym())}${usd(mcap) ? `<small>${esc(usd(mcap))}</small>` : ''}`;
    $('#tk-vol').textContent = `${fq(tk.volume24h)} ${sym()}`;
    $('#tk-trades').textContent = tk.trades.toLocaleString('en-US');
    $('#tk-age').textContent = Y.ago(tk.createdAt);

    const pct = Math.min(100, tk.progress * 100);
    $('#tk-bar').style.width = pct + '%';
    $('#tk-curve-pct').textContent = tk.graduated ? 'Graduated' : `${pct.toFixed(pct < 10 ? 2 : 1)}%`;
    $('#tk-curve-k').textContent = tk.graduated ? 'Locked pool' : 'Bonding curve';
    $('#tk-curve-txt').textContent = tk.graduated
      ? `The curve filled${tk.graduatedAt ? ' ' + Y.ago(tk.graduatedAt) + ' ago' : ''}. $${tk.symbol} now trades in its own pool${tk.poolQuote ? ` holding ${fq(tk.poolQuote)} ${sym()} and ${ft(tk.poolToken)} coins` : ''}. The pool has no LP tokens, so nobody can pull its liquidity.`
      : `${fq(tk.quoteReserve)} of ${fq(tk.threshold)} ${sym()} raised. When the curve reaches ${fq(tk.threshold)} ${sym()}, it closes and its ${sym()} and remaining coins seed a pool nobody can drain.`;

    $('#tk-desc').textContent = tk.description || 'No thesis given.';
    const links = [['Website', tk.website], ['X', tk.x], ['Telegram', tk.telegram]].filter(([, u]) => u);
    $('#tk-links').innerHTML = links.map(([n, u]) => `<a class="dn-chip" href="${esc(u)}" target="_blank" rel="noopener nofollow ugc">${n} ↗</a>`).join('');
    const rows = [['Coin', tk.token], ['Curve', tk.curve], ...(tk.pool ? [['Pool', tk.pool]] : []), ['Creator', tk.creator]];
    $('#tk-addrs').innerHTML = rows.map(([k, a]) => `<div><span>${k}</span><b><button type="button" class="yl-copy" data-copy="${esc(a)}" title="Copy">${esc(Y.short(a))}</button>${net.explorer ? ` <a href="${esc(Y.explorer(net, 'address', a))}" target="_blank" rel="noopener">↗</a>` : ''}</b></div>`).join('')
      + `<div><span>Fees</span><b>${(tk.feeBps / 100)}% protocol${tk.creatorTaxBps ? ` + ${tk.creatorTaxBps / 100}% creator` : ''} per curve trade</b></div>`;

    renderTrades();
    drawChart();
    renderSnipe();
  }

  const addrLink = (a) => (net.explorer ? `<a href="${esc(Y.explorer(net, 'address', a))}" target="_blank" rel="noopener">${esc(Y.short(a))}</a>` : esc(Y.short(a)));

  function renderTrades() {
    const me = (W.state.account || '').toLowerCase();
    const list = trades.slice(-60).reverse();
    $('#tk-rows').innerHTML = list.map((x) => {
      const when = net.explorer ? `<a href="${esc(Y.explorer(net, 'tx', x.tx))}" target="_blank" rel="noopener">${Y.ago(x.t)}</a>` : Y.ago(x.t);
      return `<tr class="${x.w.toLowerCase() === me ? 'is-you' : ''}"><td>${when}</td><td class="${x.s === 'b' ? 'is-buy' : 'is-sell'}">${x.s === 'b' ? 'Buy' : 'Sell'}</td><td>${addrLink(x.w)}${x.w.toLowerCase() === tk.creator.toLowerCase() ? ' <em class="yl-dev">dev</em>' : ''}</td><td class="r">${fq(x.q)}</td><td class="r">${ft(x.n)}</td><td class="r">${Y.fmtPrice(px(x.p || 0))}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="yl-none">No trades yet. The first buy sets the tone.</td></tr>';
  }

  /* a step line: the price holds between trades and moves at each one */
  function drawChart() {
    const box = $('#tk-chart');
    if (!tk || !box) return;
    const w = Math.max(280, box.clientWidth), h = w < 520 ? 200 : 260;
    const now = Date.now() / 1000;
    const launchP = Number(BigInt(tk.phantom) * E18 / SUPPLY) / 10 ** qd();
    let pts = [{ t: tk.createdAt, p: launchP }, ...trades.map((x) => ({ t: x.t, p: px(x.p || 0) }))].filter((q) => q.p > 0);
    pts.push({ t: Math.max(now, pts[pts.length - 1].t), p: px(tk.price) });
    const from = range ? now - range : pts[0].t;
    const before = pts.filter((q) => q.t < from).pop();
    pts = pts.filter((q) => q.t >= from);
    if (before) pts.unshift({ t: from, p: before.p });
    if (pts.length === 1) pts.unshift({ t: from, p: pts[0].p });
    const t0 = pts[0].t, t1 = Math.max(pts[pts.length - 1].t, t0 + 1);
    let lo = Math.min(...pts.map((q) => q.p)), hi = Math.max(...pts.map((q) => q.p));
    if (hi - lo < hi * 0.02) { lo *= 0.95; hi *= 1.05; }
    const pad = (hi - lo) * 0.1; lo = Math.max(0, lo - pad); hi += pad;
    const L = 8, R = 64, T = 12, B = 26;
    const X = (t) => L + (t - t0) / (t1 - t0) * (w - L - R);
    const Yp = (p) => T + (1 - (p - lo) / (hi - lo)) * (h - T - B);
    let d = `M${X(pts[0].t).toFixed(1)} ${Yp(pts[0].p).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) d += ` H${X(pts[i].t).toFixed(1)} V${Yp(pts[i].p).toFixed(1)}`;
    const area = `${d} V${h - B} H${X(pts[0].t).toFixed(1)} Z`;
    const fmtT = (t) => { const dt = new Date(t * 1000); return (t1 - t0) > 86400 * 2 ? dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); };
    const grid = [0, 0.5, 1].map((k) => { const p = lo + (hi - lo) * (1 - k), y = T + k * (h - T - B); return `<line x1="${L}" x2="${w - R}" y1="${y}" y2="${y}"/><text x="${w - R + 8}" y="${y + 4}">${Y.fmtPrice(p)}</text>`; }).join('');
    box.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Price chart">
      <defs><linearGradient id="ylg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9C3A0" stop-opacity=".28"/><stop offset="1" stop-color="#D9C3A0" stop-opacity="0"/></linearGradient></defs>
      <g class="yl-grid">${grid}</g>
      <path d="${area}" fill="url(#ylg)"/>
      <path d="${d}" fill="none" stroke="#D9C3A0" stroke-width="1.8" stroke-linejoin="round"/>
      <text class="yl-ax" x="${L}" y="${h - 6}">${fmtT(t0)}</text><text class="yl-ax" x="${w - R}" y="${h - 6}" text-anchor="end">${fmtT(t1)}</text>
      <g class="yl-hover" style="display:none"><line y1="${T}" y2="${h - B}"/><circle r="4"/></g>
      <rect class="yl-hit" x="${L}" y="0" width="${w - L - R}" height="${h}" fill="transparent"/>
    </svg><div class="yl-tip" hidden></div>`;
    const hover = $('.yl-hover', box), tip = $('.yl-tip', box);
    $('.yl-hit', box).addEventListener('pointermove', (ev) => {
      const r = ev.currentTarget.getBoundingClientRect();
      const t = t0 + (ev.clientX - r.left) / r.width * (t1 - t0);
      let q = pts[0];
      for (const x of pts) if (x.t <= t) q = x;
      const x = X(t), y = Yp(q.p);
      hover.style.display = ''; tip.hidden = false;
      $('line', hover).setAttribute('x1', x); $('line', hover).setAttribute('x2', x);
      $('circle', hover).setAttribute('cx', x); $('circle', hover).setAttribute('cy', y);
      tip.innerHTML = `<b>${esc(Y.fmtPrice(q.p))} ${esc(sym())}</b><span>${new Date(t * 1000).toLocaleString()}</span>`;
      tip.style.left = Math.min(x + 12, w - 170) + 'px';
      tip.style.top = Math.max(0, y - 46) + 'px';
    });
    $('.yl-hit', box).addEventListener('pointerleave', () => { hover.style.display = 'none'; tip.hidden = true; });
  }

  function renderSnipe() {
    const el = $('#snipe');
    if (!tk || tk.graduated || !bal.block || !tk.snipeWindow) { el.hidden = true; return; }
    const elapsed = bal.block - tk.launchBlock;
    if (elapsed >= tk.snipeWindow) { el.hidden = true; return; }
    const now = tk.snipeTaxBps * (tk.snipeWindow - elapsed) / tk.snipeWindow / 100;
    el.hidden = false;
    el.textContent = `Snipe tax right now: ${now.toFixed(1)}% on buys, falling to 0 over the next ${tk.snipeWindow - elapsed} blocks. It stays in the curve for everyone already holding.`;
  }

  /* ------------------------------------------------------------ chain reads */

  async function refreshChain() {
    if (!C) return;
    try {
      const a = W.state.account;
      const reads = [C.p.getBlockNumber()];
      if (a) reads.push(C.p.getBalance(a), C.token.balanceOf(a), C.token.allowance(a, net.router));
      if (a && !pair().native) reads.push(C.quote.balanceOf(a), C.quote.allowance(a, net.router));
      const r = await Promise.all(reads);
      bal.block = Number(r[0]);
      if (a) { bal.native = r[1]; bal.token = r[2]; bal.tokenAllow = r[3]; }
      else { bal.native = 0n; bal.token = 0n; bal.tokenAllow = 0n; }
      if (a && !pair().native) { bal.quote = r[4]; bal.quoteAllow = r[5]; }
    } catch (_) { /* RPC hiccup: keep the last values */ }
    renderBal();
    renderSnipe();
    renderButton();
  }

  const payBal = () => (side === 'buy' ? (pair().native ? bal.native : bal.quote) : bal.token);

  function renderBal() {
    const a = W.state.account;
    $('#bal').textContent = a ? `Balance: ${side === 'buy' ? fq(payBal()) + ' ' + sym() : ft(bal.token) + ' $' + tk.symbol}` : '';
  }

  /* ------------------------------------------------------------ the trade panel */

  function setSide(s) {
    side = s;
    $$('#side button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.side === s)));
    $('#trade').classList.toggle('is-sell', s === 'sell');
    $('#amt-label').textContent = s === 'buy' ? 'You pay' : 'You sell';
    $('#amt-unit').textContent = s === 'buy' ? sym() : '$' + tk.symbol;
    $('#presets').innerHTML = s === 'buy'
      ? ['0.1', '0.5', '1', '5'].map((v) => `<button type="button" data-v="${v}">${v} ${esc(sym())}</button>`).join('')
      : [25, 50, 75, 100].map((v) => `<button type="button" data-pct="${v}">${v === 100 ? 'Max' : v + '%'}</button>`).join('');
    $('#amt').value = '';
    lastQuote = null;
    showQuote();
    renderBal();
    renderButton();
  }

  $('#side').addEventListener('click', (e) => { const b = e.target.closest('button[data-side]'); if (b && tk) setSide(b.dataset.side); });
  $('#presets').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.v) $('#amt').value = b.dataset.v;
    else if (b.dataset.pct) $('#amt').value = bal.token ? toStr(bal.token * BigInt(b.dataset.pct) / 100n, 18) : '0';
    requestQuote();
  });
  $('#slip').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-s]');
    if (!b) return;
    slipBps = BigInt(b.dataset.s);
    $$('#slip button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  });
  $('#tk-range').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-r]');
    if (!b) return;
    range = +b.dataset.r;
    $$('#tk-range button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    drawChart();
  });
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) { navigator.clipboard?.writeText(c.dataset.copy); Y.toast('Copied'); }
  });

  let qTimer = 0;
  const requestQuote = () => { clearTimeout(qTimer); qTimer = setTimeout(getQuote, 220); renderButton(); };
  $('#amt').addEventListener('input', requestQuote);

  async function getQuote() {
    const amt = parseAmt($('#amt').value, side === 'buy' ? qd() : 18);
    const seq = ++qseq;
    if (!amt || !C) { lastQuote = null; showQuote(); renderButton(); return; }
    try {
      const out = side === 'buy' ? await C.router.quoteBuy(tk.curve, amt) : await C.router.quoteSell(tk.curve, amt);
      if (seq !== qseq) return;
      lastQuote = { side, amt, out };
    } catch (_) { if (seq === qseq) lastQuote = { side, amt, out: null }; }
    showQuote();
    renderButton();
  }

  function showQuote() {
    const q = lastQuote;
    const fees = tk ? (tk.graduated ? '0.3% pool fee' : `${tk.feeBps / 100}% protocol${tk.creatorTaxBps ? ` + ${tk.creatorTaxBps / 100}% creator` : ''}`) : '–';
    $('#fees').textContent = fees;
    if (!q || q.out == null) { $('#out').textContent = q ? 'Not tradable right now' : '–'; $('#impact').textContent = '–'; $('#impact').className = ''; return; }
    $('#out').textContent = q.side === 'buy' ? `${ft(q.out)} $${tk.symbol}` : `${fq(q.out)} ${sym()}`;
    const spot = BigInt(tk.price);
    if (spot > 0n && q.out > 0n) {
      const eff = q.side === 'buy' ? q.amt * E18 / q.out : q.out * E18 / q.amt;
      const imp = Number((q.side === 'buy' ? eff - spot : spot - eff) * 10000n / spot) / 100;
      const el = $('#impact');
      el.textContent = `${Math.max(0, imp).toFixed(2)}%`;
      el.className = imp > 10 ? 'is-down' : '';
    }
  }

  function renderButton() {
    const b = $('#go');
    if (busy || !tk) return;
    b.disabled = false;
    const amt = parseAmt($('#amt').value, side === 'buy' ? qd() : 18);
    if (!W.state.account) b.textContent = 'Connect wallet';
    else if (W.state.chainId !== net.chainId) b.textContent = `Switch to ${net.short}`;
    else if (!amt) { b.textContent = 'Enter an amount'; b.disabled = true; }
    else if (amt > payBal()) { b.textContent = `Not enough ${side === 'buy' ? sym() : '$' + tk.symbol}`; b.disabled = true; }
    else if (side === 'sell' && bal.tokenAllow < amt) b.textContent = `Approve $${tk.symbol}`;
    else if (side === 'buy' && !pair().native && bal.quoteAllow < amt) b.textContent = `Approve ${sym()}`;
    else if (!lastQuote || lastQuote.amt !== amt) { b.textContent = 'Getting a quote…'; b.disabled = true; }
    else if (lastQuote.out == null || lastQuote.out === 0n) { b.textContent = 'Not tradable right now'; b.disabled = true; }
    else b.textContent = `${side === 'buy' ? 'Buy' : 'Sell'} $${tk.symbol}`;
  }

  const say = (t, bad) => { const m = $('#trade-msg'); m.textContent = t; m.classList.toggle('is-bad', !!bad); };
  const txLink = (h) => (net.explorer ? ` <a href="${esc(Y.explorer(net, 'tx', h))}" target="_blank" rel="noopener">View ↗</a>` : '');

  $('#go').addEventListener('click', async () => {
    if (busy || !tk) return;
    say('');
    try {
      if (!W.state.account) { await W.connect(); return; }
      if (W.state.chainId !== net.chainId) { await W.ensureChain(net); return; }
    } catch (err) { if (err.message !== 'closed') say(Y.cleanError(err), true); return; }
    const amt = parseAmt($('#amt').value, side === 'buy' ? qd() : 18);
    if (!amt) return;
    const btn = $('#go');
    busy = true; btn.disabled = true; btn.textContent = 'Check your wallet…';
    try {
      const signer = await W.signer(net);
      const account = W.state.account;
      if (side === 'sell' && bal.tokenAllow < amt) {
        const tx = await C.token.connect(signer).approve(net.router, amt);
        btn.textContent = 'Approving…';
        await tx.wait();
        bal.tokenAllow = amt;
        say(`$${tk.symbol} approved. Now confirm the sale.`);
      }
      if (side === 'buy' && !pair().native && bal.quoteAllow < amt) {
        const tx = await C.quote.connect(signer).approve(net.router, amt);
        btn.textContent = 'Approving…';
        await tx.wait();
        bal.quoteAllow = amt;
      }
      // quote again right before sending, so the slippage limit is measured from now
      const out = side === 'buy' ? await C.router.quoteBuy(tk.curve, amt) : await C.router.quoteSell(tk.curve, amt);
      if (!out) throw new Error('Not tradable right now.');
      const min = out * (10000n - slipBps) / 10000n;
      const r = C.router.connect(signer);
      btn.textContent = 'Check your wallet…';
      const tx = side === 'buy'
        ? await r.buy(tk.curve, amt, min, account, { value: pair().native ? amt : 0n })
        : await r.sell(tk.curve, amt, min, account, pair().native);
      btn.textContent = side === 'buy' ? 'Buying…' : 'Selling…';
      const t = Y.toast(`${side === 'buy' ? 'Buying' : 'Selling'} $${esc(tk.symbol)}…${txLink(tx.hash)}`, '', 0);
      const rc = await tx.wait();
      if (!rc.status) throw new Error('The transaction reverted.');
      t.set(`<b>Done.</b> ${side === 'buy' ? `Bought ~${esc(ft(out))} $${esc(tk.symbol)}` : `Sold for ~${esc(fq(out))} ${esc(sym())}`}.${txLink(tx.hash)}`, 'is-good');
      setTimeout(t.close, 7000);
      $('#amt').value = '';
      lastQuote = null;
      say('');
      showQuote();
      fetch(`/api/poke/${chainId}`, { method: 'POST' }).catch(() => {});
      setTimeout(() => load(false), 1200);
      setTimeout(() => load(false), 4000);
    } catch (err) {
      say(Y.cleanError(err), true);
    }
    busy = false;
    await refreshChain();
  });

  /* ------------------------------------------------------------ start */

  Y.config().then((cfg) => {
    net = cfg.networks.find((n) => n.chainId === chainId);
    if (!net || !/^0x[0-9a-fA-F]{40}$/.test(curveAddr)) {
      state(`<h2>Coin not found</h2><p>${cfg.live ? 'This link does not point at a coin on a network Yuelong runs on.' : 'Trading switches on when the contracts go live.'} <a href="index.html#markets">Back to the markets</a>.</p>`);
      return;
    }
    load(true);
  });
})();
