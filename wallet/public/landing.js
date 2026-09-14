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

  /* ── Reading progress ──────────────────────────────────────────────────── */
  const bar = $('#progress');
  const nav = $('.nav');
  onScroll.push(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    nav.classList.toggle('stuck', scrollY > 8);
  });

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
  $$('[data-count]').forEach(el => {
    const to = Number(el.dataset.count);
    const pre = el.dataset.prefix || '', post = el.dataset.suffix || '';
    const paint = v => { el.textContent = pre + v + post; };
    if (calm || !('IntersectionObserver' in window)) return paint(to);
    paint(0);
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), ms = 900;
      const tick = now => {
        const k = Math.min(1, (now - t0) / ms);
        paint(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(tick);
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

  /* ── Anyone who already has a wallet is not offered a second one ───────────
     Making another on top of the first would lose the first. */
  let hasWallet = false;
  try {
    hasWallet = ['ward.v1', 'quiver.v1', 'calma.v1']
      .some(ns => localStorage.getItem(ns + '.keystore'));
  } catch {}
  if (hasWallet) {
    $$('#heroCta, #footCta').forEach(a => { a.textContent = 'Open my wallet'; });
    if ($('#navCta')) $('#navCta').textContent = 'My wallet';
  }

  onScroll.forEach(f => f());
})();
