(() => {
  const { api, usd, pct } = seekr; seekr.nav();
  const $ = (id) => document.getElementById(id);
  const big = (n) => (n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : usd(n));
  /* before launch the buy and chart buttons wait; once the coin is live they point where the config says */
  const pending = (el, label) => { el.removeAttribute('href'); el.classList.add('is-soon'); el.setAttribute('aria-disabled', 'true'); el.textContent = label; };
  api('/api/config').then((cfg) => {
    const c = cfg.chain || {};
    if (c.launch) $('tLaunch').textContent = c.launch;
    if (c.token) {
      $('tCa').textContent = c.token; $('tCopy').hidden = false;
      $('tCopy').onclick = () => navigator.clipboard.writeText(c.token).then(() => { $('tCopy').textContent = 'Copied'; setTimeout(() => { $('tCopy').textContent = 'Copy'; }, 1600); }).catch(() => null);
    }
    if (!c.buyUrl) pending($('buyBtn'), 'Opens at launch');
    if (!c.chartUrl && !c.token) pending($('chartBtn'), 'Chart');
    /* launched but not on DexScreener yet: numbers are on their way */
    if (c.token && $('tPrice').textContent === 'At launch') ['tPrice', 'tChange', 'tMcap', 'tLiq', 'tVol'].forEach((id) => { $(id).textContent = '…'; });
    if (cfg.links && cfg.links.x) $('tX').href = cfg.links.x;
  }).catch(() => null);
  api('/api/markets').then(({ seekr: a }) => {
    if (!a.live) return;
    ['tChange', 'tMcap', 'tLiq', 'tVol'].forEach((id) => { $(id).classList.remove('soon'); $(id).textContent = 'n/a'; });
    $('tPrice').textContent = usd(a.price, 6);
    const ch = $('tChange'); ch.textContent = pct(a.change); ch.className = a.change >= 0 ? 'chg-up' : 'chg-down';
    if (a.mcap) $('tMcap').textContent = big(a.mcap);
    if (a.liquidity) $('tLiq').textContent = big(a.liquidity);
    if (a.volume) $('tVol').textContent = big(a.volume);
    const chart = $('chartBtn'); if (a.url && !(window.seekrConfig && window.seekrConfig.chain.chartUrl)) { chart.href = a.url; chart.target = '_blank'; chart.rel = 'noopener'; }
  }).catch(() => null);
})();
