/* ARCHIVE 2020 — the shell.

   Startup sequence, CRT noise, the menu and the switch between the two modes.
   Both modes are drawn from one animation loop: whichever is on screen gets the
   frame, the other one is not even asked for it. */

(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const body = document.body;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- signal cut, shared by both modes ---------- */

  const tearEl = $('#tear');
  let tearUntil = 0;

  function signalCut() { if (!REDUCED) tearUntil = performance.now() + 260; }

  window.SHELL = { REDUCED, signalCut };

  /* ---------- screen noise ---------- */

  const nz = $('#noise');
  const nctx = nz.getContext('2d');
  const nimg = nctx.createImageData(nz.width, nz.height);
  let frames = 0;

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

  /* ---------- switching modes ---------- */

  function setMode(m) {
    const prev = body.dataset.mode;
    if (prev === m) return;
    if (prev === 'floor' && window.MODE_FLOOR.leave) window.MODE_FLOOR.leave();
    body.dataset.mode = m;
    if (m === 'boot') startBoot();
    if (m === 'archive') window.MODE_ARCHIVE.enter();
    if (m === 'floor') window.MODE_FLOOR.enter();
    signalCut();
  }

  document.querySelectorAll('[data-go]').forEach((b) =>
    b.addEventListener('click', () => setMode(b.dataset.go)));

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && body.dataset.mode === 'archive') setMode('menu');
    if (body.dataset.mode === 'menu' && (e.code === 'Digit1' || e.code === 'Digit2')) {
      setMode(e.code === 'Digit1' ? 'archive' : 'floor');
    }
  });

  /* ---------- the loop ---------- */

  let last = performance.now();
  const t0 = last;

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now - t0;
    const mode = body.dataset.mode;

    if (mode === 'archive') window.MODE_ARCHIVE.frame(dt, t);
    else if (mode === 'floor') window.MODE_FLOOR.frame(dt, t);

    if (now < tearUntil) {
      const k = (tearUntil - now) / 260;
      tearEl.style.opacity = String(k * 0.8);
      tearEl.style.height = Math.round(2 + k * 26) + 'px';
      tearEl.style.top = Math.round(Math.random() * 90) + '%';
    } else if (tearEl.style.opacity !== '0') {
      tearEl.style.opacity = '0';
    }

    if (!REDUCED && ++frames % 3 === 0) paintNoise();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------- cookies, and the clause under them ---------- */

  const soulChip = $('#soulChip');

  function soul(sold) {
    window.SHELL.soul = sold;
    try { localStorage.setItem('pandemik-soul', sold ? 'sold' : 'kept'); } catch (_) { /* storage blocked */ }
    if (soulChip) soulChip.textContent = sold ? '· SOUL: FORFEITED' : '· SOUL: RETAINED';
  }
  soul(false);

  $('#cookAccept').addEventListener('click', () => {
    const sold = $('#ckSoul').checked;
    soul(sold);
    $('#cookFine').textContent = sold
      ? 'Filed. The Devil thanks you and files nothing, because there is nothing to file. No cookie was set either.'
      : 'You left the second box empty. Somebody reads the small print after all.';
    signalCut();
    setTimeout(() => setMode('boot'), 420);
  });

  $('#cookReject').addEventListener('click', () => {
    soul(false);
    $('#cookFine').textContent = 'Rejected. The cookies still do not exist, your soul stays where it is, and the page works exactly the same. Going in anyway.';
    signalCut();
    setTimeout(() => setMode('boot'), 900);
  });

  /* ---------- startup ---------- */

  const BOOT = [
    'NATIONAL ARCHIVE OF DIGITAL MEMORY',
    'DATA RECOVERY UNIT  V0.9.4',
    '',
    'CPU 486DX2   MEM 8192K   VIDEO CGA .... <i>OK</i>',
    'MOUNTING VOLUME: <i>PANDEMIC_2020_2023</i>',
    'DAMAGED SECTORS: <b>4,219</b>',
    'RECOVERABLE RECORDS: 05',
    'SURVIVORS ON RECORD: <b>00</b>',
    '',
    'REBUILDING INDEX ...'
  ];

  const logEl = $('#bootLog'), barEl = $('#bootBar'), enterEl = $('#bootEnter'), bootEl = $('#boot');
  let booted = false;

  function startBoot() {
    if (booted) return;
    booted = true;
    BOOT.forEach((line, i) => {
      setTimeout(() => {
        logEl.innerHTML += line + '\n';
        barEl.style.setProperty('--w', Math.round(((i + 1) / BOOT.length) * 100) + '%');
      }, 110 * i + 100);
    });
    setTimeout(() => {
      enterEl.hidden = false;
      barEl.style.setProperty('--w', '100%');
    }, 110 * BOOT.length + 320);
  }

  const enter = () => {
    if (body.dataset.mode !== 'boot' || enterEl.hidden) return;
    setMode('menu');
    setTimeout(() => bootEl.remove(), 380);
  };
  enterEl.addEventListener('click', enter);
  bootEl.addEventListener('click', enter);
  window.addEventListener('keydown', (e) => {
    if (body.dataset.mode !== 'boot') return;
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); enter(); }
  });

})();
