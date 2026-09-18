/* Cusp — the home page: the brand marks in the stock grid, and the copy button. */

document.querySelectorAll('.hm-stock[data-logo]').forEach(el => {
  const l = LOGOS[el.dataset.logo];
  if (!l) return;
  const dot = el.querySelector('span');
  dot.style.background = '#EEEEEE';
  dot.style.color = l.c === '#000000' ? '#3D3B4F' : l.c;
  dot.innerHTML = markSvg(l);
});

/* ---------- the mark, given thickness ----------
   Sweeping the mark all the way round turned it into a blob: at most angles
   the silhouette was gone. So it is extruded instead — the same path stacked
   back along a depth axis, front face opaque — and the turn is eased so that
   most of it is spent in the orientations where the logo still reads.

   Rotating a slab about an axis does two things at once: the face narrows by
   cos(angle), and the stack shifts along it by sin(angle). Doing both is what
   makes it read as a solid rather than a squashed drawing.

   One <defs> path and 26 <use> layers, because the traced mark is 9 KB.
   It stops when it is off screen or the tab is hidden, and it never moves if
   the reader asked for less motion. */

(function thickenTheMark() {
  const svg = document.querySelector('.hm-form svg');
  const g = document.getElementById('spin');
  if (!svg || !g) return;

  const DEPTH = 26;        // layers from back to front
  const STEP = 0.9;        // how far apart they sit, in viewBox units
  const PERIOD = 14000;    // one full turn about the vertical axis
  const TUMBLE = 1.6;      // turns about the horizontal axis per turn about the vertical
  const EASE = 0.46;       // how hard it dwells face-on and snaps through edge-on
  const YSQUASH = 0.5;     // the stack spreads less vertically than sideways
  const ROLL = 0.55;       // turns in the picture plane per turn about the vertical
  const DRIFT_X = 8.0;     // how far it wanders, in viewBox units
  const DRIFT_Y = 7.0;

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

  /* All three axes, each going all the way round.

     Yaw turns it about the vertical, pitch about the horizontal. Turned at a
     constant rate either would spend as long edge-on as facing you, and
     edge-on this mark is a bar, so both angles are eased first: θ − k·sin2θ
     runs at about a sixth speed through the orientations where the logo
     reads and at nearly twice speed through the two where it does not. Same
     full revolution, most of it recognisable. Where an axis does pass edge-on
     the face is floored at 0.08 and you are left looking at the stack itself,
     which is what a tumbling slab looks like.

     Roll is the third, and it is the one that makes it read as turning every
     way rather than nodding in two: it spins the whole thing in the plane of
     the screen, which is where the diagonals come from. It needs no easing,
     because a rolled logo is still a legible logo — so it turns at a steady
     rate and carries the extrusion round with it.

     The three run at 1 : 1.6 : 0.55, so no two of them line up twice and the
     pose never repeats. On top of them the whole group wanders: one slow
     diagonal and a faster bob against it, tracing a lopsided figure of eight
     instead of a straight line back and forth. */
  const spin = a => a - EASE * Math.sin(2 * a);
  const squash = a => { const c = Math.cos(a); return Math.sign(c || 1) * Math.max(Math.abs(c), 0.08); };

  function place(t) {
    const yaw = spin(t);
    const pitch = spin(t * TUMBLE);

    const sx = squash(yaw);
    const sy = squash(pitch);

    const dx = Math.sin(yaw) * STEP;
    const dy = Math.sin(pitch) * STEP * YSQUASH;

    const wx = DRIFT_X * Math.sin(t * 0.64);
    const wy = DRIFT_Y * Math.sin(t * 0.64 + 1.05) + 2.2 * Math.sin(t * 1.7);
    const roll = (t * ROLL * 180 / Math.PI) % 360;
    g.setAttribute('transform',
      `translate(${wx.toFixed(3)} ${wy.toFixed(3)}) rotate(${roll.toFixed(2)} 50 50)`);

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
