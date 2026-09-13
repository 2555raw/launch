/**
 * Records the app film: the interface being used, rather than the page being
 * scrolled. Every beat is somebody pressing something and the interface
 * answering, which is the only kind of shot worth cutting fast.
 *
 *   python3 video/stage.py /tmp/mauvya-shoot
 *   cp video/card.html /tmp/mauvya-shoot/
 *   cd /tmp/mauvya-shoot && python3 -m http.server 8903
 *   SITE=http://localhost:8903/ node video/capture-app.js video/raw-app
 *
 * The terms gate is answered before anything paints, so it never appears.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE || 'http://localhost:8903/';
const OUT = process.argv[2] || 'video/raw-app';
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Push in on the interface, so a button fills more of the frame. */
const zoom = (page, z) => page.evaluate((v) => { document.body.style.zoom = v; }, String(z));

const toTrade = async (page, z = 1) => {
  await page.evaluate(() => { window.location.hash = '#/trade'; });
  await page.waitForTimeout(900);
  await zoom(page, z);
  await page.waitForTimeout(500);
};

const click = async (page, sel, wait = 700) => {
  await page.click(sel, { timeout: 4000 });
  await page.waitForTimeout(wait);
};

/** Each beat: a name, and the interaction it records. */
const BEATS = [
  {
    // The interface arriving: panel, chart, the pair and its price.
    name: 'open',
    run: async (page) => {
      await toTrade(page, 1.12);
      await page.waitForTimeout(1900);
    },
  },
  {
    // The token picker opening, searched, and answering.
    name: 'pick',
    run: async (page) => {
      await toTrade(page, 1.18);
      await click(page, '#tkOutBtn', 900);
      for (const ch of 'usd') {
        await page.keyboard.press(ch);
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(700);
      await click(page, '#tkList button', 1100);
    },
  },
  {
    // An amount typed, and the quote filling itself in underneath.
    name: 'amount',
    run: async (page) => {
      await toTrade(page, 1.18);
      await click(page, '#amtIn', 300);
      for (const ch of '12.5') {
        await page.keyboard.press(ch === '.' ? 'Period' : ch);
        await page.waitForTimeout(190);
      }
      await page.waitForTimeout(1600);
    },
  },
  {
    // The settings popup, and a slippage preset taking.
    name: 'settings',
    run: async (page) => {
      await toTrade(page, 1.2);
      await click(page, '#slipBtn', 900);
      await page.click('#slipModal button:not(.modal-close)', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      await click(page, '#slipClose', 700);
    },
  },
  {
    // The wallet popup: four wallets, one chosen, balances landing.
    name: 'wallet',
    run: async (page) => {
      await toTrade(page, 1.14);
      await click(page, '#swapCta', 1100);
      await click(page, '[data-wallet="MetaMask"]', 1800);
    },
  },
  {
    // The swap: review, confirm, and the interface saying what it did.
    name: 'confirm',
    run: async (page) => {
      await toTrade(page, 1.16);
      await click(page, '#swapCta', 500);
      await page.click('[data-wallet="MetaMask"]', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      await click(page, '#amtIn', 200);
      for (const ch of '2.5') {
        await page.keyboard.press(ch === '.' ? 'Period' : ch);
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(700);
      await click(page, '#swapCta', 1100);
      await click(page, '#confirmBtn', 1700);
    },
  },
  {
    // The chart answering four different questions.
    name: 'chart',
    run: async (page) => {
      await toTrade(page, 1.15);
      for (const r of ['1H', '1W', '1M', '1D']) {
        await click(page, `[data-range="${r}"]`, 620);
      }
      await page.waitForTimeout(500);
    },
  },
  {
    // The whole palette swinging, and back.
    name: 'theme',
    run: async (page) => {
      await toTrade(page, 1.1);
      await click(page, '#themeBtn', 1300);
      await click(page, '#themeBtn', 900);
    },
  },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM });

  const only = process.argv.slice(3);
  const manifestPath = path.join(OUT, 'manifest.json');
  const previous = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : [];
  const manifest = only.length ? previous.filter((b) => !only.includes(b.name)) : [];

  for (const beat of BEATS.filter((b) => !only.length || only.includes(b.name))) {
    const dir = path.join(OUT, beat.name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });

    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir, size: { width: 1280, height: 720 } },
      deviceScaleFactor: 1,
    });
    await ctx.addInitScript(() => {
      try { localStorage.setItem('mauvya-legal-v1', 'accepted'); } catch (_) {}
    });

    const page = await ctx.newPage();
    const opened = Date.now();
    await page.goto(SITE, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const started = Date.now();
    let failed = '';
    try {
      await beat.run(page);
    } catch (e) {
      failed = e.message.split('\n')[0];
    }
    const ended = Date.now();
    await page.close();
    await ctx.close();

    const file = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
    manifest.push({
      name: beat.name,
      file: path.join(dir, file),
      offset: (started - opened) / 1000,
      duration: (ended - started) / 1000,
    });
    console.error(
      `recorded ${beat.name}: ${((ended - started) / 1000).toFixed(1)}s` +
        (failed ? `  FAILED: ${failed}` : '')
    );
  }

  await browser.close();
  const order = BEATS.map((b) => b.name);
  manifest.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`manifest: ${manifestPath}`);
})();
