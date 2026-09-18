/* ------------------------------------------------------------------
   The reel's timeline.

   Nothing animates by itself: setT(t) places every element for the time
   it is given, and the renderer steps through the frames calling it. A
   deterministic scene can be re-rendered, diffed and re-cut; a scene
   driven by CSS animation and wall-clock time cannot.
   ------------------------------------------------------------------ */
const DUR = 24;                     // seconds
const $ = (id) => document.getElementById(id);

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const outCubic = (x) => 1 - Math.pow(1 - x, 3);
/* 0 before start, 1 after start+dur, eased between */
const lead = (t, start, dur = .7) => outCubic(clamp((t - start) / dur));
/* a window that rises, holds and falls */
function hold(t, start, end, fade = .55) {
  if (t < start - fade || t > end + fade) return 0;
  if (t < start) return outCubic((t - start + fade) / fade);
  if (t > end) return 1 - outCubic((t - end) / fade);
  return 1;
}

const SCENES = [
  ["s1", 0.2, 4.2],
  ["s2", 4.6, 8.6],
  ["s3", 9.0, 13.4],
  ["s4", 13.8, 18.0],
  ["s5", 18.4, 20.8],
  ["s6", 21.2, 24.0],
];

const LINE = "remember what I told you yesterday";
const JSON_LINES = [
  ['{', ''],
  ['  "model": ', '"llama-3.3-70b-versatile",'],
  ['  "messages": [', ''],
  ['    { "role": "user", "content": ', '"what is a bonding curve?" }'],
  ['  ],', ''],
  ['  "stream": ', 'true'],
  ['}', '']
];

/* ---- the petals, which drift the whole way through ---- */
const PETAL = ["#f4d8de", "#f2c4d2", "#e8b0c2", "#fbe9ef"];
let drift = [];
function seedPetals() {
  let s = 20260918;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  drift = Array.from({ length: 38 }, () => ({
    x: r() * 1280, y: r() * 720, r: 2 + r() * 4.5,
    vx: 6 + r() * 16, vy: 9 + r() * 18,
    sway: 14 + r() * 30, phase: r() * 6.283,
    a: .18 + r() * .34, hue: PETAL[(r() * PETAL.length) | 0]
  }));
}
seedPetals();

function petals(t) {
  const c = $("petals"), g = c.getContext("2d");
  g.clearRect(0, 0, 1280, 720);
  for (const p of drift) {
    const x = (p.x + p.vx * t + Math.sin(t * .6 + p.phase) * p.sway) % 1360 - 40;
    const y = (p.y + p.vy * t) % 800 - 40;
    g.globalAlpha = p.a;
    g.fillStyle = p.hue;
    g.beginPath();
    g.ellipse(x, y, p.r * 1.7, p.r, (t * .4 + p.phase), 0, 6.283);
    g.fill();
  }
  g.globalAlpha = 1;
}

/* ---- one burst, when the typed line comes apart ---- */
let burst = null;
function burstAt(t0) {
  let s = 7717;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  burst = { t0, parts: Array.from({ length: 220 }, () => ({
    x: 366 + r() * 548, y: 422 + r() * 26,
    vx: 20 + r() * 230, vy: -55 - r() * 110, g: 55 + r() * 95,
    r: 1.4 + r() * 3, a: .9, hue: PETAL[(r() * PETAL.length) | 0],
    sp: (r() - .5) * 4
  }) ) };
}
function drawBurst(t) {
  if (!burst) return;
  const dt = t - burst.t0;
  if (dt < 0 || dt > 3) return;
  const g = $("petals").getContext("2d");
  for (const p of burst.parts) {
    const a = p.a - dt * .34;
    if (a <= 0) continue;
    const x = p.x + p.vx * dt;
    const y = p.y + p.vy * dt + .5 * p.g * dt * dt;
    g.save(); g.translate(x, y); g.rotate(p.sp * dt);
    g.globalAlpha = a; g.fillStyle = p.hue;
    g.beginPath(); g.ellipse(0, 0, p.r * 1.7, p.r, 0, 0, 6.283); g.fill();
    g.restore();
  }
}

function setT(t) {
  petals(t);

  for (const [id, a, b] of SCENES) {
    const el = $(id);
    const v = hold(t, a, b);
    el.style.opacity = v.toFixed(3);
    // each scene lifts a little as it arrives, and settles
    const rise = (1 - lead(t, a - .45, .9)) * 22;
    el.style.transform = `translateY(${rise.toFixed(2)}px)`;
  }

  /* 1: the line types itself, then goes */
  const typeStart = 0.9, typeEnd = 2.5, goAt = 3.0;
  const shown = Math.round(clamp((t - typeStart) / (typeEnd - typeStart)) * LINE.length);
  const gone = t >= goAt;
  $("typed").textContent = gone ? "" : LINE.slice(0, shown);
  $("typed").style.opacity = gone ? "0" : "1";
  $("cap1").textContent = gone ? "gone. nothing was kept." : "and stop typing";
  $("cap1").classList.toggle("on", gone);
  if (t >= goAt && (!burst || burst.t0 !== goAt)) burstAt(goAt);
  if (t < goAt) burst = null;
  drawBurst(t);

  /* 2: the request writes itself out, one line at a time */
  const j0 = 5.2, per = .28;
  let out = "";
  JSON_LINES.forEach((pair, i) => {
    const on = clamp((t - (j0 + i * per)) / .3);
    if (on <= 0) return;
    out += pair[0] + (pair[1] ? pair[1] : "") + "\n";
  });
  $("json").innerHTML = out
    .replace(/("(?:model|messages|stream|role|content)")/g, '<span class="k">$1</span>')
    .replace(/(\[[\s\S]*?\])/, (m) => `<span class="hi">${m}</span>`);

  /* 3: the pair dims the moment the next question starts */
  const askAgain = 11.6;
  const dim = clamp((t - askAgain) / .6);
  $("t1a").style.opacity = (1 - dim * .62).toFixed(3);
  $("t1b").style.opacity = (1 - dim * .62).toFixed(3);
  $("t2a").style.opacity = lead(t, askAgain, .5).toFixed(3);
  $("t2a").style.transform = `translateY(${((1 - lead(t, askAgain, .5)) * 10).toFixed(2)}px)`;

  /* 4: the audit fills in */
  ["r1", "r2", "r3"].forEach((id, i) => {
    const v = lead(t, 14.5 + i * .5, .5);
    $(id).style.opacity = v.toFixed(3);
    $(id).style.transform = `translateX(${((1 - v) * -14).toFixed(2)}px)`;
  });

  /* 5: the chips land one by one */
  ["c1", "c2", "c3"].forEach((id, i) => {
    const v = lead(t, 18.9 + i * .28, .45);
    $(id).style.opacity = v.toFixed(3);
    $(id).style.transform = `translateY(${((1 - v) * 14).toFixed(2)}px)`;
  });
}

window.setT = setT;
window.DUR = DUR;
setT(0);
