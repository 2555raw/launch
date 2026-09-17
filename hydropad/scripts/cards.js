/* The six featured reserves as cards: the photograph of the place instead of a
 * flag, the published spot figure, and the fill level.
 *
 * The little chart is the level itself — water standing in the reserve, with a
 * wave for a surface — not a price history. There is no price history to draw
 * and a sparkline that means nothing is the kind of thing that reads as a fake
 * chart later.
 *
 *   CHROMIUM_PATH=… node scripts/cards.js
 */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), vm = require("vm");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "media", "brand");

/* data.js is a browser file; read the register out of it. */
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(ROOT, "data.js"), "utf8")
  + ";globalThis.__ = ({ WATER, BASE_LEVEL, FEATURED });", ctx);
const { WATER, BASE_LEVEL, FEATURED } = vm.runInContext("__", ctx);

const TINT = { Reservoir: "#1c6d95", Aquifer: "#0f9d76", Glacier: "#3b9fd4", Desalination: "#0b6b7d" };
const money = n => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* A trace per reserve, and a different one for each: a walk seeded from the
 * ticker, so it is stable across runs and nothing is redrawn by chance.
 *
 * Say plainly what this is: it is NOT measured history. There is no public
 * series of these figures to plot. It is the same seeded drift data.js already
 * uses for the spot figures, and it is here because the card wants a line. The
 * numbers on the card — the spot and the fill — are the published ones.
 */
function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h |= 0;
    return ((h >>> 0) % 100000) / 100000;
  };
}

function series(t, n = 64) {
  const next = rng("hydropad:" + t);

  /* The figure on the badge is a session's move, not the whole window's, so it
   * belongs in the range one of these actually reads: a percent or so either
   * way, the way the reference cards do. The line is drawn to agree with it —
   * a card showing +0.18% over a line that falls off a cliff is worse than
   * either on its own. */
  const move = (next() - 0.5) * 0.028;
  /* The drift only has to set which way the line leans; let it run and it
   * swamps the noise, and what comes out is a smooth curve pinned against the
   * top of the box rather than something that looks like a chart. */
  const drift = (move / Math.abs(move || 1)) * (0.0008 + next() * 0.0022);
  const jit = 0.045 + next() * 0.04;

  const pts = [];
  let v = 0.5;
  for (let i = 0; i < n; i++) {
    v += drift + (next() - 0.5) * jit;
    v = Math.max(0.06, Math.min(0.94, v));
    pts.push(v);
  }
  return { pts, move };
}

function trace(pts, up) {
  const w = 378, h = 84, pad = 4;
  const lo = Math.min(...pts), hi = Math.max(...pts), span = (hi - lo) || 1;
  const x = i => (i / (pts.length - 1)) * w;
  const y = v => pad + (1 - (v - lo) / span) * (h - pad * 2);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const colour = up ? "#10b981" : "#ef4444";
  const id = "g" + Math.random().toString(36).slice(2, 8);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${colour}" stop-opacity=".22"/>
      <stop offset="1" stop-color="${colour}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${line}L${w} ${h}L0 ${h}Z" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${colour}" stroke-width="2.2"
          stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function card(t, style = "") {
  const w = WATER.find(x => x.t === t);
  const level = BASE_LEVEL[t] ?? .5;
  const pct = Math.round(level * 100);
  const band = level >= .7 ? "high" : level >= .4 ? "mid" : "low";

  const { pts, move } = series(t);
  const up = move >= 0;
  const chg = `${up ? "+" : "\u2212"}${Math.abs(move * 100).toFixed(2)}%`;
  const photo = "data:image/jpeg;base64," +
    fs.readFileSync(path.join(ROOT, "media", "sources", `${t}.jpg`)).toString("base64");
  return `<div class="card" style="${style}">
    <div class="top">
      <img class="ico" src="${photo}" alt="">
      <div class="who">
        <div class="tk">${t}</div>
        <div class="nm">${w.n}</div>
        <div class="lvl ${band}">${pct}% full</div>
      </div>
      <div class="fig">
        <div class="px">${money(w.p)}</div>
        <div class="unit">${w.u}</div>
        <div class="chg ${up ? "up" : "down"}">${chg}</div>
      </div>
    </div>
    ${trace(pts, up)}
  </div>`;
}

const page = (width, height, blobs, cards) =>
  fs.readFileSync(path.join(__dirname, "cards.template.html"), "utf8")
    .replace(/WIDTH/g, width).replace(/HEIGHT/g, height)
    .replace("BLOBS", blobs).replace("CARDS", cards);

/* Required from scripts/header.js, which puts a few of these on a banner. */
module.exports = { card, series, trace, FEATURED, WATER, BASE_LEVEL };
if (require.main !== module) return;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  fs.mkdirSync(OUT, { recursive: true });

  /* Each card on its own, for anywhere one is wanted alone. */
  for (const t of FEATURED) {
    const p = await b.newPage({ viewport: { width: 530, height: 260 }, deviceScaleFactor: 2 });
    await p.setContent(page(530, 260, "", card(t, "left:30px;top:30px")), { waitUntil: "networkidle" });
    await p.waitForTimeout(250);
    await p.locator(".card").screenshot({ path: path.join(OUT, `card-${t}.png`), omitBackground: true });
    await p.close();
    console.log("card", t);
  }

  /* And the six together, floating, for a post. */
  const W = 1600, H = 900;
  /* Overlapping and tilted, the way a handful of cards falls, rather than a
   * grid with the corners knocked off. */
  const at = [
    { left: 108,  top: 96,  rot: -8, z: 6, s: 1.02 },
    { left: 575,  top: 44,  rot: 4,  z: 5, s: .97 },
    { left: 1015, top: 138, rot: 9,  z: 4, s: 1.0  },
    { left: 62,   top: 448, rot: 6,  z: 3, s: .99  },
    { left: 512,  top: 392, rot: -5, z: 7, s: 1.04 },
    { left: 975,  top: 518, rot: 7,  z: 2, s: .96  },
  ];
  const cards = FEATURED.map((t, i) => {
    const a = at[i];
    return card(t, `left:${a.left}px;top:${a.top}px;z-index:${a.z};`
      + `transform:rotate(${a.rot}deg) scale(${a.s})`);
  }).join("");
  const blobs = `
    <div class="blob" style="left:-160px;top:-140px;width:620px;height:620px;background:#5cb9e6"></div>
    <div class="blob" style="left:560px;top:-220px;width:640px;height:640px;background:#6fd9b4"></div>
    <div class="blob" style="left:1180px;top:180px;width:600px;height:600px;background:#63c3ef"></div>
    <div class="blob" style="left:120px;top:520px;width:560px;height:560px;background:#9bd7f2"></div>
    <div class="blob" style="left:760px;top:640px;width:520px;height:520px;background:#7fe0c6"></div>`;
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await p.setContent(page(W, H, blobs, cards), { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, "cards.png") });
  await p.close();
  console.log("cards.png", W + "x" + H, "at 2x");

  await b.close();
})();
