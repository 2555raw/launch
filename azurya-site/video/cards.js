/**
 * Renders the title cards to PNG.
 *
 *   node video/cards.js <outdir> [card-url]
 *
 * The template is the site's own type and palette, so the film cuts between a
 * title and the page without changing typeface mid-sentence.
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'video/cards';
const URL = process.env.CARD_URL || 'http://localhost:8899/card.html';
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CARDS = [
  { id: '01-logo',    kind: 'logo',  dark: '1' },
  { id: '02-line',    kind: 'line',  kicker: 'Uniswap v4 hook', text: 'A split reprices the asset. Your pool keeps quoting yesterday.' },
  { id: '03-cost',    kind: 'fig',   kicker: 'On a $1,000,000 pool', text: '&minus;$250,000' },
  { id: '04-nobody',  kind: 'word',  kicker: '01', text: 'Nobody<br>is <span class="accent">watching</span>' },
  { id: '05-first',   kind: 'word',  kicker: '02', text: 'The curve<br>moves <span class="accent">first</span>' },
  { id: '06-auction', kind: 'word',  kicker: '03', text: 'Auctioned,<br>not <span class="accent">raced</span>' },
  { id: '07-back',    kind: 'fig',   kicker: 'Back to the pool', text: '$237,500' },
  { id: '08-state',   kind: 'line',  kicker: 'The real state of it', text: 'No token. No TVL. No audit yet.' },
  { id: '09-outro',   kind: 'outro', dark: '1', meta: 'Uniswap v4 hook &middot; Base Sepolia|Testnet. Unaudited. No token.' },
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
      meta: card.meta || '',
      dark: card.dark || '',
    }).toString();
    // A URL that differs only in its hash does not reload the document, and the
    // template reads the hash once at load: without the query param every card
    // after the first would render the first card again.
    await page.goto(`${URL}?card=${card.id}#${hash}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `${card.id}.png`) });
    console.error(`card ${card.id}`);
  }

  await browser.close();
})();
