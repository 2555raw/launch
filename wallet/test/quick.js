/* Starting a wallet without a password, and what it costs.
 *
 * The shortcut this replaces was to generate a passphrase and keep it beside
 * the keystore, which is not encryption: anything that reads localStorage
 * reads both halves. So the check that matters here is step 5. The key is a
 * non-extractable AES-GCM key, and the test asks the browser to export it and
 * fails if it can. If that ever starts passing, the wallet is storing a key
 * that an injected script could copy and send away.
 *
 * The rest is the journey: arriving at the launchpad with no account, one tap,
 * a real wallet, the standing notice about what it costs, reopening with no
 * password screen, and reading the twelve words back without one.
 *
 * Needs the wallet served:  PORT=8099 npm start
 *
 *   node test/quick.js
 */
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://127.0.0.1:8099';
const view = p => p.$$eval('.view.on', v => v.map(x => x.dataset.view)[0] || 'ninguna');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await b.newContext({ viewport: { width: 430, height: 940 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let fail = 0;

  // straight from the landing page's Launchpad link
  await page.goto(APP + '/app#/launch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  console.log('1. llego al launchpad sin cuenta ->', await view(page));
  await page.click('#quickGoLaunch');
  await page.waitForTimeout(2500);
  console.log('2. tras "Start now" ->', await view(page));
  if (await view(page) !== 'launch') { console.log('   no volvio al launchpad'); fail++; }

  const addr = await page.$eval('#addrShort', n => n.textContent.trim());
  console.log('3. wallet real, direccion:', addr);
  if (!/^0x/.test(addr)) { console.log('   no hay wallet'); fail++; }

  const warn = await page.evaluate(() => {
    const w = document.querySelector('#quickWarn');
    return w && !w.hidden ? w.innerText.split('\n')[0] : null;
  });
  console.log('4. aviso permanente:', JSON.stringify(warn));
  if (!warn) { console.log('   no avisa de lo que cuesta'); fail++; }

  // the key must not be readable by script
  const key = await page.evaluate(async () => {
    const k = await window.WARD_VAULT.getKey();
    if (!k) return 'SIN CLAVE';
    if (k.extractable) return 'EXTRAIBLE';
    try { await crypto.subtle.exportKey('raw', k); return 'SE PUDO EXPORTAR'; }
    catch { return 'no exportable'; }
  });
  console.log('5. la clave es:', key);
  if (key !== 'no exportable') { console.log('   LA CLAVE SE PUEDE ROBAR'); fail++; }

  const plain = await page.evaluate(() => JSON.stringify(localStorage).length > 0
    && !/\b(abandon|ability|able)\b/.test(JSON.stringify(localStorage)));
  const sealed = await page.evaluate(() => {
    const s = localStorage.getItem('ward.v1.sealed');
    return s ? Object.keys(JSON.parse(s)).join(',') : 'nada';
  });
  console.log('6. lo guardado en claro:', sealed);
  if (!/ct/.test(sealed)) { console.log('   no esta sellado'); fail++; }

  // reopening needs no password
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  const back = await view(page);
  console.log('7. al recargar ->', back, '(sin pantalla de contrasena)');
  if (back === 'unlock') { console.log('   pidio contrasena'); fail++; }

  // and the phrase can be read back without one
  await page.evaluate(() => { document.querySelector('[data-go="settings"]').click(); });
  await page.waitForTimeout(500);
  await page.click('#revealSeed');
  await page.waitForSelector('#seedSheet:not([hidden])');
  const hidden = await page.evaluate(() =>
    document.querySelector('#seedPw').closest('.field').hidden);
  console.log('8. campo de contrasena oculto en ajustes:', hidden);
  if (!hidden) { console.log('   pide una contrasena que no existe'); fail++; }
  await page.click('#seedGo');
  await page.waitForTimeout(1200);
  const words = await page.$$eval('#seedShow .word .w', n => n.length);
  console.log('9. palabras reveladas:', words);
  if (words !== 12) { console.log('   no mostro la frase'); fail++; }

  const gone = await page.evaluate(() => document.querySelector('#quickWarn').hidden);
  console.log('10. aviso tras ver la frase, oculto:', gone);
  if (!gone) { console.log('   sigue avisando'); fail++; }

  const real = errs.filter(e => !/Failed to load|net::ERR/i.test(e));
  if (real.length) { console.log('errores:', real.slice(0,3)); fail++; }
  console.log(fail ? `\n${fail} problemas` : '\nempezar sin contrasena funciona, y la clave no se puede robar');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
