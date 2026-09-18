import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';
const PAGES = ['index.html','vaults.html','swap.html','docs.html','terms.html','risk.html','privacy.html'];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [w, h, tag] of [[1919, 954, 'wide'], [390, 844, 'phone']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await useLocalFonts(p);
  for (const f of PAGES) {
    await p.goto('http://127.0.0.1:8931/' + f, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => {
      const de = document.documentElement;
      // anything whose text colour matches its own background is invisible
      const invisible = [];
      document.querySelectorAll('a, button, h1, h2, h3, p, span, b').forEach(el => {
        if (!el.textContent.trim() || el.offsetParent === null) return;
        const s = getComputedStyle(el);
        let bg = s.backgroundColor, n = el;
        while (bg === 'rgba(0, 0, 0, 0)' && n.parentElement) { n = n.parentElement; bg = getComputedStyle(n).backgroundColor; }
        if (s.color === bg) invisible.push((el.tagName + ' ' + el.textContent.trim()).slice(0, 40));
      });
      return { over: de.scrollWidth > de.clientWidth, invisible: [...new Set(invisible)] };
    });
    console.log(`${tag.padEnd(5)} ${f.padEnd(13)} h-scroll:${r.over ? 'YES' : 'no '} ` +
      (r.invisible.length ? '| INVISIBLE: ' + r.invisible.join(' · ') : '| all text visible'));
  }
  if (errs.length) console.log(' ', tag, 'errors:', errs);
  await p.close();
}
await b.close();
