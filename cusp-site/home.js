/* Cusp — the home page: the brand marks in the stock grid, and the copy button. */

document.querySelectorAll('.hm-stock[data-logo]').forEach(el => {
  const l = LOGOS[el.dataset.logo];
  if (!l) return;
  const dot = el.querySelector('span');
  dot.style.background = '#EEEEEE';
  dot.style.color = l.c === '#000000' ? '#3D3B4F' : l.c;
  dot.innerHTML = `<svg viewBox="${l.vb}" fill="currentColor"><path d="${l.p}"${l.evenodd ? ' fill-rule="evenodd"' : ''}/></svg>`;
});

/* ---------- the wireframe form turns ----------
   The form is 46 ellipses sharing a centre, each rotated a little further and
   each with its own width: narrow at the two ends, widest in the middle. That
   bulge is what reads as the near side of the shape, so sweeping it around the
   family — rather than rotating the whole svg, which would only spin a flat
   drawing — is what makes it look like the form is turning.

   It stops when it is off screen or the tab is hidden, and it never starts if
   the reader asked for less motion. */

(function turnTheForm() {
  const svg = document.querySelector('.hm-form svg');
  if (!svg) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const rings = [...svg.querySelectorAll('ellipse')];
  if (rings.length < 4) return;

  const N = rings.length;
  const MIN = 50, SPAN = 150;          // the widths the still form was drawn with
  const PERIOD = 19000;                // one full turn, in ms

  let running = false, raf = 0, t0 = 0, phase = 0;

  function draw(now) {
    if (!t0) t0 = now;
    const p = phase + ((now - t0) / PERIOD) * Math.PI;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      rings[i].setAttribute('rx', (MIN + SPAN * (1 - Math.abs(Math.cos(Math.PI * t + p)))).toFixed(1));
    }
    raf = requestAnimationFrame(draw);
  }

  function start() {
    if (running) return;
    running = true; t0 = 0;
    raf = requestAnimationFrame(draw);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    // keep where it stopped, so coming back does not jump
    phase = (phase + (performance.now() - t0) / PERIOD * Math.PI) % Math.PI;
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? start() : stop()))
      .observe(svg);
  } else start();

  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
})();

/* ---------- the fee loop follows the pointer ----------
   :hover on the <g> is unreliable: with the pointer over one of its <text>
   children the group does not match it in Chrome, which is most of the node.
   Pointer events on the group are reliable, so the state is a class. */

(function lightTheLoop() {
  const dia = document.querySelector('.hm-cta-dia');
  if (!dia) return;
  const nodes = [...dia.querySelectorAll('.fg-node')];
  if (!nodes.length) return;

  nodes.forEach(n => {
    n.addEventListener('pointerenter', () => {
      dia.classList.add('dim');
      nodes.forEach(o => o.classList.toggle('on', o === n));
    });
  });
  dia.addEventListener('pointerleave', () => {
    dia.classList.remove('dim');
    nodes.forEach(o => o.classList.remove('on'));
  });
})();
