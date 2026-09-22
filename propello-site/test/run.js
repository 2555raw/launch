#!/usr/bin/env node
/* ===========================================================================
   The site's tests: the Rolls verify, the pages load clean at two widths,
   every link resolves, the calculator, the FAQ, the chart, the city view, the
   gate and the sandbox behave, and the figures on the page agree with the Rolls.

     npm test                 (needs Chromium: set CHROME to its binary, or
                               have playwright-core find it)
   =========================================================================== */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const serve = require('./server');
const root = path.join(__dirname, '..');
const out = [];
const ok = (n, c, d) => out.push((c ? 'PASS' : 'FAIL') + '  ' + n + (d ? '  — ' + d : ''));

(async () => {
  /* 1. the data pipeline */
  try { execFileSync('node', [path.join(root, 'scripts', 'recompute.js'), '--check'], { stdio: 'pipe' }); ok('rolls: every Roll verifies (hash, chain, price, shares)', true); }
  catch (e) { ok('rolls: every Roll verifies', false, String(e.stderr || e.message).trim().split('\n').slice(-3).join(' | ')); }
  try { execFileSync('node', [path.join(root, 'scripts', 'translate.js'), '--lang', 'zh', '--check'], { stdio: 'pipe' }); ok('i18n: the Chinese pages have no untranslated text', true); }
  catch (e) { ok('i18n: the Chinese pages have no untranslated text', false, String(e.stderr || e.message).trim().split('\n').filter(l => l.includes('?')).slice(0, 3).join(' | ')); }
  const V = require(path.join(root, 'data', 'vault.json'));

  const { chromium } = require('playwright-core');
  const server = await serve(0);
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const exe = process.env.CHROME || undefined;
  const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});

  for (const [file, w] of [['index.html', 1440], ['docs.html', 1440], ['sandbox.html', 1440], ['zh/index.html', 1440], ['zh/docs.html', 1440], ['zh/sandbox.html', 1440], ['index.html', 390], ['docs.html', 390], ['sandbox.html', 390], ['zh/index.html', 390]]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
    const errs = [], failed = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('requestfailed', r => failed.push(r.url()));
    await p.goto(base + file, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    ok(`${file}@${w}: no JS/console errors`, errs.length === 0, errs.join(' | '));
    ok(`${file}@${w}: no failed requests`, failed.length === 0, failed.join(' | '));
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(`${file}@${w}: no horizontal overflow`, sw <= w, 'scrollWidth ' + sw);
    /* overflow-x: hidden hides a spill from scrollWidth, so measure the nav and
       the headline against the viewport directly */
    const spill = await p.evaluate(() => [...document.querySelectorAll('.rt-nav *, .rt-display, .rt-h2')]
      .filter(e => e.getBoundingClientRect().width && e.getBoundingClientRect().right > innerWidth - 1)
      .map(e => e.tagName.toLowerCase() + '.' + ((e.className.baseVal !== undefined ? e.className.baseVal : e.className) || '').split(' ')[0]));
    ok(`${file}@${w}: nav and headlines stay inside the viewport`, spill.length === 0, [...new Set(spill)].join(' '));
    const dead = await p.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.querySelector(h)));
    ok(`${file}@${w}: every #anchor resolves`, dead.length === 0, [...new Set(dead)].join(' '));
    const heads = await p.evaluate(() => { const h = [...document.querySelectorAll('h1,h2,h3')].map(x => +x.tagName[1]); const j = []; for (let i = 1; i < h.length; i++) if (h[i] - h[i - 1] > 1) j.push(h[i - 1] + '→' + h[i]); return j; });
    ok(`${file}@${w}: heading outline has no jumps`, heads.length === 0, heads.join(','));
    if (w === 1440) {
      const x = await p.evaluate(() => [...document.querySelectorAll('a[href*=".html#"]')].map(a => a.getAttribute('href')));
      for (const h of [...new Set(x)]) { const [f, id] = h.split('#'); const q = await b.newPage(); await q.goto(new URL(f, base + file).href); const has = await q.evaluate(i => !!document.getElementById(i), id); await q.close(); ok(`${file}: link ${h} resolves`, has); }
      const fonts = await p.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family));
      ok(`${file}: self-hosted fonts loaded`, fonts.includes('Space Grotesk') && fonts.includes('JetBrains Mono'), [...new Set(fonts)].join(', '));
      ok(`${file}: no third-party requests`, !(await p.evaluate(() => performance.getEntriesByType('resource').some(r => !r.name.startsWith(location.origin)))));
    }
    await p.close();
  }

  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  await p.click('#navlinks a[data-spy="portfolio"]'); await p.waitForTimeout(800);
  const top = await p.evaluate(() => Math.round(document.getElementById('map').getBoundingClientRect().top));
  ok('Portfolio in the nav lands on the map', top >= 60 && top <= 90, 'map top at ' + top + 'px');
  const pins = await p.$$eval('#map .rt-pin', n => n.map(e => e.dataset.city));
  ok('a pin for every city on the big map except Terrassa', pins.length === V.cityCount - 1, pins.join(', '));
  await p.hover('#portfolio tr[data-city="Terrassa"]'); await p.waitForTimeout(200);
  ok('hovering Terrassa lights Barcelona pin and Spain', await p.evaluate(() => document.querySelector('#map .rt-pin[data-city="Barcelona"]').classList.contains('is-on') && document.querySelector('#map .rt-c[data-country="Spain"]').classList.contains('is-on')));
  await p.mouse.move(0, 0);

  /* the figures agree with the Rolls */
  const kept = await p.$$eval('#portfolio tbody td.rt-pos', n => n.reduce((s, e) => s + parseInt(e.textContent.replace(/[€,]/g, '')), 0));
  ok('building rents on the page sum to the Rolls’ kept figure', kept === V.keptLast, '€' + kept.toLocaleString('en-GB'));
  const held = await p.$$eval('#portfolio tbody td:nth-child(5)', n => n.reduce((s, e) => s + parseInt(e.textContent.replace(/[€,]/g, '')), 0));
  ok('building values sum to what the vault carries', held === V.buildingsAtCost, '€' + held.toLocaleString('en-GB'));
  const units = await p.$$eval('#portfolio tbody td:nth-child(3)', n => n.reduce((s, e) => s + parseInt(e.textContent), 0));
  ok('apartments sum to the stat tile', units === V.units, units);
  const roll = await p.$$eval('#roll tbody tr', n => n.map(r => [...r.children].map(c => c.textContent)));
  ok('The Roll table has one row per close', roll.length === V.closes.length);
  ok('The Roll’s last close matches the data', roll[roll.length - 1][4] === '€' + V.price.toFixed(4) && roll[roll.length - 1][3] === '€' + V.keptLast.toLocaleString('en-GB'), roll[roll.length - 1].join(' | '));
  ok('hero quotes the share price', (await p.textContent('.rt-hero-note')).includes('€' + V.price.toFixed(4)));

  /* calculator */
  await p.click('.rt-chip[data-amt="50000"]'); await p.waitForTimeout(150);
  const w50 = await p.textContent('#o-worth'); ok('calculator: 50,000 → price × 50,000', w50 === '€' + (50000 * V.price).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), w50);
  await p.fill('#amount', '999999'); await p.dispatchEvent('#amount', 'blur'); await p.waitForTimeout(150);
  ok('calculator clamps at 100,000', (await p.inputValue('#amount')) === '100,000');
  await p.fill('#amount', '5'); await p.dispatchEvent('#amount', 'blur'); await p.waitForTimeout(150);
  ok('calculator floors at 100', (await p.inputValue('#amount')) === '100');

  /* faq, chart */
  await p.click('#faqlist .rt-q:nth-child(3) button'); await p.waitForTimeout(400);
  ok('FAQ opens and marks aria-expanded', await p.evaluate(() => document.querySelector('#faqlist .rt-q:nth-child(3) button').getAttribute('aria-expanded') === 'true'));
  await p.click('#faqlist .rt-q:nth-child(5) button'); await p.waitForTimeout(400);
  ok('FAQ keeps one item open', (await p.$$eval('#faqlist .rt-q.is-open', n => n.length)) === 1);
  await p.hover('.rt-dot-hit[data-i="3"]'); await p.waitForTimeout(200);
  const c3 = V.closes[2];
  const tip = await p.textContent('#tip'); ok('chart tooltip quotes the third close', tip.includes(c3.date) && tip.includes(c3.price.toFixed(4)) && tip.includes(c3.kept.toLocaleString('en-GB')), tip.replace(/\s+/g, ' '));

  /* city view */
  await p.click('#map .rt-pin[data-city="Barcelona"]'); await p.waitForTimeout(500);
  ok('clicking a pin opens the city view', await p.evaluate(() => !document.getElementById('cityview').hidden && document.getElementById('city-title').textContent === 'Barcelona'));
  ok('city view lists districts and the building', await p.evaluate(() => document.querySelectorAll('#city-map .rt-dist').length > 10 && document.querySelectorAll('#city-map .rt-pin--city').length === 1 && document.querySelectorAll('#city-side .rt-bcard').length === 1));
  const olla = V.buildings.find(b => b.id === 'olla');
  ok('the building’s district is lit', await p.evaluate(d => !!document.querySelector('#city-map .rt-dist--own[data-district="' + d + '"]'), olla.district), olla.district);
  await p.click('[data-open-city="Terrassa"]'); await p.waitForTimeout(400);
  ok('Barcelona links to Terrassa', await p.evaluate(() => document.getElementById('city-title').textContent === 'Terrassa'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok('Escape closes the city view', await p.evaluate(() => document.getElementById('cityview').hidden));
  await p.click('#portfolio tr[data-city="Rotterdam"]'); await p.waitForTimeout(500);
  ok('clicking a building row opens its city with both buildings', await p.evaluate(() => document.getElementById('city-title').textContent === 'Rotterdam' && document.querySelectorAll('#city-side .rt-bcard').length === 2));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);

  /* the gate */
  await p.evaluate(() => localStorage.removeItem('propello.eligible.v1'));
  await p.click('.rt-hero [data-connect]'); await p.waitForTimeout(400);
  ok('Connect wallet opens the eligibility gate first', await p.evaluate(() => !document.getElementById('gate').hidden));
  ok('Continue is disabled until every box is ticked', await p.evaluate(() => document.getElementById('gate-continue').disabled));
  for (const i of await p.$$('#gate input[type=checkbox]')) await i.check();
  ok('Continue enables once all boxes are ticked', await p.evaluate(() => !document.getElementById('gate-continue').disabled));
  await p.click('#gate-continue'); await p.waitForTimeout(600);
  ok('without a wallet installed the page says so', (await p.textContent('#toast')).includes('No wallet found'));
  ok('the answer is remembered', await p.evaluate(() => localStorage.getItem('propello.eligible.v1') === 'yes'));
  ok('map pins are keyboard focusable', await p.$$eval('#map .rt-pin', n => n.every(e => e.getAttribute('tabindex') === '0' && e.getAttribute('role') === 'button')));

  /* the sandbox: the contract's rules, in the browser, in localStorage here
     (no claude.ai store in a bare Chromium), for a guest called Marta */
  const s = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await s.goto(base + 'sandbox.html', { waitUntil: 'networkidle' }); await s.waitForTimeout(300);
  const st = async q => (await s.textContent(q)).trim();
  const money = t => parseFloat(t.replace(/[€,\s]/g, ''));
  ok('sandbox: says the vault is this browser\u2019s when no shared store exists', (await st('#sb-mode')).startsWith('This browser only'));
  ok('sandbox: starts where the Rolls end', (await st('#sb-price')) === '€' + V.price.toFixed(4) && money(await st('#sb-supply')) === V.sharesInIssue && money(await st('#sb-reserve')) === V.reserve);
  ok('sandbox: actions wait for a name', await s.$$eval('[data-needs-me]', n => n.every(b => b.disabled)));
  await s.click('#sb-guest'); await s.waitForTimeout(150);
  ok('sandbox: guest needs a name', (await st('#toast')) === 'Pick a name first.');
  await s.fill('#sb-name', 'Marta'); await s.press('#sb-name', 'Enter'); await s.waitForTimeout(150);
  ok('sandbox: a named guest is in', (await st('#sb-me-name')) === 'Marta' && await s.$$eval('[data-needs-me]', n => n.every(b => !b.disabled)));
  await s.click('#sb-tap'); await s.waitForTimeout(150);
  ok('sandbox: the tap gives €25,000', money(await st('#sb-eurg')) === 25000);
  await s.fill('#sb-dep-amt', '20000'); await s.click('#sb-deposit'); await s.waitForTimeout(150);
  const sh = money(await st('#sb-shares'));
  ok('sandbox: a deposit mints at the share price', Math.abs(sh - 20000 / V.price) < 0.01 && money(await st('#sb-eurg')) === 5000, sh);
  ok('sandbox: the curve is 3% on the day of a deposit', (await st('#sb-curve')) === '3%');
  await s.fill('#sb-red-amt', ''); await s.dispatchEvent('#sb-red-amt', 'input');
  ok('sandbox: redeeming everything now would leave 3% behind', (await st('#sb-red-preview')).includes('€19,400.00') && (await st('#sb-red-preview')).includes('€600.00'));
  const forecast = await st('#sb-close-preview');
  await s.click('#sb-close'); await s.waitForTimeout(150);
  const pAfter = money(await st('#sb-price'));
  ok('sandbox: a close moves the price to the forecast', forecast.includes('€' + pAfter.toFixed(4)) && pAfter > V.price, forecast);
  ok('sandbox: a close takes the curve down a step', (await st('#sb-curve')) === '2%');
  ok('sandbox: the close is on the table, marked as the sandbox\u2019s', (await s.$$eval('#sb-closes tbody tr', r => r.length)) === V.closes.length + 1 && (await st('#sb-closes tbody tr:first-child td:last-child')).startsWith('sandbox'));
  await s.fill('#sb-red-amt', '5000'); await s.click('#sb-redeem'); await s.waitForTimeout(150);
  const red = (await st('#toast')).match(/€([\d,.]+) paid out, €([\d,.]+) curve/);
  const net = red ? money(red[1]) : 0, tax = red ? money(red[2]) : 0;
  ok('sandbox: a redemption pays price × shares less a 2% curve', red && Math.abs(tax - 0.02 * (net + tax)) < 0.01 && Math.abs(net + tax - 5000 * pAfter) < 0.3 && Math.abs(money(await st('#sb-eurg')) - (5000 + net)) < 0.02 && Math.abs(money(await st('#sb-shares')) - (sh - 5000)) < 0.01, await st('#toast'));
  ok('sandbox: the ledger tells the story', (await s.$$eval('#sb-ledger li', n => n.map(e => e.querySelector('.rt-sb-kind').textContent))).join(',') === 'Redeem,Close,Deposit,Tap');
  await s.reload({ waitUntil: 'networkidle' }); await s.waitForTimeout(300);
  ok('sandbox: the vault and the guest survive a reload', (await st('#sb-me-name')) === 'Marta' && money(await st('#sb-price')) === pAfter);
  await s.click('#sb-nav-wallet'); await s.waitForTimeout(150);
  ok('sandbox: without a wallet installed the page says so', (await st('#toast')).startsWith('No wallet found'));
  await s.close();

  /* linking a wallet, with two fakes standing in for the extensions: one
     MetaMask-shaped (EIP-6963, an Ethereum provider) and one Phantom-shaped
     (a Solana provider). Neither touches a network. */
  const FAKE = `(() => {
    const ACC = '0x8C2f1a4B77aE9b3c51D0e7F6a2B9c4D5E6f70819';
    const mm = { isMetaMask: true, _allowed: sessionStorage.getItem('mm.ok') === '1', on: () => {},
      request: async ({ method }) => {
        if (method === 'eth_requestAccounts') { mm._allowed = true; sessionStorage.setItem('mm.ok','1'); return [ACC]; }
        if (method === 'eth_accounts') return mm._allowed ? [ACC] : [];
        if (method === 'eth_chainId') return '0x2105';
        if (method === 'eth_getBalance') return '0x16345785d8a0000';
        if (method === 'personal_sign') return '0x' + 'ab'.repeat(65);
        if (method === 'wallet_switchEthereumChain') return null;
        throw new Error('unhandled ' + method);
      } };
    const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
      detail: Object.freeze({ info: { uuid: 'u1', name: 'MetaMask', rdns: 'io.metamask' }, provider: mm }) }));
    window.addEventListener('eip6963:requestProvider', announce); announce();
    window.ethereum = mm;
    const PK = '7Yb3Kq1sE9nF2vXpL4mR8tZcW6hJdA5gQ3uN1yS0bTxV';
    const sol = { isPhantom: true, _trusted: sessionStorage.getItem('ph.ok') === '1', publicKey: null, on: () => {},
      connect: async (o) => { if (o && o.onlyIfTrusted && !sol._trusted) throw new Error('untrusted');
        sol._trusted = true; sessionStorage.setItem('ph.ok','1');
        sol.publicKey = { toString: () => PK }; return { publicKey: sol.publicKey }; },
      disconnect: async () => { sol.publicKey = null; },
      signMessage: async () => ({ signature: new Uint8Array([1,2,3,4,5,6,7,8]) }) };
    window.phantom = { solana: sol };
  })();`;

  const wctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await wctx.addInitScript(FAKE);
  const w = await wctx.newPage();
  const werr = [];
  w.on('pageerror', e => werr.push(e.message));
  await w.goto(base, { waitUntil: 'networkidle' });
  await w.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await w.reload({ waitUntil: 'networkidle' }); await w.waitForTimeout(300);
  await w.click('.rt-hero [data-connect]'); await w.waitForTimeout(300);
  for (const i of await w.$$('#gate input[type=checkbox]')) await i.check();
  await w.click('#gate-continue'); await w.waitForTimeout(600);
  const offered = await w.$$eval('.rt-wp-pick', n => n.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  ok('wallet: both wallets are offered when both are installed', offered.length === 2 && offered.join(' ').includes('MetaMask') && offered.join(' ').includes('Phantom'), offered.join(' | '));
  await w.click('.rt-wp-pick:has-text("MetaMask")'); await w.waitForTimeout(500);
  ok('wallet: MetaMask links and the panel reads the chain and balance',
     (await w.textContent('.rt-nav [data-connect]')).includes('0x8C2f') && (await w.textContent('#walletpanel')).includes('Base') && (await w.textContent('#walletpanel')).includes('0.1000'));
  ok('wallet: an unsigned address is marked unverified', (await w.textContent('.rt-wp-tag')).trim() === 'Not verified');
  await w.click('[data-sign]'); await w.waitForTimeout(400);
  ok('wallet: signing verifies the address', (await w.textContent('.rt-wp-tag')).trim() === 'Verified');
  await w.reload({ waitUntil: 'networkidle' }); await w.waitForTimeout(900);
  ok('wallet: the link survives a reload without a prompt', (await w.textContent('.rt-nav [data-connect]')).includes('0x8C2f'));
  await w.click('.rt-nav [data-connect]'); await w.waitForTimeout(200);
  await w.click('[data-disconnect]'); await w.waitForTimeout(300);
  ok('wallet: disconnect forgets the address', (await w.textContent('.rt-nav [data-connect]')).trim() === 'Connect wallet');
  await w.click('.rt-hero [data-connect]'); await w.waitForTimeout(400);
  await w.click('.rt-wp-pick:has-text("Phantom")'); await w.waitForTimeout(500);
  const sol = await w.textContent('#walletpanel');
  ok('wallet: Phantom links on Solana and says the share lives on Base', sol.includes('Solana') && sol.includes('cannot hold'));
  await w.click('[data-sign]'); await w.waitForTimeout(400);
  ok('wallet: Phantom signs a message to verify', (await w.textContent('.rt-wp-tag')).trim() === 'Verified');
  await w.reload({ waitUntil: 'networkidle' }); await w.waitForTimeout(900);
  ok('wallet: the Solana link comes back too', (await w.textContent('.rt-nav [data-connect]')).includes('7Yb3'));
  ok('wallet: no JS errors through the whole flow', werr.length === 0, werr.join(' | '));
  await wctx.close();

  const d = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await d.goto(base + 'docs.html', { waitUntil: 'networkidle' }); await d.waitForTimeout(300);
  await d.evaluate(() => document.getElementById('fees').scrollIntoView({ block: 'start' })); await d.waitForTimeout(400);
  ok('docs sidebar follows the heading', await d.evaluate(() => document.querySelector('#side a.is-active').getAttribute('href') === '#fees'));
  ok('docs list every Roll with its hash', (await d.$$eval('.rt-kv--hashes tr', n => n.length)) === V.closes.length);
  const hashOnPage = await d.$$eval('.rt-kv--hashes code', n => n.map(e => e.textContent));
  ok('the hashes on the docs page are the registry’s', hashOnPage.every((h, i) => h === V.closes[i].hash));

  await b.close(); server.close();
  console.log(out.join('\n'));
  const fails = out.filter(l => l.startsWith('FAIL')).length;
  console.log('\n' + (out.length - fails) + ' pass, ' + fails + ' fail');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
