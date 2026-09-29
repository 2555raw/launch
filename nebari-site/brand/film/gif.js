// A 3 second loop of the real home page: the banner with its neon floor and floating logos.
//   node gif.js [out.gif]              (serves ../../ on a local port itself)
//   node gif.js --burst [out.gif]      the logos burst out of frame and fly back in
//   node gif.js --emerge [out.gif]     the logos come out of the centre to their places, then fly on out of frame
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
  const argv = process.argv.slice(2);
  const MODE = argv[0] === '--burst' ? 'burst' : argv[0] === '--emerge' ? 'emerge' : 'plain';
  if (MODE !== 'plain') argv.shift();
  const BURST = MODE !== 'plain';
  const out = path.resolve(argv[0] || path.join(__dirname, { burst: 'nebari-burst.gif', emerge: 'nebari-emerge.gif', plain: 'nebari.gif' }[MODE]));
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
    // burst: each logo flies straight away from the centre of the frame, off screen, then comes back.
    // 'translate' and 'scale' compose with the float animation's transform, so both run together.
    const cl = (x) => Math.min(1, Math.max(0, x));
    const ein = (x) => x * x * x;                                                      // speeds up on the way out
    const eback = (x) => { const c = 1.25; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }; // lands with a bounce
    const items = [...document.querySelectorAll('.banner-asset')].map((el) => {
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - innerWidth / 2, dy = r.top + r.height / 2 - innerHeight * 0.45;
      const len = Math.hypot(dx, dy) || 1;
      return { el, dx, dy, ux: dx / len, uy: dy / len, far: innerWidth * 0.95, spin: (dx > 0 ? 1 : -1) * (25 + Math.random() * 30) };
    });
    // emerge: every logo starts hidden behind the title at the centre, shoots out to its place,
    // holds there floating, then keeps going outward off the frame. Start and end are both empty.
    window.__emerge = (t) => items.forEach((it, i) => {
      const d = i * 0.04;
      const inn = eback(cl((t - 0.05 - d) / 0.8));           // centre -> place, with a small overshoot
      const out = ein(cl((t - 2.05 - d) / 0.55));            // place -> off frame
      const fromC = 1 - inn;                                  // 1 at the centre, 0 at its place
      const x = -it.dx * fromC + it.ux * it.far * out, y = -it.dy * fromC + it.uy * it.far * out;
      it.el.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
      it.el.style.scale = String(Math.max(0.05, 0.15 + 0.85 * Math.min(1, inn)) * (1 + 0.3 * Math.sin(Math.PI * Math.min(1, out * 1.2))));
      it.el.style.opacity = String(Math.min(1, cl((t - 0.05 - d) / 0.12)) * (out >= 1 ? 0 : 1));
      it.el.style.rotate = ((fromC * -it.spin) + it.spin * out).toFixed(1) + 'deg';
      const k = fromC + out, blur = Math.min(10, Math.abs(k - (it._e ?? k)) * 70); it._e = k;
      it.el.style.filter = blur > 0.3 ? 'blur(' + blur.toFixed(1) + 'px)' : '';
    });
    window.__burst = (t) => items.forEach((it, i) => {
      const d = i * 0.035;
      const out = ein(cl((t - 0.55 - d) / 0.55));            // 0.55 s to fly out
      const back = eback(cl((t - 1.55 - d) / 0.75));         // gone for a beat, then 0.75 s back in
      const k = out * (1 - back);                             // 0 in place, 1 fully off screen
      const x = it.ux * it.far * k, y = it.uy * it.far * k;
      it.el.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
      it.el.style.scale = String(1 + 0.35 * Math.sin(Math.PI * Math.min(1, k * 1.2)));
      it.el.style.rotate = (it.spin * k).toFixed(1) + 'deg';
      const blur = Math.min(10, Math.abs(k - (it._k ?? k)) * 90); it._k = k;
      it.el.style.filter = blur > 0.3 ? 'blur(' + blur.toFixed(1) + 'px)' : '';
    });
    return document.fonts.ready.then(() => true);
  })()`, awaitPromise: true });
  await sleep(400);
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nebari-gif-'));
  for (let i = 0; i < FPS * DUR; i++) {
    const ms = (i / FPS) * 1000;
    await send('Runtime.evaluate', { expression: `document.getAnimations().forEach(a => { a.pause(); a.currentTime = ${ms}; }); ${BURST ? `window.__${MODE}(${ms / 1000});` : ''} true` });
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
