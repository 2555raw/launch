#!/usr/bin/env node
/* Render scripts/pfp.html to brand/pfp.png at the sizes a profile needs.
   X shows it as a circle at 400px, so it is drawn at 1000 and scaled down.

     node scripts/pfp.js
   =========================================================================== */
'use strict';
const path = require('path');
const fs = require('fs');
const serve = require('../test/server');
const root = path.join(__dirname, '..');

(async () => {
  const { chromium } = require('playwright-core');
  const server = await serve(0);
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const exe = process.env.CHROME || undefined;
  const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  fs.mkdirSync(path.join(root, 'brand'), { recursive: true });

  for (const size of [1000, 400]) {
    const p = await b.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: size / 1000 });
    await p.goto(base + 'scripts/pfp.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(root, 'brand', 'pfp-' + size + '.png') });
    await p.close();
    console.error('wrote brand/pfp-' + size + '.png');
  }
  await b.close(); server.close();
})();
