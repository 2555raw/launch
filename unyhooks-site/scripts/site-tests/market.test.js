/* The live $UHOOKS market panel with stand-in market data: pair choice,
   numbers, the 24h line and its tooltip, the no-pool and offline states.
   Serve the site on :8765 first. */
const { chromium } = require('playwright');
// Waits poll on a timer, not on animation frames: the landing's WebGL scenes
// can starve requestAnimationFrame in a software-rendered test browser.
const B = 'http://localhost:8765/';
const out = []; const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);
const CA = '0x1111111111111111111111111111111111111111';
const withCA = async (r) => { const body = (await (await r.fetch()).text()).replace("CONTRACT: ''", `CONTRACT: '${CA}'`); r.fulfill({ body, contentType: 'application/javascript' }); };
(async () => {
  const b = await chromium.launch();
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); let p = await ctx.newPage();
  // Only the site and the stand-ins below: fonts and CDNs are not needed, and
  // without a network they can hang and keep the page from going idle.
  await ctx.route((u) => !u.href.startsWith(B), (r) => r.abort());
  await ctx.route(B + 'config.js', withCA);
  await ctx.route(/api\.dexscreener\.com/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify([
    { url: 'https://dexscreener.com/robinhood/0xaa', pairAddress: '0x' + 'aa'.repeat(32), priceUsd: '0.00042', marketCap: 420000, liquidity: { usd: 88000 }, volume: { h24: 12345 }, priceChange: { h24: 12.5 } },
    { url: 'https://dexscreener.com/robinhood/0xbb', pairAddress: '0x' + 'bb'.repeat(32), priceUsd: '0.0004', liquidity: { usd: 100 } }]) }));
  const now = Math.floor(Date.now() / 3600000) * 3600;
  let gUrl = '';
  await ctx.route(/api\.geckoterminal\.com/, r => { gUrl = r.request().url(); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { attributes: { ohlcv_list: Array.from({ length: 24 }, (_, i) => [now - i * 3600, 0, 0, 0, 0.00042 * (1 - i * 0.004 + Math.sin(i) * 0.01), 10]) } } }) }); });
  await ctx.route(/blockscout/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ holders_count: '1234' }) }));
  await p.goto(B + 'index.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelectorAll('#mk-spark path').length === 2, null, { polling: 200 });
  ok('most liquid pair chosen', gUrl.includes('0x' + 'aa'.repeat(32)), gUrl.slice(0, 120));
  ok('24h line drawn with area + line', true);
  ok('price', (await p.textContent('#mk-price')) === '$0.00042');
  ok('up move ▲ green', (await p.textContent('#mk-chg')) === '▲ 12.50% 24h' && await p.$eval('#mk-chg', e => e.classList.contains('is-up')));
  ok('mcap/liq/vol', (await p.textContent('#mk-mcap')) === '$420K' && (await p.textContent('#mk-liq')) === '$88K' && (await p.textContent('#mk-vol')) === '$12.35K', [await p.textContent('#mk-mcap'), await p.textContent('#mk-liq'), await p.textContent('#mk-vol')].join(' '));
  ok('holders from explorer', (await p.textContent('#mk-holders')) === '1,234');
  await p.$eval('#market', e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await p.waitForTimeout(900);
  // measure right before hovering (the reveal animation can still be moving
  // the chart), then wait for the tooltip rather than a fixed time
  await p.waitForTimeout(900);
  const bx = await p.$eval('#mk-spark', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width * 0.5, y: r.y + r.height / 2 }; });
  await p.mouse.move(bx.x, bx.y);
  await p.waitForFunction(() => /\$0\.000/.test(document.querySelector('#mk-tip').textContent), null, { timeout: 3000, polling: 100 }).catch(() => {});
  ok('hover tooltip with time and price', /\$0\.000/.test(await p.textContent('#mk-tip')), await p.textContent('#mk-tip'));
  await p.screenshot({ path: require('path').join(__dirname, 'market.png') });
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
  ok('mobile: no sideways scroll', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await p.$eval('#market', e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await p.screenshot({ path: require('path').join(__dirname, 'market-m.png') });
  await ctx.close();

  ctx = await b.newContext(); p = await ctx.newPage();
  await ctx.route((u) => !u.href.startsWith(B), (r) => r.abort());
  await ctx.route(B + 'config.js', withCA);
  await ctx.route(/api\.dexscreener\.com/, r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await ctx.route(/blockscout|geckoterminal/, r => r.abort());
  await p.goto(B + 'index.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelector('#mk-price').textContent === 'Not trading yet', null, { timeout: 8000, polling: 200 }).catch(() => {});
  ok('no pools yet: friendly message, buy still available', (await p.textContent('#mk-price')) === 'Not trading yet' && (await p.textContent('#mk-updated')).includes('first pool') && await p.isVisible('#mk-buy'), [await p.textContent('#mk-price'), await p.textContent('#mk-updated'), await p.isVisible('#mk-buy')].join(' | '));
  // "Live on Robinhood Chain", from the server's launch index
  ok('no launch index (static host): the live section stays hidden', !(await p.isVisible('#live')));
  await ctx.close();
  const LIVE = { ready: true, updatedAt: new Date().toISOString(), block: 1, stats: { launches: 2, ethPaired: 1.25, locked: 1, lockedForever: 0, swaps: 31 },
    latest: [{ symbol: 'PINK', name: 'Pink Moon', hook: '0x' + '22'.repeat(20), eth: '1', lock: '0x' + '33'.repeat(20), unlockAt: '1830000000', forever: false, time: Math.floor(Date.now() / 1000) - 7200 },
      { symbol: 'SEADOG', name: 'Sea Dog', hook: '0x' + '44'.repeat(20), eth: '0.25', lock: null, unlockAt: '0', forever: false, time: Math.floor(Date.now() / 1000) - 3 * 86400 }] };
  for (const [label, data] of [['with launches', LIVE], ['none yet', { ...LIVE, stats: { launches: 0, ethPaired: 0, locked: 0, lockedForever: 0, swaps: 0 }, latest: [] }]]) {
    ctx = await b.newContext(); p = await ctx.newPage();
    await ctx.route((u) => !u.href.startsWith(B), (r) => r.abort());
    await ctx.route(B + 'api/launches', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
    await p.goto(B + 'index.html', { waitUntil: 'networkidle' });
    await p.waitForFunction(() => !document.querySelector('#live').hidden, null, { timeout: 8000, polling: 200 }).catch(() => {});
    const txt = (await p.textContent('#live')).replace(/\s+/g, ' ');
    if (label === 'with launches') {
      ok('live: stats and the newest launches', /Tokens launched\s*2/.test(txt) && /1\.25 ETH/.test(txt) && /1 of 2/.test(txt) && /\$PINK/.test(txt) && /Locked until/.test(txt) && /No lock/.test(txt) && /2 h ago/.test(txt), txt.slice(0, 220));
      ok('live: each launch links to its public page', (await p.getAttribute('.uh-live-item', 'href')).includes('hook.html?a=0x2222'));
    } else {
      ok('live: none yet says so, with a way to launch', /No launches yet/.test(txt) && !(await p.isVisible('#lv-stats')) && await p.isVisible('.uh-live-empty .uh-btn'), txt.slice(0, 160));
    }
    await ctx.close();
  }
  console.log(out.join('\n')); await b.close();
})();
