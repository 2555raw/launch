/**
 * Records the footage for the film.
 *
 *   python3 video/stage.py /tmp/mauvya-serve
 *   cd /tmp/mauvya-serve && python3 -m http.server 8899
 *   node video/capture.js video/raw            # all beats
 *   node video/capture.js video/raw app docs   # or re-shoot some
 *
 * One context per beat, each with its own recording. The terms gate is
 * answered before anything paints so nothing covers the shot, and every beat
 * starts from a known scroll position, so the trim points in build.py stay
 * stable from run to run.
 */

const { chromium } = require('playwright');
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

const jump = async (page, sel, pad = 80) => {
  const y = await topOf(page, sel);
  await page.evaluate((v) => window.scrollTo(0, v), Math.max(0, y - pad));
};

/** Each beat: a name, and what to do on screen while it records. */
const BEATS = [
  {
    // The split panel, and the headline the whole piece hangs on.
    name: 'hero',
    run: async (page) => {
      await page.waitForTimeout(1000);
      await ease(page, 260, 1300);
      await page.waitForTimeout(1100);
    },
  },
  {
    // The light band: the cut from dark to light is the biggest one we have.
    name: 'state',
    run: async (page) => {
      await jump(page, '#state', 120);
      await page.waitForTimeout(700);
      await ease(page, (await topOf(page, '#state')) + 200, 1100);
      await page.waitForTimeout(1000);
    },
  },
  {
    // Three columns, one corporate action.
    name: 'ledger',
    run: async (page) => {
      await jump(page, '#security', 60);
      await page.waitForTimeout(800);
      await ease(page, (await topOf(page, '#security')) + 320, 1200);
      await page.waitForTimeout(1000);
    },
  },
  {
    // The three calls, then the source they live in.
    name: 'hook',
    run: async (page) => {
      await jump(page, '#earn', 60);
      await page.waitForTimeout(900);
      await ease(page, (await topOf(page, '#interface')) - 40, 1300);
      await page.waitForTimeout(1000);
    },
  },
  {
    // The deployment registry, reading "not deployed" out loud.
    name: 'registry',
    run: async (page) => {
      await jump(page, '#token', 70);
      await page.waitForTimeout(800);
      await ease(page, (await topOf(page, '#token')) + 260, 1100);
      await page.waitForTimeout(800);
    },
  },
  {
    // The whole palette swinging. The accent picker next to this button is
    // hidden by the stylesheet, so the theme is the only control to shoot.
    name: 'theme',
    run: async (page) => {
      await jump(page, '#security', 60);
      await page.waitForTimeout(600);
      await page.click('#themeBtn');
      await page.waitForTimeout(1200);
      await page.click('#themeBtn');
      await page.waitForTimeout(900);
    },
  },
  {
    // The app: the swap panel and the chart beside it.
    name: 'app',
    run: async (page) => {
      await page.evaluate(() => { window.location.hash = '#/trade'; });
      await page.waitForTimeout(1500);
      await page.click('#amtIn');
      for (const ch of '2.5') {
        await page.keyboard.press(ch === '.' ? 'Period' : ch);
        await page.waitForTimeout(180);
      }
      await page.waitForTimeout(1300);
    },
  },
  {
    // The note, read the way a reader would open it.
    name: 'docs',
    run: async (page) => {
      await page.evaluate(() => { window.location.hash = '#/docs'; });
      await page.waitForTimeout(900);
      await ease(page, 420, 1400);
      await page.waitForTimeout(800);
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
    // Answer the terms gate before anything paints.
    await ctx.addInitScript(() => {
      try { localStorage.setItem('mauvya-legal-v1', 'accepted'); } catch (_) {}
    });

    const page = await ctx.newPage();
    const opened = Date.now();
    await page.goto(SITE, { waitUntil: 'domcontentloaded' });
    // The page scrolls smoothly, which turns every jump below into a slow
    // travel from the top and opens every shot on the hero.
    await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
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
  console.log(`manifest: ${manifestPath}`);
})();
