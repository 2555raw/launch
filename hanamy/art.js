/* ------------------------------------------------------------------
   The hero engraving. Drawn rather than photographed: a cherry grove
   over a river, in the woodcut manner the reference uses for its oaks
   — hatched ground, silhouetted trunks, blossom in place of leaves.
   Seeded, so the same grove is printed on every load.
   ------------------------------------------------------------------ */
(function () {
  const c = document.getElementById("grove");
  if (!c) return;
  const img = document.getElementById("heroimg");

  // A tiny deterministic PRNG. The scene must not reshuffle on resize.
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  const INK = "#3a1826", INK2 = "#5b2a3b", BARK = "#2e1220";
  const SKY0 = "#fff3f7", SKY1 = "#ffe2ec";
  const PETAL = ["#ffd4e2", "#ffbdd2", "#f7a8c0", "#ffe9f0"];

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const r = rng(20260918);

    // sky
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, SKY1); sky.addColorStop(.55, SKY0); sky.addColorStop(1, "#ffd9e6");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);

    // distant hills, each hatched a little denser than the one behind it
    for (let band = 0; band < 3; band++) {
      const base = h * (0.52 + band * 0.07);
      const amp = 26 - band * 6;
      g.beginPath(); g.moveTo(0, h);
      g.lineTo(0, base);
      for (let x = 0; x <= w; x += 12) {
        const y = base + Math.sin((x / w) * (3 + band) * Math.PI + band) * amp
                       + Math.sin(x / 47 + band * 2) * 5;
        g.lineTo(x, y);
      }
      g.lineTo(w, h); g.closePath();
      g.fillStyle = ["#ffd0e0", "#f8b9ce", "#eea3bd"][band];
      g.fill();
      // hatching
      g.save(); g.clip();
      g.strokeStyle = "rgba(90,30,55," + (0.05 + band * 0.04) + ")";
      g.lineWidth = 1;
      for (let x = -h; x < w + h; x += 7 - band) {
        g.beginPath(); g.moveTo(x, base - amp); g.lineTo(x + h, h); g.stroke();
      }
      g.restore();
    }

    // the river: a pale ribbon that narrows as it goes back
    const rt = h * 0.60, rb = h + 20;
    g.beginPath();
    g.moveTo(w * 0.58, rt);
    g.bezierCurveTo(w * 0.56, h * 0.76, w * 0.44, h * 0.86, w * 0.34, rb);
    g.lineTo(w * 0.62, rb);
    g.bezierCurveTo(w * 0.66, h * 0.83, w * 0.62, h * 0.73, w * 0.60, rt);
    g.closePath();
    const riv = g.createLinearGradient(0, rt, 0, rb);
    riv.addColorStop(0, "#fff6f9"); riv.addColorStop(1, "#ffe6ef");
    g.fillStyle = riv; g.fill();
    g.save(); g.clip();
    g.strokeStyle = "rgba(120,40,70,.13)"; g.lineWidth = 1.2;
    for (let i = 0; i < 46; i++) {
      const y = rt + (rb - rt) * (i / 46);
      const x = w * (0.58 - 0.22 * ((y - rt) / (rb - rt)));
      const len = 18 + r() * 60 * ((y - rt) / (rb - rt) + .3);
      g.beginPath(); g.moveTo(x + r() * 26, y); g.lineTo(x + r() * 26 + len, y + 1); g.stroke();
    }
    g.restore();

    // ground hatching on both banks
    g.strokeStyle = "rgba(70,25,45,.10)"; g.lineWidth = 1;
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = h * 0.62 + r() * h * 0.38;
      const len = 4 + r() * 12;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * 0.3, y - len); g.stroke();
    }

    // --- the trees -------------------------------------------------
    function blossom(x, y, s, alpha) {
      g.globalAlpha = alpha;
      const n = Math.round(9 + r() * 10);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = r() * s;
        g.beginPath();
        g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 1.4 + r() * s * 0.16, 0, 7);
        g.fillStyle = PETAL[(r() * PETAL.length) | 0];
        g.fill();
      }
      g.globalAlpha = 1;
    }

    function branch(x, y, ang, len, wid, depth, cloud) {
      if (depth <= 0 || len < 4) { if (cloud) blossom(x, y, 16 + r() * 16, .95); return; }
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(ang - .3) * len * .6, y + Math.sin(ang - .3) * len * .6, x2, y2);
      g.lineWidth = wid; g.strokeStyle = cloud ? BARK : INK2;
      g.lineCap = "round"; g.stroke();
      const k = r() < .25 ? 3 : 2;
      for (let i = 0; i < k; i++) {
        const spread = (i - (k - 1) / 2) * (0.5 + r() * 0.45);
        branch(x2, y2, ang + spread + (r() - .5) * .2, len * (0.62 + r() * 0.18),
               Math.max(0.6, wid * 0.62), depth - 1, cloud);
      }
      if (cloud && depth <= 2) blossom(x2, y2, 14 + r() * 20, .9);
    }

    // far grove: small, pale, no detail
    for (let i = 0; i < 22; i++) {
      const x = r() * w, y = h * (0.58 + r() * 0.08);
      g.globalAlpha = .45 + r() * .25;
      branch(x, y, -Math.PI / 2 + (r() - .5) * .3, 26 + r() * 20, 3.4, 4, true);
      g.globalAlpha = 1;
    }

    // the two framing trees, left and right, reaching over the scene
    branch(w * 0.06, h * 1.02, -Math.PI / 2 + 0.16, h * 0.30, 15, 6, true);
    branch(w * 0.95, h * 1.02, -Math.PI / 2 - 0.18, h * 0.32, 17, 6, true);
    // one standing mid-left, closer to the water
    branch(w * 0.30, h * 0.92, -Math.PI / 2 - 0.05, h * 0.20, 9, 5, true);

    // canopy arch across the top, the way the reference frames its scene
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const x = w * t, y = h * (0.06 + Math.sin(t * Math.PI) * 0.16);
      blossom(x + (r() - .5) * 40, y, 26 + r() * 22, .85);
    }

    // a few petals in the air
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = h * 0.15 + r() * h * 0.7;
      g.globalAlpha = .35 + r() * .4;
      g.fillStyle = PETAL[(r() * PETAL.length) | 0];
      g.beginPath(); g.ellipse(x, y, 1.6 + r() * 2, 1 + r() * 1.3, r() * 3, 0, 7); g.fill();
    }
    g.globalAlpha = 1;

    // print edge: a dark vignette, as a block would leave
    const vig = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.95);
    vig.addColorStop(0, "rgba(58,24,38,0)");
    vig.addColorStop(1, "rgba(58,24,38,.32)");
    g.fillStyle = vig; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(58,24,38,.5)"; g.lineWidth = 1;
    g.strokeRect(.5, .5, w - 1, h - 1);
    void INK;
  }

  let t;
  function start() {
    if (img) img.hidden = true;
    c.hidden = false;
    draw();
    addEventListener("resize", () => { clearTimeout(t); t = setTimeout(draw, 160); });
  }

  // The engraving is the fallback, not the default: it is printed only if
  // the photograph is missing or fails to load.
  if (!img) start();
  else if (img.complete) { if (!img.naturalWidth) start(); }
  else { img.addEventListener("error", start, { once: true }); }
})();
