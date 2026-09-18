/* Steps the scene frame by frame and writes PNGs. setT places everything,
 * so a frame depends only on its time and the render can be resumed,
 * re-cut or diffed. */
const { chromium } = require("/home/user/launch/hydropad/node_modules/playwright-core");
const fs = require("fs");
const path = require("path");

const FPS = 30;
const OUT = process.argv[3] || "frames";

(async () => {
  const fonts = process.argv[2];
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto("file://" + path.resolve("scene.html"));
  await p.evaluate((f) => { document.querySelector("link").href = f; }, fonts);
  await p.waitForTimeout(2500);          // let every face land before frame 0
  const dur = await p.evaluate(() => window.DUR);
  const total = Math.round(dur * FPS);
  for (let i = 0; i < total; i++) {
    await p.evaluate((t) => window.setT(t), i / FPS);
    await p.screenshot({ path: `${OUT}/f${String(i).padStart(4, "0")}.png` });
    if (i % 60 === 0) process.stdout.write(`${i}/${total} `);
  }
  console.log(`\n${total} frames`, errs.length ? "ERRORS: " + errs[0] : "no page errors");
  await b.close();
})();
