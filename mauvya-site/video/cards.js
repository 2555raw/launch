/**
 * Renders the title cards to PNG.
 *
 *   node video/cards.js <outdir>
 *
 * card.html has to be served from the staged copy, so it can reach the same
 * local /_fonts/fonts.css the footage is shot with.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'video/cards';
const URL = process.env.CARD_URL || 'http://localhost:8899/card.html';
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CARDS = [
  { id: '01-logo', kind: 'logo' },
  {
    id: '02-line', kind: 'line',
    kicker: 'Uniswap v4 hook',
    text: 'Your pool should not <span class="accent">pay</span> for the split.',
  },
  { id: '03-split',    kind: 'word', kicker: '01 · the event',    text: 'One 4:1<br>split' },
  { id: '04-ledger',   kind: 'word', kicker: '02 · the ledger',   text: 'Three<br>columns' },
  { id: '05-hook',     kind: 'word', kicker: '03 · the hook',     text: 'Three calls,<br>one <span class="accent">block</span>' },
  { id: '06-registry', kind: 'word', kicker: '04 · the registry', text: 'Nothing<br>deployed' },
  { id: '07-app',      kind: 'word', kicker: '05 · the app',      text: 'Point a pool<br>at it' },
  { id: '08-outro',    kind: 'outro' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

  for (const card of CARDS) {
    const hash = new URLSearchParams({
      kind: card.kind,
      text: card.text || '',
      kicker: card.kicker || '',
    }).toString();
    // A URL that differs only in its hash does not reload the document, and the
    // template reads the hash once at load: without the query param every card
    // after the first renders the first card again.
    await page.goto(`${URL}?card=${card.id}#${hash}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(220);
    await page.screenshot({ path: path.join(OUT, `${card.id}.png`) });
    console.error(`card ${card.id}`);
  }

  await browser.close();
})();
