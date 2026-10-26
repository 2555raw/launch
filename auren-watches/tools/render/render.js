/* Renders the AUREN product photography with Playwright and three.js.
 *
 *   node render/render.js                     everything the store uses
 *   node render/render.js auren-one           one model
 *   node render/render.js auren-one obsidiana piel-negra front --out /tmp/x
 *
 * Writes WebP files to public/img/watches (gallery size and card size) and the
 * hero and editorial images to public/img. Needs Chromium for Playwright. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { MODELS, STRAPS } = require('./models');

const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? args.splice(outIdx, 2)[1] : path.join(ROOT, 'public', 'img');
const [onlyModel, onlyColour, onlyStrap, onlyAngle] = args;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  fs.readFile(file, (err, body) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
  });
});

// Every product image the store refers to.
function jobs() {
  const list = [];
  for (const [model, m] of Object.entries(MODELS)) {
    if (onlyModel && onlyModel !== model) continue;
    for (const colour of Object.keys(m.colours)) {
      if (onlyColour && onlyColour !== colour) continue;
      for (const strap of m.straps) {
        if (onlyStrap && onlyStrap !== strap) continue;
        for (const angle of ['front', 'three', 'side', 'detail']) {
          if (onlyAngle && onlyAngle !== angle) continue;
          list.push({
            file: `watches/${model}-${colour}-${strap}-${angle}`,
            spec: { model, colour, strap, angle, width: 1200, height: 1500 },
            card: angle === 'front' || angle === 'three'
          });
        }
      }
    }
  }
  if (!onlyModel || onlyModel === 'scenes') {
    list.push(
      { file: 'hero', spec: { model: 'auren-one', colour: 'obsidiana', strap: 'piel-negra', angle: 'hero', mood: 'dark', frame: 'hero-right', width: 2400, height: 1350 } },
      { file: 'hero-mobile', spec: { model: 'auren-one', colour: 'obsidiana', strap: 'piel-negra', angle: 'hero', mood: 'dark', frame: 'hero-low', width: 1080, height: 1440 } },
      { file: 'editorial', spec: { model: 'auren-classic', colour: 'champan', strap: 'piel-marron', angle: 'macro', mood: 'dark', width: 1600, height: 1200 } },
      { file: 'story', spec: { model: 'auren-eclipse', colour: 'eclipse', strap: 'caucho-negro', angle: 'detail', mood: 'dark', width: 1600, height: 1200 } }
    );
  }
  return list;
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  await page.goto(`http://localhost:${port}/tools/render/scene.html`);
  await page.waitForFunction(() => window.AUREN_READY && window.AUREN_LOGO);
  await page.evaluate(([m, s]) => window.AUREN.init(m, s), [MODELS, STRAPS]);

  for (const job of jobs()) {
    const t = Date.now();
    const data = await page.evaluate((spec) => window.AUREN.shot(spec), job.spec);
    const target = path.join(OUT, job.file + '.webp');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(data.split(',')[1], 'base64'));
    if (job.card) {
      // half size for product cards, downscaled in the browser with a good filter
      const small = await page.evaluate(async ([src, w, h]) => {
        const img = new Image(); img.src = src; await img.decode();
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, w, h);
        return c.toDataURL('image/webp', 0.86);
      }, [data, 600, 750]);
      fs.writeFileSync(path.join(OUT, job.file + '-card.webp'), Buffer.from(small.split(',')[1], 'base64'));
    }
    console.log(`${job.file}.webp  ${Math.round(fs.statSync(target).size / 1024)} KB  ${((Date.now() - t) / 1000).toFixed(1)} s`);
  }
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
