/* Renders the X/Twitter banners into media/brand/ from the register's own
 * photographs. CHROMIUM_PATH=… node scripts/header.js
 */
const { chromium } = require('/home/user/launch/hydropad/node_modules/playwright');
const fs = require('fs'), path = require('path');
const BASE = '/home/user/launch/hydropad/media/sources';
const variants = [
  { t: 'TRR', pos: 'center 42%', caption: 'Laguna Rosa · Torrevieja' },
  { t: 'GLC', pos: 'center 55%', caption: 'Perito Moreno · Santa Cruz' },
  { t: 'ORO', pos: 'center 45%', caption: 'Oroville · California' },
  { t: 'MEAD', pos: 'center 52%', caption: 'Lake Mead · Nevada' },
];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const logo = "data:image/png;base64,"
    + fs.readFileSync(path.join(__dirname, "..", "media", "brand", "logo-128.png")).toString("base64");
  const tpl = fs.readFileSync(path.join(__dirname, 'header.template.html'), 'utf8');
  for (const v of variants) {
    const data = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(BASE, v.t + '.jpg')).toString('base64');
    const html = tpl.replace('SHOT', data).replace('LOGO', logo).replace('CAPTION', v.caption).replace('var(--pos, center)', v.pos);
    const out = n => path.join(__dirname, '..', 'media', 'brand', n);

    /* Rendered at 2x and kept, because X downsamples better than it upsamples,
     * and written again at the size X actually documents. */
    const twice = await b.newPage({ viewport: { width: 1500, height: 500 }, deviceScaleFactor: 2 });
    await twice.setContent(html, { waitUntil: 'networkidle' });
    await twice.waitForTimeout(400);
    await twice.screenshot({ path: out(`header-${v.t}@2x.png`) });
    await twice.close();

    const once = await b.newPage({ viewport: { width: 1500, height: 500 }, deviceScaleFactor: 1 });
    await once.setContent(html, { waitUntil: 'networkidle' });
    await once.waitForTimeout(400);
    await once.screenshot({ path: out(`header-${v.t}.png`) });
    await once.close();
    console.log(`rendered ${v.t}  1500x500 + @2x`);
  }
  await b.close();
})();
