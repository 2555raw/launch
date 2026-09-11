/**
 * Records the footage for the film.
 *
 *   npm run snapshot && python3 scripts/assemble-snapshot.py video/site/index.html
 *   (or point SITE at any served copy of the page)
 *   node video/capture.js <outdir>
 *
 * One context per beat, each with its own recording. The gate and the cookie
 * notice are answered before load so nothing covers the shot, and every beat
 * starts from a known scroll position, so the trim points in build.py stay
 * stable from run to run.
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE || 'http://localhost:8899/';
const OUT = process.argv[2] || 'video/raw';
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ease = (page, y, ms = 1200) =>
  page.evaluate(
    ([target, dur]) =>
      new Promise((done) => {
        const from = window.scrollY;
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / dur);
          const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          window.scrollTo(0, from + (target - from) * e);
          if (t < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      }),
    [y, ms]
  );

const topOf = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? window.scrollY + el.getBoundingClientRect().top : 0;
  }, sel);

/** Each beat: a name, how long to record, and what to do on screen. */
const BEATS = [
  {
    name: 'hero',
    run: async (page) => {
      await page.waitForTimeout(1600);
      await ease(page, 260, 2200);
      await page.waitForTimeout(900);
    },
  },
  {
    name: 'colours',
    run: async (page) => {
      const y = await topOf(page, '[data-card-panel]');
      await page.evaluate((v) => window.scrollTo(0, v), y - 80);
      await page.waitForTimeout(700);
      await page.locator('[data-card-name]').click();
      for (const ch of 'ANDRES') await page.keyboard.press(ch), await page.waitForTimeout(90);
      await page.waitForTimeout(500);
      for (const id of ['coral', 'violet', 'green', 'cream', 'ink']) {
        await page.click(`[data-card-theme="${id}"]`);
        await page.waitForTimeout(720);
      }
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'network',
    run: async (page) => {
      const y = await topOf(page, '[data-network-picker]');
      await page.evaluate((v) => window.scrollTo(0, v), y - 240);
      await page.waitForTimeout(700);
      await page.click('[data-network-toggle]');
      await page.waitForTimeout(900);
      await page.click('[data-network-option="meridian"]');
      await page.waitForTimeout(1100);
    },
  },
  {
    name: 'policy',
    run: async (page) => {
      const y = await topOf(page, '[data-allow-list]');
      await page.evaluate((v) => window.scrollTo(0, v), y - 300);
      await page.waitForTimeout(700);
      await page.click('[data-card-panel] button[aria-label="Remove Datadog"]');
      await page.waitForTimeout(650);
      await page.click('[data-suggest="AI APIs"]');
      await page.waitForTimeout(800);
      await page.click('[data-freeze]');
      await page.waitForTimeout(1300);
    },
  },
  {
    name: 'terminal',
    run: async (page) => {
      const y = await topOf(page, '#agent-terminal');
      await page.evaluate((v) => window.scrollTo(0, v), y - 90);
      await page.waitForTimeout(4300);   // the log writes itself out
    },
  },
  {
    name: 'platform',
    run: async (page) => {
      const y = await topOf(page, '#security');
      await page.evaluate((v) => window.scrollTo(0, v), y - 60);
      await page.waitForTimeout(700);
      for (const t of ['limits', 'security', 'webhooks', 'mcp']) {
        await page.click(`#tab-${t}`);
        await page.waitForTimeout(780);
      }
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'monitor',
    run: async (page) => {
      const y = await topOf(page, '#dashboard');
      await page.evaluate((v) => window.scrollTo(0, v), y - 20);
      await page.waitForTimeout(900);
      await ease(page, y + 300, 1900);
      await page.waitForTimeout(1500);
    },
  },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM });

  // `node video/capture.js out monitor hero` re-shoots those beats and leaves
  // the rest of the manifest alone.
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
    // Answer the gate and the notice before anything paints.
    await ctx.addInitScript(() => {
      try {
        sessionStorage.setItem('payence-terms', 'accepted');
        localStorage.setItem('payence-consent', 'declined');
      } catch (_) {}
    });

    const page = await ctx.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.route('**://fonts.gstatic.com/**', (r) => r.abort());
    const opened = Date.now();
    await page.goto(SITE, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
    await page.waitForTimeout(500);
    const started = Date.now();
    await beat.run(page);
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
    console.error(`recorded ${beat.name}: ${((ended - started) / 1000).toFixed(1)}s`);
  }

  await browser.close();
  const order = BEATS.map((b) => b.name);
  manifest.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
})();
