#!/usr/bin/env node
/* ===========================================================================
   recompute.js — rebuilds every figure on the site from the Rolls.

     node scripts/recompute.js            verify the Rolls and write data/vault.js
     node scripts/recompute.js --check    verify only, exit 1 on any mismatch

   What it checks, per Roll:
     · the file's SHA-256 matches rolls/hashes.json
     · previous_roll in the header is the hash of the Roll before it
     · closing_price in the header equals
         opening_price + (Σ rent collected − Σ costs) / shares_close
                       + (Σ curve tax on redemptions) / shares_close
       to six decimals
     · shares_close − shares_open equals Σ deposits − Σ redemptions

   What it writes: data/vault.js, a single object every page reads.
   =========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const hashes = JSON.parse(fs.readFileSync(path.join(root, 'rolls', 'hashes.json'), 'utf8'));
const buildings = JSON.parse(fs.readFileSync(path.join(root, 'data', 'buildings.json'), 'utf8'));
const byName = Object.fromEntries(buildings.map(b => [b.name, b]));

let problems = 0;
const fail = (m) => { problems++; console.error('  ✗ ' + m); };

function parseCSV(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const cells = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur); rows.push(cells);
  }
  const head = rows.shift();
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const closes = [];
let prevHash = '0x' + '0'.repeat(64);
let expectedOpening = 1.0;
const monthKeys = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = d => d.getUTCDate() + ' ' + monthKeys[d.getUTCMonth()] + ' ' + d.getUTCFullYear();

for (const entry of hashes) {
  const text = fs.readFileSync(path.join(root, entry.file), 'utf8');
  const hash = '0x' + crypto.createHash('sha256').update(text).digest('hex');
  console.error(entry.month);
  if (hash !== entry.sha256) fail('hash mismatch: file ' + hash + ' vs registry ' + entry.sha256);

  const rows = parseCSV(text);
  const header = Object.fromEntries(rows.filter(r => r.section === 'header').map(r => [r.building, r.unit]));
  if (header.previous_roll !== prevHash) fail('previous_roll does not chain: ' + header.previous_roll + ' vs ' + prevHash);
  const opening = +header.opening_price, closingStated = +header.closing_price;
  const sharesOpen = +header.shares_open, sharesClose = +header.shares_close;
  if (Math.abs(opening - expectedOpening) > 5e-7) fail('opening_price ' + opening + ' is not the previous closing ' + expectedOpening);

  const rent = rows.filter(r => r.section === 'rent');
  const costs = rows.filter(r => r.section === 'cost');
  const moves = rows.filter(r => r.section === 'movement');
  const scheduled = rent.reduce((s, r) => s + +r.lease_due, 0);
  const collected = rent.reduce((s, r) => s + +r.collected, 0);
  const costTotal = costs.reduce((s, r) => s + +r.collected, 0);
  const kept = collected - costTotal;
  let deposited = 0, redeemed = 0, curveTax = 0;
  for (const m of moves) {
    const shares = +m.collected;
    if (m.note.startsWith('deposit')) deposited += shares;
    else if (m.note.startsWith('redeem')) { redeemed += shares; const t = /tax ([\d.]+)/.exec(m.note); if (t) curveTax += +t[1]; }
  }
  if (sharesClose - sharesOpen !== deposited - redeemed) fail('shares: ' + sharesOpen + ' → ' + sharesClose + ' but deposits − redemptions = ' + (deposited - redeemed));
  const closing = opening + kept / sharesClose + curveTax / sharesClose;
  if (Math.abs(closing - closingStated) > 5e-7) fail('closing_price recomputes to ' + closing.toFixed(6) + ', header says ' + closingStated.toFixed(6));
  else console.error('  ✓ ' + closing.toFixed(6) + '  kept ' + kept + '  curve ' + curveTax.toFixed(2) + '  hash ok, chain ok');

  /* per building: what it collected and what it cost, the management fee
     spread by carrying value with largest-remainder rounding so it sums */
  const perB = {};
  for (const b of buildings) perB[b.name] = { scheduled: 0, collected: 0, costs: 0, occupied: 0, units: 0, late: 0, missed: 0 };
  for (const r of rent) {
    const p = perB[r.building]; if (!p) { fail('unknown building ' + r.building); continue; }
    p.units++; p.scheduled += +r.lease_due; p.collected += +r.collected;
    if (+r.lease_due > 0 && !/vacant|lease ended/.test(r.note)) p.occupied++;
    if (/late/.test(r.note)) p.late++;
    if (/not received|partial/.test(r.note)) p.missed++;
  }
  const topCost = costs.filter(c => c.building).map(c => { const p = c.note.split(' — '); return { building: c.building, amount: +c.collected, payee: p[0], what: p.length > 2 ? p[1] : p[0] }; }).sort((a, b) => b.amount - a.amount)[0] || null;
  const leasesEnded = rent.filter(r => /lease ended/.test(r.note)).map(r => ({ building: r.building, unit: r.unit, on: r.note.replace('lease ended ', '') }));
  const bought = rows.filter(r => r.section === 'header' && r.building === 'bought').map(r => ({ building: r.unit, value: +r.lease_due, on: r.collected_on }));
  let mgmt = 0;
  for (const c of costs) { if (c.building && perB[c.building]) perB[c.building].costs += +c.collected; else mgmt += +c.collected; }
  const totalValue = buildings.reduce((s, b) => s + b.value, 0);
  const raw = buildings.map(b => mgmt * b.value / totalValue);
  const floor = raw.map(x => Math.floor(x)); let rem = Math.round(mgmt) - floor.reduce((s, x) => s + x, 0);
  raw.map((x, i) => [x - floor[i], i]).sort((a, b) => b[0] - a[0]).slice(0, rem).forEach(([, i]) => floor[i]++);
  buildings.forEach((b, i) => { perB[b.name].costs += floor[i]; perB[b.name].net = Math.round((perB[b.name].collected - perB[b.name].costs) * 100) / 100; });

  const d = new Date(entry.month + '-01T00:00:00Z');
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  closes.push({
    month: entry.month, label: monthKeys[d.getUTCMonth()],
    date: shortDate(last),
    opening: +opening.toFixed(6), price: +closing.toFixed(6),
    rentPerShare: +(kept / sharesClose).toFixed(6), curvePerShare: +(curveTax / sharesClose).toFixed(6),
    scheduled, collected, costs: costTotal, kept, curveTax: +curveTax.toFixed(2),
    sharesOpen, sharesClose, deposited, redeemed,
    buildingsAtCost: +header.buildings_at_cost,
    hash, file: entry.file,
    topCost, leasesEnded, bought,
    buildings: Object.fromEntries(buildings.map(b => [b.id, perB[b.name]]))
  });
  prevHash = hash; expectedOpening = closing;
}

if (CHECK) { console.error(problems ? problems + ' problem(s)' : 'all ' + closes.length + ' Rolls verify'); process.exit(problems ? 1 : 0); }
if (problems) { console.error(problems + ' problem(s) — data/vault.js not written'); process.exit(1); }

/* ------------------------------------------------------------ the summary - */
const last = closes[closes.length - 1];
const priceNow = last.price;
const held = last.sharesClose * priceNow;
const units = buildings.reduce((s, b) => s + b.units, 0);
const occupied = buildings.reduce((s, b) => s + last.buildings[b.id].occupied, 0);
const cities = [...new Set(buildings.map(b => b.city))];
const countries = [...new Set(buildings.map(b => b.country))];
const vault = {
  generated: new Date().toISOString().slice(0, 10),
  price: priceNow,
  rentPerShareTotal: +closes.reduce((s, c) => s + c.rentPerShare, 0).toFixed(6),
  curvePerShareTotal: +closes.reduce((s, c) => s + c.curvePerShare, 0).toFixed(6),
  sharesInIssue: last.sharesClose,
  held: Math.round(held),
  buildingsAtCost: last.buildingsAtCost,
  reserve: Math.round(held - last.buildingsAtCost),
  scheduledMonthly: last.scheduled,
  keptLast: last.kept,
  collectedLast: last.collected,
  units, occupied, occupancy: Math.round(occupied / units * 100),
  buildingCount: buildings.length, cityCount: cities.length, countryCount: countries.length,
  cities, countries,
  nextClose: (() => { const d = new Date(last.month + '-01T00:00:00Z'); const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)); return shortDate(n); })(),
  closes,
  buildings: buildings.map(b => ({ ...b, ...last.buildings[b.id], let: Math.round(last.buildings[b.id].occupied / b.units * 100) }))
};
const js = '/* generated by scripts/recompute.js from rolls/*.csv — do not edit */\nwindow.PROPELLO_DATA = ' + JSON.stringify(vault, null, 1) + ';\n';
fs.writeFileSync(path.join(root, 'data', 'vault.js'), js);
fs.writeFileSync(path.join(root, 'data', 'vault.json'), JSON.stringify(vault, null, 1) + '\n');
console.error('wrote data/vault.js — price ' + priceNow + ', held €' + Math.round(held).toLocaleString('en-GB') + ', kept €' + last.kept.toLocaleString('en-GB'));
console.error('buildings:', vault.buildings.map(b => b.city.slice(0, 3) + ' ' + b.net).join(' | '));
