/* The wide banner: six reserve cards floating either side of a headline, over
 * a sky blurred past recognition, with coins turning between them.
 *
 *   CHROMIUM_PATH=… node scripts/banner.js
 *
 * Two sizes come out: banner.png at 2000x650 for a post, and banner-header.png
 * at 1500x500 for the X header, laid out separately rather than cropped — a
 * crop of the wide one loses the cards at both ends.
 *
 * The cards' line and percentage are generated, not measured. See
 * media/brand/README.md.
 */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const { card, FEATURED } = require("./cards.js");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "media", "brand");
const b64 = p => "data:image/jpeg;base64," + fs.readFileSync(p).toString("base64");

/* A falling drop. The shape is the easy part; what makes it water is the
 * highlight near the top, the darker rim where the light bends round, and the
 * small bright spot low down where it comes back through. */
function drop(size, x, y, rot, tint) {
  const h = Math.round(size * 1.34);
  const id = `d${x}${y}`;
  return `<div class="drop" style="left:${x}px;top:${y}px;transform:rotate(${rot}deg)">
    <svg width="${size}" height="${h}" viewBox="0 0 60 80">
      <defs>
        <radialGradient id="b${id}" cx="36%" cy="30%" r="72%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".92"/>
          <stop offset="34%" stop-color="${tint}" stop-opacity=".78"/>
          <stop offset="100%" stop-color="${tint}" stop-opacity=".34"/>
        </radialGradient>
        <linearGradient id="r${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".75"/>
          <stop offset="55%" stop-color="#ffffff" stop-opacity=".12"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity=".5"/>
        </linearGradient>
      </defs>
      <path d="M30 2C30 2 54 36 54 52a24 24 0 0 1-48 0C6 36 30 2 30 2Z"
            fill="url(#b${id})" stroke="url(#r${id})" stroke-width="1.6"/>
      <ellipse cx="22" cy="44" rx="7.5" ry="11" fill="#fff" opacity=".55"
               transform="rotate(-18 22 44)"/>
      <circle cx="39" cy="61" r="3.4" fill="#fff" opacity=".8"/>
    </svg></div>`;
}

/* Water, not sweets: the site's accent and two steps either side of it. */
const TINTS = ["#67c0e2", "#8fd6ee", "#4aa9d0", "#a8e3f2", "#5bb8dc"];

function layout({ W, H, head, sub, headSize, subSize, cardW, cards, coins, glows }) {
  return fs.readFileSync(path.join(__dirname, "banner.template.html"), "utf8")
    .replace(/W(?=px|;)/g, W).replace(/H(?=px|;)/g, H)
    .replace(/Wpx/g, W + "px").replace(/Hpx/g, H + "px")
    .replace("HEADpx", headSize + "px").replace("SUBpx", subSize + "px")
    .replace("CARDpx", cardW + "px")
    .replace("HEADLINE", head).replace("SUB", sub)
    .replace("GLOWS", glows).replace("DROPS", coins).replace("CARDS", cards);
}

const HEAD = `A launchpad paired to <span class="on">real water</span>`;
const SUB = "26 named reserves. One curve each. On Robinhood Chain.";

const WIDE = {
  W: 2000, H: 650, headSize: 62, subSize: 21, cardW: 372,
  at: [
    { left: 60,   top: 40,  rot: -4 },
    { left: 24,   top: 246, rot: 3 },
    { left: 150,  top: 452, rot: -2 },
    { left: 1560, top: 30,  rot: 3 },
    { left: 1604, top: 236, rot: -3 },
    { left: 1478, top: 442, rot: 2 },
  ],
  coins: [
    drop(84, 700,  26,  -12, TINTS[0]),
    drop(66, 1288, 430,  14, TINTS[2]),
    drop(52, 628,  486,   8, TINTS[1]),
    drop(46, 1332, 62,   -9, TINTS[3]),
    drop(38, 986,  556,  11, TINTS[4]),
    drop(30, 1150, 190,  -6, TINTS[1]),
    drop(26, 486,  392,   9, TINTS[3]),
  ].join(""),
  glows: `<div class="glow" style="left:-120px;top:-120px;width:640px;height:640px;background:#1c6d95"></div>
    <div class="glow" style="left:1500px;top:-100px;width:640px;height:640px;background:#12705a"></div>
    <div class="glow" style="left:720px;top:380px;width:620px;height:620px;background:#1f5f83"></div>`,
};

const HEADER = {
  W: 1500, H: 500, headSize: 46, subSize: 16, cardW: 330,
  at: [
    { left: 26,   top: 26,  rot: -4 },
    { left: -10,  top: 196, rot: 3 },
    { left: 60,   top: 346, rot: -2 },
    { left: 1150, top: 22,  rot: 3 },
    { left: 1188, top: 192, rot: -3 },
    { left: 1118, top: 342, rot: 2 },
  ],
  coins: [
    drop(64, 476, 28,  -12, TINTS[0]),
    drop(52, 986, 352,  14, TINTS[2]),
    drop(40, 430, 386,   8, TINTS[1]),
    drop(30, 900, 96,   -7, TINTS[3]),
    drop(24, 360, 250,  10, TINTS[4]),
  ].join(""),
  glows: `<div class="glow" style="left:-140px;top:-120px;width:520px;height:520px;background:#1c6d95"></div>
    <div class="glow" style="left:1100px;top:-100px;width:520px;height:520px;background:#12705a"></div>
    <div class="glow" style="left:520px;top:280px;width:500px;height:500px;background:#1f5f83"></div>`,
};

/* Left-hand cards turn their right edge away, right-hand ones their left, so
 * the set reads as standing around the headline rather than pasted flat on it. */
const deck = spec => FEATURED.map((t, i) => {
  const a = spec.at[i];
  const yaw = i < 3 ? 13 : -13;
  return card(t, `left:${a.left}px;top:${a.top}px;z-index:5;`
    + `transform:perspective(1400px) rotateY(${yaw}deg) rotate(${a.rot}deg)`);
}).join("");

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  for (const [name, spec] of [["banner", WIDE], ["banner-header", HEADER]]) {
    const html = layout({ ...spec, head: HEAD, sub: SUB, cards: deck(spec) });
    for (const [suffix, scale] of [["@2x", 2], ["", 1]]) {
      const p = await b.newPage({ viewport: { width: spec.W, height: spec.H }, deviceScaleFactor: scale });
      await p.setContent(html, { waitUntil: "networkidle" });
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(OUT, `${name}${suffix}.png`) });
      await p.close();
    }
    console.log(`${name}  ${spec.W}x${spec.H} + @2x`);
  }
  await b.close();
})();
