/* Nomia — page behaviour.
   No dependencies: theme, menu, anchor navigation, code tabs, scroll reveal and
   the dashboard mockup. Nothing loops. */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- theme ---------- */

  const SUN  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>';
  const MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';

  const themeBtn = $('#theme');

  const applyTheme = (mode) => {
    document.documentElement.setAttribute('data-theme', mode);
    if (themeBtn) themeBtn.innerHTML = mode === 'light' ? MOON : SUN;
  };

  let stored = null;
  try { stored = localStorage.getItem('nomia-theme'); } catch (_) { /* storage blocked */ }
  applyTheme(stored === 'light' ? 'light' : 'dark');

  themeBtn?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('nomia-theme', next); } catch (_) { /* storage blocked */ }
  });

  /* ---------- mobile menu ---------- */

  const burger = $('#burger');
  const links  = $('#navlinks');

  burger?.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });

  /* ---------- anchor navigation ---------- */

  const NAV_H = 62;

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-scroll]');
    if (!el) return;
    const target = document.getElementById(el.dataset.scroll);
    if (!target) return;
    e.preventDefault();
    const y = target.getBoundingClientRect().top + window.scrollY - NAV_H - 12;
    window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });
    links?.classList.remove('is-open');
    burger?.setAttribute('aria-expanded', 'false');
  });

  /* ---------- active section in the nav ---------- */

  const navItems = $$('#navlinks a');
  const sections = navItems
    .map((a) => document.getElementById(a.dataset.scroll))
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navItems.forEach((a) => a.classList.toggle('is-active', a.dataset.scroll === entry.target.id));
      });
    }, { rootMargin: `-${NAV_H + 40}px 0px -62% 0px`, threshold: 0 });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- code tabs ---------- */

  const FILES = { node: 'agent.ts', python: 'agent.py', curl: 'terminal', mcp: 'mcp.json' };
  const tabFile = $('#tabfile');

  $('#tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.nm-tab');
    if (!tab) return;
    const key = tab.dataset.tab;
    $$('#tabs .nm-tab').forEach((t) => t.classList.toggle('is-active', t === tab));
    $$('.nm-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === key));
    if (tabFile) tabFile.textContent = FILES[key] || '';
  });

  /* ---------- dashboard mockup ---------- */

  // Today's spend per agent. Sample data: wiring the real API means replacing
  // this list and nothing else.
  const AGENTS = [
    { name: 'market-researcher',  id: 'agt_9f21c4', spent: 412.80, cap: 600 },
    { name: 'procurement-agent',  id: 'agt_2b70ea', spent: 318.15, cap: 500 },
    { name: 'support-tier-1',     id: 'agt_57ac31', spent: 244.60, cap: 500 },
    { name: 'data-enricher',      id: 'agt_c1d908', spent: 187.05, cap: 400 },
    { name: 'price-watcher',      id: 'agt_44fe6b', spent:  96.40, cap: 300 },
    { name: 'ledger-reconciler',  id: 'agt_8e05d2', spent:  41.90, cap: 250 }
  ];

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const rows = $('#rows');
  if (rows) {
    rows.innerHTML = AGENTS.map((a) => {
      const pct = Math.min(100, Math.round((a.spent / a.cap) * 100));
      return `<div class="nm-row">
        <div class="nm-row-n">${a.name}<small>${a.id} · ${pct}% of ceiling</small></div>
        <div class="nm-bar"><i style="width:${pct}%"></i></div>
        <div class="nm-row-v">${money.format(a.spent)}</div>
      </div>`;
    }).join('');
  }

  /* ---------- scroll reveal ---------- */

  const risers = $$('.nm-rise');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (risers.length && !still && 'IntersectionObserver' in window) {
    // The hidden state is applied by CSS only under .nm-js, so if this never
    // runs the page still renders in full.
    $('.nm')?.classList.add('nm-js');
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        reveal.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    risers.forEach((el) => reveal.observe(el));
  }

  /* ---------- year in the footer ---------- */

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
