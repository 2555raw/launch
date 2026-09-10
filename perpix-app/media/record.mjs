import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';

const BASE = 'http://localhost:8899/app/index.html';
const OUT = '/tmp/claude-0/-home-user-launch/aa4c71b2-4719-520c-b28f-4c5116b434e7/scratchpad/takes';
const W = 1920, H = 1080;
const fontCss = await readFile('/tmp/claude-0/-home-user-launch/aa4c71b2-4719-520c-b28f-4c5116b434e7/scratchpad/fonts/local.css', 'utf8');

/* A pointer the recording can actually see. Playwright dispatches real mouse
   events but draws no cursor, so the page draws its own. */
const CURSOR = `
(() => {
  const add = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div'); c.id = '__cur';
    c.style.cssText = 'position:fixed;z-index:99999;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;pointer-events:none;background:rgba(31,88,245,.22);box-shadow:0 0 0 2px rgba(31,88,245,.9),0 2px 10px rgba(0,0,0,.35);transition:transform .08s;left:-50px;top:-50px';
    document.documentElement.append(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => {
      c.style.transform = 'scale(.7)';
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;z-index:99998;left:' + c.style.left + ';top:' + c.style.top + ';width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;pointer-events:none;border:2px solid rgba(31,88,245,.9);animation:__rip .45s ease-out forwards';
      document.documentElement.append(r); setTimeout(() => r.remove(), 460);
    }, true);
    addEventListener('mouseup', () => { c.style.transform = 'scale(1)'; }, true);
    const st = document.createElement('style');
    st.textContent = '@keyframes __rip{to{transform:scale(3.2);opacity:0}}';
    document.head.append(st);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
})();`;

async function makeContext(browser, name, { seed = true, dark = false } = {}) {
  await mkdir(`${OUT}/${name}`, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: { dir: `${OUT}/${name}`, size: { width: W, height: H } },
    colorScheme: dark ? 'dark' : 'light',
  });
  // The app asks Google for its fonts; this session cannot reach it, so the
  // request is answered locally with the same two families.
  await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: fontCss }));
  await ctx.route(/img\.logo\.dev|icons\.duckduckgo\.com|google\.com\/s2/, r => r.abort());
  await ctx.addInitScript(CURSOR);
  if (seed) {
    await ctx.addInitScript(() => {
      const now = Date.now();
      localStorage.setItem('perpix.terms', JSON.stringify({ version: 1, acceptedAt: now }));
      localStorage.setItem('perpix.storage.consent', JSON.stringify({ choice: 'accepted', at: now }));
    });
  }
  return ctx;
}

const marks = [];
let t0 = 0;
const mark = (label) => { marks.push({ label, t: (Date.now() - t0) / 1000 }); };
const wait = (p, ms) => p.waitForTimeout(ms);

/** Moves the pointer to an element and clicks it, so the motion is visible. */
async function glide(page, target, { steps = 14, hold = 160, click = true } = {}) {
  const el = typeof target === 'string' ? page.locator(target).first() : target;
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  if (!box) throw new Error('no box for ' + target);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  await wait(page, hold);
  if (click) await page.mouse.down(), await wait(page, 70), await page.mouse.up();
  return el;
}

const TAKES = (process.argv[2] || 'abcd').split('');
const browser = await chromium.launch();

/* ---------------- take 1: arriving ---------------- */
if (TAKES.includes('a')) {
  const ctx = await makeContext(browser, 'a-open', { seed: false });
  const p = await ctx.newPage();
  t0 = Date.now();
  await p.goto(BASE, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await wait(p, 1100); mark('a.gate');
  await glide(p, '#termsAgree'); await wait(p, 500); mark('a.checked');
  await glide(p, '.px-terms-actions .px-btn'); await wait(p, 1600); mark('a.dashboard');
  await p.mouse.move(1300, 620, { steps: 20 }); await wait(p, 900); mark('a.stats');
  await ctx.close();
  console.log('take a done');
}

/* ---------------- take 2: the market, then every perpetual ---------------- */
if (TAKES.includes('b')) {
  const ctx = await makeContext(browser, 'b-market');
  const p = await ctx.newPage();
  t0 = Date.now();
  await p.goto(BASE + '#/market', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await wait(p, 1300); mark('b.market');
  await p.mouse.move(960, 700, { steps: 18 }); await wait(p, 900); mark('b.rows');

  const symbols = ['CRYPTOBETA','PRECIOUS','SILICON','BATTERY','MAG5','GOLDTWICE','LUXURY','CRAVING','IBERIA'];
  for (const sym of symbols) {
    await p.goto(`${BASE}#/i/ix_${sym.toLowerCase()}`, { waitUntil: 'load' });
    await wait(p, 1250);
    mark('b.ix.' + sym);
  }
  await ctx.close();
  console.log('take b done');
}

/* ---------------- take 3: build one, trade it, close it ---------------- */
if (TAKES.includes('c')) {
  const ctx = await makeContext(browser, 'c-build');
  const p = await ctx.newPage();
  t0 = Date.now();
  await p.goto(BASE + '#/create', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await wait(p, 1000); mark('c.create');
  await glide(p, '.px-input.num[maxlength="12"]');
  await p.keyboard.type('MYFIRST', { delay: 85 }); await wait(p, 350); mark('c.symbol');
  await glide(p, '.px-input[maxlength="48"]');
  await p.keyboard.type('Chips, gold and bitcoin', { delay: 55 }); await wait(p, 450); mark('c.name');
  await glide(p, p.locator('.px-chip', { hasText: 'NVIDIA' })); await wait(p, 550);
  await glide(p, p.locator('.px-seg button', { hasText: 'Metals' })); await wait(p, 400);
  await glide(p, p.locator('.px-chip', { hasText: 'Gold' }).first()); await wait(p, 550);
  await glide(p, p.locator('.px-seg button', { hasText: 'Crypto' })); await wait(p, 400);
  await glide(p, p.locator('.px-chip', { hasText: 'Bitcoin' })); await wait(p, 1100); mark('c.legs');
  await p.mouse.move(1500, 500, { steps: 16 }); await wait(p, 1000); mark('c.preview');
  await glide(p, p.locator('.px-btn', { hasText: 'List the index' })); await wait(p, 1800); mark('c.listed');

  // trade it
  await glide(p, p.locator('.px-seg.side button', { hasText: 'Short' })); await wait(p, 500);
  await glide(p, p.locator('.px-seg.side button', { hasText: 'Long' })); await wait(p, 400);
  const lev = p.locator('.px-range');
  const lb = await lev.boundingBox();
  await p.mouse.move(lb.x + lb.width * 0.25, lb.y + lb.height / 2, { steps: 8 });
  await p.mouse.down();
  for (const f of [0.4, 0.6, 0.8, 1.0]) { await p.mouse.move(lb.x + lb.width * f, lb.y + lb.height / 2, { steps: 6 }); await wait(p, 120); }
  await p.mouse.up(); await wait(p, 900); mark('c.leverage');
  // Not "Max": that spends the whole balance and leaves nothing for the fee,
  // so the engine refuses the order, which is correct and makes for a dull shot.
  await glide(p, p.locator('.px-btn', { hasText: '50%' })); await wait(p, 800); mark('c.size');
  await glide(p, '.px-btn.long'); await wait(p, 1700); mark('c.opened');

  await p.goto(BASE + '#/portfolio', { waitUntil: 'load' }); await wait(p, 1500); mark('c.portfolio');
  await glide(p, p.locator('.px-table .px-btn', { hasText: 'Close' })); await wait(p, 1600); mark('c.closed');
  await ctx.close();
  console.log('take c done');
}

/* ---------------- take 4: assets, and the lights going out ---------------- */
if (TAKES.includes('d')) {
  const ctx = await makeContext(browser, 'd-theme');
  const p = await ctx.newPage();
  t0 = Date.now();
  await p.goto(BASE + '#/assets', { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await wait(p, 1200); mark('d.stocks');
  await glide(p, p.locator('.px-seg button', { hasText: 'Metals' })); await wait(p, 1300); mark('d.metals');
  await glide(p, p.locator('.px-seg button', { hasText: 'Crypto' })); await wait(p, 1200); mark('d.crypto');
  await p.goto(BASE + '#/', { waitUntil: 'load' }); await wait(p, 1100);
  await glide(p, '#themeBtn'); await wait(p, 1500); mark('d.dark');
  await p.goto(BASE + '#/market', { waitUntil: 'load' }); await wait(p, 1500); mark('d.darkmarket');
  await glide(p, '.px-x', { click: false }); await wait(p, 1200); mark('d.x');
  await ctx.close();
  console.log('take d done');
}

await browser.close();
await writeFile(`${OUT}/marks-${TAKES.join('')}.json`, JSON.stringify(marks, null, 1));
console.log('\nmarks:'); marks.forEach(m => console.log(`  ${m.t.toFixed(2).padStart(6)}s  ${m.label}`));
