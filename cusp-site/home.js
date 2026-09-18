/* Cusp — the home page: the brand marks in the stock grid, and the copy button. */

document.querySelectorAll('.hm-stock[data-logo]').forEach(el => {
  const l = LOGOS[el.dataset.logo];
  if (!l) return;
  const dot = el.querySelector('span');
  dot.style.background = '#EEEEEE';
  dot.style.color = l.c === '#000000' ? '#3D3B4F' : l.c;
  dot.innerHTML = `<svg viewBox="${l.vb}" fill="currentColor"><path d="${l.p}"${l.evenodd ? ' fill-rule="evenodd"' : ''}/></svg>`;
});

/* ---------- the mark, given thickness ----------
   Sweeping the mark all the way round turned it into a blob: at most angles
   the silhouette was gone. So it is extruded instead — the same path stacked
   back along a depth axis, front face opaque — and the yaw is limited to ±34°
   so the face never edges out and you are always looking at the logo.

   Rotating a slab about its vertical axis does two things at once: the face
   narrows by cos(yaw), and the stack shifts sideways by sin(yaw). Doing both
   is what makes it read as a solid rather than a squashed drawing.

   One <defs> path and 26 <use> layers, because the traced mark is 9 KB.
   It stops when it is off screen or the tab is hidden, and it never moves if
   the reader asked for less motion. */

(function thickenTheMark() {
  const svg = document.querySelector('.hm-form svg');
  const g = document.getElementById('spin');
  if (!svg || !g) return;

  const DEPTH = 26;        // layers from back to front
  const STEP = 0.9;        // how far apart they sit, in viewBox units
  const YAW = 34 * Math.PI / 180;
  const PERIOD = 14000;    // one yaw sweep, left to right and back
  const TUMBLE = 1.6;      // somersaults per yaw sweep — the pitch never reverses
  const EASE = 0.46;       // how hard it dwells face-on and snaps through edge-on
  const YSQUASH = 0.5;     // the stack spreads less vertically than sideways
  const DRIFT_X = 5.5;     // how far it wanders, in viewBox units
  const DRIFT_Y = 5.0;

  const layers = [];
  for (let i = 0; i < DEPTH; i++) {
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#cuspmark');
    // back layers are faint, the face is solid
    const front = i / (DEPTH - 1);
    u.setAttribute('opacity', (0.05 + 0.5 * Math.pow(front, 2.4)).toFixed(3));
    // the deepest layers carry a faint pastel trail, so the solid has an edge
    // rather than a second colour: eight layers, none of them over a fifth opaque
    if (i < 8) {
      u.setAttribute('fill', '#F2EAA0');
      u.setAttribute('opacity', (0.07 + 0.11 * (i / 7)).toFixed(3));
    }
    g.appendChild(u);
    layers.push(u);
  }

  /* Two rotations at once. The yaw still swings ±34° and comes back, so the
     face is never edge-on sideways and the silhouette stays readable. The
     pitch, by contrast, never reverses: it runs all the way round, which is
     what makes it read as a somersault rather than a nod. Halfway through one
     the slab is edge-on and you are looking at the stack itself — that moment
     is the tumble, so it is kept, only floored at 0.06 so it stays a sliver
     rather than collapsing to nothing.

     On top of the two rotations the whole group wanders: one slow diagonal
     and a faster bob against it, which traces a lopsided figure of eight
     instead of a straight line back and forth. */
  function place(t) {
    const yaw = YAW * Math.sin(t);

    /* A somersault turned at a constant rate spends as long edge-on as it
       does facing you, and edge-on the mark is a bar. So the angle is eased:
       θ − k·sin2θ runs at about a sixth speed through the two orientations
       where the logo reads and at nearly twice speed through the two where it
       does not. Same full revolution, most of it spent recognisable. */
    const raw = t * TUMBLE;
    const pitch = raw - EASE * Math.sin(2 * raw);

    const sx = Math.cos(yaw);
    const cp = Math.cos(pitch);
    const sy = Math.sign(cp || 1) * Math.max(Math.abs(cp), 0.06);

    const dx = Math.sin(yaw) * STEP;
    const dy = Math.sin(pitch) * STEP * YSQUASH;

    const wx = DRIFT_X * Math.sin(t * 0.64);
    const wy = DRIFT_Y * Math.sin(t * 0.64 + 1.05) + 2.2 * Math.sin(t * 1.7);
    g.setAttribute('transform', `translate(${wx.toFixed(3)} ${wy.toFixed(3)})`);

    layers.forEach((u, i) => {
      const z = (DEPTH - 1 - i);          // 0 at the front
      u.setAttribute('transform',
        `translate(${(dx * z).toFixed(3)} ${(dy * z).toFixed(3)}) ` +
        `translate(50 50) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-50 -50)`);
    });
  }

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
