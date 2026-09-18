/* ------------------------------------------------------------------
   The hero's demonstration.

   Type a line; stop typing; the line comes apart into blossom and goes.
   The text is rendered to an offscreen canvas and sampled, so the petals
   start in the exact shape of what you wrote rather than drifting past
   it. Nothing is stored on the way out, which is the point being made.
   ------------------------------------------------------------------ */
(function () {
  const box = document.getElementById("vanish");
  if (!box) return;
  const input = document.getElementById("vanish-in");
  const note = document.getElementById("vanish-note");
  const c = document.getElementById("petals");
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  const PETAL = ["#ffd9e6", "#ffc2d6", "#f7a8c0", "#fff1f5", "#ffb0c8"];
  let dpr = 1, W = 0, H = 0, parts = [], raf = 0, idle = 0;

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = c.getBoundingClientRect();
    W = r.width; H = r.height;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* Sample the typed line and turn its ink into petals. */
  function burst(text) {
    const cs = getComputedStyle(input);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const pad = 2;
    const off = document.createElement("canvas");
    const og = off.getContext("2d");
    og.font = font;
    const w = Math.ceil(Math.min(og.measureText(text).width, W)) + pad * 2;
    const h = Math.ceil(parseFloat(cs.fontSize) * 1.5);
    if (w < 4 || h < 4) return;
    off.width = w; off.height = h;
    const g2 = off.getContext("2d");
    g2.font = font;
    g2.textBaseline = "middle";
    g2.fillStyle = "#fff";
    g2.fillText(text, pad, h / 2);

    const data = g2.getImageData(0, 0, w, h).data;
    // where the input sits inside the canvas, so the petals start on the words
    const ir = input.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const ox = ir.left - cr.left + 2;
    const oy = ir.top - cr.top + (ir.height - h) / 2 + 2;

    const step = Math.max(2, Math.round(parseFloat(cs.fontSize) / 11));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] < 128) continue;
        parts.push({
          x: ox + x, y: oy + y,
          vx: 0.25 + Math.random() * 1.5,
          vy: -0.5 - Math.random() * 0.7,
          g: 0.012 + Math.random() * 0.02,
          r: 1.1 + Math.random() * 2.1,
          a: 1,
          fade: 0.004 + Math.random() * 0.006,
          spin: (Math.random() - 0.5) * 0.12,
          rot: Math.random() * 6.283,
          hue: PETAL[(Math.random() * PETAL.length) | 0],
          sway: 0.3 + Math.random() * 0.9,
          phase: Math.random() * 6.283
        });
      }
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick(t) {
    const g = c.getContext("2d");
    g.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of parts) {
      if (p.a <= 0) continue;
      alive++;
      p.vy += p.g;
      p.x += p.vx + Math.sin(t / 700 + p.phase) * p.sway * 0.35;
      p.y += p.vy;
      p.rot += p.spin;
      p.a -= p.fade;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.globalAlpha = Math.max(0, p.a);
      g.fillStyle = p.hue;
      g.beginPath();
      g.ellipse(0, 0, p.r * 1.7, p.r, 0, 0, 6.283);
      g.fill();
      g.restore();
    }
    if (alive) { raf = requestAnimationFrame(tick); }
    else { parts = []; raf = 0; g.clearRect(0, 0, W, H); }
  }

  function go() {
    const text = input.value.trim();
    if (!text) return;
    if (!still.matches) burst(text);
    // The text is dropped here. There is no variable holding it afterwards
    // and nothing is written anywhere.
    input.value = "";
    note.textContent = "gone. nothing was kept.";
    note.classList.add("gone");
    clearTimeout(idle);
    idle = setTimeout(() => {
      note.textContent = "and stop typing";
      note.classList.remove("gone");
    }, 3600);
  }

  input.addEventListener("input", () => {
    note.textContent = "and stop typing";
    note.classList.remove("gone");
    clearTimeout(idle);
    if (input.value.trim()) idle = setTimeout(go, 1600);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); clearTimeout(idle); go(); }
  });

  size();
  let rs;
  addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(size, 200); });
})();
