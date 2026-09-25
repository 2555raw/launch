/* Alternatives: what a typical month costs here, from the live price table. */
(() => {
  const { api, esc, mark, vendorMark } = seekr; seekr.nav();
  const money = (n) => (n >= 1 ? '$' + n.toFixed(2) : '$' + n.toFixed(3));
  const EX = [
    { id: 'gpt-5-mini', n: 300, what: 'chat messages', cost: (m) => (1500 * (m.prices.inUsd || 0) + 500 * m.prices.usd) / 1e6 },
    { id: 'claude-sonnet-5', n: 300, what: 'chat messages', cost: (m) => (1500 * (m.prices.inUsd || 0) + 500 * m.prices.usd) / 1e6 },
    { id: 'flux-2-pro', n: 50, what: 'images', cost: (m) => m.prices.usd },
    { id: 'kling-3', n: 10, what: 'video clips of 5 s', cost: (m) => 5 * m.prices.usd }
  ];
  api('/api/models').then(({ models }) => {
    const cards = EX.map((e) => { const m = models.find((x) => x.id === e.id); if (!m) return ''; const t = e.cost(m) * e.n;
      return `<div class="cmp-card"><div class="cmp-h"><span class="cmp-ic">${mark(vendorMark(m.vendor))}</span><div><b>${esc(m.name)}</b><small>${e.n} ${esc(e.what)}</small></div></div>
        <div class="cmp-big">${money(t)}<small>/month</small></div><div class="cmp-row"><span>$WONDR holder</span><span class="accent">${money(t * 0.05)}</span></div>
        <a class="btn btn-ghost btn-sm cmp-try" href="/compare#${m.kind === 'chat' ? 'chat' : m.kind}">Compare</a></div>`; }).join('');
    document.getElementById('altEx').innerHTML = cards;
  }).catch(() => null);
})();
