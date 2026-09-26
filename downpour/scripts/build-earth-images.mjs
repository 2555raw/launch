#!/usr/bin/env node
/* Prepares the real Earth imagery for the planet in the sky, from NASA's public-domain
 * maps as packaged by three-globe (example/img): the Blue Marble day map, the Earth at
 * night city lights, and the topography used for relief. Resized and re-encoded with
 * Chromium into web/public/earth/.
 *
 *   node scripts/build-earth-images.mjs            (downloads three-globe with npm pack)
 *   node scripts/build-earth-images.mjs <dir>      (a folder that already has the images)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'web/public/earth');
mkdirSync(out, { recursive: true });

let src = process.argv[2];
if (!src) {
  const tmp = mkdtempSync(join(tmpdir(), 'earth-'));
  execFileSync('npm', ['pack', 'three-globe@2.45.2', '--pack-destination', tmp], { stdio: 'inherit' });
  execFileSync('tar', ['-xzf', join(tmp, 'three-globe-2.45.2.tgz'), '-C', tmp]);
  src = join(tmp, 'package/example/img');
}
for (const f of ['earth-blue-marble.jpg', 'earth-night.jpg', 'earth-topology.png']) {
  if (!existsSync(join(src, f))) throw new Error(`missing ${f} in ${src}`);
}

const jobs = [
  { from: 'earth-blue-marble.jpg', to: 'day-4k.jpg', w: 4096, q: 0.84 },
  { from: 'earth-blue-marble.jpg', to: 'day-2k.jpg', w: 2048, q: 0.86 },
  { from: 'earth-night.jpg', to: 'night-2k.jpg', w: 2048, q: 0.86 },
  { from: 'earth-topology.png', to: 'relief-2k.jpg', w: 2048, q: 0.8, grey: true },
];

const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await browser.newPage();
for (const job of jobs) {
  const type = job.from.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const dataUrl = `data:${type};base64,${readFileSync(join(src, job.from)).toString('base64')}`;
  const b64 = await page.evaluate(
    async ({ dataUrl, w, q, grey }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = w / 2;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      if (grey) g.filter = 'grayscale(1)';
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q).split(',')[1];
    },
    { dataUrl, w: job.w, q: job.q, grey: !!job.grey },
  );
  const buf = Buffer.from(b64, 'base64');
  writeFileSync(join(out, job.to), buf);
  console.log(`${job.to}: ${job.w}x${job.w / 2}, ${(buf.length / 1024).toFixed(0)} KB`);
}
await browser.close();
