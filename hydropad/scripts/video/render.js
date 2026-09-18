/* Render the film frame by frame, then let ffmpeg put them together.
 *
 *   CHROMIUM_PATH=… node scripts/video/render.js
 *
 * The page animates nothing on its own: setT(t) places everything for that
 * instant, so a frame is a screenshot of a known state rather than of whatever
 * the browser happened to have painted. Slow machine, fast machine, same film.
 */
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");

const HERE = __dirname;
const FRAMES = path.join(HERE, "frames");
const FPS = 30;
const FF = process.env.FFMPEG;

(async () => {
  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });

  const b = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 });
  await p.goto("file://" + path.join(HERE, "scene.html"), { waitUntil: "networkidle" });

  const duration = await p.evaluate(() => window.DURATION);
  const total = Math.round(duration * FPS);
  process.stdout.write(`${total} frames at ${FPS}fps (${duration}s)\n`);

  for (let i = 0; i < total; i++) {
    await p.evaluate(t => window.setT(t), i / FPS);
    await p.screenshot({ path: path.join(FRAMES, String(i).padStart(5, "0") + ".png") });
    if (i % 60 === 0) process.stdout.write(`  ${i}/${total}  ${(i / FPS).toFixed(1)}s\n`);
  }
  await b.close();
  console.log("frames done");
})();
