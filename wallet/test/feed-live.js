/* The launched-coins section, reading a chain for real.
 *
 * The page asks the public Robinhood Chain node; here that request is
 * redirected to a local chain seeded with three launches, so the whole path
 * runs: logs fetched, addresses pulled out of topics, names and descriptions
 * read off each token, rows painted.
 *
 * Two of the checks are not about whether it works. One is that a multi-byte
 * name survives the hand-rolled string decoder. The other is that no coin's
 * picture is ever fetched: the logo is a URL chosen by whoever launched the
 * coin, and this page tells visitors it has no trackers and sends nothing to
 * anyone. Loading that image would send every visitor's address to a host a
 * stranger picked, so the avatar is a letter and the test fails if an <img>
 * appears.
 *
 *   npx hardhat node --port 8545          (chainId 4663)
 *   node test/feed-seed.js                (needs solc; places the launches)
 *   PORT=8099 npm start
 *   node test/feed-live.js
 */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await b.newContext({ colorScheme: 'dark', viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  /* Point the page's RPC at the local chain before feed.js runs. */
  await page.route('https://rpc.mainnet.chain.robinhood.com/**', async route => {
    const r = await fetch((process.env.RPC_URL || 'http://127.0.0.1:8545'), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: route.request().postData()
    });
    route.fulfill({ status: 200, contentType: 'application/json', body: await r.text() });
  });
  await page.goto((process.env.SITE_URL || 'http://127.0.0.1:8099/'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { const c = document.querySelector('.consent'); if (c) c.remove(); });

  const rows = await page.$$eval('.fd-item', is => is.map(i => ({
    name: i.querySelector('b').textContent,
    sym: i.querySelector('small').textContent,
    desc: i.querySelector('.fd-desc').textContent.slice(0, 40),
    link: i.querySelector('.fd-go').getAttribute('href'),
    avatar: i.querySelector('.fd-av').textContent,
    img: !!i.querySelector('.fd-av img')
  })));
  let fail = 0;
  console.log('monedas leidas de la cadena:', rows.length);
  rows.forEach(r => console.log('  ' + JSON.stringify(r)));
  if (rows.length !== 3) { console.log('  esperaba 3'); fail++; }
  if (!rows.some(r => r.name === 'Proxima' && r.sym === 'PXM')) { console.log('  falta Proxima'); fail++; }
  if (!rows.some(r => r.name === 'ライオン')) { console.log('  el multi-byte no se decodifico'); fail++; }
  if (rows.some(r => r.img)) { console.log('  CARGO UNA IMAGEN DE TERCEROS'); fail++; }
  if (!rows.every(r => /^https:\/\/robinhoodchain\.blockscout\.com\/token\/0x/.test(r.link))) { console.log('  enlace mal'); fail++; }
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 0) { console.log('  desborda ' + over + 'px'); fail++; }
  if (errs.length) { console.log('  errores:', errs.slice(0,2)); fail++; }

  await page.evaluate(() => document.querySelector('#launches').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await page.locator('#launches').screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir() + '/') + 'feed-live.png' });
  console.log(fail ? `\n${fail} problemas` : '\nla portada lista las monedas leidas de la cadena');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
