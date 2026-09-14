/* Landing page: motion and one check. None of this touches keys — the wallet
   lives at /app and shares nothing with this file but a localStorage read. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Everything that reacts to scrolling shares one listener and one frame.
     Four separate scroll handlers would fight each other for the same 16ms. */
  const onScroll = [];
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll.forEach(f => f()); ticking = false; });
  }, { passive: true });

  /* ── The bar closes into a capsule once the page moves ─────────────────── */
  const nav = $('.nav');
  onScroll.push(() => nav.classList.toggle('stuck', scrollY > 8));

  /* ── Sections arriving ─────────────────────────────────────────────────── */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('seen');
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: .1 });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('seen'));
  }

  /* ── Counters ──────────────────────────────────────────────────────────── */
  const repaint = [];
  $$('[data-count]').forEach(el => {
    const to = Number(el.dataset.count);
    const paint = v => { el.textContent = (el.dataset.prefix || '') + v + (el.dataset.suffix || ''); };
    /* The suffix is translated, so the final value has to be repaintable. */
    repaint.push(() => paint(el.dataset.done ? to : 0));
    if (calm || !('IntersectionObserver' in window)) { el.dataset.done = '1'; return paint(to); }
    paint(0);
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), ms = 900;
      const tick = now => {
        const k = Math.min(1, (now - t0) / ms);
        paint(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(tick); else el.dataset.done = '1';
      };
      requestAnimationFrame(tick);
    }), { threshold: .6 });
    io.observe(el);
  });

  /* ── The hero card follows the pointer ─────────────────────────────────── */
  const stage = $('#stage'), card = $('#heroCard');
  if (stage && card && !calm && matchMedia('(hover: hover)').matches) {
    const base = 'rotateX(9deg) rotateY(-13deg) rotateZ(1.5deg)';
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `rotateX(${9 - y * 16}deg) rotateY(${-13 + x * 18}deg) rotateZ(1.5deg)`;
      card.style.setProperty('--sheen', `${(x + .5) * 100}%`);
    });
    stage.addEventListener('pointerleave', () => { card.style.transform = base; });
  }

  /* ── Follow a payment ──────────────────────────────────────────────────────
     Four blocks of copy scroll past a panel that stays put. The scene shown is
     whichever step sits closest to the middle of the screen, so the panel keeps
     up with reading rather than with pixel counts. */
  const steps = $$('.jr-step');
  const scenes = $$('.jr-scene');
  const dots = $$('.jr-dots i');
  if (steps.length && scenes.length) {
    let current = -1;
    const setScene = i => {
      if (i === current) return;
      current = i;
      scenes.forEach((s, n) => s.classList.toggle('on', n === i));
      dots.forEach((d, n) => d.classList.toggle('on', n === i));
      steps.forEach((s, n) => s.classList.toggle('active', n === i));
    };
    setScene(0);
    onScroll.push(() => {
      const mid = innerHeight * 0.5;
      let best = 0, bestD = Infinity;
      steps.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      setScene(best);
    });
  }

  /* ── Plan cards lean towards the cursor ────────────────────────────────── */
  if (!calm && matchMedia('(hover: hover)').matches) {
    $$('.tier .tcard').forEach(tc => {
      const host = tc.parentElement;
      host.addEventListener('pointermove', e => {
        const r = tc.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        tc.style.transform = `rotateX(${-y * 10}deg) rotateY(${x * 12}deg)`;
        tc.style.setProperty('--sheen', `${(x + .5) * 100}%`);
      });
      host.addEventListener('pointerleave', () => { tc.style.transform = ''; });
    });
  }

  /* ── What Ward stores ───────────────────────────────────────────────────
     It waits for the page to move rather than blocking the first screen: a
     notice about storage is worth reading, and nobody reads one that lands
     before they have seen what the site is. Dismissing it is itself the only
     thing it writes. */
  const consent = $('#consent');
  const SEEN = 'ward.v1.notice';
  let told = true;
  try { told = !!localStorage.getItem(SEEN); } catch {}

  if (consent && !told) {
    let shown = false;
    const reveal = () => {
      if (shown || scrollY < 180) return;
      shown = true;
      consent.hidden = false;
      requestAnimationFrame(() => consent.classList.add('in'));
    };
    onScroll.push(reveal);

    const dismiss = () => {
      consent.classList.remove('in');
      consent.classList.add('out');
      try { localStorage.setItem(SEEN, String(Date.now())); } catch {}
      setTimeout(() => { consent.hidden = true; }, 500);
    };
    $('#csOk').addEventListener('click', dismiss);

    const more = $('#csMore'), detail = $('#csDetail');
    more.addEventListener('click', () => {
      const open = detail.hidden;
      detail.hidden = !open;
      const d = (window.WARD_I18N || {})[document.documentElement.lang.slice(0, 2)] || {};
      more.textContent = open ? (d['cs.hide'] || 'Hide details') : (d['cs.more'] || "What's stored");
    });
  }

  /* ── Language ────────────────────────────────────────────────────────────
     One page, four dictionaries, swapped at runtime. English stays in the HTML
     as the source, so a failure to load i18n.js leaves a readable page rather
     than an empty one. */
  const LANGS = [
    { id: 'en', name: 'English', short: 'EN' },
    { id: 'es', name: 'Español', short: 'ES' },
    { id: 'zh', name: '中文', short: '中文' },
    { id: 'ru', name: 'Русский', short: 'RU' }
  ];
  const HTML_LANG = { en: 'en', es: 'es', zh: 'zh-Hans', ru: 'ru' };
  const LANG_KEY = 'ward.v1.lang';
  const DICT = window.WARD_I18N || {};

  function chooseLang() {
    try { const saved = localStorage.getItem(LANG_KEY); if (saved && DICT[saved]) return saved; } catch {}
    const n = (navigator.language || 'en').toLowerCase();
    if (n.startsWith('es')) return 'es';
    if (n.startsWith('zh')) return 'zh';
    if (n.startsWith('ru')) return 'ru';
    return 'en';
  }

  function applyLang(id, remember) {
    const d = DICT[id];
    if (!d) return;
    document.documentElement.lang = HTML_LANG[id] || id;
    $$('[data-i18n]').forEach(el => {
      const v = d[el.dataset.i18n];
      if (v != null) el.innerHTML = v;
    });
    $$('[data-i18n-suffix]').forEach(el => {
      const v = d[el.dataset.i18nSuffix];
      if (v != null) el.dataset.suffix = v;
    });
    repaint.forEach(f => f());
    if (d['meta.title']) document.title = d['meta.title'];
    const desc = $('meta[name="description"]');
    if (desc && d['meta.desc']) desc.setAttribute('content', d['meta.desc']);

    const now = LANGS.find(l => l.id === id);
    if ($('#langNow')) $('#langNow').textContent = now ? now.short : id.toUpperCase();
    $$('#langMenu button').forEach(b => b.classList.toggle('on', b.dataset.lang === id));
    if (remember) { try { localStorage.setItem(LANG_KEY, id); } catch {} }

    /* The notice button carries two labels; keep the one it is showing. */
    const more = $('#csMore'), detail = $('#csDetail');
    if (more && detail && !detail.hidden) more.textContent = d['cs.hide'] || more.textContent;
    if (hasWallet) markHasWallet();
  }

  let hasWallet = false;
  try {
    hasWallet = ['ward.v1', 'quiver.v1', 'calma.v1'].some(ns => localStorage.getItem(ns + '.keystore'));
  } catch {}
  function markHasWallet() {
    const d = DICT[chooseLang()] || {};
    const open = d['nav.openmine'] || 'Open my wallet';
    $$('#heroCta, #footCta').forEach(a => { a.textContent = open; });
    if ($('#navCta')) $('#navCta').textContent = d['nav.mine'] || 'My wallet';
  }

  const menu = $('#langMenu'), langBtn = $('#langBtn');
  if (menu && langBtn) {
    LANGS.forEach(l => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.lang = l.id; b.textContent = l.name;
      b.addEventListener('click', () => { applyLang(l.id, true); closeMenu(); });
      li.appendChild(b); menu.appendChild(li);
    });
    const closeMenu = () => { menu.hidden = true; langBtn.setAttribute('aria-expanded', 'false'); };
    langBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      langBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }

  applyLang(chooseLang(), false);

  onScroll.forEach(f => f());
})();
