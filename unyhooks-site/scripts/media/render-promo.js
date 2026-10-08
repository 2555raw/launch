// Renders promo.html to a video, frame by frame, and lays a soundtrack under it.
//   node scripts/media/render-promo.js <soundtrack> <out.mp4>
//   node scripts/media/render-promo.js --stills 0.1,2.5,4.5 <outdir>   (single frames, for checking)
// Needs Playwright (Chromium), ffmpeg, and three.js in node_modules (npm i --no-save three@0.186.1).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');

const FPS = 24000 / 1001, DURATION = 20.458;
const ROOT = path.join(__dirname, '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };

(async () => {
  const args = process.argv.slice(2);
  const stills = args[0] === '--stills' ? args[1].split(',').map(Number) : null;
  const out = stills ? args[2] : args[1];
  const audio = stills ? null : args[0];
  // WebGL (the 3D icons and hook) on a software renderer works everywhere
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1080 } });
  // fonts come from Google Fonts; fetch them once with curl (works behind proxies)
  const cache = path.join(os.tmpdir(), 'uh-fontcache'); fs.mkdirSync(cache, { recursive: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => {
    const url = r.request().url(), key = path.join(cache, Buffer.from(url).toString('base64url').slice(-120));
    if (!fs.existsSync(key)) fs.writeFileSync(key, execFileSync('curl', ['-s', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', url], { maxBuffer: 1 << 26 }));
    r.fulfill({ contentType: /googleapis/.test(url) ? 'text/css' : 'font/woff2', body: fs.readFileSync(key), headers: { 'access-control-allow-origin': '*' } });
  });
  // serve the repo over a fake origin so ES modules (three.js) load
  await ctx.route(/^http:\/\/promo\.local\//, (r) => {
    const f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.error('page error:', e.message));
  await p.goto('http://promo.local/scripts/media/promo.html');
  await p.evaluate(() => window.ready);
  const grab = async (t, f) => Buffer.from((await p.evaluate(([t, f]) => { draw(t, f); return document.getElementById('c').toDataURL('image/jpeg', .93); }, [t, f])).split(',')[1], 'base64');
  if (stills) {
    fs.mkdirSync(out, { recursive: true });
    for (const t of stills) fs.writeFileSync(path.join(out, `t${t.toFixed(2)}.jpg`), await grab(t, Math.round(t * FPS)));
    await b.close(); return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uh-promo-'));
  const n = Math.ceil(DURATION * FPS);
  for (let f = 0; f < n; f++) fs.writeFileSync(path.join(dir, `f${String(f).padStart(4, '0')}.jpg`), await grab(f / FPS, f));
  await b.close();
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '24000/1001', '-i', path.join(dir, 'f%04d.jpg'), '-i', audio,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('wrote', out, n, 'frames');
})();
