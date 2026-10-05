/* Renders scripts/media/launch-video.html to video, frame by frame: for each
   frame it calls window.seek(t) and screenshots, so timing is exact and the
   motion is smooth at 30 fps whatever the machine's speed.

     media/unyhooks-launch.mp4           1920×1080, the full launch (~31 s)
     media/unyhooks-launch-vertical.mp4  1080×1920, the same for Reels, TikTok and Shorts
     media/unyhooks-checks.mp4           1080×1080, the public page (~16 s)
     media/unyhooks-launch.gif           720 px, 12 fps, the first 8 seconds of the full launch

     (cd unyhooks-site && python3 -m http.server 8765)   # the site
     node scripts/media/record-launch.js                 # needs playwright + ffmpeg
     STILLS=1 node scripts/media/record-launch.js        # a few frames as PNG, to check layouts */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const SITE = process.env.SITE || 'http://localhost:8765/';
const OUT = process.env.OUT || path.join(__dirname, '..', '..', 'media');
const FPS = 30;
const JOBS = [
  { name: 'unyhooks-launch', format: 'wide', cut: 'launch', w: 1280, h: 720 },
  { name: 'unyhooks-launch-vertical', format: 'tall', cut: 'launch', w: 720, h: 1280 },
  { name: 'unyhooks-checks', format: 'square', cut: 'checks', w: 720, h: 720 }
].filter((j) => !process.env.ONLY || process.env.ONLY.split(',').includes(j.name));

(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync(OUT, { recursive: true });
  for (const job of JOBS) {
    const ctx = await browser.newContext({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: 1.5 });
    const page = await ctx.newPage();
    await page.goto(`${SITE}scripts/media/launch-video.html?format=${job.format}&cut=${job.cut}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const duration = await page.evaluate(() => window.DURATION);

    if (process.env.STILLS) {
      const times = (process.env.STILLS === '1' ? [1.5, 3.8, 6, 10, 13.5, 15.5, 17, 22, 28] : process.env.STILLS.split(',').map(Number)).filter((t) => t < duration);
      for (const t of times) {
        await page.evaluate((x) => window.seek(x), t);
        await page.screenshot({ path: path.join(OUT, `${job.name}-${t}s.png`) });
      }
      console.log(`${job.name}: ${times.length} stills`);
      await ctx.close();
      continue;
    }

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uh-launch-'));
    const frames = Math.round(duration * FPS);
    for (let i = 0; i < frames; i++) {
      await page.evaluate((x) => window.seek(x), i / FPS);
      await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
    }
    await ctx.close();
    const mp4 = path.join(OUT, `${job.name}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%05d.jpg'),
      '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-movflags', '+faststart', mp4]);
    if (job.name === 'unyhooks-launch') {
      const gif = path.join(OUT, 'unyhooks-launch.gif');
      const palette = path.join(tmp, 'palette.png');
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-t', '8', '-i', mp4, '-vf', 'fps=12,scale=720:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=128', palette]);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-t', '8', '-i', mp4, '-i', palette, '-lavfi', 'fps=12,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', gif]);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`${job.name}: ${frames} frames, ${duration.toFixed(1)} s -> ${mp4} (${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB)`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
