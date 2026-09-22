#!/usr/bin/env node
/* Render scripts/og.html to og.png, with the figures taken from the Rolls, so
   the share card is never out of date.   node scripts/og.js   */
'use strict';
const path = require('path');
const serve = require('../test/server');
const V = require('../data/vault.json');
const root = path.join(__dirname, '..');

(async () => {
  const { chromium } = require('playwright-core');
  const server = await serve(0);
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const exe = process.env.CHROME || undefined;
  const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await p.goto(base + 'scripts/og.html', { waitUntil: 'networkidle' });
  await p.evaluate(v => {
    document.getElementById('og-b').textContent = v.buildingCount + ' BUILDINGS';
    document.getElementById('og-c').textContent = v.cityCount + ' CITIES';
    document.getElementById('og-p').textContent = '€' + v.price.toFixed(4);
  }, V);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(root, 'og.png'), scale: 'css' });
  await b.close(); server.close();
  console.error('wrote og.png — ' + V.buildingCount + ' buildings, €' + V.price.toFixed(4));
})();
