/* The launch screen, through the real interface.
 *
 * It creates a wallet the way a person does, then checks the three states the
 * screen has and — the part that matters — that the button stays shut. The
 * launchpad has no configuration on chain yet, so there is nothing to launch
 * against, and a screen that let someone try anyway would spend their SOL on
 * a transaction that cannot succeed.
 *
 * It also covers the network pill, which sits in the bar on every screen:
 * moving off Solana while looking at the launch form has to change the form
 * back into an offer to switch. It did not, until this test said so.
 *
 * Needs the wallet being served:  PORT=8111 npm start
 *
 *   node test/launch.js          (APP_URL overrides the address)
 */
const APP = process.env.APP_URL || 'http://127.0.0.1:8111/app';
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await b.newContext({ viewport: { width: 430, height: 940 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(APP, { waitUntil: 'networkidle' });

  await page.click('#startCreate');
  await page.waitForSelector('.seed .word');
  const words = await page.$$eval('#seedGrid .word .w', n => n.map(x => x.textContent));
  await page.click('label.check');
  await page.click('#toVerify');
  await page.waitForSelector('#verifyFields .vf');
  for (const row of await page.$$('#verifyFields .vf')) {
    const n = parseInt((await row.$eval('b', x => x.textContent)).replace(/\D/g, ''), 10);
    await row.$eval('input', (i, v) => { i.value = v; i.dispatchEvent(new Event('input')); }, words[n - 1]);
  }
  await page.click('#toPass');
  await page.waitForSelector('[data-view="password"].on');
  await page.fill('#pw1', 'Ward-2026!ok');
  await page.fill('#pw2', 'Ward-2026!ok');
  await page.click('#doCreate');
  await page.waitForSelector('[data-view="home"].on', { timeout: 60000 });
  console.log('  ▸ wallet created');

  let fail = 0;
  const netName = () => page.$eval('#netName', n => n.textContent.trim());
  console.log('  starts on:', await netName());

  // switch through the network sheet, the way a person does
  await page.click('#netPill');
  await page.waitForSelector('#netSheet:not([hidden])', { timeout: 5000 });
  const names = await page.$$eval('#netList button .nl-mid b', n => n.map(x => x.textContent.trim()));
  console.log('  networks offered:', names.join(', '));
  const solIdx = names.findIndex(n => /solana/i.test(n));
  if (solIdx < 0) { console.log('  no Solana in the list'); fail++; }
  await (await page.$$('#netList button'))[solIdx].click();
  await page.waitForTimeout(900);
  const after = await netName();
  console.log('  after picking Solana:', after);
  if (!/solana/i.test(after)) { console.log('  the network did not change'); fail++; }
  if (await page.isVisible('#netSheet:not([hidden])')) { console.log('  the sheet stayed open'); fail++; }

  // the launch screen should now offer the form rather than the wrong-chain note
  await page.click('.launch-cta');
  await page.waitForSelector('[data-view="launch"].on');
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({
    wrong: !document.querySelector('#launchWrongChain').hidden,
    noCfg: !document.querySelector('#launchNoConfig').hidden,
    form: !document.querySelector('#launchForm').hidden
  }));
  console.log('  launch screen on Solana:', JSON.stringify(st));
  if (st.wrong || !st.noCfg || !st.form) { console.log('  wrong state for Solana'); fail++; }

  /* The button, with everything a person can control set correctly. It must
     still refuse, because the one thing they cannot control — the config —
     does not exist. */
  await page.fill('#lcName', 'Ward Coin');
  await page.fill('#lcSym', 'ward');
  await page.fill('#lcDesc', 'A coin for the tests.');
  await page.waitForTimeout(150);
  const cnt = await page.evaluate(() => ({
    n: document.querySelector('#lcNameCount').textContent,
    s: document.querySelector('#lcSymCount').textContent
  }));
  if (cnt.n !== '9/64' || cnt.s !== '4/16') {
    console.log('  the character counters are wrong:', JSON.stringify(cnt)); fail++;
  }

  /* The picture is read locally and shown; nothing is uploaded, because there
     is nowhere to upload it to yet. */
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.setInputFiles('#lcFile', { name: 'coin.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(400);
  const shown = await page.$eval('#lcPrevBox', b => (b.querySelector('img') || {}).src || '');
  if (!shown.startsWith('data:image/png')) { console.log('  the picture never appeared'); fail++; }

  await page.setInputFiles('#lcFile', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('no') });
  await page.waitForTimeout(350);
  const refused = await page.$$eval('.toast', t => t.map(x => x.textContent));
  if (!refused.some(t => /jpg|png|gif/i.test(t))) { console.log('  a .txt was not refused'); fail++; }

  await page.waitForTimeout(120);
  if (!(await page.$eval('#lcGo', x => x.disabled))) {
    console.log('  the button is live with no config on chain'); fail++;
  } else console.log('  form complete, still refuses: ok');

  /* And if something forces the click anyway, it says why rather than
     building a transaction that cannot land. */
  await page.evaluate(() => {
    /* Clear whatever the background balance read has already put up, or the
       assertion below passes on someone else's message. */
    document.querySelector('#toasts').innerHTML = '';
    document.querySelector('#lcGo').disabled = false;
  });
  await page.click('#lcGo');
  await page.waitForTimeout(400);
  const said = await page.$$eval('.toast', t => t.map(x => x.textContent));
  const named = said.some(t => /not open|launchpad/i.test(t));
  if (!named) { console.log('  a forced submit did not say why it refused:', JSON.stringify(said)); fail++; }
  else console.log('  a forced submit answers:', JSON.stringify(said.find(t => /not open|launchpad/i.test(t))));

  // and back to an EVM chain
  await page.click('#netPill');
  await page.waitForSelector('#netSheet:not([hidden])');
  const baseIdx = (await page.$$eval('#netList button .nl-mid b', n => n.map(x => x.textContent.trim())))
    .findIndex(n => /^base$/i.test(n));
  await (await page.$$('#netList button'))[baseIdx].click();
  await page.waitForTimeout(900);
  console.log('  back to:', await netName());
  // stays on the launch screen: the bar's network pill is reachable from here
  await page.waitForTimeout(300);
  const st2 = await page.evaluate(() => ({
    wrong: !document.querySelector('#launchWrongChain').hidden,
    form: !document.querySelector('#launchForm').hidden
  }));
  console.log('  launch screen on Base:', JSON.stringify(st2));
  if (!st2.wrong || st2.form) { console.log('  should offer to switch, not a form'); fail++; }

  const real = errs.filter(e => !/Failed to load resource|net::ERR|balance|RPC|fetch/i.test(e));
  if (real.length) { console.log('  errors:', real.slice(0, 5)); fail++; }
  console.log(fail ? `\n${fail} problems` : '\nnetwork switching intact');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
