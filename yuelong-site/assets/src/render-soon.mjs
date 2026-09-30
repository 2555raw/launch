// Renders soon.html to a seamless 3-second loop: yuelong-soon.gif (800x450) and .mp4 (1280x720).
// Needs ffmpeg (FFMPEG env var or on PATH). Run: node assets/src/render-soon.mjs [outDir]
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(HERE, '..', 'brand');
const FF = process.env.FFMPEG || 'ffmpeg';
const FPS = 30, SECONDS = 3;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'soon-'));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1 })).newPage();
await p.goto('file://' + path.join(HERE, 'soon.html'));
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);
for (let i = 0; i < FPS * SECONDS; i++) {
  await p.evaluate((t) => window.draw(t), i / FPS);
  await p.screenshot({ path: path.join(tmp, `f${String(i).padStart(3, '0')}.png`) });
}
await b.close();
fs.mkdirSync(out, { recursive: true });
const frames = path.join(tmp, 'f%03d.png');
execFileSync(FF, ['-v', 'error', '-y', '-framerate', String(FPS), '-i', frames, '-vf',
  'scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a', '-loop', '0',
  path.join(out, 'yuelong-soon.gif')]);
execFileSync(FF, ['-v', 'error', '-y', '-framerate', String(FPS), '-i', frames, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
  path.join(out, 'yuelong-soon.mp4')]);
fs.rmSync(tmp, { recursive: true, force: true });
for (const f of ['yuelong-soon.gif', 'yuelong-soon.mp4']) console.log(path.join(out, f), fs.statSync(path.join(out, f)).size, 'bytes');
