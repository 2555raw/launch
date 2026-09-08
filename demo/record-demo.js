/* Records a 25-second guided tour of the Blendify landing page.
 *
 * Drives a real Chromium over the site with a drawn-on cursor, clicking through
 * the interactive parts, and finishes on the X link in the nav. Output is
 * demo/blendify-demo.mp4.
 *
 *   cd demo && npm install && npm run demo
 */
const { chromium } = require('playwright');
const ffmpegPath = require('ffmpeg-static');
const { execFile } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const SITE = path.join(__dirname, '..', 'blendify-site');
const RAW_DIR = path.join(__dirname, 'video');
const FONT_DIR = path.join(__dirname, 'fonts');
const OUT = path.join(__dirname, 'blendify-demo.mp4');
const PORT = Number(process.env.PORT || 8123);
const W = 1440, H = 900;
const TARGET = 25;            // final running time, in seconds
const TAIL_HOLD = 0.5;        // frames kept after the closing click

/* ---------- the drawn cursor, injected into every page ---------- */

const overlayInit = () => {
  const paint = () => {
    if (document.getElementById('__demoCursor')) return;
    const style = document.createElement('style');
    style.textContent = `
      #__demoCursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;
        pointer-events:none;will-change:transform;transform:translate(-100px,-100px);
        transition:transform .085s linear;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))}
      #__demoRipple{position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;
        border-radius:50%;z-index:2147483646;pointer-events:none;opacity:0;
        transition:left .085s linear,top .085s linear;
        background:rgba(123,21,35,.35);border:2px solid #7B1523}
      @keyframes __demoPing{0%{opacity:.9;transform:scale(.4)}100%{opacity:0;transform:scale(4.2)}}
      #__demoRipple.is-on{animation:__demoPing .55s cubic-bezier(.2,.7,.3,1)}
      #__demoCard{position:fixed;right:26px;top:64px;transform:translateY(-10px);
        z-index:2147483647;pointer-events:none;opacity:0;
        transition:opacity .3s ease,transform .3s cubic-bezier(.2,.9,.3,1);
        background:#0D0D0D;color:#fff;border-radius:12px;padding:13px 20px;display:flex;gap:11px;
        align-items:center;font:600 15px/1.2 'Instrument Sans',system-ui,sans-serif;
        box-shadow:0 20px 44px -18px rgba(0,0,0,.6)}
      #__demoCard.is-on{opacity:1;transform:translateY(0)}
    `;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = '__demoCursor';
    cursor.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26">
      <path d="M5 2.5 L5 20.2 L9.4 16.1 L12.2 22 L15.4 20.5 L12.6 14.8 L18.6 14.6 Z"
            fill="#0D0D0D" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(cursor);

    const ripple = document.createElement('div');
    ripple.id = '__demoRipple';
    document.body.appendChild(ripple);

    const card = document.createElement('div');
    card.id = '__demoCard';
    document.body.appendChild(card);

    addEventListener('mousemove', (e) => {
      cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      ripple.style.left = e.clientX + 'px';
      ripple.style.top = e.clientY + 'px';
    }, true);

    addEventListener('mousedown', () => {
      ripple.classList.remove('is-on');
      void ripple.offsetWidth;
      ripple.classList.add('is-on');
      cursor.animate([{ scale: 1 }, { scale: .78 }, { scale: 1 }], { duration: 260, easing: 'ease-out' });
    }, true);

    window.__demoCard = (html) => { card.innerHTML = html; card.classList.add('is-on'); };
  };
  if (document.body) paint();
  else addEventListener('DOMContentLoaded', paint);
};

/* ---------- helpers ---------- */

const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(SITE, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(SITE) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(PORT, '127.0.0.1', () => ok(server)));
}

const ffmpeg = (args) => new Promise((ok, fail) =>
  execFile(ffmpegPath, args, { maxBuffer: 64 << 20 }, (err, stdout, stderr) =>
    err && !stderr ? fail(err) : ok(stderr || '')));

// Playwright writes one screencast frame per paint, so a heavy page yields a
// video that runs slower than the wall clock. Both cut points therefore come
// out of the file itself rather than out of timings taken while driving it.
async function cutPoints(file) {
  const scenes = await ffmpeg(['-hide_banner', '-i', file, '-vf', "select='gt(scene,0.03)',showinfo", '-an', '-f', 'null', '-']);
  const first = scenes.match(/pts_time:([0-9.]+)/);
  const freezes = await ffmpeg(['-hide_banner', '-i', file, '-vf', 'freezedetect=n=-50dB:d=0.5', '-map', '0:v', '-f', 'null', '-']);
  const starts = [...freezes.matchAll(/freeze_start: ([0-9.]+)/g)].map((m) => Number(m[1]));
  const duration = Number((await ffmpeg(['-hide_banner', '-i', file, '-f', 'null', '-']))
    .match(/Duration: (\d+):(\d+):([\d.]+)/).slice(1).reduce((a, v, i) => a + Number(v) * [3600, 60, 1][i], 0));
  // the click on the X opens a new tab, which backgrounds this page and stops
  // the capture: the last freeze runs to the end of the file and marks the click
  const tail = starts.length ? starts[starts.length - 1] : duration;
  return { from: first ? Number(first[1]) : 0, to: Math.min(duration, tail + TAIL_HOLD) };
}

/* ---------- the tour ---------- */

(async () => {
  const server = await serve();
  fs.rmSync(RAW_DIR, { recursive: true, force: true });

  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: { dir: RAW_DIR, size: { width: W, height: H } }
  });
  await context.addInitScript(overlayInit);
  const page = await context.newPage();

  // serve the webfonts off disk when they have been cached, so the recording
  // does not open on ten seconds of unstyled text (see fonts/fetch.sh)
  if (fs.existsSync(path.join(FONT_DIR, 'map.txt'))) {
    const map = Object.fromEntries(fs.readFileSync(path.join(FONT_DIR, 'map.txt'), 'utf8')
      .trim().split('\n').map((line) => line.split(' ')));
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(FONT_DIR, 'fonts.css')) }));
    await page.route('https://fonts.gstatic.com/**', (route) => {
      const file = map[route.request().url()];
      return file ? route.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(path.join(__dirname, file)) })
                  : route.abort();
    });
  }

  let cx = W / 2, cy = H - 60;

  const move = async (x, y, ms = 700) => {
    const sx = cx, sy = cy, t0 = Date.now();
    for (;;) {
      const raw = (Date.now() - t0) / ms;
      if (raw >= 1) break;
      const t = ease(raw);
      await page.mouse.move(sx + (x - sx) * t, sy + (y - sy) * t);
    }
    await page.mouse.move(x, y);
    cx = x; cy = y;
  };

  const box = async (locator) => {
    let b = await locator.boundingBox();
    if (!b) throw new Error('nothing to point at');
    if (b.y < 8 || b.y + b.height > H - 8) {
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      b = await locator.boundingBox();
    }
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  const hover = async (locator, ms = 700, dwell = 320) => {
    const p = await box(locator);
    await move(p.x, p.y, ms);
    await page.waitForTimeout(dwell);
  };

  const click = async (locator, ms = 700, dwell = 320, after = 620) => {
    await hover(locator, ms, dwell);
    await page.mouse.down();
    await page.waitForTimeout(90);
    await page.mouse.up();
    await page.waitForTimeout(after);
  };

  // the page's own nav is not pinned while scrolled, so long hops are driven as
  // a scroll of our own rather than by clicking a link that is off-screen
  const scrollTo = (selector, ms) => page.evaluate(({ sel, ms }) => new Promise((done) => {
    const node = document.querySelector(sel);
    const from = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const to = Math.max(0, Math.min(node.getBoundingClientRect().top + from - 90, max));
    const t0 = performance.now();
    const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    (function step(now) {
      const raw = Math.min(1, (now - t0) / ms);
      window.scrollTo(0, from + (to - from) * ease(raw));
      raw < 1 ? requestAnimationFrame(step) : done();
    })(t0);
  }), { sel: selector, ms });

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(600);

  // 1. hero — the trade-sizing pills in the panel
  await move(430, 300, 700);
  await page.waitForTimeout(250);
  await click(page.locator('#sizePills .bl-pill').nth(2), 600, 200, 450);   // 10 ETH
  await click(page.locator('#sizePills .bl-pill').nth(0), 400, 180, 450);   // 0.5 ETH

  // 2. hero CTA — scrolls to the index builder
  await click(page.locator('.bl-hero .bl-cta-row .bl-btn-primary'), 600, 260, 1100);

  // 3. index builder — add two assets, drop one
  await click(page.locator('#assetChips .bl-chip').nth(3), 500, 200, 400);  // AAPL
  await click(page.locator('#assetChips .bl-chip').nth(4), 350, 170, 400);  // TSLA
  await click(page.locator('#assetChips .bl-chip').nth(0), 350, 170, 800);  // BTC off

  // 4. down to the calculators
  await scrollTo('#calc', 1700);
  await page.waitForTimeout(500);

  // 5. calculators — gas assumption and leverage
  await click(page.locator('#gasPills .bl-pill').nth(0), 550, 200, 420);    // 3 assets
  await click(page.locator('#gasPills .bl-pill').nth(2), 330, 170, 600);    // 5 assets
  await click(page.locator('#levPills .bl-pill').nth(2), 500, 200, 800);    // 5x

  // 6. back to the top and out to X
  await scrollTo('#top', 1500);
  await page.waitForTimeout(700);
  await hover(page.locator('.bl-x-link'), 800, 450);

  // the card goes up before the click: the new tab takes focus and the capture
  // of this page stops the moment it opens
  const dest = await page.locator('.bl-x-link').getAttribute('href');
  await page.evaluate((url) => window.__demoCard(
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M18.9 2H22l-7 8 8.2 12h-6.4l-5-7.3L5.9 22H2.8l7.5-8.6L2.5 2h6.6l4.5 6.7L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z"/></svg>`
    + `<span>${url}</span>`), dest);
  await page.waitForTimeout(1500);

  const popupWait = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
  await page.waitForTimeout(800);
  const popup = await popupWait;
  console.log(popup ? `X link opened a new tab at ${dest}` : `X link did not open a tab (expected ${dest})`);

  await context.close();
  await browser.close();
  server.close();

  /* ---------- trim and encode ---------- */

  const raw = fs.readdirSync(RAW_DIR).map((f) => path.join(RAW_DIR, f))
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  const { from, to } = await cutPoints(raw);
  const pts = (TARGET / (to - from)).toFixed(4);
  console.log(`keeping ${from.toFixed(2)}s–${to.toFixed(2)}s of the capture, retimed by ${pts}x`);

  await ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', raw,
    '-vf', `trim=${from}:${to},setpts=(PTS-STARTPTS)*${pts}`, '-an', '-r', '30',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-preset', 'slow', '-movflags', '+faststart', OUT]);
  console.log('wrote', path.relative(process.cwd(), OUT));
})();
