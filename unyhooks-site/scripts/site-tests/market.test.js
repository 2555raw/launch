/* The live $UHOOKS market panel with stand-in market data: pair choice,
   numbers, the 24h line and its tooltip, the no-pool and offline states.
   Serve the site on :8765 first. */
const { chromium } = require('playwright');
const B = 'http://localhost:8765/';
const out = []; const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);
const CA = '0x1111111111111111111111111111111111111111';
const withCA = async (r) => { const body = (await (await r.fetch()).text()).replace("CONTRACT: ''", `CONTRACT: '${CA}'`); r.fulfill({ body, contentType: 'application/javascript' }); };
(async () => {
  const b = await chromium.launch();
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); let p = await ctx.newPage();
  await ctx.route(B + 'config.js', withCA);
  await ctx.route(/api\.dexscreener\.com/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify([
    { url: 'https://dexscreener.com/robinhood/0xaa', pairAddress: '0x' + 'aa'.repeat(32), priceUsd: '0.00042', marketCap: 420000, liquidity: { usd: 88000 }, volume: { h24: 12345 }, priceChange: { h24: 12.5 } },
    { url: 'https://dexscreener.com/robinhood/0xbb', pairAddress: '0x' + 'bb'.repeat(32), priceUsd: '0.0004', liquidity: { usd: 100 } }]) }));
  const now = Math.floor(Date.now() / 3600000) * 3600;
  let gUrl = '';
  await ctx.route(/api\.geckoterminal\.com/, r => { gUrl = r.request().url(); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { attributes: { ohlcv_list: Array.from({ length: 24 }, (_, i) => [now - i * 3600, 0, 0, 0, 0.00042 * (1 - i * 0.004 + Math.sin(i) * 0.01), 10]) } } }) }); });
  await ctx.route(/blockscout/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ holders_count: '1234' }) }));
  await p.goto(B + 'index.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelectorAll('#mk-spark path').length === 2);
  ok('most liquid pair chosen', gUrl.includes('0x' + 'aa'.repeat(32)), gUrl.slice(0, 120));
  ok('24h line drawn with area + line', true);
  ok('price', (await p.textContent('#mk-price')) === '$0.00042');
  ok('up move ▲ green', (await p.textContent('#mk-chg')) === '▲ 12.50% 24h' && await p.$eval('#mk-chg', e => e.classList.contains('is-up')));
  ok('mcap/liq/vol', (await p.textContent('#mk-mcap')) === '$420K' && (await p.textContent('#mk-liq')) === '$88K' && (await p.textContent('#mk-vol')) === '$12.35K', [await p.textContent('#mk-mcap'), await p.textContent('#mk-liq'), await p.textContent('#mk-vol')].join(' '));
  ok('holders from explorer', (await p.textContent('#mk-holders')) === '1,234');
  await p.$eval('#market', e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await p.waitForTimeout(900);
  const bx = await p.$eval('#mk-spark', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width * 0.5, y: r.y + r.height / 2 }; });
  await p.waitForTimeout(900); await p.mouse.move(bx.x, bx.y); await p.waitForTimeout(150);
  ok('hover tooltip with time and price', /\$0\.000/.test(await p.textContent('#mk-tip')), await p.textContent('#mk-tip'));
  await p.screenshot({ path: 'market.png' });
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
  ok('mobile: no sideways scroll', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await p.$eval('#market', e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await p.screenshot({ path: 'market-m.png' });
  await ctx.close();

  ctx = await b.newContext(); p = await ctx.newPage();
  await ctx.route(B + 'config.js', withCA);
  await ctx.route(/api\.dexscreener\.com/, r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await ctx.route(/blockscout|geckoterminal/, r => r.abort());
  await p.goto(B + 'index.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  ok('no pools yet: friendly message, buy still available', (await p.textContent('#mk-price')) === 'Not trading yet' && (await p.textContent('#mk-updated')).includes('first pool') && await p.isVisible('#mk-buy'));
  console.log(out.join('\n')); await b.close();
})();
