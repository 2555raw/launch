/* ARCHIVO 2020 — el archivo con scroll.

   Monta las cinco escenas de escenas.js en los cinco capítulos de index.html:
   convierte el scroll de cada uno en un progreso 0..1, mantiene el ruido de la
   pantalla, el índice lateral y la secuencia de arranque. */

(() => {
  'use strict';

  const A = window.ARCHIVO;
  const { c01 } = A;

  /* ================================================================
     Montaje: arranque, ruido CRT, interfaz y bucle
     ================================================================ */

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SCENES = A.scenes;

  const chapters = $$('.chapter').map((el) => {
    const cv = $('canvas', el);
    const cx = cv.getContext('2d', { alpha: false });
    cx.imageSmoothingEnabled = false;
    el.style.height = (el.dataset.len || 520) + 'vh';
    return { el, cx, draw: SCENES[el.dataset.scene], p: 0 };
  });

  /* ---------- ruido de la pantalla ---------- */

  const nz = $('#noise');
  const nctx = nz.getContext('2d');
  const nimg = nctx.createImageData(nz.width, nz.height);

  function paintNoise() {
    const d = nimg.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = v > 214 ? 78 : v > 130 ? 26 : 8;
    }
    nctx.putImageData(nimg, 0, 0);
  }
  paintNoise();

  /* ---------- corte de señal entre sectores ---------- */

  const tearEl = $('#tear');
  let tearUntil = 0;

  function signalCut() {
    if (REDUCED) return;
    tearUntil = performance.now() + 260;
  }

  /* ---------- interfaz ---------- */

  const links = $$('.hud__nav a');
  const rail = $('#railFill');
  const meta = $('#hudMeta');
  const rec = $('#rec');
  let current = -1;

  function updateHud(t) {
    const doc = document.documentElement;
    const total = doc.scrollHeight - window.innerHeight;
    const g = total > 0 ? c01(window.scrollY / total) : 0;
    rail.style.height = (g * 100) + '%';
    meta.textContent = 'SECTOR ' + String(Math.round(g * 5000)).padStart(4, '0') + ' / 5000';
    rec.classList.toggle('off', Math.floor(t / 620) % 2 === 0);

    let idx = 0;
    const mid = window.innerHeight / 2;
    chapters.forEach((ch, i) => {
      const r = ch.el.getBoundingClientRect();
      if (r.top <= mid) idx = i;
    });
    if (idx !== current) {
      current = idx;
      links.forEach((a, i) => a.classList.toggle('on', i === idx));
      signalCut();
    }
  }

  /* ---------- bucle ---------- */

  let t0 = performance.now();
  let frames = 0;

  function loop(now) {
    const t = REDUCED ? 0 : now - t0;
    frames++;

    if (!REDUCED && frames % 3 === 0) paintNoise();

    if (now < tearUntil) {
      const k = (tearUntil - now) / 260;
      tearEl.style.opacity = String(k * 0.8);
      tearEl.style.height = Math.round(2 + k * 26) + 'px';
      tearEl.style.top = Math.round(Math.random() * 90) + '%';
    } else if (tearEl.style.opacity !== '0') {
      tearEl.style.opacity = '0';
    }

    const vh = window.innerHeight;
    for (const ch of chapters) {
      const r = ch.el.getBoundingClientRect();
      if (r.bottom < -40 || r.top > vh + 40) continue;
      const run = r.height - vh;
      ch.p = run > 0 ? c01(-r.top / run) : 0;
      ch.draw(ch.cx, ch.p, t);
    }

    updateHud(now - t0);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------- secuencia de arranque ---------- */

  const BOOT = [
    'ARCHIVO NACIONAL DE MEMORIA DIGITAL',
    'UNIDAD DE RECUPERACION DE DATOS  V0.9.4',
    '',
    'CPU 486DX2   MEM 8192K   VIDEO CGA .... <i>OK</i>',
    'MONTANDO VOLUMEN: <i>PANDEMIA_2020_2023</i>',
    'SECTORES DANADOS: <b>4.219</b>',
    'REGISTROS RECUPERABLES: 05',
    '',
    'RECONSTRUYENDO INDICE ...'
  ];

  const bootEl = $('#boot');
  const logEl = $('#bootLog');
  const barEl = $('#bootBar');
  const enterEl = $('#bootEnter');

  BOOT.forEach((line, i) => {
    setTimeout(() => {
      logEl.innerHTML += line + '\n';
      barEl.style.setProperty('--w', Math.round(((i + 1) / BOOT.length) * 100) + '%');
    }, 130 * i + 120);
  });

  setTimeout(() => {
    enterEl.hidden = false;
    barEl.style.setProperty('--w', '100%');
  }, 130 * BOOT.length + 380);

  function enter() {
    if (document.body.classList.contains('is-in')) return;
    document.body.classList.remove('is-booting');
    document.body.classList.add('is-in');
    signalCut();
    window.scrollTo(0, 0);
    setTimeout(() => bootEl.remove(), 700);
  }

  enterEl.addEventListener('click', enter);
  bootEl.addEventListener('click', enter);

  /* ---------- teclado ---------- */

  window.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('is-in')) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); enter(); }
      return;
    }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= chapters.length) {
      chapters[n - 1].el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      signalCut();
    }
  });

  links.forEach((a) => a.addEventListener('click', signalCut));

})();
