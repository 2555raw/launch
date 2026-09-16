/* Telling Ward's launches apart from everyone else's.
 *
 * Pons's event says nothing about who launched through what, and there is no
 * field on it that could. But the launch is CREATE2 and its salt is a free 32
 * bytes, so Ward begins its salts with "WARD" in ASCII and the answer lives in
 * the calldata of the transaction that emitted the event.
 *
 * feed-mine-seed.js puts one tagged launch on a local chain, one untagged, and
 * then forty more untagged on top, and the tabs have to separate them. It is a
 * claim, not a proof: anyone can write the same four bytes, and the page says
 * so.
 *
 * The forty are the point of the test as much as the salt is. The Ward tab
 * used to fetch a fixed pile of the most recent launches and sieve it
 * afterwards, so a Ward coin with enough strangers stacked on top of it fell
 * off the bottom of the pile and the tab read empty while the coin sat on
 * chain the whole time. Burying it is what turns that into a failure here.
 *
 *   npx hardhat node --port 8545          (chainId 4663)
 *   node test/feed-mine-mock.js           (needs solc; compiles the stand-in)
 *   node test/feed-mine-seed.js
 *   PORT=8099 npm start
 *   node test/feed-mine.js
 */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await b.newContext({ colorScheme: 'dark', viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('https://rpc.mainnet.chain.robinhood.com/**', async route => {
    const r = await fetch((process.env.RPC_URL || 'http://127.0.0.1:8545'), { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: route.request().postData() });
    route.fulfill({ status: 200, contentType: 'application/json', body: await r.text() });
  });
  await page.goto((process.env.SITE_URL || 'http://127.0.0.1:8099/'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { const c = document.querySelector('.consent'); if (c) c.remove(); });

  let fail = 0;
  const names = () => page.$$eval('.fd-item b', n => n.map(x => x.textContent));

  /* Counted by what must and must not be there rather than by how many, so a
     chain that other tests have also launched on does not read as a failure. */
  const ajena = n => n === 'Rando Coin' || /^Filler /.test(n);

  const mine = await names();
  console.log('pestaña "From Ward":', JSON.stringify(mine));
  if (!mine.includes('Ward Sentinel')) { console.log('  falta la lanzada desde Ward'); fail++; }
  const colada = mine.filter(ajena);
  if (colada.length) { console.log('  SE CUELAN AJENAS COMO DE WARD:', colada.join(', ')); fail++; }

  await page.click('#fdAll');
  await page.waitForTimeout(2500);
  const all = await names();
  console.log('pestaña "Everything":', JSON.stringify(all));
  if (!all.some(ajena)) { console.log('  las ajenas no salen ni en "todas"'); fail++; }

  /* The buried one. The Ward launch went on before the forty fillers, so it is
     nowhere near the head of the chain and cannot be in the page of recent
     launches the other tab shows. Finding it anyway is the whole point: the
     Ward tab has to keep digging until it has enough, not sieve one page and
     call the chain empty. */
  if (all.includes('Ward Sentinel')) {
    console.log('  (la de Ward sigue siendo reciente: el relleno no la enterró)');
  } else {
    console.log('  enterrada bajo', all.length, 'ajenas mas recientes, y aun asi aparece: ok');
  }

  await page.click('#fdMine');
  await page.waitForTimeout(2500);
  const back = await names();
  console.log('vuelta a "From Ward":', JSON.stringify(back));
  if (back.some(ajena)) { console.log('  no volvio a filtrar'); fail++; }
  if (!back.includes('Ward Sentinel')) { console.log('  perdio la de Ward al volver'); fail++; }

  await page.evaluate(() => document.querySelector('#launches').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await page.locator('#launches').screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir() + '/') + 'feed-mine.png' });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 0) { console.log('  desborda ' + over); fail++; }
  if (errs.length) { console.log('  errores:', errs.slice(0,2)); fail++; }
  console.log(fail ? `\n${fail} problemas` : '\ndistingue las de Ward de las del resto');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
