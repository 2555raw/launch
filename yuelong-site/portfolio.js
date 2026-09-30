/* Yuelong — the connected wallet's holdings and launches, read live from each chain. */
(() => {
  'use strict';
  const Y = window.YL;
  const box = document.getElementById('pf');
  if (!Y || !box) return;
  const { esc } = Y;
  const W = Y.wallet;
  const art = (s) => (window.YLart ? window.YLart(s) : '');

  const row = (t, extra) => `
    <a class="yl-pf-row" href="token.html?chain=${t.chainId}&c=${t.curve}">
      <img src="${esc(t.image || art(t.symbol))}" alt="" data-fallback="${esc(art(t.symbol))}">
      <span class="yl-pf-id"><b>${esc(t.name)}</b><small>$${esc(t.symbol)} · ${t.graduated ? 'pool' : (t.progress * 100).toFixed(1) + '% curve'}</small></span>
      ${extra}
    </a>`;

  let seq = 0;
  async function render() {
    const me = ++seq;
    const a = W.state.account;
    if (!a) {
      box.innerHTML = '<div class="yl-state"><p>Connect a wallet to see the coins it holds.</p><p><button class="dn-btn-white yl-pf-connect" type="button" data-wallet>Connect wallet</button></p></div>';
      return;
    }
    box.innerHTML = '<div class="yl-state"><p>Reading your balances…</p></div>';
    const cfg = await Y.config();
    if (!cfg.live) { box.innerHTML = '<div class="yl-state"><p>Trading opens as soon as the contracts are live.</p></div>'; return; }
    const { tokens } = await Y.api('/api/markets');
    const [e, A] = await Promise.all([Y.ethers(), Y.abi()]);
    const held = [];
    for (const net of cfg.networks) {
      const p = await Y.reader(net);
      const list = tokens.filter((t) => t.chainId === net.chainId);
      for (let i = 0; i < list.length; i += 20) {
        const bals = await Promise.all(list.slice(i, i + 20).map((t) => new e.Contract(t.token, A.YuelongToken, p).balanceOf(a).catch(() => 0n)));
        bals.forEach((b, j) => { if (b > 0n) held.push({ t: list[i + j], b, net }); });
      }
    }
    if (me !== seq) return;
    const value = (x) => Y.toNum(x.b) * Y.toNum(x.t.price, x.t.quoteDecimals);
    held.sort((x, y) => value(y) - value(x));
    const mine = tokens.filter((t) => t.creator.toLowerCase() === a.toLowerCase());
    const totals = {};
    for (const x of held) totals[x.t.quoteSymbol] = (totals[x.t.quoteSymbol] || 0) + value(x);
    const totalTxt = Object.entries(totals).map(([s, v]) => `${Y.fmtAmt(v)} ${s}`).join(' + ') || '0';
    const usd = held.reduce((s, x) => s + value(x) * (x.net.usd && x.t.quoteSymbol === x.net.native ? x.net.usd : 0), 0);

    box.innerHTML = `
      <section class="dn-box yl-pf-sum"><span class="dn-kicker">Holdings value</span><b>${esc(totalTxt)}</b>${usd ? `<small>${esc(Y.fmtUsd(usd))}</small>` : ''}<small>${esc(Y.short(a))}</small></section>
      <section class="dn-box"><span class="dn-kicker">Holding · ${held.length}</span>
        <div class="yl-pf-list">${held.map((x) => row(x.t, `<span class="yl-pf-num"><b>${esc(Y.fmtAmt(Y.toNum(x.b)))}</b><small>${esc(Y.fmtAmt(value(x)))} ${esc(x.t.quoteSymbol)}</small></span>`)).join('') || '<p class="dn-dim yl-pf-none">No Yuelong coins in this wallet yet. <a href="index.html#markets">Browse the markets</a>.</p>'}</div>
      </section>
      <section class="dn-box"><span class="dn-kicker">Launched by you · ${mine.length}</span>
        <div class="yl-pf-list">${mine.map((t) => row(t, `<span class="yl-pf-num"><b>${esc(Y.fmtAmt(Y.toNum(t.mcap, t.quoteDecimals)))} ${esc(t.quoteSymbol)}</b><small>market cap</small></span>`)).join('') || '<p class="dn-dim yl-pf-none">Nothing yet. <a href="launch.html">Launch a coin</a>.</p>'}</div>
      </section>`;
  }
  box.addEventListener('error', (ev) => { const f = ev.target.dataset?.fallback; if (f && ev.target.src !== f) ev.target.src = f; }, true);
  W.onChange(() => render().catch((err) => { box.innerHTML = `<div class="yl-state"><p>${esc(Y.cleanError(err))}</p></div>`; }));
  setTimeout(() => render().catch(() => {}), 400);
})();
