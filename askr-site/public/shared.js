/* Shared by every page: the API client, formatting, the vendor marks, the
 * theme, the nav, and the live $ASKR pill. */
window.askr = (() => {
  const KEY = 'askr.key';
  const api = async (path, opts = {}) => {
    const headers = { ...(opts.headers || {}) };
    if (opts.body !== undefined && !(opts.body instanceof FormData)) { headers['content-type'] = 'application/json'; opts.body = JSON.stringify(opts.body); }
    const key = getKey();
    if (key) headers.authorization = 'Bearer ' + key;
    const r = await fetch(path, { ...opts, headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || r.statusText); e.status = r.status; e.code = j.code; e.needed = j.needed; throw e; }
    return j;
  };
  const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
  const setKey = (k) => { try { k ? localStorage.setItem(KEY, k) : localStorage.removeItem(KEY); } catch { /* private mode */ } };

  const usd = (n, d) => { if (n === null || n === undefined) return '—'; const v = Number(n); const digits = d ?? (v >= 0.01 ? 2 : v >= 0.0001 ? 4 : 6); return '$' + v.toLocaleString('en-US', { minimumFractionDigits: v >= 0.01 ? 2 : 0, maximumFractionDigits: digits }); };
  const cr = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 2 : 0 });
  const pct = (n) => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* simple monochrome marks per vendor/asset (not the vendors' trademarks) */
  const MARKS = {
    anthropic: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.4 4h3.2l6 16h-3.3l-1.2-3.3h-6.2L10.7 20H7.4l6-16zm-.6 10h4.4l-2.2-6.2L12.8 14zM1.4 4h3.3l6.1 16H7.5L1.4 4z"/></svg>',
    openai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9L12 3z"/><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/></svg>',
    gemini: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.6 5.5 4.5 9.4 10 10-5.5.6-9.4 4.5-10 10-.6-5.5-4.5-9.4-10-10 5.5-.6 9.4-4.5 10-10z"/></svg>',
    deepseek: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 12c2-4 6-6 10-5.5 2.5.3 4 1.5 5.5 3.5.5-.8 1.2-1.4 2.5-1.5-.8 1.3-1.1 2.6-.6 4.2-1 2.9-3.6 5-7.2 5.3-3.4.3-6.2-1-8.2-3.3 1.3 0 2.4-.4 3.2-1.2C6.2 13.7 4.6 13 3 12zm9.5-1.5a.9.9 0 100 1.8.9.9 0 000-1.8z"/></svg>',
    xai: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h3.2l12.8 16h-3.2L4 4zm12.4 0H20L13.3 12.4l-1.6-2L16.4 4zM4 20l5.6-7 1.6 2L7.2 20H4z"/></svg>',
    meta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 16c1.5-6 3-9 5.5-9S12 12 12 12s1-5 3.5-5S21 10 21 16c0 1.5-.8 2.5-2 2.5-3 0-4.5-6-7-6s-4 6-7 6c-1.2 0-2-1-2-2.5z"/></svg>',
    mistral: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h3v3H3zm15 0h3v3h-3zM3 7h6v3H3zm12 0h6v3h-6zM3 10h18v3H3zm0 3h6v3H3zm9 0h3v3h-3zm3 0h6v3h-6zM3 16h3v4H3zm15 0h3v4h-3z"/></svg>',
    runway: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 20V4h6.5a4.5 4.5 0 010 9H6m7 0l6 7"/></svg>',
    bfl: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l4 8-4 2-4-2 4-8zm-6 10l6 3 6-3 3 6H3l3-6z"/></svg>',
    nvidia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12c3-4 6-6 10-6s7 2 10 6c-3 4-6 6-10 6S5 16 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    kling: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h3.5v7L14 4h4.5l-7 7.5L19 20h-4.5l-5.5-6.3L7.5 15v5H4z"/></svg>',
    bytedance: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3v11.2a3.8 3.8 0 11-3-3.7V7.3a7 7 0 106 6.9V8.4c1.2.8 2.6 1.3 4 1.3V6.6A4.6 4.6 0 0117 3h-3z"/></svg>',
    google: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 12h-8m8 0a8 8 0 11-2.3-5.7"/></svg>',
    elevenlabs: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4h3v16H7zm7 0h3v16h-3z"/></svg>',
    usdt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l10 10-10 10L2 12 12 2zm-4 6v2.5h3v1.6c-2.6.1-4.5.6-4.5 1.2s1.9 1.1 4.5 1.2V18h2v-3.5c2.6-.1 4.5-.6 4.5-1.2s-1.9-1.1-4.5-1.2V10.5h3V8H8zm3 5.6v-1.3c.3 0 .7.1 1 .1s.7 0 1-.1v1.3c-.3 0-.7.1-1 .1s-.7 0-1-.1z"/></svg>',
    btc: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 110 20 10 10 0 010-20zm-1.5 5v1.5H9V17h1.5v1.5h1.5V17h.5c2 0 3.3-1 3.3-2.6 0-1.1-.6-1.8-1.5-2.1.7-.4 1.1-1 1.1-1.9 0-1.4-1.1-2.4-3-2.4H12V7h-1.5zm0 3h1.6c.9 0 1.4.4 1.4 1s-.5 1-1.4 1h-1.6v-2zm0 3.5h1.9c1 0 1.6.4 1.6 1.1s-.6 1.1-1.6 1.1h-1.9v-2.2z"/></svg>',
    eth: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l6 10-6 3.5L6 12l6-10zm0 15l6-3.5L12 22l-6-8.5 6 3.5z"/></svg>',
    sol: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h14l-3 3H3l3-3zm0 5.5h14l-3 3H3l3-3zM6 16h14l-3 3H3l3-3z"/></svg>'
  };
  const mark = (id) => MARKS[id] || MARKS.openai;
  const vendorMark = (vendor) => ({ Anthropic: 'anthropic', OpenAI: 'openai', Google: 'gemini', DeepSeek: 'deepseek', xAI: 'xai', Meta: 'meta', Mistral: 'mistral', Alibaba: 'openai', NVIDIA: 'nvidia', 'Black Forest Labs': 'bfl', Kuaishou: 'kling', ByteDance: 'bytedance', Runway: 'runway', ElevenLabs: 'elevenlabs' }[vendor] || 'openai');

  /* theme */
  const theme = {
    get: () => document.documentElement.dataset.theme || 'dark',
    set: (t) => { document.documentElement.dataset.theme = t; try { localStorage.setItem('askr.theme', t); } catch { /* ignore */ } },
    toggle: () => theme.set(theme.get() === 'light' ? 'dark' : 'light')
  };

  /* nav behaviour shared by the marketing pages */
  function nav() {
    const b = document.getElementById('burger');
    const links = document.getElementById('navLinks');
    if (b && links) b.addEventListener('click', () => links.classList.toggle('open'));
    const dd = document.getElementById('devDd');
    if (dd) dd.querySelector('a').addEventListener('click', (e) => { if (matchMedia('(max-width: 860px)').matches) { e.preventDefault(); dd.classList.toggle('open'); } });
    api('/api/markets').then(({ askr: a }) => {
      const p = document.getElementById('askrPrice'); const c = document.getElementById('askrChange');
      if (p) p.textContent = usd(a.price, 6);
      if (c) { c.textContent = pct(a.change); c.className = a.change >= 0 ? 'chg-up' : 'chg-down'; }
    }).catch(() => null);
    api('/api/config').then((cfg) => {
      const buy = document.getElementById('buyBtn'); const chart = document.getElementById('chartBtn');
      if (buy && cfg.chain.buyUrl) buy.href = cfg.chain.buyUrl;
      if (chart && cfg.chain.chartUrl) chart.href = cfg.chain.chartUrl;
      const tg = document.getElementById('tgLink'); if (tg) tg.href = cfg.links.telegram;
      for (const id of ['mailLink', 'supportLink']) { const el = document.getElementById(id); if (el) { el.href = 'mailto:' + cfg.links.email; if (id === 'mailLink') el.textContent = cfg.links.email; } }
      window.askrConfig = cfg;
    }).catch(() => null);
  }

  let toastT = null;
  function toast(msg, err) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle('err', Boolean(err)); t.style.display = 'block';
    clearTimeout(toastT); toastT = setTimeout(() => { t.style.display = 'none'; }, 3200);
  }

  return { api, getKey, setKey, usd, cr, pct, esc, mark, vendorMark, theme, nav, toast };
})();
