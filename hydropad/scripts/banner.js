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

/* A disc, lit from above, with the mark pressed into it. */
function coin(size, x, y, rot, tilt, hue) {
  const [a, c] = hue;
  return `<div class="coin" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;
    background:linear-gradient(150deg,${a},${c});
    transform:perspective(900px) rotate(${rot}deg) rotate3d(1,.38,0,${tilt}deg);z-index:2">
    <svg width="${Math.round(size * 0.52)}" height="${Math.round(size * 0.52)}" viewBox="0 0 26 26">
      <defs><clipPath id="c${x}${y}"><circle cx="13" cy="13" r="9.4"/></clipPath></defs>
      <g clip-path="url(#c${x}${y})">
        <path d="M-3 16q3.25-2.2 6.5 0t6.5 0 6.5 0 6.5 0V30H-3Z" fill="#fff"/></g>
      <circle cx="13" cy="13" r="10.1" fill="none" stroke="#fff" stroke-width="2.1"/>
    </svg></div>`;
}

const HUES = [
  ["#a8e6c9", "#6fcfa6"], ["#bcd8f7", "#7fb0e8"], ["#f7c9d8", "#eda3bd"],
  ["#cfd2f5", "#a3a8ea"], ["#bfe9f5", "#82cfe6"], ["#d8eeba", "#aed77f"],
];

function layout({ W, H, head, sub, headSize, subSize, cardW, cards, coins, glows }) {
  return fs.readFileSync(path.join(__dirname, "banner.template.html"), "utf8")
    .replace(/W(?=px|;)/g, W).replace(/H(?=px|;)/g, H)
    .replace(/Wpx/g, W + "px").replace(/Hpx/g, H + "px")
    .replace("HEADpx", headSize + "px").replace("SUBpx", subSize + "px")
    .replace("CARDpx", cardW + "px")
    .replace("SKY", b64(path.join(ROOT, "media", "sources", "ICE.jpg")))
    .replace("HEADLINE", head).replace("SUB", sub)
    .replace("GLOWS", glows).replace("COINS", coins).replace("CARDS", cards);
}

const HEAD = `Meme coins, paired to <span class="on">real water</span>`;
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
    coin(118, 690, 22,  -12, 28, HUES[0]),
    coin(96,  1280, 452, 14, 22, HUES[3]),
    coin(74,  620,  500, 8,  30, HUES[1]),
    coin(64,  1330, 60,  -8, 26, HUES[2]),
    coin(52,  980,  580, 10, 24, HUES[5]),
  ].join(""),
  glows: `<div class="glow" style="left:-80px;top:-60px;width:520px;height:520px;background:#8fd3f2"></div>
    <div class="glow" style="left:1520px;top:-40px;width:520px;height:520px;background:#9fe6c9"></div>
    <div class="glow" style="left:760px;top:420px;width:520px;height:520px;background:#c9d6fa"></div>`,
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
    coin(88, 470, 26,  -12, 28, HUES[0]),
    coin(72, 980, 366, 14,  22, HUES[3]),
    coin(54, 420, 402, 8,   30, HUES[1]),
  ].join(""),
  glows: `<div class="glow" style="left:-100px;top:-80px;width:440px;height:440px;background:#8fd3f2"></div>
    <div class="glow" style="left:1120px;top:-60px;width:440px;height:440px;background:#9fe6c9"></div>
    <div class="glow" style="left:540px;top:320px;width:440px;height:440px;background:#c9d6fa"></div>`,
};

const deck = spec => FEATURED.map((t, i) => {
  const a = spec.at[i];
  return card(t, `left:${a.left}px;top:${a.top}px;z-index:5;transform:rotate(${a.rot}deg)`);
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
