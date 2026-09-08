/**
 * Checks every interaction in the flat snapshot.
 *
 *   npm run snapshot
 *   python3 scripts/assemble-snapshot.py payence.html
 *   node scripts/check-snapshot.js .              # the directory holding payence.html
 *
 * The snapshot's behaviour is a hand-written port of the components, so a
 * component can gain a control the port never learns about — or, as happened
 * once, an edit to the port can silently delete whole blocks of it. Every
 * result below should be true, a real value, and `errors` empty.
 *
 * Needs playwright-core and a Chromium binary; set CHROMIUM to override the path.
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const out = process.argv[2], errs = [], R = {};
  const inner = fs.readFileSync(require('path').join(out, 'payence.html'), 'utf8');
  const wrap = h => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style></head><body>${h}</body></html>`;
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.on('pageerror', e => errs.push('ERR ' + e.message.slice(0, 140)));
  await p.setContent(wrap(inner), { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);

  // 1. the notice greets you; the gate does not
  R.cookieAtLoadSeen = await p.locator('[data-cookie-notice]').isVisible();
  R.gateAtLoad = await p.locator('[data-terms-gate]').isVisible();
  await p.click('[data-cookie-allow]'); await p.waitForTimeout(150);
  await p.evaluate(() => window.scrollTo(0, 800));
  await p.waitForTimeout(600);
  R.gateOnScroll = await p.locator('[data-terms-gate]').isVisible();
  await p.click('[data-terms-decline]'); await p.waitForTimeout(250);
  R.declineBlocks = await p.locator('[data-terms-blocked]').isVisible();
  await p.click('[data-terms-review]'); await p.waitForTimeout(200);
  await p.click('[data-terms-accept]'); await p.waitForTimeout(300);
  R.acceptReleases = !(await p.locator('[data-terms-gate]').isVisible())
    && (await p.evaluate(() => getComputedStyle(document.body).overflow)) === 'visible';

  // 1b. the cookie notice, bottom-left on arrival
  R.cookieAtLoad = R.cookieAtLoadSeen;
  R.cookieDismisses = !(await p.locator('[data-cookie-notice]').isVisible());

  // 2. terminal
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
  await p.waitForTimeout(3600);
  R.terminalLines = await p.locator('[data-term-line]:visible').count();

  // 3. hero words + countup
  R.heroWords = await p.locator('[data-hero-word]').count();
  await p.locator('[data-countup="41280"]').scrollIntoViewIfNeeded(); await p.waitForTimeout(1900);
  R.countUp = (await p.locator('[data-countup="41280"]').textContent())?.trim();

  // 4. allowlist: remove, restore, add, and the kind toggle
  await p.locator('[data-card-panel]').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.click('[data-card-panel] button[aria-label="Remove Vercel"]'); await p.waitForTimeout(200);
  R.removeMakesSuggestion = await p.locator('[data-suggest="Vercel"]').count() === 1;
  await p.click('[data-suggest="Vercel"]'); await p.waitForTimeout(200);
  R.suggestionRestores = (await p.locator('[data-allow-list] li').allTextContents()).some(t => t.includes('Vercel'));
  await p.click('[data-kind-toggle="category"]'); await p.waitForTimeout(200);
  R.kindPlaceholder = await p.locator('[data-allow-input]').getAttribute('placeholder');
  R.kindHint = (await p.locator('[data-allow-hint]').textContent())?.slice(0, 8);
  await p.fill('[data-allow-input]', 'Observability');
  await p.click('[data-allow-add]'); await p.waitForTimeout(250);
  R.categoryChip = await p.locator('[data-allow-list] li[data-kind="category"]').count();
  R.categoryHasTag = await p.locator('[data-allow-list] li[data-kind="category"] svg').count() > 0;
  await p.click('[data-kind-toggle="merchant"]'); await p.waitForTimeout(150);
  R.backToMerchant = await p.locator('[data-allow-input]').getAttribute('placeholder');

  // 5. palette + network
  await p.click('[data-card-theme="violet"]'); await p.waitForTimeout(400);
  R.faceColour = await p.locator('[data-card-face]').evaluate(el => getComputedStyle(el).backgroundColor);
  await p.click('[data-network-toggle]'); await p.waitForTimeout(250);
  await p.click('[data-network-option="axiom"]'); await p.waitForTimeout(300);
  R.network = (await p.locator('[data-card-network]').textContent())?.trim();

  // 6. freeze light
  R.lightGreen = await p.locator('[data-freeze-light]').evaluate(el => getComputedStyle(el).backgroundColor);
  await p.click('[data-freeze]'); await p.waitForTimeout(400);
  R.lightRed = await p.locator('[data-freeze-light]').evaluate(el => getComputedStyle(el).backgroundColor);

  // 7. tabs — every one
  const tabs = ['cards','limits','security','webhooks','mcp'];
  R.tabs = [];
  for (const t of tabs) {
    await p.click(`#tab-${t}`); await p.waitForTimeout(250);
    const only = await p.locator('[role="tabpanel"]:visible').count();
    R.tabs.push(`${t}:${await p.locator(`#panel-${t}`).isVisible()}/${only}`);
  }

  // 8. spend bars
  await p.locator('[data-spend-bar]').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(1300);
  R.bars = (await p.locator('[data-spend-bar]').evaluateAll(e => e.map(x => x.style.height))).slice(0, 3);

  // 9. faq
  await p.locator('button[aria-controls="faq-4"]').scrollIntoViewIfNeeded();
  await p.click('button[aria-controls="faq-4"]'); await p.waitForTimeout(250);
  R.faqOpens = await p.locator('#faq-4').isVisible();

  // 10. legal dialogs
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(400);
  await p.locator('[data-legal="terms"]').first().click(); await p.waitForTimeout(300);
  R.termsOpens = await p.locator('#legal-terms [role="dialog"]').isVisible();
  await p.locator("#legal-terms button:text-is(\"Close\")").click(); await p.waitForTimeout(250);
  R.termsCloses = !(await p.locator('#legal-terms [role="dialog"]').isVisible());
  await p.locator('[data-legal="privacy"]').first().click(); await p.waitForTimeout(300);
  R.privacyOpens = await p.locator('#legal-privacy [role="dialog"]').isVisible();
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  R.escapeCloses = !(await p.locator('#legal-privacy [role="dialog"]').isVisible());

  // 11. console freeze further down
  await p.locator('button:text("Freeze card")').last().scrollIntoViewIfNeeded();
  await p.locator('button:text("Freeze card")').last().click(); await p.waitForTimeout(250);
  R.consoleFreeze = (await p.locator('button:text("Unfreeze card")').count()) > 0;

  // 12. mobile menu
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await m.setContent(wrap(inner), { waitUntil: 'domcontentloaded' });
  await m.waitForTimeout(400);
  R.menuHidden = !(await m.locator('#mobile-menu').isVisible());
  await m.click('button[aria-controls="mobile-menu"]'); await m.waitForTimeout(300);
  R.menuOpens = await m.locator('#mobile-menu').isVisible();
  R.mobileOverflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  R.errors = errs;
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
