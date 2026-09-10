import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFile } from 'node:fs/promises';
const fontCss = await readFile('./fonts/local.css', 'utf8');
const OUT = './cards';

const CSS = `
${fontCss}
*{margin:0;box-sizing:border-box}
body{width:1920px;height:1080px;background:transparent;font-family:'Inter',system-ui,sans-serif;
     -webkit-font-smoothing:antialiased;position:relative}
.lower{position:absolute;left:96px;bottom:88px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.tag{display:inline-flex;align-items:center;gap:12px;background:rgba(9,12,18,.82);backdrop-filter:blur(8px);
     border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:12px 22px 12px 16px;
     box-shadow:0 18px 50px -20px rgba(0,0,0,.85)}
.dot{width:9px;height:9px;border-radius:50%;background:#FFC72C;flex:none}
.tag span{color:#fff;font-size:27px;font-weight:600;letter-spacing:-.02em;white-space:nowrap}
.sub{color:rgba(255,255,255,.62);font-size:20px;font-weight:500;padding-left:18px;letter-spacing:-.01em;
     text-shadow:0 2px 14px rgba(0,0,0,.9)}
.chip{position:absolute;right:96px;top:96px;background:rgba(9,12,18,.82);backdrop-filter:blur(8px);
      border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:11px 18px;color:rgba(255,255,255,.9);
      font-size:21px;font-weight:600;letter-spacing:-.01em}
/* end card */
.end{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:26px;
     background:rgba(8,11,16,.9)}
.mark{width:132px;height:132px}
.name{color:#fff;font-size:104px;font-weight:700;letter-spacing:-.045em;line-height:1}
.handle{color:#8FB0FF;font-size:38px;font-weight:600;letter-spacing:-.01em}
.disc{color:rgba(255,255,255,.45);font-size:22px;font-weight:500;letter-spacing:-.005em;margin-top:14px;text-align:center;line-height:1.5}
`;
const MARK = `<svg class="mark" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1F58F5"/>
  <path d="M10 24.5V13M16 24.5V8.5M22 24.5V17" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <path d="M6.5 19.5h19" stroke="#FFC72C" stroke-width="2.6" stroke-linecap="round"/></svg>`;

const lower = (title, sub) => `<div class="lower"><div class="tag"><span class="dot"></span><span>${title}</span></div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
const chip = (t) => `<div class="chip">${t}</div>`;

const CARDS = {
  'c1-intro':   lower('Perpix', 'Index perpetuals, on a paper market'),
  'c2-market':  lower('Nine baskets, one perpetual each'),
  'c3-legs':    chip('Fixed weight · 3 to 5 assets'),
  'c4-build':   lower('Build your own', 'Pick the legs, set the weights, list it'),
  'c5-trade':   lower('Long or short, up to 5×', 'Liquidation priced before you commit'),
  'c6-assets':  lower('Stocks · metals · crypto · ETFs', 'Every one with its real mark'),
  'c7-theme':   lower('Light or dark'),
  'c8-end':     `<div class="end">${MARK}<div class="name">Perpix</div><div class="handle">@usePerpix</div>
                 <div class="disc">A paper market. Prices come from a simulator<br>and do not describe the real market.</div></div>`,
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: fontCss }));
for (const [name, body] of Object.entries(CARDS)) {
  await p.setContent(`<link rel="stylesheet" href="http://localhost:8899/fonts/local.css"><style>${CSS}</style>${body}`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(180);
  await p.screenshot({ path: `${OUT}/${name}.png`, omitBackground: true });
  console.log(name);
}
await b.close();
