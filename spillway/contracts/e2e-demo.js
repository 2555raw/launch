/* End-to-end for the in-page chain: no wallet, no network. The page boots a real
 * EVM, deploys the launcher, launches a pairing and trades it — and the state
 * survives navigation through the journal replay.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const log = [];
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1360, height: 950 } });
  p.on('pageerror', e => log.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/CERT|favicon|fonts/.test(m.text())) log.push('CONSOLE ' + m.text()); });

  const umd = path.join(__dirname, '..', 'node_modules', 'ethers', 'dist', 'ethers.umd.min.js');
  await p.route('https://cdnjs.cloudflare.com/**', route =>
    fs.existsSync(umd)
      ? route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(umd, 'utf8') })
      : route.continue());
  await p.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  // there is no wallet in this browser, and no chain to reach
  await p.route('https://sepolia.base.org/**', route => route.abort());

  const base = 'http://127.0.0.1:8080/';
  const step = async (name, fn) => { process.stdout.write(name + ' … '); await fn(); console.log('ok'); };

  await step('offer the in-page chain when there is nothing to connect to', async () => {
    await p.goto(base + 'index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#start-demo', { timeout: 30000 });
  });

  await step('boot the EVM and deploy the launcher', async () => {
    await p.click('#start-demo');
    await p.waitForSelector('#reset-demo', { timeout: 180000 });
  });
  console.log('   launcher:', await p.evaluate(() => localStorage.getItem('spillway.launcher.1337')));

  await step('launch a pairing on it', async () => {
    await p.goto(base + 'launch.html', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#f-name', { timeout: 120000 });
    await p.fill('#f-name', 'Raw Water');
    await p.fill('#f-symbol', 'h2o');
    await p.selectOption('#f-source', 'MEAD');
    await p.fill('#f-firstbuy', '0.5');
    await p.click('button[type=submit]');
    await p.waitForURL(/token\.html\?addr=0x/, { timeout: 120000 });
    await p.waitForSelector('#buy-btn', { timeout: 120000 });
  });
  const token = new URL(p.url()).searchParams.get('addr');
  console.log('   token:', token);

  await step('buy on the curve', async () => {
    const before = await p.textContent('.panel-head h3');
    await p.fill('#buy-amount', '0.4');
    await p.click('#buy-btn');
    await p.waitForFunction(prev => document.querySelector('.panel-head h3')?.textContent !== prev, before, { timeout: 120000 });
  });
  const priceAfterBuy = (await p.textContent('.panel-head h3')).trim().split(' ')[0];
  console.log('   price:', priceAfterBuy);

  await step('state survives a full page load (journal replay)', async () => {
    await p.goto(base + 'launches.html', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#launch-rows tr .asset', { timeout: 180000 });
    const rows = await p.locator('#launch-rows tr').count();
    if (rows !== 1) throw new Error('expected 1 row after replay, got ' + rows);
  });

  await step('the token page reads the same state back', async () => {
    await p.goto(base + `token.html?addr=${token}`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#buy-btn', { timeout: 180000 });
    const price = (await p.textContent('.panel-head h3')).trim().split(' ')[0];
    if (price !== priceAfterBuy) throw new Error(`price changed across reload: ${priceAfterBuy} → ${price}`);
  });
  await p.screenshot({ path: 'e2e-demo-token.png' });

  await step('reset wipes the chain', async () => {
    await p.click('#reset-demo');
    await p.waitForSelector('#deploy-launcher', { timeout: 180000 });
  });

  console.log('\nerrors:', log.length ? log : 'none');
  await b.close();
})().catch(e => { console.error('\nFAILED:', e.message); console.log('errors:', log); process.exit(1); });
