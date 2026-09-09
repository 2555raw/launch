/**
 * Renders the title cards to PNG.
 *
 *   node video/cards.js <outdir> [card-url]
 *
 * The card template is the same type and palette as the site, so the film cuts
 * between titles and product without changing typeface mid-sentence.
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'video/cards';
const URL = process.env.CARD_URL || 'http://localhost:8899/card.html';
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CARDS = [
  { id: '01-logo', kind: 'logo' },
  { id: '02-line', kind: 'line', kicker: 'The financial layer for AI agents', text: 'Give agents a card of their own.' },
  { id: '03-cards', kind: 'word', kicker: '01', text: 'Virtual<br>cards' },
  { id: '04-network', kind: 'word', kicker: '02', text: 'Any<br>network' },
  { id: '05-policy', kind: 'word', kicker: '03', text: 'Policies<br>that <span class="accent">hold</span>' },
  { id: '06-auth', kind: 'word', kicker: '04', text: 'Every<br>authorization' },
  { id: '07-console', kind: 'word', kicker: '05', text: 'One<br>console' },
  { id: '08-outro', kind: 'outro' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**://fonts.gstatic.com/**', (r) => r.abort());

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
    const file = path.join(OUT, `${card.id}.png`);
    await page.screenshot({ path: file });
    console.error(`card ${card.id}`);
  }

  await browser.close();
})();
