// Serves the scene locally, renders it in headless Chromium (WebGL), saves a 1600x1000 PNG.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, out = process.argv[2] || path.join(ROOT, 'raw.png');
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8766, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 2560, height: 1600 }, deviceScaleFactor: 1 });
  const logs = []; p.on('console', m => logs.push(m.text())); p.on('pageerror', e => logs.push('ERR ' + e.message));
  await p.goto('http://localhost:8766/scene2.html');
  await p.waitForFunction(() => window.__done === true, null, { timeout: 240000 });
  await p.waitForTimeout(300);
  await p.screenshot({ path: out });
  console.log('saved', out, logs.slice(0, 5));
  await b.close(); srv.close();
});
