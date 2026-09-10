/* ARCHIVE 2011 — mode 01: the recovered files.

   Mode 01 is a document, not a scene: five files of text that set up what the
   world lost and what is waiting on each floor of mode 02. Nothing is drawn
   here, so all this file does is keep the cabinet in step with the reading —
   the rail on the right, the sector counter, the REC light and which file the
   side index is pointing at. The shell (startup, CRT noise, mode switching) is
   main.js. */

(() => {
  'use strict';

  const A = window.ARCHIVE;
  const { c01 } = A;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const files = $$('.rec');
  const links = $$('.hud__nav a');
  const rail = $('#railFill');
  const meta = $('#hudMeta');
  const rec = $('#rec');
  let current = -1;

  function frame(dt, t) {
    const doc = document.documentElement;
    const total = doc.scrollHeight - window.innerHeight;
    const g = total > 0 ? c01(window.scrollY / total) : 0;

    rail.style.height = (g * 100) + '%';
    meta.textContent = 'SECTOR ' + String(Math.round(g * 5000)).padStart(4, '0') + ' / 5000';
    rec.classList.toggle('off', Math.floor(t / 620) % 2 === 0);

    /* whichever file has crossed the upper third of the screen is the one
       being read */
    let idx = 0;
    const mark = window.innerHeight / 3;
    files.forEach((el, i) => { if (el.getBoundingClientRect().top <= mark) idx = i; });
    if (idx !== current) {
      current = idx;
      links.forEach((a, i) => a.classList.toggle('on', i === idx));
      window.SHELL.signalCut();
    }
  }

  /* jumping between files with the number keys */
  window.addEventListener('keydown', (e) => {
    if (document.body.dataset.mode !== 'archive') return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= files.length) {
      files[n - 1].scrollIntoView({ behavior: window.SHELL.REDUCED ? 'auto' : 'smooth' });
      window.SHELL.signalCut();
    }
  });

  links.forEach((a) => a.addEventListener('click', () => window.SHELL.signalCut()));

  window.MODE_ARCHIVE = {
    frame,
    enter() { current = -1; window.scrollTo(0, 0); }
  };

})();
