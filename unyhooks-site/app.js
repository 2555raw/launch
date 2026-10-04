/* UnyHooks — page behaviour.
   No dependencies: links from config.js, sticky nav, mobile menu, anchor
   navigation, the typing prompt in the hero, copy-the-contract and scroll reveal. */

(() => {
  'use strict';

  const CONFIG = window.UNYHOOKS || {};
  const NET = CONFIG.NETWORK || {};

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- links ---------- */

  const HREFS = {
    app:  CONFIG.APP_URL,
    signin: CONFIG.SIGNIN_URL || 'app.html',
    docs: CONFIG.DOCS_URL,
    site: CONFIG.SITE_URL,
    x:    `https://x.com/${CONFIG.X_HANDLE}`
  };
  $$('[data-link]').forEach((a) => { a.href = HREFS[a.dataset.link] || '#'; });
  $$('[data-handle]').forEach((el) => { el.textContent = `@${CONFIG.X_HANDLE}`; });
  // The footer shows the app's host name once APP_URL is a full URL.
  $$('[data-host]').forEach((a) => {
    try { a.textContent = new URL(CONFIG.APP_URL).host; } catch (_) { /* relative or a placeholder */ }
  });

  /* ---------- contract address ---------- */

  const ca = $('#ca');
  const copyBtn = $('#copy');
  const copyT = $('#copy-t');
  const explorer = $('#explorer');

  if (CONFIG.CONTRACT && ca && copyBtn) {
    ca.textContent = CONFIG.CONTRACT;
    copyBtn.disabled = false;
    if (explorer && NET.explorerUrl) {
      explorer.href = `${NET.explorerUrl}/address/${CONFIG.CONTRACT}`;
      explorer.hidden = false;
    }

    const copyText = async (text) => {
      try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* fall through */ }
      // Older browsers and non-secure origins: select the text and copy it.
      const range = document.createRange();
      range.selectNodeContents(ca);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { /* unsupported */ }
      sel.removeAllRanges();
      return ok;
    };

    let reset;
    copyBtn.addEventListener('click', async () => {
      const ok = await copyText(CONFIG.CONTRACT);
      copyT.textContent = ok ? 'Copied' : 'Copy failed';
      clearTimeout(reset);
      reset = setTimeout(() => { copyT.textContent = 'Copy CA'; }, 1600);
    });
  }

  /* ---------- sticky nav ---------- */

  const head = $('.uh-head');
  const onScroll = () => head?.classList.toggle('is-stuck', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- mobile menu ---------- */

  const burger = $('#burger');
  const links  = $('#navlinks');

  const closeMenu = () => {
    links?.classList.remove('is-open');
    burger?.setAttribute('aria-expanded', 'false');
  };
  burger?.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  /* ---------- anchor navigation ---------- */

  const NAV_H = 80;

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-scroll]');
    if (!el) return;
    const id = el.dataset.scroll;
    e.preventDefault();
    closeMenu();
    if (id === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const target = document.getElementById(id);
    if (!target) return;
    const y = target.getBoundingClientRect().top + window.scrollY - NAV_H;
    window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });
  });

  /* ---------- active section in the nav ---------- */

  const navItems = $$('#navlinks a[data-scroll]');
  const sections = navItems.map((a) => document.getElementById(a.dataset.scroll)).filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navItems.forEach((a) => a.classList.toggle('is-active', a.dataset.scroll === entry.target.id));
      });
    }, { rootMargin: `-${NAV_H + 40}px 0px -60% 0px`, threshold: 0 });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- hero: hand a request to the builder ---------- */

  const tryForm = $('#try');
  const tryInput = $('#try-input');
  const goBuild = (text) => {
    // Passed through sessionStorage: a query string or hash may not survive
    // every host this page is served from.
    if (text) { try { sessionStorage.setItem('unyhooks-ask', text); } catch (_) { /* storage blocked */ } }
    window.location.href = CONFIG.APP_URL || 'build.html';
  };
  tryForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    goBuild(tryInput.value.trim() || tryInput.placeholder);
  });
  $$('[data-idea]').forEach((b) => b.addEventListener('click', () => goBuild(b.dataset.idea)));

  /* ---------- the typing prompt ---------- */

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const typer = $('#typer');

  const PROMPTS = [
    'Create a Uniswap V4 hook that takes 1% of every swap',
    'Raise the fee when ETH gets volatile',
    'Cap every wallet at 1% of supply for the first hour',
    'Pair my token with NVDA and open it at 9:30'
  ];

  if (typer && !still) {
    let p = 0;
    let i = 0;
    let deleting = false;

    const tick = () => {
      const text = PROMPTS[p];
      if (!deleting) {
        i += 1;
        typer.textContent = text.slice(0, i);
        if (i === text.length) { deleting = true; return setTimeout(tick, 2200); }
        return setTimeout(tick, 38 + Math.random() * 50);
      }
      i -= 1;
      typer.textContent = text.slice(0, i);
      if (i === 0) {
        deleting = false;
        p = (p + 1) % PROMPTS.length;
        return setTimeout(tick, 380);
      }
      return setTimeout(tick, 16);
    };

    typer.textContent = '';
    setTimeout(tick, 600);
  }

  /* ---------- scroll reveal ---------- */

  const risers = $$('.uh-rise');

  if (risers.length && !still && 'IntersectionObserver' in window) {
    $('.uh')?.classList.add('uh-js');
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        reveal.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    risers.forEach((el) => reveal.observe(el));
  }
})();
