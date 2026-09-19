/* The contract address, in both of its states.

   The site has two slots for it, the nav chip and the bar under the hero, and
   the point of token.js is that neither holds a copy of the answer. So this
   checks the pre-launch state as shipped, then sets an address in the page and
   checks that both slots followed — including that a malformed one is refused
   rather than displayed. */

import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8931';
const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const ctx = await b.newContext();
await useLocalFonts(ctx);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));

let bad = 0;
const ok = (c, label, note = '') => {
  console.log(`  ${c ? 'ok ' : 'FAIL'} ${label}${note ? '   ' + note : ''}`);
  if (!c) bad++;
};

const read = () => p.evaluate(() => {
  const g = s => {
    const el = document.querySelector(s);
    if (!el) return null;
    return {
      live: el.classList.contains('is-live'),
      addr: el.querySelector('.ca-addr')?.textContent || '',
      copy: !!el.querySelector('.ca-copy'),
      out: el.querySelector('.ca-out')?.getAttribute('href') || '',
      text: el.textContent.replace(/\s+/g, ' ').trim(),
    };
  };
  return { nav: g('.nav-ca'), hero: g('.hm-ca') };
});

const REAL = '0xA8050AF8Dc4470DF8dA07543b75F1d8872d4AB47';

console.log('— before there is one —');
await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
let s = await read();
ok(s.nav && s.hero, 'both slots are on the page');
ok(!s.nav.live && !s.hero.live, 'neither claims to have an address');
ok(!s.nav.copy && !s.hero.copy, 'there is nothing to copy');
ok(s.nav.text === 'CA' && s.hero.text === 'CA', 'both read exactly "CA"', JSON.stringify([s.nav.text, s.hero.text]));

console.log('— a malformed one is refused —');
for (const junk of ['0x123', 'not-an-address', '0x' + '0'.repeat(40), '', REAL.slice(0, -1)]) {
  await p.evaluate(a => { TOKEN.address = a; paintAllCA(); }, junk);
  const r = await read();
  ok(!r.nav.live && !r.hero.live, `${JSON.stringify(junk).slice(0, 26).padEnd(28)} leaves it pre-launch`);
}

console.log('— once it is set —');
await p.evaluate(a => { TOKEN.address = a; paintAllCA(); }, REAL);
s = await read();
ok(s.nav.live && s.hero.live, 'both slots went live together');
ok(s.hero.addr === REAL, 'the bar shows the whole address', s.hero.addr);
ok(s.nav.addr === REAL.slice(0, 6) + '…' + REAL.slice(-4), 'the chip shows it shortened', s.nav.addr);
ok(s.nav.copy && s.hero.copy, 'both can be copied');
ok(s.nav.out.startsWith('https://robinhoodchain.blockscout.com/token/'),
   'and both link into Blockscout', s.nav.out);
ok(s.nav.out === s.hero.out, 'to the same place', 'chip === bar');

console.log('— the testnet is wired too —');
await p.evaluate(() => { TOKEN.chainId = 46630; paintAllCA(); });
s = await read();
ok(s.hero.out.includes('explorer.testnet.chain.robinhood.com'), 'chain 46630 points at the testnet explorer', s.hero.out);

console.log('— and the dashes give way to the address —');
const slot = await p.evaluate(() => {
  const el = document.querySelector('.hm-ca .hm-ca-slot');
  return el ? getComputedStyle(el).display : 'absent';
});
ok(slot === 'none' || slot === 'absent', 'the empty slot is not drawn next to a real address', slot);

console.log('\nerrors: ' + (errs.length ? errs.join(' | ') : 'none'));
bad += errs.length;
await b.close();
console.log(bad ? `FAILURES: ${bad}` : 'all clear');
process.exit(bad ? 1 : 0);
