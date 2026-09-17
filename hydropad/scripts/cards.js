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

/* The level, drawn: a filled body of water with a wave on top. */
function levelChart(level, tint) {
  const w = 378, h = 84, top = Math.round(h - 8 - level * (h - 18));
  const a = 4.5;
  let d = `M0 ${top}`;
  for (let x = 0; x < w; x += 68) d += ` q17 ${-a} 34 0 t34 0`;
  d += ` L${w} ${h} L0 ${h} Z`;
  const id = "g" + Math.random().toString(36).slice(2, 8);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${tint}" stop-opacity=".42"/>
      <stop offset="1" stop-color="${tint}" stop-opacity=".06"/>
    </linearGradient></defs>
    <path d="${d}" fill="url(#${id})"/>
    <path d="${d}" fill="none" stroke="${tint}" stroke-width="2.4" stroke-linejoin="round"/>
  </svg>`;
}

function card(t, style = "") {
  const w = WATER.find(x => x.t === t);
  const level = BASE_LEVEL[t] ?? .5;
  const pct = Math.round(level * 100);
  const band = level >= .7 ? "high" : level >= .4 ? "mid" : "low";
  const tint = TINT[w.c] || "#1c6d95";
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
      </div>
    </div>
    ${levelChart(level, tint)}
  </div>`;
}

const page = (width, height, blobs, cards) =>
  fs.readFileSync(path.join(__dirname, "cards.template.html"), "utf8")
    .replace(/WIDTH/g, width).replace(/HEIGHT/g, height)
    .replace("BLOBS", blobs).replace("CARDS", cards);

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
