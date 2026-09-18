import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';
const PAGES = ['index.html','vaults.html','swap.html','docs.html','terms.html','risk.html','privacy.html'];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await useLocalFonts(p);

// every id on every page, so a cross-page #anchor can be checked too
const ids = {};
for (const f of PAGES) {
  await p.goto('http://127.0.0.1:8931/' + f, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(150);
  ids[f] = new Set(await p.$$eval('[id]', els => els.map(e => e.id)));
}

let broken = 0, checked = 0;
for (const f of PAGES) {
  await p.goto('http://127.0.0.1:8931/' + f, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(200);
  const hrefs = await p.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
  const bad = [];
  for (const h of [...new Set(hrefs)]) {
    checked++;
    if (h.startsWith('http')) continue;
    const [path, hash] = h.split('#');
    const file = path.split('?')[0];   // a query string is not part of the page name
    const target = file || f;
    if (!ids[target]) { bad.push(h + ' (no such page)'); continue; }
    if (hash && !ids[target].has(hash)) bad.push(h + ' (no #' + hash + ' on ' + target + ')');
  }
  broken += bad.length;
  console.log(`${f.padEnd(13)} ${String([...new Set(hrefs)].length).padStart(2)} links  ${bad.length ? 'BROKEN → ' + bad.join(', ') : 'all land'}`);
}
console.log(`\n${checked} link targets checked, ${broken} broken`);

// and the selection colour
await p.goto('http://127.0.0.1:8931/index.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
console.log('selection:', await p.evaluate(() => {
  const s = [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } })
    .filter(r => r.selectorText && r.selectorText.includes('selection'));
  return s.map(r => r.cssText);
}));
await b.close();
