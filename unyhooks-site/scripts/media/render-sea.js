/* Renders the landing's opening shot into a seamless looping video, the
   fallback for devices too slow for the live 3D (see index.html).

     (cd unyhooks-site && python3 -m http.server 8765)
     node scripts/media/render-sea.js portrait     -> media/sea-portrait.mp4 + .webm  (540×960)
     node scripts/media/render-sea.js landscape    -> media/sea-landscape.mp4 + .webm (1280×720)

   Each frame is drawn at a fixed time step (index.html?render=1, see
   storyScene in src/scene3d.js), so the video is the scene itself, not a
   screen recording. The last second cross-fades into the first, so the loop
   has no seam. Needs ffmpeg on the PATH. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const SITE = process.env.SITE || 'http://localhost:8765/';
const FPS = 30, LOOP = 8, FADE = 1;
const SIZES = { portrait: [540, 960], landscape: [1280, 720] };

(async () => {
  const kind = process.argv[2] || 'portrait';
  const [w, h] = SIZES[kind];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uh-sea-'));
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(`${SITE}index.html?3d=force&render=1&hq=1`, { waitUntil: 'load' });
  await page.addStyleTag({ content: '.uh-head,.uh-rail,.uh-stage-shade,main,.uh-foot,.uh-label3d{visibility:hidden!important}' });
  await page.waitForFunction(() => window.__uhReady, null, { timeout: 120000 });
  await page.evaluate(() => window.__uhReady);
  const total = (LOOP + FADE) * FPS;
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.__uhFrame(t), 3 + i / FPS);
    await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.png`) });
    if (i % 30 === 0) process.stdout.write(`${i}/${total} `);
  }
  await browser.close();

  // out(t) = clip(t) for t ≥ FADE; over the first FADE seconds the clip's tail
  // (LOOP..LOOP+FADE) fades into its head, so the end runs straight into the start.
  const out = path.join(__dirname, '..', '..', 'media', `sea-${kind}.mp4`);
  const L = LOOP * FPS, F = FADE * FPS;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'),
    '-filter_complex',
    `[0]split=3[a][b][c];[a]trim=start_frame=${L}:end_frame=${L + F},setpts=PTS-STARTPTS[tail];[b]trim=end_frame=${F},setpts=PTS-STARTPTS[head];` +
    `[tail][head]xfade=transition=fade:duration=${FADE}:offset=0[blend];[c]trim=start_frame=${F}:end_frame=${L},setpts=PTS-STARTPTS[mid];[blend][mid]concat=n=2:v=1[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', kind === 'portrait' ? '27' : '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
  fs.rmSync(dir, { recursive: true, force: true });
  // VP9 for browsers without H.264
  const webm = out.replace(/\.mp4$/, '.webm');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-an', webm]);
  console.log(`\nwrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(2)} MB) and ${path.basename(webm)} (${(fs.statSync(webm).size / 1e6).toFixed(2)} MB)`);
})().catch((e) => { console.error(e); process.exit(1); });
