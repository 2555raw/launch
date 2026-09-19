/* PayLink, version 1.1. Page behaviour.
   No dependencies. The sidebar and the top bar are stamped in here so every
   page carries the same shell; the page itself only holds its content.
   Theme, the search shortcut, the calculator, the demo forms and a scroll
   reveal. Nothing loops except the dashed wires, which are CSS. */

(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- icons ---------- */

  const I = {
    home:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
    search:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/></svg>',
    plus:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    link:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg>',
    dollar:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v18"/><path d="M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3"/></svg>',
    pulse:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-6 4 12 2.5-6h5"/></svg>',
    code:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 8-4 4 4 4M16 8l4 4-4 4"/></svg>',
    mark:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5 14.5 9.5"/><path d="M13 7.5 15.2 5.3a3.1 3.1 0 0 1 4.4 4.4L17.4 12"/><path d="M11 16.5 8.8 18.7a3.1 3.1 0 0 1-4.4-4.4L6.6 12"/></svg>',
    sun:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>',
    moon:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
    burger:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    x:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.2 8.3L23 22h-6.6l-5.2-6.8L5.3 22H2.1l7.7-8.8L1.8 2h6.8l4.7 6.2L18.9 2zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20z"/></svg>',
  };

  /* ---------- shell ---------- */

  const page = document.body.dataset.page || 'home';
  const NAV = [
    ['home',    'index.html',   'Home',           I.home],
    ['explore', 'explore.html', 'Explore',        I.search],
    ['_',       'Get paid'],
    ['launch',  'launch.html',  'Launch a token', I.plus],
    ['link',    'link.html',    'Link a token',   I.link],
    ['_',       'Transparency'],
    ['fees',    'fees.html',    'Fees',           I.dollar],
    ['proof',   'proof.html',   'Live proof',     I.pulse],
    ['docs',    'docs.html',    'Docs',           I.code],
  ];

  const side = document.createElement('aside');
  side.className = 'side';
  side.id = 'side';
  side.innerHTML = `
    <a class="brand" href="index.html"><span class="mark">${I.mark}</span><b>Pay<em>Link</em></b></a>
    <nav class="nav" aria-label="Main">
      ${NAV.map(([k, href, label, icon]) => k === '_'
        ? `<div class="group">${href}</div>`
        : `<a href="${href}" class="${k === page ? 'is-active' : ''}">${icon}<span>${label}</span></a>`).join('')}
    </nav>
    <div class="side-foot">
      <a class="btn-side" href="launch.html">Launch a token</a>
      <a class="who" href="fees.html"><span class="av">$</span><span><strong>Platform fees</strong><span>0x78289…9854E</span></span></a>
      <a class="who" href="https://x.com/PayLinkRH" target="_blank" rel="noopener"><span class="av x">${I.x}</span><span><strong>PayLink</strong><span class="sans">@PayLinkRH</span></span></a>
    </div>`;

  const top = document.createElement('header');
  top.className = 'top';
  top.innerHTML = `
    <button class="icon-btn burger" id="burger" aria-label="Menu" aria-controls="side" aria-expanded="false">${I.burger}</button>
    <label class="search">${I.search}<input id="q" type="search" placeholder="Search tokens, tickers, addresses" aria-label="Search"><kbd>Ctrl K</kbd></label>
    <span class="grow"></span>
    <button class="icon-btn" id="theme" aria-label="Switch theme">${I.moon}</button>
    <a class="btn btn-accent" href="launch.html">Launch</a>
    <button class="btn btn-ghost hide-sm" id="wallet">Connect wallet</button>`;

  const root = $('.pl');
  root.prepend(top);
  root.prepend(side);

  /* ---------- theme ---------- */

  const themeBtn = $('#theme');
  const applyTheme = (mode) => {
    document.documentElement.setAttribute('data-theme', mode);
    themeBtn.innerHTML = mode === 'light' ? I.sun : I.moon;
  };
  let stored = null;
  try { stored = localStorage.getItem('paylink-theme'); } catch (_) { /* storage blocked */ }
  applyTheme(stored === 'light' ? 'light' : 'dark');
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('paylink-theme', next); } catch (_) { /* storage blocked */ }
  });

  /* ---------- menu, search, wallet ---------- */

  const burger = $('#burger');
  burger.addEventListener('click', () => {
    const open = side.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (side.classList.contains('is-open') && !side.contains(e.target) && !burger.contains(e.target)) side.classList.remove('is-open');
  });

  const q = $('#q');
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); q.focus(); q.select(); }
  });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && q.value.trim()) location.href = 'explore.html?q=' + encodeURIComponent(q.value.trim());
  });

  const toastEl = document.createElement('div');
  toastEl.className = 'toast'; toastEl.setAttribute('role', 'status');
  document.body.appendChild(toastEl);
  let toastT;
  const toast = (msg) => {
    toastEl.textContent = msg; toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  };
  window.plToast = toast;

  $('#wallet').addEventListener('click', () => {
    if (window.ethereum && window.ethereum.request) {
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then((a) => { if (a && a[0]) { $('#wallet').textContent = a[0].slice(0, 6) + '…' + a[0].slice(-4); toast('Wallet connected'); } })
        .catch(() => toast('Connection cancelled'));
    } else {
      toast('No wallet found in this browser');
    }
  });

  /* ---------- calculator ---------- */

  const money = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const range = $('#vol');
  if (range) {
    const out = $('#vol-out');
    const fees = $('#c-fees'), into = $('#c-into'), share = $('#c-share'), pctFees = $('#c-pct');
    const presets = $$('.presets button');
    const TRADE_FEE = 0.01, CREATOR_CUT = 0.70, PAYOUT = 0.80;
    const render = () => {
      const v = Number(range.value);
      const creator = v * TRADE_FEE * CREATOR_CUT;
      out.textContent = '$' + v.toLocaleString('en-US');
      fees.textContent = money(creator);
      into.textContent = money(creator * PAYOUT);
      share.textContent = money(creator * (1 - PAYOUT));
      pctFees.textContent = (TRADE_FEE * CREATOR_CUT * 100).toFixed(1) + '% of volume';
      presets.forEach((b) => b.classList.toggle('is-on', Number(b.dataset.v) === v));
    };
    range.addEventListener('input', render);
    presets.forEach((b) => b.addEventListener('click', () => { range.value = b.dataset.v; render(); }));
    render();
  }

  /* ---------- demo forms ---------- */

  const isAddr = (s) => /^0x[0-9a-fA-F]{40}$/.test(s.trim());
  const lookup = $('#lookup');
  if (lookup) {
    lookup.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('#token-addr').value;
      toast(isAddr(v) ? 'Reading the Pons factory for ' + v.slice(0, 6) + '…' + v.slice(-4) : 'That is not an Ethereum address');
    });
  }
  const launch = $('#launch-form');
  if (launch) {
    launch.addEventListener('submit', (e) => {
      e.preventDefault();
      const pay = $('#pay-addr').value;
      if (!isAddr(pay)) { toast('The PayPal address has to be an Ethereum address'); $('#pay-addr').focus(); return; }
      toast('Connect a wallet to sign the launch');
    });
  }

  /* ---------- explore search ---------- */

  const params = new URLSearchParams(location.search);
  const filter = $('#filter');
  if (filter) {
    const rows = $$('#explore-rows tr');
    const apply = () => {
      const s = filter.value.trim().toLowerCase();
      let n = 0;
      rows.forEach((r) => { const on = !s || r.textContent.toLowerCase().includes(s); r.hidden = !on; if (on) n++; });
      $('#explore-empty').hidden = n > 0;
    };
    if (params.get('q')) filter.value = params.get('q');
    filter.addEventListener('input', apply);
    apply();
  }

  /* ---------- reveal ---------- */

  const rv = $$('.rv');
  if ('IntersectionObserver' in window && rv.length) {
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    rv.forEach((el) => io.observe(el));
  } else rv.forEach((el) => el.classList.add('is-in'));
})();
