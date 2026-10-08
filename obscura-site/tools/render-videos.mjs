// Renders tools/scenes.html into assets/video/{scene}.mp4 plus a poster frame.
//
//   npm i -D playwright            (or point PLAYWRIGHT at an existing install)
//   python3 -m http.server 8765    (from obscura-site/)
//   node tools/render-videos.mjs [scene ...] [--stills 3,6,9]
//
// Needs ffmpeg with libx264 on PATH. Each frame is rendered by calling
// render(t) in the page, so the output is identical on every run.
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.BASE || "http://localhost:8765/";
const FPS = 30;

const args = process.argv.slice(2);
const stillsAt = args.includes("--stills") ? args[args.indexOf("--stills") + 1].split(",").map(Number) : null;
const scenes = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--stills");
const list = scenes.length ? scenes : ["cloak", "transfer", "prove"];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

for (const name of list) {
  await page.goto(`${base}tools/scenes.html?scene=${name}`);
  await page.waitForFunction(() => window.READY === true);
  const duration = await page.evaluate(() => window.DURATION);

  if (stillsAt) {
    for (const t of stillsAt) {
      await page.evaluate((t) => window.render(t), t);
      await page.screenshot({ path: join(root, "tools", `still-${name}-${t}.png`) });
    }
    continue;
  }

  const frames = join(root, "tools", ".frames", name);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  const total = Math.round(duration * FPS);
  for (let i = 0; i <= total; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    await page.screenshot({ path: join(frames, `${String(i).padStart(4, "0")}.png`) });
  }

  const out = join(root, "assets", "video");
  mkdirSync(out, { recursive: true });
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(FPS), "-i", join(frames, "%04d.png"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(out, `${name}.mp4`)]);
  // poster: the title card
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", join(frames, `${String(Math.round(1.6 * FPS)).padStart(4, "0")}.png`),
    "-q:v", "3", join(out, `${name}.jpg`)]);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", join(out, `${name}.mp4`),
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38", "-row-mt", "1", "-an", join(out, `${name}.webm`)]);
  rmSync(frames, { recursive: true, force: true });
  console.log(`${name}: ${total + 1} frames -> assets/video/${name}.mp4`);
}

await browser.close();
