/* Cusp — the home page: the brand marks in the stock grid, and the copy button. */

document.querySelectorAll('.hm-stock[data-logo]').forEach(el => {
  const l = LOGOS[el.dataset.logo];
  if (!l) return;
  const dot = el.querySelector('span');
  dot.style.background = '#EEEEEE';
  dot.style.color = l.c === '#000000' ? '#3D3B4F' : l.c;
  dot.innerHTML = `<svg viewBox="${l.vb}" fill="currentColor"><path d="${l.p}"${l.evenodd ? ' fill-rule="evenodd"' : ''}/></svg>`;
});

/* ---------- the mark, turned into a solid ----------
   The hero form is the mark itself, swept around its vertical axis: thirty
   copies of the same path, each squashed horizontally by the cosine of its
   angle, which is what a profile looks like once it has been rotated in
   space. Advancing the phase turns the whole solid.

   One <defs> path and thirty <use> elements, because the traced mark is 9 KB
   and thirty copies of it in the DOM would not be.

   It stops when it is off screen or the tab is hidden, and it never starts if
   the reader asked for less motion. */

(function turnTheMark() {
  const svg = document.querySelector('.hm-form svg');
  const g = document.getElementById('spin');
  if (!svg || !g) return;

  const N = 30, PERIOD = 22000;
  const layers = [];
  for (let i = 0; i < N; i++) {
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#cuspmark');
    g.appendChild(u);
    layers.push(u);
  }

  const place = p => layers.forEach((u, i) => {
    const a = Math.PI * i / N + p;
    const sx = Math.cos(a);
    u.setAttribute('transform', `translate(50 50) scale(${sx.toFixed(4)} 1) translate(-50 -50)`);
    u.setAttribute('opacity', (0.25 + 0.55 * Math.abs(Math.sin(a))).toFixed(3));
  });

  place(0);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let running = false, raf = 0, t0 = 0, phase = 0;
  function draw(now) {
    if (!t0) t0 = now;
    place(phase + ((now - t0) / PERIOD) * Math.PI * 2);
    raf = requestAnimationFrame(draw);
  }
  function start() { if (!running) { running = true; t0 = 0; raf = requestAnimationFrame(draw); } }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    phase = (phase + (performance.now() - t0) / PERIOD * Math.PI * 2) % (Math.PI * 2);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? start() : stop())).observe(svg);
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
