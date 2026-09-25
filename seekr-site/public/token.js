(() => {
  const { api, usd, pct } = seekr; seekr.nav();
  const $ = (id) => document.getElementById(id);
  const big = (n) => (n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : usd(n));
  const link = (el, url, label) => { el.href = url; el.classList.remove('is-soon'); el.removeAttribute('aria-disabled'); if (/^https?:/.test(url)) { el.target = '_blank'; el.rel = 'noopener'; } if (label) el.textContent = label; };
  const pending = (el, label) => { el.removeAttribute('href'); el.classList.add('is-soon'); el.setAttribute('aria-disabled', 'true'); el.textContent = label; };
  Promise.all([api('/api/config').catch(() => ({ chain: {} })), api('/api/markets').catch(() => ({ seekr: {} }))]).then(([cfg, m]) => {
    const c = cfg.chain || {}, a = m.seekr || {};
    if (c.launch) $('tLaunch').textContent = c.launch;
    if (cfg.links && cfg.links.x) $('tX').href = cfg.links.x;
    if (c.token) {
      $('tCa').textContent = c.token; $('tCopy').hidden = false;
      $('tCopy').onclick = () => navigator.clipboard.writeText(c.token).then(() => { $('tCopy').textContent = 'Copied'; setTimeout(() => { $('tCopy').textContent = 'Copy'; }, 1600); }).catch(() => null);
      if (c.explorer) { $('tScan').href = `${c.explorer}/token/${c.token}`; $('tScan').hidden = false; }
    }
    /* buy: the configured link; after launch without one, the pair page; before launch, it waits */
    const buy = c.buyUrl || (c.token && a.url) || '';
    if (buy) link($('buyBtn'), buy, c.buyUrl ? null : 'Buy $SEEKR'); else pending($('buyBtn'), c.token ? 'Buy link soon' : 'Opens at launch');
    const chart = c.chartUrl || a.url || '';
    if (chart) link($('chartBtn'), chart); else pending($('chartBtn'), 'Chart');
    if (a.live) {
      $('tPrice').textContent = usd(a.price, 6);
      ['tChange', 'tMcap', 'tLiq', 'tVol'].forEach((id) => { $(id).classList.remove('soon'); $(id).textContent = 'n/a'; });
      const ch = $('tChange'); ch.textContent = pct(a.change); ch.className = a.change >= 0 ? 'chg-up' : 'chg-down';
      if (a.mcap) $('tMcap').textContent = big(a.mcap);
      if (a.liquidity) $('tLiq').textContent = big(a.liquidity);
      if (a.volume) $('tVol').textContent = big(a.volume);
    } else if (c.token) ['tPrice', 'tChange', 'tMcap', 'tLiq', 'tVol'].forEach((id) => { $(id).textContent = '…'; });
  });
})();
