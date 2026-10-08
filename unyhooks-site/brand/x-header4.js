// Builds x-header4.png: the night scene (the hook, the ship, the moon) as a halftone dot field.
// node brand/x-header4.js   (needs Playwright; reads x-header3-bg.png)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const D = __dirname;
const bg = 'data:image/png;base64,' + fs.readFileSync(path.join(D, 'x-header3-bg.png')).toString('base64');
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@600&display=swap" rel="stylesheet">
<style>*{margin:0}body{width:1500px;height:500px;overflow:hidden;background:#070B14;position:relative}
canvas{position:absolute;inset:0;width:1500px;height:500px}
.wm{position:absolute;right:58px;bottom:46px;display:flex;align-items:center;gap:14px;font:600 44px 'Geist',sans-serif;letter-spacing:-.03em;color:#fff}
.wm svg{width:46px;height:46px}.wm em{font-style:normal;color:#E8B04B}</style></head><body>
<canvas id="c" width="3000" height="1000"></canvas>
<div class="wm"><span>Uny<em>Hooks</em></span></div>
<script>
const W = 3000, H = 1000, STEP = 9;
const img = new Image();
img.onload = () => {
  // the light field: the scene, zoomed in on the hook and the ship
  const f = document.createElement('canvas'); f.width = W; f.height = H;
  const g = f.getContext('2d');
  g.filter = 'blur(1px)'; g.drawImage(img, 714, 60, 2143, 714, 0, 0, W, H);
  // the same, very soft: subtracting it brings out the shapes (the hook's edges, the ship) over the moon's halo
  const bc = document.createElement('canvas'); bc.width = W; bc.height = H; const bg2 = bc.getContext('2d');
  bg2.filter = 'blur(36px)'; bg2.drawImage(img, 714, 60, 2143, 714, 0, 0, W, H); g.filter = 'none';
  // a few soft patches of light, like moonlight through cloud
  for (const [x, y, r, a] of [[300, 520, 620, 0.16], [900, 120, 460, 0.12], [2750, 260, 480, 0.14]]) {
    const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(120,150,210,' + a + ')'); q.addColorStop(1, 'rgba(120,150,210,0)');
    g.fillStyle = q; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const px = g.getImageData(0, 0, W, H).data, pb = bg2.getImageData(0, 0, W, H).data;
  const lum = (p, i) => (0.3 * p[i] + 0.55 * p[i + 1] + 0.15 * p[i + 2]) / 255;
  const L = (x, y) => { const i = (Math.min(H - 1, y) * W + Math.min(W - 1, x)) * 4; const f = lum(px, i), b = lum(pb, i); return Math.max(0, 0.5 * f + 0.12 * b + 2.2 * (f - b)); };
  // colour ramp, the site's palette: night navy -> navy -> steel -> bronze -> gold (#E8B04B) -> cream (#F3EAD7)
  const R = [[0, [10, 17, 32]], [0.3, [24, 36, 64]], [0.52, [52, 72, 112]], [0.7, [150, 118, 62]], [0.84, [232, 176, 75]], [1, [243, 234, 215]]];
  const ramp = (t) => { t = Math.max(0, Math.min(1, t)); for (let k = 1; k < R.length; k++) if (t <= R[k][0]) { const [a, ca] = R[k - 1], [b, cb] = R[k]; const u = (t - a) / (b - a); return ca.map((c, j) => Math.round(c + (cb[j] - c) * u)); } return R[R.length - 1][1]; };
  const c = document.getElementById('c').getContext('2d');
  // soft glow underneath
  const lo = document.createElement('canvas'); lo.width = 300; lo.height = 100; const lg = lo.getContext('2d');
  lg.filter = 'blur(4px)'; lg.drawImage(f, 0, 0, 300, 100);
  const ld = lg.getImageData(0, 0, 300, 100);
  for (let i = 0; i < ld.data.length; i += 4) { const l = (0.3 * ld.data[i] + 0.55 * ld.data[i + 1] + 0.15 * ld.data[i + 2]) / 255; const [r, gg, b] = ramp(Math.pow(l, 0.75) * 1.4); ld.data[i] = r * 0.22; ld.data[i + 1] = gg * 0.22; ld.data[i + 2] = b * 0.22; }
  lg.putImageData(ld, 0, 0);
  c.imageSmoothingQuality = 'high'; c.drawImage(lo, 0, 0, W, H);
  // the dots: small crosses on a grid, bigger and brighter where there is light
  for (let y = STEP / 2; y < H; y += STEP) for (let x = STEP / 2; x < W; x += STEP) {
    const l = Math.min(1.05, 0.1 + Math.pow(L(x | 0, y | 0), 0.7) * 1.45);
    const [r, gg, b] = ramp(l);
    const a = 0.5 + 0.5 * Math.min(1, l);
    const d = 1.4 + Math.min(1, l) * 6.4;
    c.fillStyle = 'rgba(' + r + ',' + gg + ',' + b + ',' + a + ')';
    const w = 1.2 + Math.min(1, l) * 1.3; c.fillRect(x - d / 2, y - w / 2, d, w); c.fillRect(x - w / 2, y - d / 2, w, d);
    if (l > 0.35) { const q = d * 0.42; c.fillRect(x - q / 2, y - q / 2, q, q); }
  }
  // gentle vignette
  const v = c.createRadialGradient(W * 0.6, H * 0.45, H * 0.3, W * 0.5, H * 0.5, W * 0.62);
  v.addColorStop(0, 'rgba(7,11,20,0)'); v.addColorStop(1, 'rgba(7,11,20,.6)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  document.body.dataset.done = 1;
};
img.src = ${JSON.stringify(bg)};
</script></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 500 }, deviceScaleFactor: 2 });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.waitForSelector('body[data-done]', { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(D, 'x-header4.png') });
  await b.close();
})();
