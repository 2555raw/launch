/* A list headed LIVE that only updates on reload is a screenshot.
 *
 * This opens the page, launches a coin on the chain behind it, touches
 * nothing, and waits for the row to arrive by itself at the top of the list.
 */
const { chromium } = require('playwright');
const { ethers } = require('ethers');
const j = require(process.env.PONS_MOCK || './feed-mine.json');
const A = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const KEY = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';
const WARD = () => '0x57415244' + require('crypto').randomBytes(28).toString('hex');
const P = (n, sy, d, salt, logo) => ({ name: n, symbol: sy, logo: logo || '', description: d,
  socials: { twitter: '', telegram: '', discord: '', website: '', farcaster: '' },
  creatorFeeRecipient: '0x' + '11'.repeat(20), creatorTaxBps: 0, buybackEnabled: false,
  expectedEconomics: '0x' + '0'.repeat(64), salt });

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
  const before = await names();
  console.log('antes:', JSON.stringify(before));

  // launch one while the page is open and untouched
  const p = new ethers.JsonRpcProvider((process.env.RPC_URL || 'http://127.0.0.1:8545'));
  const c = new ethers.Contract(A, j.fac.abi, new ethers.Wallet(KEY, p));
  await (await c.launchToken(P('Landed Live', 'LIVE', 'Aparecio sin recargar.', WARD()), 1, '0x' + '00'.repeat(20))).wait();
  console.log('lanzada en la cadena, esperando a que la pagina se entere…');

  try {
    await page.waitForFunction(
      () => [...document.querySelectorAll('.fd-item b')].some(b => b.textContent === 'Landed Live'),
      { timeout: 45000 });
    console.log('apareció sola');
  } catch { console.log('  NO aparecio sin recargar'); fail++; }

  const after = await names();
  console.log('despues:', JSON.stringify(after));
  if (after[0] !== 'Landed Live') { console.log('  deberia entrar la primera'); fail++; }

  const fresh = await page.$$eval('.fd-fresh', n => n.length);
  console.log('filas destacadas como recien llegadas:', fresh);

  await page.evaluate(() => document.querySelector('#launches').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.locator('#launches').screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir() + '/') + 'feed-live-arrival.png' });
  if (errs.length) { console.log('  errores:', errs.slice(0, 2)); fail++; }
  console.log(fail ? `\n${fail} problemas` : '\nuna moneda lanzada con la pagina abierta aparece sola');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
