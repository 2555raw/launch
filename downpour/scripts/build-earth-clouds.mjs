#!/usr/bin/env node
/* Renders the planet's cloud cover once, into web/public/earth/clouds-2k.jpg and
 * clouds-1k.jpg: domain-warped cloud bands over the real coastlines, twisted into
 * cyclones, with two hurricanes (CLOUD_FS in web/src/storm/earthgen.ts). The sky used to
 * generate this on the visitor's GPU, but a shader that long takes some drivers minutes
 * to compile (Direct3D unrolls every noise loop), which crashed browsers on Windows.
 *
 *   node scripts/build-earth-clouds.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'web/public/earth');
mkdirSync(out, { recursive: true });

// the page script: CLOUD_FS with the land mask and storms, bundled for the browser
const bundle = await build({
  configFile: false,
  logLevel: 'warn',
  root,
  build: {
    write: false,
    minify: false,
    lib: { entry: join(root, 'scripts/lib/clouds-page.ts'), formats: ['iife'], name: 'Clouds', fileName: () => 'clouds.js' },
  },
});
const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find((o) => o.type === 'chunk').code;

const browser = await chromium.launch({
  ...(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}),
  // a software GPU is fine here, and the same everywhere
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.addScriptTag({ content: code });
const sizes = [2048, 1024];
const urls = await page.evaluate(({ sizes }) => window.Clouds.render(sizes, 0.9), { sizes });
await browser.close();

urls.forEach((url, i) => {
  const w = sizes[i];
  const file = `clouds-${w / 1024}k.jpg`;
  const buf = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(join(out, file), buf);
  console.log(`${file}: ${w}x${w / 2}, ${(buf.length / 1024).toFixed(0)} KB`);
});
