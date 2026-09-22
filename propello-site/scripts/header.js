#!/usr/bin/env node
/* Render scripts/header.html to brand/header.png, the size X asks for.
     node scripts/header.js
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
  const p = await b.newPage({ viewport: { width: 1500, height: 500 }, deviceScaleFactor: 2 });
  await p.goto(base + 'scripts/header.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(root, 'brand', 'header.png'), scale: 'css' });
  await b.close(); server.close();
  console.error('wrote brand/header.png');
})();
