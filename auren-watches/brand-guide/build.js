/* Turns guia.html into the PDF of the identity guide (eight 16:9 pages) and a
 * PNG preview of each page.  node brand-guide/build.js  — needs Playwright. */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('file://' + path.join(__dirname, 'guia.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const pdf = path.join(__dirname, 'AUREN_WATCHES_Identidad_visual_Jordi_Cayo_Almenar.pdf');
  await page.pdf({ path: pdf, width: '1280px', height: '720px', printBackground: true });
  console.log(path.basename(pdf), Math.round(fs.statSync(pdf).size / 1024) + ' KB');
  if (process.argv.includes('--png')) {
    const out = process.argv[process.argv.indexOf('--png') + 1];
    fs.mkdirSync(out, { recursive: true });
    const slides = await page.$$('.page');
    for (let i = 0; i < slides.length; i++) await slides[i].screenshot({ path: path.join(out, `p${i + 1}.png`) });
  }
  await browser.close();
})();
