/* Records the landing-page demo as a video for social posts.

   Opens scripts/media/demo-video.html (the demo window in a 16:9 frame),
   captures every painted frame through Chrome's screencast at 1920×1080, and
   lets ffmpeg turn them into:
     media/unyhooks-demo.mp4   H.264, 30 fps, all three scenes (~36 s)
     media/unyhooks-demo.gif   first scene only, 960 px, 15 fps

     (cd unyhooks-site && python3 -m http.server 8765)   # the site
     node scripts/media/record-demo.js                   # needs playwright + ffmpeg */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const SITE = process.env.SITE || 'http://localhost:8765/';
const OUT = path.join(__dirname, '..', '..', 'media');
const SECONDS = Number(process.env.SECONDS || 36);
const GIF_SECONDS = Number(process.env.GIF_SECONDS || 12);

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uh-demo-'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto(SITE + 'scripts/media/demo-video.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // demo.js shows the finished first scene, then resets and starts typing: begin after the reset.
  await page.waitForFunction(() => document.getElementById('dm-typed').textContent.length > 0 && document.getElementById('dm-typed').textContent.length < 6);

  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = path.join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await page.waitForTimeout(SECONDS * 1000);
  await cdp.send('Page.stopScreencast');
  await browser.close();

  // Frames arrive only when something repaints, so each one is held until the next.
  const lines = [];
  frames.forEach((f, i) => {
    const next = frames[i + 1] ? frames[i + 1].t : f.t + 1 / 30;
    lines.push(`file '${f.file}'`, `duration ${Math.max(next - f.t, 1 / 60).toFixed(4)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file}'`);
  const list = path.join(tmp, 'frames.txt');
  fs.writeFileSync(list, lines.join('\n'));

  fs.mkdirSync(OUT, { recursive: true });
  const mp4 = path.join(OUT, 'unyhooks-demo.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-movflags', '+faststart', '-t', String(SECONDS), mp4]);

  const gif = path.join(OUT, 'unyhooks-demo.gif');
  const palette = path.join(tmp, 'palette.png');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-t', String(GIF_SECONDS), '-i', mp4,
    '-vf', 'fps=15,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff', palette]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-t', String(GIF_SECONDS), '-i', mp4, '-i', palette,
    '-lavfi', 'fps=15,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', gif]);

  fs.rmSync(tmp, { recursive: true, force: true });
  const mb = (f) => `${(fs.statSync(f).size / 1048576).toFixed(1)} MB`;
  console.log(`${frames.length} frames -> ${mp4} (${mb(mp4)}), ${gif} (${mb(gif)})`);
})().catch((e) => { console.error(e); process.exit(1); });
