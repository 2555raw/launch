/* UnyHooks — the landing page's moving parts.

   - the ship's log: a ticker of example rules, written twice so it can loop
   - the rope: a line down the left edge with a knot per section; the hook
     slides down it as the page scrolls and the knot of the current section lights
   - the cannon: fires every few seconds while the launch section is on screen
     (and once more when someone heads for the launch page)

   With prefers-reduced-motion nothing moves: the hook stays at the top, the
   cannon stays quiet, and the ticker is a still line. */

(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the ship's log ---------- */

  const LOG = [
    ['i-anchor', 'when', 'buy > 0.1 ETH', 'refuse'],
    ['i-chest', 'when', 'anyone swaps', '1% to the captain'],
    ['i-storm', 'when', 'price moves 2%', 'raise the fee'],
    ['i-cannon', 'when', 'a wallet buys twice in 30s', 'refuse'],
    ['i-hourglass', 'when', 'the market closes', 'hold all swaps'],
    ['i-lock', 'until', '4 Oct 2027', 'liquidity stays locked'],
    ['i-flag', 'when', '60 minutes pass', 'open the gates']
  ];
  const ticker = $('#ticker');
  if (ticker) {
    const items = LOG.map(([icon, when, cond, then]) =>
      `<span class="uh-ticker-item"><svg aria-hidden="true"><use href="#${icon}"/></svg><b>${when}</b> <code>${cond}</code> <b>then</b> <code>${then}</code></span>`).join('');
    ticker.innerHTML = items + items.replace(/<span class="uh-ticker-item">/g, '<span class="uh-ticker-item" aria-hidden="true">');
  }

  /* ---------- the rope ---------- */

  const rope = $('#rope');
  const hook = $('#rope-hook');
  const sections = [...document.querySelectorAll('#navlinks a[data-scroll]')]
    .map((a) => document.getElementById(a.dataset.scroll)).filter(Boolean);
  if (rope && hook && sections.length) {
    const knots = sections.map(() => {
      const k = document.createElement('span');
      k.className = 'uh-rope-knot';
      rope.appendChild(k);
      return k;
    });
    let frame = 0;
    const place = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const h = window.innerHeight;
      // knots sit where each section's top falls on the rope's scale
      sections.forEach((s, i) => {
        const at = (s.offsetTop / doc.scrollHeight) * (h - 60) + 30;
        knots[i].style.top = `${at}px`;
        const r = s.getBoundingClientRect();
        knots[i].classList.toggle('is-on', r.top < h * .5 && r.bottom > h * .5);
      });
      const y = still ? 20 : (window.scrollY / max) * (h - 70) + 20;
      hook.style.transform = `translateY(${y}px)`;
    };
    const ask = () => { if (!frame) frame = requestAnimationFrame(place); };
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    window.addEventListener('load', ask);
    place();
  }

  /* ---------- the cannon ---------- */

  const battery = $('#battery');
  if (battery && !still) {
    const barrel = $('#bt-barrel');
    const muzzle = $('#bt-muzzle');
    const smoke = $('#bt-smoke');
    const ball = $('#bt-ball');
    const hit = $('#bt-hit');
    const CYCLE = 4200;
    // the ball's arc: from the muzzle to the flag card (a quadratic curve)
    const P0 = { x: 280, y: 236 };
    const P1 = { x: 300, y: 60 };
    const P2 = { x: 300, y: 104 };
    const clamp = (x) => Math.min(1, Math.max(0, x));
    const seg = (t, a, b) => clamp((t - a) / (b - a));

    let visible = false;
    let start = 0;
    let raf = 0;
    const draw = (now) => {
      raf = 0;
      if (!visible) return;
      if (!start) start = now;
      const t = ((now - start) % CYCLE) / CYCLE;
      // recoil, flash and smoke at the shot; the ball flies, then hits
      const kick = t < .08 ? 0 : t < .11 ? seg(t, .08, .11) : 1 - seg(t, .11, .3);
      barrel.setAttribute('transform', `translate(${-14 * kick} ${4 * kick}) rotate(${-3 * kick} 150 250)`);
      const flash = t < .08 ? 0 : t < .1 ? seg(t, .08, .1) : 1 - seg(t, .1, .17);
      muzzle.setAttribute('opacity', flash.toFixed(3));
      const s = seg(t, .09, .55);
      smoke.setAttribute('opacity', (t < .09 ? 0 : s < .1 ? s * 8.5 : .85 * (1 - s)).toFixed(3));
      smoke.setAttribute('transform', `translate(${10 * s} ${-14 * s}) scale(${1 + 1.6 * s})`);
      smoke.style.transformOrigin = '300px 236px';
      const f = seg(t, .1, .46);
      if (t >= .1 && t <= .47) {
        const x = (1 - f) * (1 - f) * P0.x + 2 * (1 - f) * f * P1.x + f * f * P2.x;
        const y = (1 - f) * (1 - f) * P0.y + 2 * (1 - f) * f * P1.y + f * f * P2.y;
        ball.setAttribute('cx', x.toFixed(1));
        ball.setAttribute('cy', y.toFixed(1));
        ball.setAttribute('opacity', '1');
      } else {
        ball.setAttribute('opacity', '0');
      }
      const h = seg(t, .46, .7);
      hit.setAttribute('opacity', (t < .46 ? 0 : 1 - h).toFixed(3));
      hit.setAttribute('transform', `translate(${P2.x} ${P2.y}) scale(${.4 + h * 1.4})`);
      raf = requestAnimationFrame(draw);
    };
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible && !raf) { start = 0; raf = requestAnimationFrame(draw); }
    }, { threshold: .25 }).observe(battery);

    // One more shot on the way to the launch page.
    const link = $('#fire-link');
    if (link) link.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      battery.scrollIntoView({ block: 'center', behavior: 'smooth' });
      visible = true;
      start = performance.now() - CYCLE * .07;
      if (!raf) raf = requestAnimationFrame(draw);
      setTimeout(() => { window.location.href = link.href; }, 900);
    });
  }
})();
