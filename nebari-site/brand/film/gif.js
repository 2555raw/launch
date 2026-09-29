// A 3 second loop of the real home page: the banner with its neon floor and floating logos.
//   node gif.js [out.gif]      (serves ../../ on a local port itself)
// Every CSS animation is paused and set to the frame's time, with the banner's loops
// retimed to 3 s, so the last frame runs straight back into the first.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'); const path = require('path'); const http = require('http');
const SITE = path.resolve(__dirname, '..', '..');
const FPS = 20, DUR = 3, W = 1280, H = 720;
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FF = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };

(async () => {
  const out = path.resolve(process.argv[2] || path.join(__dirname, 'nebari.gif'));
  const server = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
    fs.readFile(path.join(SITE, p), (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); s.end(d); }); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const port = 9700 + Math.floor(Math.random() * 200);
  const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let tab; for (let i = 0; i < 50 && !tab; i++) { await sleep(300); try { tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json(); } catch (_) {} }
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => ws.onopen = r);
  let id = 0; const pending = {}; ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) pending[d.id](d); };
  const send = (method, params) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('nebari:cookies','accepted')}catch(e){}" });
  await send('Page.navigate', { url }); await sleep(3500);
  await send('Runtime.evaluate', { expression: `(() => {
    const st = document.createElement('style');
    st.textContent = '.banner-asset{animation-duration:${DUR}s !important}.banner-grid{animation-duration:${DUR}s !important}.marquee{display:none}.reveal{opacity:1 !important;transform:none !important}';
    document.head.appendChild(st);
    document.querySelectorAll('.cookies').forEach((el) => el.remove());   // the gate is not part of the shot
    document.body.classList.remove('cookies-open');
    return document.fonts.ready.then(() => true);
  })()`, awaitPromise: true });
  await sleep(400);
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nebari-gif-'));
  for (let i = 0; i < FPS * DUR; i++) {
    const ms = (i / FPS) * 1000;
    await send('Runtime.evaluate', { expression: `document.getAnimations().forEach(a => { a.pause(); a.currentTime = ${ms}; }); true` });
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    fs.writeFileSync(path.join(dir, `f${String(i).padStart(3, '0')}.png`), Buffer.from(r.result.data, 'base64'));
  }
  ws.close(); chrome.kill(); server.close();
  const pal = path.join(dir, 'pal.png');
  execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%03d.png'), '-vf', 'scale=960:-1:flags=lanczos,palettegen=max_colors=192:stats_mode=full', pal]);
  execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%03d.png'), '-i', pal,
    '-lavfi', 'scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a', '-loop', '0', out]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
})().catch((e) => { console.error(e); process.exit(1); });
