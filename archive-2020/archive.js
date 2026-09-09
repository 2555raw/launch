/* ARCHIVE 2020 — mode 01: the scrolling archive.

   Mounts the five scenes of engine.js on the five chapters of the page: turns
   the scroll of each one into a 0..1 progress value and keeps the side index
   in step with it. The shell (startup, CRT noise, mode switching) is main.js. */

(() => {
  'use strict';

  const A = window.ARCHIVE;
  const { c01 } = A;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const chapters = $$('.chapter').map((el) => {
    const cv = $('canvas', el);
    const cx = cv.getContext('2d', { alpha: false });
    cx.imageSmoothingEnabled = false;
    el.style.height = (el.dataset.len || 520) + 'vh';
    return { el, cx, draw: A.scenes[el.dataset.scene], p: 0 };
  });

  const links = $$('.hud__nav a');
  const rail = $('#railFill');
  const meta = $('#hudMeta');
  const rec = $('#rec');
  let current = -1;

  function hud(t) {
    const doc = document.documentElement;
    const total = doc.scrollHeight - window.innerHeight;
    const g = total > 0 ? c01(window.scrollY / total) : 0;
    rail.style.height = (g * 100) + '%';
    meta.textContent = 'SECTOR ' + String(Math.round(g * 5000)).padStart(4, '0') + ' / 5000';
    rec.classList.toggle('off', Math.floor(t / 620) % 2 === 0);

    let idx = 0;
    const mid = window.innerHeight / 2;
    chapters.forEach((ch, i) => { if (ch.el.getBoundingClientRect().top <= mid) idx = i; });
    if (idx !== current) {
      current = idx;
      links.forEach((a, i) => a.classList.toggle('on', i === idx));
      window.SHELL.signalCut();
    }
  }

  function frame(dt, t) {
    const vh = window.innerHeight;
    for (const ch of chapters) {
      const r = ch.el.getBoundingClientRect();
      if (r.bottom < -40 || r.top > vh + 40) continue;
      const run = r.height - vh;
      ch.p = run > 0 ? c01(-r.top / run) : 0;
      ch.draw(ch.cx, ch.p, t);
    }
    hud(t);
  }

  /* jumping between sectors with the number keys */
  window.addEventListener('keydown', (e) => {
    if (document.body.dataset.mode !== 'archive') return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= chapters.length) {
      chapters[n - 1].el.scrollIntoView({ behavior: window.SHELL.REDUCED ? 'auto' : 'smooth' });
      window.SHELL.signalCut();
    }
  });

  links.forEach((a) => a.addEventListener('click', () => window.SHELL.signalCut()));

  window.MODE_ARCHIVE = {
    frame,
    enter() { current = -1; window.scrollTo(0, 0); }
  };

})();
