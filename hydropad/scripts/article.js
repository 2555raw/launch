/* The cover image for a written piece about the site.
 *
 *   CHROMIUM_PATH=… node scripts/article.js
 *
 * Two, at 1600x900, which is the shape a link card and an X article header
 * both want. Typographic rather than photographic on purpose: every photograph
 * in media/ is somebody else's, credit pending, and a marketing image is the
 * last place to be casual about that. The mark and the type are ours.
 *
 *   article-coords.png   the coordinates as the whole image
 *   article-lake.png     the line the piece ends on
 */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "media", "brand");
const mark = "data:image/png;base64,"
  + fs.readFileSync(path.join(OUT, "logo-512.png")).toString("base64");

/* The site's own ground, and the one light in it. */
const GROUND = `
  background:
    radial-gradient(120% 90% at 50% 8%, rgba(63, 211, 224, .13) 0%, rgba(63, 211, 224, 0) 58%),
    radial-gradient(140% 120% at 50% 100%, #08110f 0%, #0b1512 42%, #060f0e 100%);
`;

const SHELL = body => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1600px; height: 900px; }
  body {
    ${GROUND}
    color: #eaf2ee;
    font-family: "Liberation Sans", system-ui, sans-serif;
    display: grid; place-items: center;
    position: relative; overflow: hidden;
  }
  /* A grid so faint it reads as paper texture rather than as a grid. */
  body::before {
    content: ""; position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(180, 214, 202, .028) 1px, transparent 1px),
      linear-gradient(90deg, rgba(180, 214, 202, .028) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(70% 60% at 50% 45%, #000 0%, transparent 78%);
  }
  .in { position: relative; text-align: center; }
  .mark { width: 96px; height: 96px; margin: 0 auto 34px; display: block; }
  .eyebrow {
    font-family: "DejaVu Sans Mono", monospace;
    font-size: 15px; letter-spacing: .38em; text-transform: uppercase;
    color: #6f8c83; margin-bottom: 40px;
  }
  .rule { width: 76px; height: 1px; background: rgba(63, 211, 224, .5); margin: 40px auto; }
  .foot {
    position: absolute; left: 0; right: 0; bottom: 54px;
    font-family: "DejaVu Sans Mono", monospace;
    font-size: 16px; letter-spacing: .22em; color: #5d7a71; text-align: center;
  }
</style></head><body>${body}
  <div class="foot">HYDROPAD.SITE</div>
</body></html>`;

const COORDS = SHELL(`
  <div class="in">
    <img class="mark" src="${mark}">
    <p class="eyebrow">Paired to real water</p>
    <p style="font-family:'DejaVu Sans Mono',monospace;font-size:96px;line-height:1.24;
              letter-spacing:.02em;color:#eafcff;font-weight:700">
      36.0161° N<br>114.7377° W
    </p>
    <div class="rule"></div>
    <p style="font-size:28px;letter-spacing:.01em;color:#a9c0b7">
      Lake Mead <span style="color:#3fd3e0">·</span> Nevada / Arizona, US
    </p>
    <p style="margin-top:18px;font-family:'DejaVu Sans Mono',monospace;font-size:17px;
              letter-spacing:.14em;color:#6f8c83">[hydropad:1:MEAD]</p>
  </div>`);

const LAKE = SHELL(`
  <div class="in">
    <img class="mark" src="${mark}">
    <p class="eyebrow">A launchpad bound to real water</p>
    <p style="font-family:'Liberation Serif',Georgia,serif;font-size:152px;line-height:1;
              letter-spacing:-.015em;color:#f4fbf8">Pick a lake.</p>
    <div class="rule"></div>
    <p style="font-size:26px;color:#a9c0b7;max-width:30ch;margin:0 auto;line-height:1.5">
      Every token names a body of water that exists, written into the contract itself.
    </p>
  </div>`);

(async () => {
  const b = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const [name, html] of [["article-coords", COORDS], ["article-lake", LAKE]]) {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    await p.setContent(html, { waitUntil: "networkidle" });
    const file = path.join(OUT, `${name}.png`);
    await p.screenshot({ path: file });
    console.log(`${name}.png  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
    await p.close();
  }
  await b.close();
})();
