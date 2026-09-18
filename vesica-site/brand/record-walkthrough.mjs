/* Vesica — the product walkthrough, recorded rather than animated.
   It drives the real site in a real browser: the entrance, the hero, the
   twenty vaults, the safeguards, the fee loop, the cube field, then a deposit
   that opens a position and ticks up, then a swap the four routers compete
   for. Nothing here is staged — every figure on screen is the page's own.

   Run it with the site served at 127.0.0.1:8931 and a local Google Fonts
   mirror (fontroute.mjs); Playwright writes a webm, and ffmpeg turns it into
   the mp4 X wants:

     node record-walkthrough.mjs
     ffmpeg -i vid/*.webm -vf "scale=1600:900:flags=lanczos,fps=30" \
            -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
            -movflags +faststart -an vesica-walkthrough.mp4 */

import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';

const W = 1600, H = 900;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: './vid', size: { width: W, height: H } },
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await useLocalFonts(p);

const wait = ms => p.waitForTimeout(ms);

/* a scroll the eye can follow: eased, in the page, rather than a jump */
const glide = (to, ms = 1600) => p.evaluate(([to, ms]) => new Promise(res => {
  const from = scrollY, d = to - from, t0 = performance.now();
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  (function step(now) {
    const t = Math.min((now - t0) / ms, 1);
    scrollTo(0, from + d * ease(t));
    t < 1 ? requestAnimationFrame(step) : res();
  })(t0);
}), [to, ms]);

const toEl = async (sel, off = 120, ms = 1600) => {
  const y = await p.evaluate(([s, o]) => {
    const el = document.querySelector(s);
    return el ? el.getBoundingClientRect().top + scrollY - o : scrollY;
  }, [sel, off]);
  await glide(y, ms);
};

// ---------------------------------------------------------------- home
await p.goto('http://127.0.0.1:8931/index.html', { waitUntil: 'networkidle' });
await wait(2600);                       // the curtain, then the hero settling
await wait(2200);                       // the mark tumbling

await toEl('.hm-strip', 150, 1500);     // twenty vaults, one per stock
await wait(1900);

await toEl('.pr-head', 130, 1700);      // protected by default
await wait(2100);

await toEl('.hm-cta', 90, 1700);        // the fee loop
await wait(700);
const loop = await p.locator('.hm-cta-dia').boundingBox();
if (loop) {                             // light two steps of it
  await p.mouse.move(loop.x + loop.width * .5, loop.y + loop.height * .18, { steps: 24 });
  await wait(1100);
  await p.mouse.move(loop.x + loop.width * .80, loop.y + loop.height * .63, { steps: 22 });
  await wait(1200);
  await p.mouse.move(loop.x + loop.width * .20, loop.y + loop.height * .63, { steps: 22 });
  await wait(1200);
}
await p.mouse.move(W / 2, H - 40, { steps: 10 });

await toEl('.ft-cubes', 420, 1600);     // the cube field
await wait(400);
const cb = await p.locator('.ft-cubes svg').boundingBox();
if (cb) {
  const y = Math.min(cb.y + cb.height * .55, H - 60);
  await p.mouse.move(cb.x + cb.width * .28, y, { steps: 26 }); await wait(500);
  await p.mouse.move(cb.x + cb.width * .52, y - 26, { steps: 26 }); await wait(500);
  await p.mouse.move(cb.x + cb.width * .74, y + 10, { steps: 26 }); await wait(700);
}

// ---------------------------------------------------------------- vaults
await p.goto('http://127.0.0.1:8931/vaults.html', { waitUntil: 'networkidle' });
await wait(1400);
await toEl('#list', 90, 1500);
await wait(1500);

await p.click('#connect'); await wait(1400);          // the demo wallet
await p.locator('#rows > details').first().click(); await wait(1500);   // open a row
await p.locator('#rows button', { hasText: /Deposit/ }).first().click(); await wait(1200);
await p.fill('#d-amount', '5000'); await wait(1300);  // the drawer does the maths
await p.click('#d-go'); await wait(1000);
await p.click('#d-close'); await wait(700);
await toEl('#mine', 160, 1200);
await wait(3200);                                     // the position ticking up

// ---------------------------------------------------------------- swap
await p.goto('http://127.0.0.1:8931/swap.html', { waitUntil: 'networkidle' });
await wait(1500);
await p.fill('#pay', '1'); await wait(2200);          // four routers quote it
await p.click('#go'); await wait(2400);               // and one of them wins

// ---------------------------------------------------------------- close
await p.goto('http://127.0.0.1:8931/index.html', { waitUntil: 'networkidle' });
await wait(1200);
await p.evaluate(() => scrollTo(0, document.body.scrollHeight));
await wait(600);
await toEl('.ft-brand', 180, 1400);
await wait(2200);

console.log('errors:', errs.length ? errs : 'none');
await ctx.close();
await b.close();
