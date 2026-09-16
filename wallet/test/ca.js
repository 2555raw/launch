/* The contract address chip, and the mark next to it.
 *
 * Ward's own coin does not exist yet, so the chip on the landing page reads
 * PENDING and the mark beside it goes nowhere. Both are switched on later by
 * putting values in two attributes on #caBar and changing nothing else, which
 * is only a good idea if the switched-off state is genuinely inert: a chip
 * that copies an empty string, or a mark that links to nowhere, is worse than
 * an obvious placeholder.
 *
 * So this opens the page twice. Once as it ships, and once with the attributes
 * filled, which is done by rewriting the HTML on its way to the browser rather
 * than from a script: landing.js reads them as it starts, and anything that
 * sets them afterwards tests the wrong thing.
 *
 *   PORT=8099 npm start
 *   node test/ca.js
 */
const { chromium } = require('playwright');
const SITE = process.env.SITE_URL || 'http://127.0.0.1:8099/';
const ADDR = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const XURL = 'https://x.com/wardwallet';

(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  let fail = 0;

  async function open(fill) {
    const ctx = await b.newContext({ colorScheme: 'dark', viewport: { width: 1180, height: 900 },
                                     permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    page.on('pageerror', e => { console.log('   PAGEERROR ' + e.message); fail++; });
    if (fill) {
      await page.route('**/', async route => {
        const r = await route.fetch();
        const html = (await r.text())
          .replace('data-ca=""', 'data-ca="' + ADDR + '"')
          .replace('data-x=""', 'data-x="' + XURL + '"');
        await route.fulfill({ response: r, body: html, headers: { ...r.headers(), 'content-length': undefined } });
      });
    }
    await page.goto(SITE, { waitUntil: 'networkidle' });
    await page.evaluate(() => { const c = document.querySelector('.consent'); if (c) c.remove(); });
    return { ctx, page };
  }

  /* As it ships. */
  console.log('1. before there is a coin');
  {
    const { ctx, page } = await open(false);
    const st = await page.evaluate(() => ({
      text: document.querySelector('#caVal').textContent.trim(),
      off: document.querySelector('#caChip').disabled,
      href: document.querySelector('#caX').getAttribute('href'),
      tab: document.querySelector('#caX').getAttribute('tabindex'),
      linked: [...document.querySelectorAll('.soc.x')].filter(a => a.hasAttribute('href')).length
    }));
    console.log('  ', JSON.stringify(st));
    if (!/pending/i.test(st.text)) { console.log('   ✗ the chip does not read PENDING'); fail++; }
    if (!st.off) { console.log('   ✗ the chip is clickable with nothing to copy'); fail++; }
    if (st.href) { console.log('   ✗ the mark links somewhere already'); fail++; }
    if (st.linked) { console.log('   ✗ ' + st.linked + ' mark(s) link somewhere already'); fail++; }
    if (st.tab !== '-1') { console.log('   ✗ the dead mark is still in the tab order'); fail++; }
    else console.log('   ✓ inert, and says so');
    await ctx.close();
  }

  /* And once the two attributes are filled in. */
  console.log('2. once the coin exists');
  {
    const { ctx, page } = await open(true);
    const st = await page.evaluate(XURL => ({
      text: document.querySelector('#caVal').textContent.trim(),
      off: document.querySelector('#caChip').disabled,
      title: document.querySelector('#caChip').title,
      href: document.querySelector('#caX').getAttribute('href'),
      rel: document.querySelector('#caX').getAttribute('rel'),
      tab: document.querySelector('#caX').getAttribute('tabindex'),
      marks: [...document.querySelectorAll('.soc.x')].length,
      linked: [...document.querySelectorAll('.soc.x')].filter(a => a.href === XURL).length
    }), XURL);
    console.log('  ', JSON.stringify(st));
    if (st.off) { console.log('   ✗ the chip is still dead'); fail++; }
    if (!/^0x7eD5/.test(st.text) || !/EC7e$/.test(st.text)) {
      console.log('   ✗ the chip does not show the shortened address'); fail++;
    }
    if (st.title !== ADDR) { console.log('   ✗ the whole address is not on the chip'); fail++; }
    if (st.href !== XURL) { console.log('   ✗ the mark does not link to the account'); fail++; }
    if (!/noopener/.test(st.rel || '')) { console.log('   ✗ the link opens without noopener'); fail++; }
    if (st.tab === '-1') { console.log('   ✗ a live link is still out of the tab order'); fail++; }
    if (st.linked !== st.marks) {
      console.log('   ✗ only ' + st.linked + ' of ' + st.marks + ' marks link anywhere'); fail++;
    }

    /* Copying is the only thing the chip is for. */
    await page.click('#caChip');
    await page.waitForTimeout(250);
    const said = await page.$eval('#caVal', n => n.textContent.trim());
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    console.log('   after a click: chip says', JSON.stringify(said), '| clipboard', JSON.stringify(clip));
    if (clip !== ADDR) { console.log('   ✗ the address did not reach the clipboard'); fail++; }
    if (!/copi/i.test(said)) { console.log('   ✗ the chip did not say it copied'); fail++; }

    await page.waitForTimeout(1500);
    const back = await page.$eval('#caVal', n => n.textContent.trim());
    if (!/^0x7eD5/.test(back)) { console.log('   ✗ it never went back to the address'); fail++; }
    else console.log('   ✓ copies, says so, and goes back');
    await ctx.close();
  }

  /* The bar has to hold it at every width, not at the three anyone thinks to
     look at. Moving the chip into the bar broke four widths that no phone and
     no laptop happens to be: the band just above where the bar compacts, and
     the one where the links capsule joins the row. Both were found by
     measuring the row rather than by looking at it, so the measuring is the
     part worth keeping. */
  console.log('3. the bar holds it at every width');
  for (const fill of [true, false]) {
    const { ctx, page } = await open(fill);
    const bad = [];
    for (let w = 320; w <= 1460; w += 10) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(60);
      const r = await page.evaluate(() => {
        const n = document.querySelector('.nav-in');
        const cta = document.querySelector('.nav .cta.sm');
        return {
          nav: n.scrollWidth - n.clientWidth,
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          cta: Math.round(cta.getBoundingClientRect().width),
          ca: Math.round(document.querySelector('#caBar').getBoundingClientRect().width)
        };
      });
      /* Spilling off the row is the obvious failure. A call to action squeezed
         down to its first letter, or an address too narrow to read, is the one
         that looks fine in a screenshot taken at some other width. */
      if (r.nav > 0 || r.page > 0) bad.push(w + 'px spills ' + Math.max(r.nav, r.page));
      else if (r.cta < 60) bad.push(w + 'px crushes the button to ' + r.cta);
      else if (r.ca < 70) bad.push(w + 'px crushes the address to ' + r.ca);
    }
    if (bad.length) {
      console.log('   ✗ ' + (fill ? 'with an address' : 'pending') + ', ' + bad.length + ' widths:');
      bad.slice(0, 6).forEach(x => console.log('       ' + x));
      fail++;
    } else console.log('   ✓ ' + (fill ? 'with an address' : 'pending') + ': 320 to 1460, nothing spills or is crushed');
    await ctx.close();
  }

  console.log(fail ? `\nFAIL (${fail})` : '\nPASS');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
