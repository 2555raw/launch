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
/* The account the page ships pointing at. Read from the page rather than
   written here would test nothing: the point is that this address is the one
   that arrives in the mark. */
const XURL = 'https://x.com/useGwardpad';

(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  let fail = 0;

  async function open(fill, lang) {
    const ctx = await b.newContext({ colorScheme: 'dark', viewport: { width: 1180, height: 900 },
                                     permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    page.on('pageerror', e => { console.log('   PAGEERROR ' + e.message); fail++; });
    /* Two states off the same page. Filled is what it looks like once there is
       a coin; bare is the inert state, which the page no longer ships now that
       the account exists, so the attribute is emptied on the way through to
       keep that branch covered. */
    await page.route('**/', async route => {
      const r = await route.fetch();
      const html = fill
        ? (await r.text()).replace('data-ca=""', 'data-ca="' + ADDR + '"')
        : (await r.text()).replace(/data-x="[^"]*"/, 'data-x=""');
      await route.fulfill({ response: r, body: html, headers: { ...r.headers(), 'content-length': undefined } });
    });
    /* The language is stored, so it takes a second visit to take effect: the
       first load is what puts it there. */
    if (lang && lang !== 'en') {
      await page.goto(SITE, { waitUntil: 'domcontentloaded' });
      await page.evaluate(l => localStorage.setItem('ward.v1.lang', l), lang);
    }
    await page.goto(SITE, { waitUntil: 'networkidle' });
    if (lang && lang !== 'en') await page.waitForTimeout(700);
    await page.evaluate(() => { const c = document.querySelector('.consent'); if (c) c.remove(); });
    return { ctx, page };
  }

  /* What the page actually ships: no coin yet, but the account exists. */
  console.log('0. as it ships');
  {
    const { ctx, page } = await open(true);
    const st = await page.evaluate(() => ({
      marks: [...document.querySelectorAll('.soc.x')].map(a => a.getAttribute('href'))
    }));
    const wrong = st.marks.filter(h => h !== XURL);
    if (!st.marks.length) { console.log('   ✗ no X mark on the page at all'); fail++; }
    else if (wrong.length) { console.log('   ✗ a mark points at ' + wrong[0]); fail++; }
    else console.log('   ✓ ' + st.marks.length + ' marks, both to ' + XURL);
    await ctx.close();
  }

  /* With nothing filled in at all. */
  console.log('1. with neither a coin nor an account');
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
    if (st.href) { console.log('   ✗ the mark links somewhere with an empty attribute'); fail++; }
    if (st.linked) { console.log('   ✗ ' + st.linked + ' mark(s) link with an empty attribute'); fail++; }
    if (st.tab !== '-1') { console.log('   ✗ the dead mark is still in the tab order'); fail++; }
    else console.log('   ✓ inert, and says so');
    await ctx.close();
  }

  /* And once the two attributes are filled in. */
  console.log('2. once the coin exists too');
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

  /* The bar has to hold it at every width, in every language, not at the three
     anyone thinks to look at in the one they read. Putting the address in the
     links capsule broke nine widths that no phone and no laptop happens to be,
     and four of those only in Portuguese, whose links are the longest. None of
     it was visible in a screenshot; all of it came out of measuring the row.
     So the measuring is the part worth keeping.
     The languages are the ones that actually broke while this was being fitted,
     plus the baseline. Portuguese, French and Vietnamese have the longest
     links; Russian and Japanese the longest call to action. English is here
     because it is the baseline, not because it is the risk: it was clean at
     four of the widths the others failed on. */
  console.log('3. the bar holds it at every width, in the widest languages');
  for (const lang of ['en', 'vi', 'pt', 'ru', 'fr', 'ja']) {
    for (const fill of [true, false]) {
      const { ctx, page } = await open(fill, lang);
      const bad = [];
      for (let w = 320; w <= 1460; w += 20) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(55);
        const r = await page.evaluate(() => {
          const n = document.querySelector('.nav-in'), pill = document.querySelector('.nav-pill');
          const cta = document.querySelector('.nav .cta.sm');
          const links = [...pill.querySelectorAll(':scope > a')]
            .filter(a => getComputedStyle(a).display !== 'none');
          return {
            nav: n.scrollWidth - n.clientWidth,
            page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            pill: pill.scrollWidth - pill.clientWidth,
            rows: new Set(links.map(a => Math.round(a.getBoundingClientRect().top))).size,
            cta: cta.scrollWidth - cta.clientWidth,
            ca: (c => c.scrollWidth - c.clientWidth)(document.querySelector('#caChip'))
          };
        });
        /* Spilling off the row is the obvious failure. Links on two lines, or
           a label clipped inside its own button, are the ones that look fine
           in a screenshot taken at some other width. Clipping rather than a
           width in pixels, because "Open wallet" is "Mở ví" in Vietnamese and a
           button that is narrow because its word is short is not a bug. */
        const spill = Math.max(r.nav, r.page, r.pill);
        if (spill > 0) bad.push(w + 'px spills ' + spill);
        else if (r.rows > 1) bad.push(w + 'px puts the links on ' + r.rows + ' rows');
        else if (r.cta > 0) bad.push(w + 'px clips the button by ' + r.cta);
        else if (r.ca > 0) bad.push(w + 'px clips the address by ' + r.ca);
      }
      const what = lang + ', ' + (fill ? 'with an address' : 'pending');
      if (bad.length) {
        console.log('   ✗ ' + what + ', ' + bad.length + ' widths:');
        bad.slice(0, 5).forEach(x => console.log('       ' + x));
        fail++;
      } else console.log('   ✓ ' + what + ': 320 to 1460 clean');
      await ctx.close();
    }
  }

  console.log(fail ? `\nFAIL (${fail})` : '\nPASS');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
