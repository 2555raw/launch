// Records a smooth scroll through the live Strydo site as frames for a GIF and an mp4.
// Usage: node site-gif.cjs <site url> <frames dir> <spki file>
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const [url, dir, spkiFile] = process.argv.slice(2);
  const spki = fs.readFileSync(spkiFile, 'utf8').trim();
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY }, args: ['--ignore-certificate-errors-spki-list=' + spki] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(3500);
  const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  // Stops: hero hold, then glide section to section, pausing at each.
  const ids = ['how-it-works', 'demo', 'ranking', 'rewards', 'leaderboard', 'faq'];
  const stops = [0];
  for (const id of ids) stops.push(await p.evaluate((id) => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().top + scrollY - 70 : 0; }, id));
  stops.push(H);
  let f = 0;
  const shot = async () => { await p.screenshot({ path: `${dir}/${String(f++).padStart(4, '0')}.png` }); };
  const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  for (let h = 0; h < 22; h++) { await p.waitForTimeout(60); await shot(); } // hold on hero
  for (let s = 1; s < stops.length; s++) {
    const a = stops[s - 1], z = Math.min(stops[s], H), N = 14;
    for (let i = 1; i <= N; i++) { await p.evaluate((y) => window.scrollTo(0, y), a + (z - a) * ease(i / N)); await p.waitForTimeout(45); await shot(); }
    for (let h = 0; h < 16; h++) { await p.waitForTimeout(70); await shot(); } // hold so reveals play
  }
  console.log('frames', f);
  await b.close();
})();
