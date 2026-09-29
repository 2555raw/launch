/* ORBE — page behaviour.
   No dependencies: mobile menu, anchor navigation, active section, scroll
   reveal and the live-price mockup in the hero panel. */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  document.documentElement.classList.add('js');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* ---------- anchor navigation ---------- */

  const NAV_H = 64;

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-scroll]');
    if (!el) return;
    const target = document.getElementById(el.dataset.scroll);
    if (!target) return;
    e.preventDefault();
    const y = el.dataset.scroll === 'top' ? 0 : target.getBoundingClientRect().top + window.scrollY - NAV_H;
    window.scrollTo({ top: Math.max(y, 0), behavior: reduced ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + el.dataset.scroll);
    closeMenu();
  });

  /* ---------- active section in the nav ---------- */

  const navLinks = $$('.nav__links a[data-scroll]:not(.btn)');
  const sections = navLinks.map((a) => document.getElementById(a.dataset.scroll)).filter(Boolean);

  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.scroll === entry.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => spy.observe(s));

    /* ---------- scroll reveal ---------- */

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: .12 });

    $$('.reveal').forEach((el, i) => {
      el.style.transitionDelay = `${(i % 3) * 80}ms`;
      io.observe(el);
    });
  } else {
    $$('.reveal').forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- live-price mockup ---------- */

  const fmt = (n) => n.toFixed(3).replace('.', ',');
  const px    = $('#px');
  const pxd   = $('#pxd');
  const line  = $('#sparkLine');
  const area  = $('#sparkArea');
  const rows  = $$('#rows li');

  const OPEN = 141.72;
  const W = 300, H = 70, N = 40;
  let series = [];
  let v = OPEN;
  for (let i = 0; i < N; i++) {
    v += (Math.random() - .45) * .18;
    series.push(v);
  }

  const draw = () => {
    const min = Math.min(...series), max = Math.max(...series);
    const span = max - min || 1;
    const pts = series.map((y, i) => [
      (i / (N - 1)) * W,
      H - 6 - ((y - min) / span) * (H - 14),
    ]);
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    line.setAttribute('d', d);
    area.setAttribute('d', `${d} L${W} ${H} L0 ${H} Z`);

    const last = series[N - 1];
    const pct = ((last - OPEN) / OPEN) * 100;
    px.textContent = fmt(last);
    pxd.textContent = `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2).replace('.', ',')}%`;
    pxd.classList.toggle('is-down', pct < 0);

    // the other venues trail the best price by a small, slowly drifting spread
    const spreads = [0, .045, .08, .14];
    rows.forEach((row, i) => {
      const s = spreads[i] + (i ? (Math.random() - .5) * .01 : 0);
      row.children[1].textContent = fmt(last * (1 - s / 100));
      if (i) row.children[2].textContent = `−${s.toFixed(2).replace('.', ',')}%`;
    });
  };

  if (px && line && area) {
    draw();
    if (!reduced) {
      setInterval(() => {
        const next = series[N - 1] + (Math.random() - .47) * .16;
        series = [...series.slice(1), next];
        draw();
      }, 1400);
    }
  }

  /* ---------- footer year ---------- */

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
