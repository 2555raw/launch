/* Dendra — page behaviour.
   No dependencies: theme, menu, anchor navigation, the launch composer mock,
   the markets table, the subnet face-off, the thesis cards and scroll reveal.
   Every figure below is sample data. */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  document.documentElement.classList.add('dn-js');

  /* ---------- sample data ---------- */

  const MARKETS = [
    { ticker: 'INFR',  name: 'SN19 inference demand',     kind: 'subnet', pair: 'SN19 α', change: 18.4, curve: 91 },
    { ticker: 'HALV',  name: 'Halving priced in by Q2',   kind: 'thesis', pair: 'TAO',    change: -4.2, curve: 37 },
    { ticker: 'PRTN',  name: 'Protein folding subnet',    kind: 'subnet', pair: 'SN25 α', change: 7.9,  curve: 64 },
    { ticker: 'VAL1',  name: 'Top validator stays top',   kind: 'thesis', pair: 'TAO',    change: 2.1,  curve: 22 },
    { ticker: 'DATA',  name: 'Open data wins',            kind: 'thesis', pair: 'SN13 α', change: 31.6, curve: 96 },
    { ticker: 'SCRP',  name: 'Scraping subnet mainstream', kind: 'subnet', pair: 'TAO',   change: -11.3, curve: 12 },
    { ticker: 'GRAD',  name: 'Pretraining beats the labs', kind: 'thesis', pair: 'SN9 α', change: 5.5,  curve: 100 },
  ];

  const SUBNETS = [
    { id: 'SN9',  name: 'Pretraining', share: 24 },
    { id: 'SN13', name: 'Data',        share: 17 },
    { id: 'SN19', name: 'Inference',   share: 29 },
    { id: 'SN25', name: 'Protein',     share: 12 },
    { id: 'SN51', name: 'Compute',     share: 18 },
  ];

  const THESES = [
    { quote: 'Decentralised inference gets cheaper than the big clouds for open models within a year. This subnet is where that shows up first.', who: 'mira.tao', ticker: 'INFR', pair: 'SN19 α' },
    { quote: 'Alpha tokens are underpriced relative to the emissions they will capture once dTAO matures. Buying the basket, not the story.', who: 'k0rtex', ticker: 'BSKT', pair: 'TAO' },
    { quote: 'The best open dataset on the network is the moat. Models come and go; the data compounds.', who: 'lena_v', ticker: 'DATA', pair: 'SN13 α' },
  ];

  /* ---------- theme ---------- */

  const SUN  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>';
  const MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';

  const themeBtn = $('#theme');
  const applyTheme = (mode) => {
    document.documentElement.setAttribute('data-theme', mode);
    if (themeBtn) themeBtn.innerHTML = mode === 'light' ? MOON : SUN;
  };

  let stored = null;
  try { stored = localStorage.getItem('dendra-theme'); } catch (_) { /* storage blocked */ }
  applyTheme(stored === 'light' ? 'light' : 'dark');

  themeBtn?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('dendra-theme', next); } catch (_) { /* storage blocked */ }
  });

  /* ---------- mobile menu ---------- */

  const burger = $('#burger');
  const links  = $('#navlinks');
  burger?.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });

  /* ---------- anchor navigation ---------- */

  const NAV_H = 64;

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-scroll]');
    if (!el) return;
    const target = document.getElementById(el.dataset.scroll);
    if (!target) return;
    e.preventDefault();
    const y = el.dataset.scroll === 'top' ? 0 : target.getBoundingClientRect().top + window.scrollY - NAV_H - 12;
    window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });
    links?.classList.remove('is-open');
    burger?.setAttribute('aria-expanded', 'false');
  });

  const navItems = $$('#navlinks a');
  const sections = navItems.map((a) => document.getElementById(a.dataset.scroll)).filter(Boolean);
  if (sections.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navItems.forEach((a) => a.classList.toggle('is-active', a.dataset.scroll === entry.target.id));
      });
    }, { rootMargin: `-${NAV_H + 40}px 0px -62% 0px`, threshold: 0 });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- launch composer (mock) ---------- */

  const idea    = $('#idea');
  const ticker  = $('#ticker');
  const chain   = $('#chain');
  const pairSeg = $('#pair');
  const note    = $('#form-note');
  const PAIR_TEXT = { TAO: 'paired with TAO', alpha: 'paired with subnet alpha', usdc: 'funded in USDC, paired with TAO' };
  let pair = 'TAO';

  // A ticker from the idea: initials of the first meaningful words, up to five letters.
  const autoTicker = (text) => {
    const words = text.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/)
      .filter((w) => w && !['THE', 'A', 'AN', 'OF', 'BY', 'IN', 'ON', 'AND', 'TO', 'FOR'].includes(w));
    if (!words.length) return '';
    if (words.length === 1) return words[0].slice(0, 5);
    return words.slice(0, 5).map((w) => w[0]).join('');
  };

  const renderPreview = () => {
    const t = (ticker.value.trim() || autoTicker(idea.value) || 'TICKER').toUpperCase().slice(0, 8);
    $('#preview-ticker').textContent = '$' + t;
    $('#coin').textContent = t === 'TICKER' ? '?' : t[0];
    $('#preview-pair').textContent = PAIR_TEXT[pair];
    $('#chain-label').textContent = chain.value;
  };

  idea?.addEventListener('input', renderPreview);
  ticker?.addEventListener('input', () => { ticker.value = ticker.value.replace(/[^a-z0-9]/gi, ''); renderPreview(); });
  chain?.addEventListener('change', renderPreview);

  pairSeg?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-pair]');
    if (!btn) return;
    pair = btn.dataset.pair;
    $$('button', pairSeg).forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
    renderPreview();
  });

  $('#launch-card')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!idea.value.trim()) {
      note.textContent = 'Describe what you are launching first.';
      note.classList.add('is-warn');
      idea.focus();
      return;
    }
    note.classList.remove('is-warn');
    note.textContent = 'Preview only: connect a wallet in the app to deploy.';
  });

  renderPreview();

  /* ---------- markets table ---------- */

  const rows = $('#market-rows');

  const renderMarkets = (filter) => {
    const list = MARKETS.filter((m) =>
      filter === 'all' ? true : filter === 'graduating' ? m.curve >= 85 : m.kind === filter);
    rows.innerHTML = list.map((m) => {
      const done = m.curve >= 100;
      const sign = m.change >= 0 ? '+' : '';
      return `
        <div class="dn-tr" role="row">
          <span class="dn-tok" role="cell"><i>${esc(m.ticker[0])}</i><div><b>$${esc(m.ticker)}</b><small>${esc(m.name)}</small></div></span>
          <span class="dn-pair" role="cell">${esc(m.pair)}</span>
          <span class="dn-num ${m.change >= 0 ? 'dn-up' : 'dn-down'}" role="cell">${sign}${m.change.toFixed(1)}%</span>
          <span class="dn-curve${done ? ' is-done' : ''}" role="cell">
            <span class="dn-curve-track"><span class="dn-curve-fill" style="display:block;width:${m.curve}%"></span></span>
            <span>${done ? 'Graduated' : m.curve + '% filled'}</span>
          </span>
        </div>`;
    }).join('');
  };

  $('#market-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    $$('#market-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    renderMarkets(btn.dataset.filter);
  });

  if (rows) renderMarkets('all');

  /* ---------- subnet face-off ---------- */

  const snA = $('#sn-a');
  const snB = $('#sn-b');
  const bars = $('#faceoff-bars');

  const renderFaceoff = () => {
    const a = SUBNETS.find((s) => s.id === snA.value);
    const b = SUBNETS.find((s) => s.id === snB.value);
    const total = a.share + b.share;
    const pct = (s) => Math.round((s.share / total) * 100);
    bars.innerHTML = [a, b].map((s) => `
      <div class="dn-bar-row${s.share >= Math.max(a.share, b.share) && a !== b ? ' is-lead' : ''}">
        <div class="dn-bar-head"><span>${esc(s.id)} · ${esc(s.name)}</span><b>${pct(s)}%</b></div>
        <div class="dn-bar"><div style="width:${pct(s)}%"></div></div>
      </div>`).join('');
  };

  if (snA && snB) {
    const opts = SUBNETS.map((s) => `<option value="${s.id}">${s.id} · ${s.name}</option>`).join('');
    snA.innerHTML = opts;
    snB.innerHTML = opts;
    snA.value = 'SN19';
    snB.value = 'SN9';
    snA.addEventListener('change', renderFaceoff);
    snB.addEventListener('change', renderFaceoff);
    renderFaceoff();
  }

  /* ---------- thesis cards ---------- */

  const theses = $('#theses');
  if (theses) {
    theses.innerHTML = THESES.map((t) => `
      <article class="dn-card dn-thesis dn-rise">
        <span class="dn-label">$${esc(t.ticker)}</span>
        <blockquote>${esc(t.quote)}</blockquote>
        <div class="dn-thesis-foot">
          <span class="dn-author"><i>${esc(t.who[0].toUpperCase())}</i>@${esc(t.who)}</span>
          <span class="dn-pair">${esc(t.pair)}</span>
        </div>
      </article>`).join('');
  }

  /* ---------- scroll reveal ---------- */

  const risers = $$('.dn-rise');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    risers.forEach((el) => io.observe(el));
  } else {
    risers.forEach((el) => el.classList.add('is-in'));
  }
})();
