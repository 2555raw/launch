(() => {
  const { api, usd, pct } = seekr; seekr.nav();
  const $ = (id) => document.getElementById(id);
  const big = (n) => (n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : usd(n));
  const link = (el, url, label) => { el.href = url; el.classList.remove('is-soon'); el.removeAttribute('aria-disabled'); if (/^https?:/.test(url)) { el.target = '_blank'; el.rel = 'noopener'; } if (label) el.textContent = label; };
  const pending = (el, label) => { el.removeAttribute('href'); el.classList.add('is-soon'); el.setAttribute('aria-disabled', 'true'); el.textContent = label; };
  Promise.all([api('/api/config').catch(() => ({ chain: {} })), api('/api/markets').catch(() => ({ seekr: {} }))]).then(([cfg, m]) => {
    const c = cfg.chain || {}, a = m.seekr || {};
    if (c.launch) $('tLaunch').textContent = c.launch;
    /* launch time: shown in Beijing time (UTC+8), where the market is, with the visitor's own time and a countdown */
    const at = c.launchAt ? new Date(c.launchAt) : null;
    if (at && !isNaN(at)) {
      const zh = document.documentElement.lang === 'zh-CN';
      const fmt = (tz) => new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
      $('tLaunch').textContent = zh ? `北京时间 ${fmt('Asia/Shanghai')} (UTC+8)` : `${fmt('Asia/Shanghai')} Beijing (UTC+8)`;
      if (!c.token) {
        const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
        $('tCountT').textContent = zh ? (local && local !== 'Asia/Shanghai' ? `北京时间 ${fmt('Asia/Shanghai')} · 你的时间 ${fmt(local)}` : `北京时间 ${fmt('Asia/Shanghai')}`) : local && local !== 'Asia/Shanghai' ? `${fmt('Asia/Shanghai')} Beijing · ${fmt(local)} your time` : `${fmt('Asia/Shanghai')} Beijing time`;
        $('tCount').hidden = false;
        const pad = (n) => String(n).padStart(2, '0');
        const tick = () => { const s = Math.max(0, Math.floor((at - Date.now()) / 1000)); $('tCountV').textContent = s ? (zh ? `${Math.floor(s / 86400)}天 ${pad(Math.floor(s / 3600) % 24)}时 ${pad(Math.floor(s / 60) % 60)}分 ${pad(s % 60)}秒` : `${Math.floor(s / 86400)}d ${pad(Math.floor(s / 3600) % 24)}h ${pad(Math.floor(s / 60) % 60)}m ${pad(s % 60)}s`) : 'Launching now'; if (s) setTimeout(tick, 1000); };
        tick();
      }
    }
    if (cfg.links && cfg.links.x) $('tX').href = cfg.links.x;
    if (c.token) {
      $('tCa').textContent = c.token; $('tCopy').hidden = false;
      $('tCopy').onclick = () => navigator.clipboard.writeText(c.token).then(() => { $('tCopy').textContent = 'Copied'; setTimeout(() => { $('tCopy').textContent = 'Copy'; }, 1600); }).catch(() => null);
      if (c.explorer) { $('tScan').href = `${c.explorer}/token/${c.token}`; $('tScan').hidden = false; }
    }
    /* buy: the configured link; after launch without one, the pair page; before launch, it waits */
    const buy = c.buyUrl || (c.token && a.url) || '';
    if (buy) link($('buyBtn'), buy, c.buyUrl ? null : 'Buy $WONDR'); else pending($('buyBtn'), c.token ? 'Buy link soon' : 'Opens at launch');
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
