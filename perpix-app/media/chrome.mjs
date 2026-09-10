import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFile } from 'node:fs/promises';
const fontCss = await readFile('./fonts/local.css', 'utf8');

/* The window the recording sits inside.
   One PNG, 1920x1080, opaque everywhere except a hole exactly where the
   recording goes — so overlaying it on top of the scaled video gives rounded
   corners, a title bar and a desktop in a single composite, with no alpha mask
   to keep in sync.

   No Apple logo and no Apple wallpaper: the traffic lights and the rounded
   window are the generic convention, the desktop underneath is drawn here. */
const CONTENT = { x: 160, y: 112, w: 1600, h: 900 };   // where the video lands
const TITLEBAR = 44;
const WIN = { x: CONTENT.x, y: CONTENT.y - TITLEBAR, w: CONTENT.w, h: CONTENT.h + TITLEBAR };

const html = `
<style>
${fontCss}
*{margin:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden}
body{font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}

/* the desktop */
.desk{position:absolute;inset:0;background:
   radial-gradient(1200px 800px at 22% 8%, #2B3E86 0%, transparent 60%),
   radial-gradient(900px 700px at 88% 92%, #7A2B6B 0%, transparent 62%),
   radial-gradient(700px 500px at 62% 30%, #1B6E8C 0%, transparent 55%),
   linear-gradient(160deg,#0A0D1A 0%,#131A33 48%,#0B0F1E 100%)}
.grain{position:absolute;inset:0;opacity:.16;mix-blend-mode:overlay}

/* the menu bar, without the vendor's mark on it */
.menubar{position:absolute;top:0;left:0;right:0;height:28px;background:rgba(12,15,24,.42);
  backdrop-filter:blur(18px);display:flex;align-items:center;gap:22px;padding:0 18px;
  color:rgba(255,255,255,.86);font-size:13px;font-weight:500}
.menubar .app{font-weight:650}
.menubar .right{margin-left:auto;display:flex;align-items:center;gap:16px;color:rgba(255,255,255,.72);font-size:12.5px}
.menubar .right .num{font-variant-numeric:tabular-nums}
.bat{width:24px;height:12px;border:1.4px solid rgba(255,255,255,.6);border-radius:3px;position:relative;display:inline-block}
.bat::after{content:'';position:absolute;left:1.5px;top:1.5px;bottom:1.5px;width:66%;background:rgba(255,255,255,.85);border-radius:1.5px}
.bat::before{content:'';position:absolute;right:-3.5px;top:3.5px;bottom:3.5px;width:2px;background:rgba(255,255,255,.6);border-radius:0 1px 1px 0}

/* the window: everything opaque except the hole */
.win{position:absolute;left:${WIN.x}px;top:${WIN.y}px;width:${WIN.w}px;height:${WIN.h}px;
  border-radius:14px;box-shadow:0 60px 120px -30px rgba(0,0,0,.85),0 0 0 .5px rgba(255,255,255,.14);
  overflow:hidden}
.bar{height:${TITLEBAR}px;background:#E9EAEE;display:flex;align-items:center;padding:0 16px;
  border-bottom:1px solid #D5D7DE;position:relative}
.lights{display:flex;gap:8px}
.lights i{width:12px;height:12px;border-radius:50%;display:block}
.lights i:nth-child(1){background:#FF5F57;box-shadow:inset 0 0 0 .5px rgba(0,0,0,.14)}
.lights i:nth-child(2){background:#FEBC2E;box-shadow:inset 0 0 0 .5px rgba(0,0,0,.14)}
.lights i:nth-child(3){background:#28C840;box-shadow:inset 0 0 0 .5px rgba(0,0,0,.14)}
.wtitle{position:absolute;left:0;right:0;text-align:center;font-size:13.5px;font-weight:600;color:#4A4F5A;
  letter-spacing:-.01em;pointer-events:none}
/* The hole is not "a transparent div": the desktop is painted behind it, so a
   transparent block would still screenshot as desktop. Everything is wrapped
   and clipped with an even-odd path instead, which punches the content rect
   out of every layer at once. */
.hole{height:${CONTENT.h}px;background:transparent}
.all{position:absolute;inset:0;
  clip-path:path(evenodd,'M0 0H1920V1080H0Z M${CONTENT.x} ${CONTENT.y}H${CONTENT.x + CONTENT.w}V${CONTENT.y + CONTENT.h}H${CONTENT.x}Z')}
</style>
<div class="all">
<div class="desk"></div>
<canvas class="grain" id="g" width="1920" height="1080"></canvas>
<div class="menubar">
  <span class="app">Perpix</span><span>File</span><span>Edit</span><span>View</span><span>Window</span><span>Help</span>
  <span class="right"><span class="num">Thu 10 Sept &nbsp;19:47</span><span class="bat"></span></span>
</div>
<div class="win">
  <div class="bar"><div class="lights"><i></i><i></i><i></i></div><div class="wtitle">Perpix — Index perpetuals</div></div>
  <div class="hole"></div>
</div>
</div>
<script>
  // A little grain, so a flat gradient does not read as a render.
  const c = document.getElementById('g'), x = c.getContext('2d');
  const d = x.createImageData(1920, 1080);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 118 + Math.random() * 40;
    d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 255;
  }
  x.putImageData(d, 0, 0);
</script>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: fontCss }));
await p.setContent(html);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
await p.screenshot({ path: 'chrome.png', omitBackground: true });
await b.close();
console.log(JSON.stringify({ content: CONTENT, titlebar: TITLEBAR }));
