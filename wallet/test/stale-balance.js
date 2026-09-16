/* Switching network must not repaint the old chain's balance against the new
   chain's decimals. 0.0001 ETH is 10^14 wei; on a nine-decimal chain that
   number reads as 100,000 SOL, which is money the person does not have. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await b.newContext({ viewport: { width: 430, height: 940 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto((process.env.APP_URL || 'http://127.0.0.1:8099/app'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.click('#quickGo');
  await page.waitForSelector('[data-view="home"].on', { timeout: 30000 });
  await page.waitForTimeout(800);

  let fail = 0;
  // 0.0001 ETH on the EVM side, the amount that produced the report
  await page.evaluate(() => {
      document.querySelectorAll('#tokenList .tok-amt').forEach(n => { n.textContent = '0.0001'; });
  });
  const before = await page.$$eval('#tokenList .tok-amt', n => n.map(x => x.textContent));
  console.log('antes (Base):', JSON.stringify(before));

  await page.click('#netPill');
  await page.waitForSelector('#netSheet:not([hidden])');
  const names = await page.$$eval('#netList button .nl-mid b', n => n.map(x => x.textContent.trim()));
  const i = names.findIndex(n => /solana/i.test(n));
  await (await page.$$('#netList button'))[i].click();
  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => ({
    list: [...document.querySelectorAll('#tokenList .tok-amt')].map(n => n.textContent),
    card: (document.querySelector('#cardBal') || {}).textContent || ''
  }));
  console.log('despues (Solana):', JSON.stringify(after));
  const bad = v => /^[\d.,]+$/.test((v || '').trim()) && parseFloat(v.replace(/,/g, '')) > 0;
  if (after.list.some(bad)) { console.log('  SIGUE MOSTRANDO UN SALDO QUE NO ES DE ESTA RED'); fail++; }
  if (bad(after.card)) { console.log('  la tarjeta muestra saldo ajeno'); fail++; }
  if (errs.length) { console.log('  errores:', errs.slice(0,2)); fail++; }
  console.log(fail ? `\n${fail} problemas` : '\nal cambiar de red no se hereda el saldo de la anterior');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
