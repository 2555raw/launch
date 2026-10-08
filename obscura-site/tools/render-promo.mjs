// Renders tools/promo.html into assets/social/heldat-promo.mp4 (1920x1080, 30 fps).
//
//   python3 -m http.server 8766    (from obscura-site/)
//   BASE=http://localhost:8766/ node tools/render-promo.mjs [--stills 1,3.2,8.5]
//
// Needs ffmpeg on PATH. Each frame is drawn by calling render(t) in the page.
import { mkdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");

const FPS = 30;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.BASE || "http://localhost:8766/";
const args = process.argv.slice(2);
const stills = args.includes("--stills") ? args[args.indexOf("--stills") + 1].split(",").map(Number) : null;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${base}tools/promo.html`);
await page.waitForFunction(() => window.READY === true);
const duration = await page.evaluate(() => window.DURATION);

if (stills) {
  for (const t of stills) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: join(root, "tools", `still-promo-${t}.png`) });
  }
  await browser.close();
  process.exit(0);
}

const frames = join(root, "tools", ".frames", "promo");
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const total = Math.round(duration * FPS);
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: join(frames, `${String(i).padStart(4, "0")}.png`) });
}
await browser.close();

const out = join(root, "assets", "social", "heldat-promo.mp4");
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(FPS), "-i", join(frames, "%04d.png"),
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
rmSync(frames, { recursive: true, force: true });
console.log(`assets/social/heldat-promo.mp4: ${(statSync(out).size / 1e6).toFixed(2)} MB, ${duration} s`);
