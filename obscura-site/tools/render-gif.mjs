// Renders tools/gif.html into assets/social/heldat.gif and heldat.mp4 (4 s loop).
//
//   python3 -m http.server 8766    (from obscura-site/)
//   BASE=http://localhost:8766/ node tools/render-gif.mjs [--stills 0.2,0.5,1.5]
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
const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
await page.goto(`${base}tools/gif.html`);
await page.waitForFunction(() => window.READY === true);
const duration = await page.evaluate(() => window.DURATION);

if (stills) {
  for (const t of stills) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: join(root, "tools", `still-gif-${t}.png`) });
  }
  await browser.close();
  process.exit(0);
}

const frames = join(root, "tools", ".frames", "gif");
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const total = Math.round(duration * FPS);
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: join(frames, `${String(i).padStart(4, "0")}.png`) });
}
await browser.close();

const out = join(root, "assets", "social");
mkdirSync(out, { recursive: true });
const input = ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(FPS), "-i", join(frames, "%04d.png")];
// MP4 at 1080p for X and Telegram (sharper and smaller than a GIF)
execFileSync("ffmpeg", [...input, "-vf", "scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(out, "heldat.mp4")]);
// GIF: one shared palette, 720 px wide to stay well under X's 15 MB limit
const vf = "fps=25,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=4";
execFileSync("ffmpeg", [...input, "-vf", vf, "-loop", "0", join(out, "heldat.gif")]);
rmSync(frames, { recursive: true, force: true });
for (const f of ["heldat.gif", "heldat.mp4"]) console.log(`assets/social/${f}: ${(statSync(join(out, f)).size / 1e6).toFixed(2)} MB`);
