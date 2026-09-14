/**
 * Renders the on-screen captions to transparent PNGs.
 *
 *   node video/overlays.js <outdir> [url]
 *
 * These sit on top of the footage rather than between shots, which is what
 * keeps the cut moving: a title card costs a second of black, a caption costs
 * nothing because the product is still on screen underneath it.
 *
 * Rendered in the site's own type and salmon, at the film's own size, with the
 * background omitted so ffmpeg can overlay them straight on.
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'video/caps';
const URL = process.env.CAP_URL || 'http://localhost:8899/caption.html';
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CAPS = [
  { id: 'watching',  kind: 'tag',   text: 'Nobody is watching the calendar' },
  { id: 'back',      kind: 'punch', tag: 'On a $1,000,000 pool', text: '$237,500 back to the pool' },
  { id: 'threecalls',kind: 'tag',   text: 'Three calls, inside one block' },
  { id: 'beforeswap',kind: 'punch', tag: 'The entry point', text: 'beforeSwap()' },
  { id: 'fee',       kind: 'tag',   text: 'The fee is a function, not a constant' },
  { id: 'sepolia',   kind: 'tag',   text: 'Live on Base Sepolia · chain 84532' },
  { id: 'slippage',  kind: 'tag',   text: 'Slippage, routing, settlement — yours' },
  { id: 'reds',      kind: 'tag',   text: 'Four readings of one salmon' },
  { id: 'note',      kind: 'tag',   text: 'The protocol note, in full' },
  { id: 'split',     kind: 'punch', tag: 'One 4:1 split', text: 'The curve moves first' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

  for (const cap of CAPS) {
    const hash = new URLSearchParams({ kind: cap.kind, text: cap.text || '', tag: cap.tag || '' }).toString();
    await page.goto(`${URL}?c=${cap.id}#${hash}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, `${cap.id}.png`), omitBackground: true });
    console.error(`caption ${cap.id}`);
  }

  await browser.close();
})();
