// Renders film.html frame by frame and encodes the film.
//   node build.js [out.mp4]            full film, 30 s at 30 fps, with the soundtrack
//   node build.js --stills t1,t2,...   PNG stills at those seconds, for checking
// Needs Chromium (CHROME env or the Playwright path) and ffmpeg (FFMPEG env, or
// `pip install imageio-ffmpeg`), plus numpy for the soundtrack (payence/video/music.py).
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const HERE = __dirname;
const FPS = 30, DUR = 30, W = 1920, H = 1080;
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FF = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open() {
  const port = 9600 + Math.floor(Math.random() * 300);
  const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', `--remote-debugging-port=${port}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let tab; for (let i = 0; i < 50 && !tab; i++) { await sleep(300); try { tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json(); } catch (_) {} }
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => ws.onopen = r);
  let id = 0; const pending = {}; ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) pending[d.id](d); };
  const send = (method, params) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file://' + path.join(HERE, 'film.html') });
  await sleep(1500);
  await send('Runtime.evaluate', { expression: 'window.ready', awaitPromise: true });
  const frame = async (t, format = 'jpeg') => {
    await send('Runtime.evaluate', { expression: `render(${t})` });
    const r = await send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 92 : undefined, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    return Buffer.from(r.result.data, 'base64');
  };
  return { frame, close: () => { ws.close(); chrome.kill(); } };
}

(async () => {
  const args = process.argv.slice(2);
  const b = await open();
  if (args[0] === '--stills') {
    const dir = path.join(HERE, 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const t of args[1].split(',').map(Number)) { fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.png`), await b.frame(t, 'png')); console.log('still', t); }
    b.close(); return;
  }
  const out = path.resolve(args[0] || path.join(HERE, 'nebari.mp4'));
  const wav = path.join(HERE, 'music.wav');
  execFileSync('python3', [path.join(HERE, '..', '..', '..', 'payence', 'video', 'music.py'), wav, String(DUR)], { stdio: 'inherit' });
  const ff = spawn(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', wav,
    '-filter:a', `afade=t=in:d=0.4,afade=t=out:st=${DUR - 1.6}:d=1.6`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = FPS * DUR;
  for (let i = 0; i < total; i++) {
    const buf = await b.frame(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 90 === 0) console.log(`frame ${i}/${total}`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  b.close(); fs.rmSync(wav, { force: true });
  console.log('wrote', out);
})().catch((e) => { console.error(e); process.exit(1); });
