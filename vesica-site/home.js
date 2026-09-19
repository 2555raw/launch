/* Vesica — the home page: the brand marks in the stock grid, and the copy button. */

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

  /* Something for it to turn in front of. Two circles of equal radius, each
     passing through the other's centre: the lens where they cross is a vesica,
     which is the shape the mark is built from and the reason for the name. It
     sits behind everything, turns the other way and much more slowly, and is
     soft enough at the edge to read as depth rather than as a second logo. */
  const NS = 'http://www.w3.org/2000/svg';
  const R = 38, Y = R * Math.sqrt(3) / 2;
  const defs = svg.querySelector('defs');
  defs.insertAdjacentHTML('beforeend', `
    <radialGradient id="vesicaglow" cx="50%" cy="46%" r="62%">
      <stop offset="0%"   stop-color="#F2EAA0" stop-opacity=".72"/>
      <stop offset="52%"  stop-color="#D3D2DA" stop-opacity=".46"/>
      <stop offset="100%" stop-color="#DCDBE2" stop-opacity="0"/>
    </radialGradient>
    <filter id="vesicasoft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.4"/>
    </filter>
    <filter id="markedge" x="-12%" y="-12%" width="124%" height="124%">
      <feGaussianBlur stdDeviation=".13"/>
    </filter>`);

  /* Where the mark's own spikes are thinner than the gap between two layers,
     the stack still combs however the foreshortening is floored — the source
     path is simply narrower there than the step. An eighth of a unit of blur over the
     composited group closes those teeth into an edge, and reads as the depth
     of field a solid this close to the lens would have anyway. */
  g.setAttribute('filter', 'url(#markedge)');

  const ground = document.createElementNS(NS, 'g');
  ground.setAttribute('filter', 'url(#vesicasoft)');
  ground.innerHTML =
    `<path fill="url(#vesicaglow)" d="M50 ${(50 - Y).toFixed(2)}` +
    ` A${R} ${R} 0 0 1 50 ${(50 + Y).toFixed(2)}` +
    ` A${R} ${R} 0 0 1 50 ${(50 - Y).toFixed(2)} Z"/>` +
    `<path fill="none" stroke="#B9B8C2" stroke-width=".8" opacity=".8"` +
    ` d="M50 ${(50 - Y).toFixed(2)} A${R} ${R} 0 0 1 50 ${(50 + Y).toFixed(2)}` +
    ` A${R} ${R} 0 0 1 50 ${(50 - Y).toFixed(2)} Z"/>`;
  g.parentNode.insertBefore(ground, g);

  const DEPTH = 40;        // layers from back to front — more, and all opaque
  const STEP = 0.92;       // how far apart they sit, in viewBox units
  const PERIOD = 22000;    // one full turn about the vertical axis
  const TUMBLE = 0.62;     // turns about the horizontal axis per turn about the vertical
  const EASE = 0.58;       // how hard it dwells face-on and snaps through edge-on
  const YSQUASH = 0.62;    // the stack spreads less vertically than sideways
  const ROLL = 0.22;       // turns in the picture plane per turn about the vertical
  const DRIFT_X = 5.2;     // how far it wanders, in viewBox units
  const DRIFT_Y = 4.4;
  const BREATH = 0.055;    // how much it swells as it comes round

  /* A solid is shaded, not faded. Every layer is fully opaque and the colour
     runs dark at the back to light at the face, which is what makes a stack of
     flat copies read as one object with a lit front and a body behind it.
     The old build did the opposite — it faded the layers out and tinted the
     deepest eight pastel — and the result was a smear with a yellow edge on
     one side rather than a shape. The group carries the transparency instead,
     once, so the thing stays a background element without any of its internal
     structure dissolving. */
  const BACK = [0x6E, 0x6D, 0x7A];      // the body, in shadow
  const FACE = [0xEF, 0xEE, 0xF2];      // the lit front
  const shade = f => '#' + BACK.map((b, k) =>
    Math.round(b + (FACE[k] - b) * Math.pow(f, 1.35)).toString(16).padStart(2, '0')).join('');

  const layers = [];
  for (let i = 0; i < DEPTH; i++) {
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#vesicamark');
    u.setAttribute('fill', shade(i / (DEPTH - 1)));
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
  /* The floor on the foreshortening is not cosmetic. Each layer is a copy of a
     shape with holes in it, so as the face narrows the copies become slivers
     while their spacing stays put — and below about a fifth the stack opens
     into a comb instead of closing into a block. Holding the face at 0.24
     keeps every sliver wider than the gap to the next one, at every angle. */
  const FLOOR = 0.24;
  const squash = a => { const c = Math.cos(a); return Math.sign(c || 1) * Math.max(Math.abs(c), FLOOR); };

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
    // it swells a little as the face comes round, which sells the near edge
    const grow = 1 + BREATH * Math.cos(yaw);
    g.setAttribute('transform',
      `translate(${wx.toFixed(3)} ${wy.toFixed(3)}) rotate(${roll.toFixed(2)} 50 50) ` +
      `translate(50 50) scale(${grow.toFixed(4)}) translate(-50 -50)`);
    // the ground turns the other way, slowly, so the two never look welded
    ground.setAttribute('transform',
      `translate(${(wx * 0.35).toFixed(3)} ${(wy * 0.35).toFixed(3)}) ` +
      `rotate(${(-roll * 0.45).toFixed(2)} 50 50)`);

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
