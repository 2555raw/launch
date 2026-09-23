/* The rule, held down by checks.
 *
 * Spinpad has exactly one thing it must never get wrong: no coin is minted
 * without a spin, and the asset is whatever the board drew. Everything here
 * exercises that in a real browser, including the ways someone would try to go
 * around it from a console.
 *
 * Needs Playwright on the machine, which is deliberately not a dependency of
 * the site — the site itself ships nothing. Run it with:
 *
 *   npm test                       # picks up a global or nearby playwright
 *   CHROME_PATH=/path/to/chrome npm test
 */
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');

let passed = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
};

/* ---------- the board's own table, rebuilt here on purpose ----------
   If app.js and this file ever disagree about which dot is which asset, the
   needle check below fails. That is the point: it is not importing the answer. */
const QUADS = ['bid', 'ask', 'short', 'long'];
const BASE = ['green', 'yellow', 'blue', 'red'];
const SECTORS = [];
for (let q = 0; q < 4; q++) for (let k = 0; k < 4; k++) SECTORS.push({ color: BASE[(k + q) % 4], quadrant: QUADS[q] });

/* The table is read off the page rather than copied here: it lives in
   config.js now, where the addresses are, and a test that hardcodes it would
   pass while the page paired coins with something else entirely. */
const assetsFrom = (cfg) => {
  const out = {};
  ['green', 'yellow', 'blue', 'red'].forEach((k) => {
    out[k] = {};
    QUADS.forEach((q) => { out[k][q] = cfg.assets[k][q].name; });
  });
  return out;
};

/* ---------- the server must survive a hostile path ---------- */
const get = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject);
});

async function serverChecks() {
  console.log('\nserver');
  const port = 8099;
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port) }, stdio: 'ignore',
  });
  try {
    await new Promise((r) => setTimeout(r, 700));
    const base = 'http://127.0.0.1:' + port;
    ok('serves the page', await get(base + '/') === 200);
    // decodeURIComponent throws URIError on this one
    ok('malformed escape is a 400, not a crash', await get(base + '/%') === 400);
    // a NUL byte makes fs.readFile throw synchronously
    ok('NUL byte is a 400, not a crash', await get(base + '/a%00b') === 400);
    ok('unknown path is a 404', await get(base + '/nope') === 404);
    ok('still serving after all of that', await get(base + '/') === 200);
  } finally {
    child.kill();
  }
}

/* ---------- the rule, in a browser ---------- */
async function browserChecks() {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) {
    console.log('\nbrowser checks skipped: playwright is not installed here');
    console.log('  install it, or run with CHROME_PATH set, to exercise the rule');
    return false;
  }

  console.log('\nthe rule');
  const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errors.push(m.text()); });

  await page.goto(PAGE);
  await page.waitForTimeout(700);
  const ASSETS = assetsFrom(await page.evaluate(() => window.SPINPAD_CONFIG));

  // the door: nothing on the page is reachable until it is accepted
  ok('the door is up on a first visit', await page.locator('#gate').isVisible());
  ok('and it will not open without the tick', await page.locator('#gateGo').isDisabled());
  await page.check('#gateAgree');
  ok('ticking it opens the way in', !(await page.locator('#gateGo').isDisabled()));
  await page.click('#gateGo');
  await page.waitForTimeout(300);
  ok('accepting closes it', !(await page.locator('#gate').isVisible()));
  await page.reload();
  await page.waitForTimeout(500);
  ok('and it stays closed on the way back', !(await page.locator('#gate').isVisible()));

  const coins = () => page.locator('.lv-coin').count();
  const before = await coins();

  ok('launch control ships disabled', await page.locator('#launchBtn').isDisabled());
  ok('spin is closed until the details are in', await page.locator('#spin').isDisabled());

  // force the control open from outside and click it
  await page.evaluate(() => { document.getElementById('launchBtn').disabled = false; });
  await page.click('#launchBtn');
  await page.waitForTimeout(200);
  ok('a forced launch with no spin mints nothing', await coins() === before);
  ok('and the control closes again', await page.locator('#launchBtn').isDisabled());

  // a draft that does not validate does not move on
  await page.fill('#fName', 'x');
  await page.click('#toSpin');
  await page.waitForTimeout(150);
  ok('an invalid draft stays on step one', await page.getAttribute('#pad', 'data-step') === '1');

  await page.fill('#fName', 'Northwind Capital');
  await page.fill('#fTicker', 'NWND');
  await page.fill('#fSupply', '250000000');
  await page.fill('#fDesc', 'Checked by the test suite.');
  ok('the asset field is empty before the spin',
    (await page.locator('#assetName').textContent()).trim() === 'Assigned by the spin');

  await page.click('#toSpin');
  await page.waitForTimeout(200);
  ok('the spin opens on step two', !(await page.locator('#spin').isDisabled()));
  ok('the launch control is still shut on step two', await page.locator('#launchBtn').isDisabled());

  await page.click('#spin');
  await page.waitForFunction(() => !document.getElementById('launchBtn').disabled, null, { timeout: 12000 });
  await page.waitForTimeout(300);

  // what the board actually shows, worked out from the needle's resting angle
  const angle = await page.evaluate(() => {
    const m = new DOMMatrixReadOnly(getComputedStyle(document.getElementById('needle')).transform);
    return ((Math.atan2(m.b, m.a) * 180 / Math.PI) % 360 + 360) % 360;
  });
  const drawn = SECTORS[Math.floor(angle / 22.5)];
  const expected = ASSETS[drawn.color][drawn.quadrant];

  const inForm = (await page.locator('#assetName').textContent()).trim();
  ok('the asset under the needle is the asset reported',
    inForm.startsWith(expected), `needle at ${angle.toFixed(1)}° is ${expected}, form says "${inForm}"`);
  ok('the preview follows the draw',
    (await page.locator('#pvAsset').textContent()).trim().length > 0 &&
    (await page.locator('#pvAsset').textContent()).trim() !== 'UNPAIRED');
  ok('the summary names it too',
    (await page.locator('#sumRows').textContent()).includes(expected));
  ok('the figure on the mat moved onto it',
    (await page.locator('#matRead').textContent()).includes(expected));
  ok('the spin is spent', (await page.locator('#spinCount').textContent()).includes('1/1'));
  ok('there is no way back to the details', await page.locator('#backToForm').isHidden());

  // force a second spin from outside
  await page.evaluate(() => { const s = document.getElementById('spin'); s.disabled = false; s.click(); });
  await page.waitForTimeout(500);
  ok('a forced second spin does not change the draw',
    (await page.locator('#assetName').textContent()).trim() === inForm);

  // No wallet is injected in this file, so launching has to refuse rather than
  // pretend. The path that actually deploys is exercised in launch.test.js with
  // a fake wallet, where the bytes it would send are checked.
  await page.click('#launchBtn');
  await page.waitForTimeout(500);
  ok('without a wallet the pad refuses to launch',
    /wallet/i.test(await page.locator('#status').textContent()));
  ok('and mints nothing', await coins() === before);
  ok('the record stays closed', !(await page.locator('#ticket').isVisible()));

  // the mat is a control, not a picture.
  // It has to be on screen first: mouse coordinates are viewport coordinates,
  // and a drag aimed at an off-screen grip silently lands somewhere else — which
  // is exactly how the first version of this check passed without doing anything.
  await page.locator('.lv-mat').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const read = await page.locator('#matRead').textContent();
  await page.locator('.lv-mat-dot[data-row="3"][data-col="0"]').click();
  await page.waitForTimeout(250);
  ok('tapping a circle moves that limb', (await page.locator('#matRead').textContent()) !== read);
  ok('and it lands on the right asset',
    (await page.locator('#matRead').textContent()).includes(ASSETS.green.long));

  // and the limbs can be dragged along their own row
  const from = await page.locator('.lv-fig-grip[data-limb="long"]').boundingBox();
  const onto = await page.locator('.lv-mat-dot[data-row="3"][data-col="3"]').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(onto.x + onto.width / 2, onto.y + onto.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  ok('dragging a foot walks it along its row',
    (await page.locator('#matRead').textContent()).includes(ASSETS.red.long));

  // a limb dropped outside its own row stays where it was
  const before2 = await page.locator('#matRead').textContent();
  const off = await page.locator('.lv-mat-dot[data-row="0"][data-col="0"]').boundingBox();
  const grip2 = await page.locator('.lv-fig-grip[data-limb="long"]').boundingBox();
  await page.mouse.move(grip2.x + grip2.width / 2, grip2.y + grip2.height / 2);
  await page.mouse.down();
  await page.mouse.move(off.x + off.width / 2, off.y + off.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const moved = await page.evaluate(() => {
    const g = document.querySelector('.lv-fig-grip[data-limb="long"]');
    const r = g.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(el && el.closest && el.closest('.lv-fig-grip'));
  });
  ok('the grip really was under the pointer', moved);
  ok('and a drop in someone else\u2019s row is ignored',
    (await page.locator('#matRead').textContent()) === before2);

  // the sort control is a listbox now, and it has to work from the keyboard
  await page.click('#sortBtn');
  await page.waitForTimeout(200);
  ok('the sort menu opens', await page.locator('#sortMenu').isVisible());
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  ok('choosing with the keyboard closes it', !(await page.locator('#sortMenu').isVisible()));
  ok('and the button reports the choice',
    (await page.locator('#sortBtn').textContent()).trim().length > 0);

  // the coloured ground comes back when the tab does
  await page.evaluate(() => {
    document.querySelectorAll('.is-blooming').forEach((el) => el.classList.remove('is-blooming'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(150);
  ok('the ground blooms back on return to the tab',
    await page.evaluate(() => document.querySelectorAll('.is-blooming').length > 0));

  // nothing on the page should be reachable only by mouse
  ok('the nav links are focusable',
    await page.evaluate(() => [...document.querySelectorAll('.lv-links a')].every((a) => a.hasAttribute('href'))));

  ok('no console errors along the way', errors.length === 0, errors.join(' / '));

  await browser.close();
  return true;
}

(async () => {
  await serverChecks();
  await browserChecks();

  console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
  if (fails.length) {
    fails.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
})();
