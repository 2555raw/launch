/**
 * Records the footage for the film.
 *
 *   SITE=http://localhost:8899/ node video/capture.js <outdir> [beat ...]
 *
 * One context per beat, each with its own recording. The legal gate is answered
 * before load so nothing covers the shot, and every beat starts from a known
 * scroll position, so the trim points in build.py stay stable from run to run.
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE || 'http://localhost:8899/';
const OUT = process.argv[2] || 'video/raw';
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BLIND = 88;   // rows the recorder returns but the page never paints

/** Scroll with an ease, because a jump cut inside a shot reads as a glitch. */
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

/** Park a section just under the bar and let its reveal play. */
const land = async (page, sel, pad = 90, settle = 900) => {
  const y = await topOf(page, sel);
  await page.evaluate((v) => window.scrollTo(0, v), Math.max(0, y - pad));
  await page.waitForTimeout(settle);
};

const BEATS = [
  {
    // the headline builds itself a word at a time, so this one shoots from load
    name: 'hero',
    run: async (page) => {
      await page.waitForTimeout(2600);
      await ease(page, 300, 1600);
      await page.waitForTimeout(700);
    },
  },
  {
    name: 'ticker',
    run: async (page) => {
      await land(page, '.ticker', 260, 1500);
      await page.waitForTimeout(1800);
    },
  },
  {
    // the figures count up as the band comes into view
    name: 'band',
    run: async (page) => {
      const y = await topOf(page, '.band');
      await page.evaluate((v) => window.scrollTo(0, v - 700), y);
      await page.waitForTimeout(400);
      await ease(page, y - 140, 1100);
      await page.waitForTimeout(3200);   // the reveal, then the figures counting
    },
  },
  {
    name: 'registry',
    run: async (page) => {
      await land(page, '#token', 140, 1700);
      await page.waitForTimeout(900);
    },
  },
  {
    // three cards on a staircase, revealing in sequence
    name: 'cards',
    run: async (page) => {
      const y = await topOf(page, '#liquidity');
      await page.evaluate((v) => window.scrollTo(0, v - 620), y);
      await page.waitForTimeout(400);
      await ease(page, y + 130, 1500);
      await page.waitForTimeout(1900);
    },
  },
  {
    name: 'board',
    run: async (page) => {
      await land(page, '#security', 120, 2100);
      await page.waitForTimeout(1000);
    },
  },
  {
    name: 'flow',
    run: async (page) => {
      await land(page, '#earn', 120, 2100);
      await page.waitForTimeout(900);
    },
  },
  {
    name: 'code',
    run: async (page) => {
      await land(page, '#interface', 110, 1900);
      await page.waitForTimeout(900);
    },
  },
  {
    name: 'chart',
    run: async (page) => {
      await land(page, '#fees-tech', 110, 2000);
      await ease(page, (await topOf(page, '#fees-tech')) + 260, 1400);
      await page.waitForTimeout(900);
    },
  },
  {
    // the whole page changes colour: four readings of the beige, then the night
    name: 'tints',
    run: async (page) => {
      await land(page, '#earn', 120, 1200);
      for (const i of [0, 2, 3, 1]) {
        await page.click(`.tint[data-tint="${i}"]`);
        await page.waitForTimeout(760);
      }
      await page.click('#themeBtn');
      await page.waitForTimeout(1500);
      await page.click('#themeBtn');
      await page.waitForTimeout(900);
    },
  },
  {
    name: 'app',
    run: async (page) => {
      await page.evaluate(() => { location.hash = '#/trade'; });
      await page.waitForTimeout(1700);
      await page.click('#amtIn');
      for (const ch of '2.5') {
        await page.keyboard.press(ch === '.' ? 'Period' : `Digit${ch}`);
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(900);
      await page.click('#flipBtn');
      await page.waitForTimeout(1300);
    },
  },
  {
    name: 'docs',
    run: async (page) => {
      await page.evaluate(() => { location.hash = '#/docs'; });
      await page.waitForTimeout(1400);
      await ease(page, 620, 2000);
      await page.waitForTimeout(700);
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

    // The recording starts when the context does, not when the page loads, so
    // the manifest has to measure from here: timing the action window from a
    // later mark leaves build.py trimming from before the page has arrived, and
    // every shot then opens on an unscrolled, half-revealed hero.
    const created = Date.now();
    // The recorder hands back a canvas 88 rows taller than the page ever paints,
    // so every clip used to carry a grey strip along the bottom. Shooting 88
    // rows tall and trimming them in build.py gives a full 1280x720 of real
    // page, at native resolution, with nothing scaled or cropped off the sides.
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 + BLIND },
      recordVideo: { dir, size: { width: 1280, height: 720 + BLIND } },
      deviceScaleFactor: 1,
    });
    // Answer the gate before anything paints, and open on the light theme,
    // which is the real one for a brand named after a colour.
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('beyga-legal-v1', 'accepted');
        localStorage.setItem('beyga-theme', 'light');
        localStorage.setItem('beyga-tint', '1');
      } catch (_) {}
    });

    const page = await ctx.newPage();
    await page.goto(SITE, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // The page sets scroll-behavior: smooth, which turns every jump below into
    // a slow travel from the top and opens every shot on the hero.
    await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
    await page.waitForTimeout(500);

    const started = Date.now();
    try {
      await beat.run(page);
    } catch (err) {
      console.error(`  ! ${beat.name}: ${err.message}`);
    }
    const ended = Date.now();

    await page.close();
    await ctx.close();

    const file = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
    manifest.push({
      name: beat.name,
      file: path.join(dir, file),
      offset: (started - created) / 1000,
      duration: (ended - started) / 1000,
    });
    console.error(`recorded ${beat.name}: ${((ended - started) / 1000).toFixed(1)}s`);
  }

  await browser.close();
  const order = BEATS.map((b) => b.name);
  manifest.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.error(`manifest: ${manifest.length} beats`);
})();
