/* A banner with the cards on it: the lockup on ink to the left, three reserve
 * cards floating over the photograph on the right.
 *
 *   CHROMIUM_PATH=… node scripts/header-cards.js
 *
 * The cards' line and percentage are generated, not measured — see
 * media/brand/README.md before this goes anywhere it reads as market data.
 */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const { card } = require("./cards.js");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "media", "brand");

const variants = [
  { name: "mead", shot: "MEAD", pos: "center 58%", deck: ["POW", "GRN", "TGR"] },
  { name: "glc",  shot: "GLC",  pos: "center 60%", deck: ["MEAD", "ORO", "GRN"] },
  { name: "oro",  shot: "ORO",  pos: "center 40%", deck: ["MEAD", "GRN", "TGR"] },
];

/* Stacked down the right and kept whole. A card running off the edge reads as
 * a crop rather than as depth, and X crops this again on a phone. */
const at = [
  { left: 800,  top: 18,  rot: -3.5 },
  { left: 900,  top: 170, rot: 2.5 },
  { left: 1000, top: 316, rot: -2 },
];

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const logo = "data:image/png;base64,"
    + fs.readFileSync(path.join(ROOT, "media", "brand", "logo-128.png")).toString("base64");
  const tpl = fs.readFileSync(path.join(__dirname, "header-cards.template.html"), "utf8");

  for (const v of variants) {
    const shot = "data:image/jpeg;base64,"
      + fs.readFileSync(path.join(ROOT, "media", "sources", `${v.shot}.jpg`)).toString("base64");
    const deck = v.deck.map((t, i) => {
      const a = at[i];
      return card(t, `left:${a.left}px;top:${a.top}px;z-index:${3 - i};`
        + `transform:rotate(${a.rot}deg)`);
    }).join("");
    const html = tpl.replace("SHOT", shot).replace("LOGO", logo).replace("POS", v.pos).replace("DECK", deck);

    for (const [suffix, scale] of [["@2x", 2], ["", 1]]) {
      const p = await b.newPage({ viewport: { width: 1500, height: 500 }, deviceScaleFactor: scale });
      await p.setContent(html, { waitUntil: "networkidle" });
      await p.waitForTimeout(350);
      await p.screenshot({ path: path.join(OUT, `header-cards-${v.name}${suffix}.png`) });
      await p.close();
    }
    console.log(`header-cards-${v.name}  1500x500 + @2x`);
  }
  await b.close();
})();
