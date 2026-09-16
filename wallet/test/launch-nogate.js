/* Launching a coin must not ask for an account.
 *
 * A wallet with a password had, until now, one door: the unlock screen. It
 * went up before anything else on a later visit, including for someone who
 * had clicked "Launchpad" and never wanted an account in the first place. The
 * card needs one. Launching does not: Phantom can sign on Solana without Ward
 * holding a key at all.
 *
 * So this makes a wallet with a password, reloads onto #/launch the way the
 * landing page sends someone, and checks that the launch screen is what comes
 * up, that it explains the closed wallet rather than demanding the password,
 * and that the password screen is still one tap away for whoever wants it.
 *
 * It also checks the consent checkbox is gone, since the button used to hang
 * on it and a leftover reference would shut the form for everyone.
 *
 * Needs the wallet being served:  PORT=8111 npm start
 *
 *   node test/launch-nogate.js
 */
const APP = process.env.APP_URL || 'http://127.0.0.1:8111/app';
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await b.newContext({ viewport: { width: 430, height: 940 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  /* Balance and launchpad reads fail here: this machine has no route to any
     node. That is the network, not the page, and it is not what this is
     testing. */
  const offline = t => /ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|Failed to fetch/i.test(t);
  page.on('console', m => { if (m.type() === 'error' && !offline(m.text())) errs.push(m.text()); });
  let fail = 0;
  const on = v => page.$eval(`[data-view="${v}"]`, n => n.classList.contains('on'));
  const shown = id => page.$eval(id, n => !n.hidden && n.offsetParent !== null);

  await page.goto(APP, { waitUntil: 'networkidle' });

  /* A wallet with a password, made the long way, because that is the one that
     used to put an unlock screen in front of the launchpad. */
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
  console.log('  ▸ wallet with a password created');

  /* Coming back later, the way the landing page's Launchpad button arrives. */
  /* Away first, then in on the fragment. Going straight from one #/launch to
     another never reloads the document, and it is boot() that this is about;
     a plain reload would not do either, because the app clears the fragment
     out of the address bar once it has read it. */
  await page.goto('about:blank');
  await page.goto(APP + '#/launch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  console.log('1. where #/launch lands');
  if (await on('unlock')) { console.log('   ✗ still the password screen'); fail++; }
  if (!(await on('launch'))) { console.log('   ✗ not the launch screen'); fail++; }
  else console.log('   ✓ the launch screen, with no password asked');

  console.log('2. what it says about the closed wallet');
  if (!(await shown('#launchLocked'))) { console.log('   ✗ no note about the wallet being closed'); fail++; }
  else {
    const t = await page.$eval('#launchLocked', n => n.textContent);
    if (!/Phantom/.test(t)) { console.log('   ✗ it does not mention signing with Phantom'); fail++; }
    else console.log('   ✓ it offers Phantom and offers to open the wallet');
  }
  if (await shown('#launchNoWallet')) {
    console.log('   ✗ it also offers to make a second wallet over the top of this one'); fail++;
  }

  console.log('3. the password is still there for whoever wants it');
  await page.click('#launchUnlock');
  await page.waitForTimeout(300);
  if (!(await on('unlock'))) { console.log('   ✗ "Open my wallet" did not go to the password screen'); fail++; }
  else console.log('   ✓ one tap away');

  await page.fill('#unlockPw', 'Ward-2026!ok');
  await page.click('#doUnlock');
  await page.waitForTimeout(1500);
  if (!(await on('launch'))) { console.log('   ✗ opening it did not come back to the launchpad'); fail++; }
  else console.log('   ✓ and it comes back to the launchpad afterwards');

  console.log('4. nothing left of the consent checkbox');
  if (await page.$('#lcAgree')) { console.log('   ✗ #lcAgree is still in the page'); fail++; }
  else console.log('   ✓ gone');

  if (errs.length) { console.log('\n  console errors:'); errs.forEach(e => console.log('   ' + e)); fail += errs.length; }
  console.log(fail ? `\nFAIL (${fail})` : '\nPASS');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
