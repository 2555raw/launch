#!/usr/bin/env node
/* ===========================================================================
   make-rolls.js — writes the six demonstration Rolls into ../rolls/.

   This is the one place the demonstration's numbers are invented. Everything
   else on the site is COMPUTED from the files this writes, by recompute.js.
   The generator is deterministic (a fixed-seed PRNG), so running it twice
   gives byte-identical files and identical hashes.
   =========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------ the vault --- */
const BUILDINGS = [
  { name: 'Rua da Bica 14',        city: 'Lisbon',    country: 'Portugal',    units: 8,  value: 1120000, monthly: 4320 },
  { name: 'Mesón de Paredes 41',   city: 'Madrid',    country: 'Spain',       units: 9,  value: 1430000, monthly: 5180, empty: ['4B'] },
  { name: "Torrent de l'Olla 62",  city: 'Barcelona', country: 'Spain',       units: 6,  value: 1580000, monthly: 4460, bought: '2026-05-27' },
  { name: 'Carrer del Nord 15',    city: 'Terrassa',  country: 'Spain',       units: 7,  value:  690000, monthly: 2730, bought: '2026-04-22' },
  { name: "Via Sant'Ottavio 24",   city: 'Turin',     country: 'Italy',       units: 8,  value:  850000, monthly: 3290, empty: ['2A'], bought: '2026-03-18' },
  { name: 'Kurt-Eisner-Straße 27', city: 'Leipzig',   country: 'Germany',     units: 10, value: 1240000, monthly: 4560 },
  { name: 'Gohliser Straße 9',     city: 'Leipzig',   country: 'Germany',     units: 6,  value:  750000, monthly: 2840 },
  { name: 'Beijerlandselaan 112',  city: 'Rotterdam', country: 'Netherlands', units: 10, value: 1720000, monthly: 7020 },
  { name: 'Zwaanshals 64',         city: 'Rotterdam', country: 'Netherlands', units: 5,  value:  860000, monthly: 2780, empty: ['1'], endedOn: '2026-08-09' },
  { name: 'Ulica Krakowska 18',    city: 'Kraków',    country: 'Poland',      units: 8,  value:  660000, monthly: 3440 }
];

/* one row per close: what arrived, what went out, what came in and left */
const MONTHS = [
  { ym: '2026-03', last: '2026-03-31', collected: 43290, costs: 13652, supplyOpen:        0, supplyClose:  8420000, curve: 5069, opening: 1.000000 },
  { ym: '2026-04', last: '2026-04-30', collected: 47880, costs: 14812, supplyOpen:  8420000, supplyClose:  9160000, curve: 4864 },
  { ym: '2026-05', last: '2026-05-31', collected: 50120, costs: 16350, supplyOpen:  9160000, supplyClose:  9704000, curve: 6211, note: 'roof, Kurt-Eisner-Straße 27' },
  { ym: '2026-06', last: '2026-06-30', collected: 55410, costs: 17061, supplyOpen:  9704000, supplyClose: 10240000, curve: 5099 },
  { ym: '2026-07', last: '2026-07-31', collected: 58940, costs: 18205, supplyOpen: 10240000, supplyClose: 10608000, curve: 6100 },
  { ym: '2026-08', last: '2026-08-31', collected: 58870, costs: 18250, supplyOpen: 10608000, supplyClose: 11050000, curve: 7470 }
];

/* a building earns rent from the month after it is bought; its value joins
   the carrying total on the day it is bought */
const owned = (b, m) => !b.bought || b.bought < m.ym + '-01';
const carried = m => BUILDINGS.filter(b => !b.bought || b.bought <= m.last).reduce((s, b) => s + b.value, 0);
const boughtIn = m => BUILDINGS.filter(b => b.bought && b.bought.startsWith(m.ym));

/* --------------------------------------------------------------- prng ----- */
let seed = 20260301;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = arr => arr[Math.floor(rnd() * arr.length)];

const fmt = n => (Math.round(n * 1e6) / 1e6).toFixed(6);
const csvq = s => /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;

function unitLabel(b, i) {
  const floors = Math.ceil(b.units / 2);
  const floor = Math.floor(i / 2) + 1, side = i % 2 === 0 ? 'A' : 'B';
  return b.units <= 5 ? String(i + 1) : floor + side;
}

/* the rent roll: split each building's scheduled rent over its units so that
   the sum is exact, mark the empties, then decide who paid late or not at all
   so that the month's collected total lands exactly on the figure above. */
function rentLines(m, mi) {
  const lines = [];
  let scheduledTotal = 0;
  for (const b of BUILDINGS.filter(b => owned(b, m))) {
    /* schedule is the lease figure, only occupied units count. The scheduled
       rent of an occupied building = monthly net-to-vault / 0.6907 gross-up,
       so it is stable month to month and the empties are simply missing. */
    const occupied = b.units - (b.empty ? b.empty.length : 0);
    const gross = Math.round(b.monthly / 0.6616 / 5) * 5;     /* lease rent, occupied units */
    const perUnit = Math.round(gross / occupied / 5) * 5;
    for (let i = 0; i < b.units; i++) {
      const unit = unitLabel(b, i);
      const empty = b.empty && b.empty.includes(unit);
      const endedThisMonth = empty && b.endedOn && b.endedOn.startsWith(m.ym);
      const emptyBefore = empty && !(b.endedOn && b.endedOn > m.last) && !endedThisMonth;
      let due = empty ? (endedThisMonth ? Math.round(perUnit * 8 / 31) : (b.endedOn && b.endedOn > m.last ? perUnit : 0)) : perUnit;
      lines.push({ b, unit, due, empty: emptyBefore, endedThisMonth });
      scheduledTotal += due;
    }
  }
  /* make collected land on the month's figure: some tenants pay a few days
     late (still inside the month), a few pay part, one or two pay nothing */
  let shortfall = scheduledTotal - m.collected;
  if (shortfall < 0) throw new Error(m.ym + ': collected exceeds scheduled by ' + (-shortfall));
  const payable = lines.filter(l => l.due > 0);
  /* spread it: no building loses more than one and a half rents in a month */
  let guard = 0;
  while (shortfall > 0 && guard++ < 200) {
    const l = pick(payable);
    if (l.collected !== undefined) continue;
    const lost = lines.filter(x => x.b === l.b && x.collected !== undefined).reduce((s, x) => s + (x.due - x.collected), 0);
    if (lost + l.due * 0.5 > l.due * 1.5) continue;
    const full = rnd() < 0.35;
    const gap = Math.min(shortfall, full ? l.due : Math.round(l.due * (0.2 + rnd() * 0.5) / 5) * 5);
    l.collected = l.due - gap; l.note = gap === l.due ? 'not received' : 'partial, balance chased';
    shortfall -= gap;
  }
  if (shortfall > 0) { const l = payable.find(l => l.collected === undefined); l.collected = l.due - shortfall; l.note = 'partial, balance chased'; }
  for (const l of lines) {
    if (l.due === 0) { l.collected = 0; l.on = ''; l.note = l.endedThisMonth ? 'lease ended ' + l.b.endedOn : (l.empty ? 'vacant' : ''); continue; }
    if (l.collected === undefined) l.collected = l.due;
    const day = l.collected === 0 ? '' : String(1 + Math.floor(rnd() * (rnd() < 0.8 ? 5 : 20))).padStart(2, '0');
    l.on = day ? m.ym + '-' + day : '';
    if (l.endedThisMonth) l.note = 'lease ended ' + l.b.endedOn + (l.note ? ', ' + l.note : '');
    else if (!l.note) l.note = day && +day > 7 ? 'late' : '';
  }
  return { lines, scheduledTotal };
}

/* costs: the standing items every month plus repairs, summing exactly */
function costLines(m) {
  const items = [];
  const mine = BUILDINGS.filter(b => owned(b, m));
  const mgmt = Math.round(carried(m) * 0.0035 / 12);                   /* 0.35% a year of what is held */
  items.push({ b: '', payee: 'RENTA Vastgoed B.V. — management fee 0.35%', ref: 'MGMT-' + m.ym, amount: mgmt });
  for (const b of mine) {
    items.push({ b: b.name, payee: 'managing agent, ' + b.city, ref: 'AGT-' + m.ym + '-' + b.city.slice(0, 3).toUpperCase(), amount: Math.round(b.monthly * 0.085 / 5) * 5 });
    items.push({ b: b.name, payee: 'property tax, ' + b.city, ref: 'TAX-' + m.ym, amount: Math.round(b.value * 0.0042 / 12 / 5) * 5 });
    items.push({ b: b.name, payee: 'buildings insurance', ref: 'INS-' + m.ym, amount: Math.round(b.value * 0.0016 / 12 / 5) * 5 });
  }
  if (m.note) items.push({ b: 'Kurt-Eisner-Straße 27', payee: 'Dachdeckerei Hoffmann — roof, west section', ref: 'LE-2026-0512', amount: 4180 });
  const standing = items.reduce((s, i) => s + i.amount, 0);
  /* the rest is repairs and small works, spread over a handful of invoices */
  let rest = m.costs - standing;
  if (rest < 0) throw new Error(m.ym + ': standing costs exceed the month\'s costs by ' + (-rest));
  const works = ['plumbing', 'boiler service', 'lift inspection', 'common-parts cleaning', 'lock change', 'window seal', 'electrician', 'painting, stairwell', 'gutter', 'intercom repair'];
  /* repairs land on every building roughly by size, with some luck */
  const totalV = mine.reduce((s, b) => s + b.value, 0);
  const share = mine.map(b => (b.value / totalV) * (0.6 + rnd() * 0.8));
  const norm = share.reduce((s, x) => s + x, 0);
  let n = 0, given = 0;
  mine.forEach((b, i) => {
    const amt = i === mine.length - 1 ? rest - given : Math.round(rest * share[i] / norm / 5) * 5;
    if (amt <= 0) return;
    items.push({ b: b.name, payee: pick(works), ref: b.city.slice(0, 2).toUpperCase() + '-' + m.ym.replace('-', '') + '-' + String(100 + n++), amount: amt });
    given += amt;
  });
  return items;
}

/* movements: deposits and redemptions whose net is the change in supply, and
   whose curve tax is the month's figure */
function movementLines(m, price) {
  const lines = [];
  const net = m.supplyClose - m.supplyOpen;
  const wallets = ['0x3fA1…9a1c', '0x7c02…44de', '0xB19e…0f7a', '0x54d3…c2e8', '0xE8a0…1b3f', '0x2D77…e6a4', '0x9cC4…7d10', '0x61F2…a09b'];
  let redeemed = 0, curve = 0;
  const nRedeem = MONTHS.indexOf(m) === 0 ? 4 : 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < nRedeem; i++) {
    const shares = Math.round((2000 + rnd() * 30000) / 100) * 100;
    const pct = i === nRedeem - 1 ? null : Math.round(rnd() * 250) / 100;   /* curve % */
    lines.push({ kind: 'redeem', wallet: pick(wallets), shares, pct });
    redeemed += shares;
  }
  /* solve the last redemption's curve so the month's curve tax is exact */
  let taxSoFar = 0;
  for (const l of lines) if (l.pct !== null) { l.tax = Math.round(l.shares * price * l.pct / 100 * 100) / 100; taxSoFar += l.tax; }
  const last = lines[lines.length - 1];
  last.tax = Math.round((m.curve - taxSoFar) * 100) / 100;
  last.pct = Math.round(last.tax / (last.shares * price) * 10000) / 100;
  const deposited = net + redeemed;
  const nDep = 6 + Math.floor(rnd() * 5);
  let left = deposited;
  for (let i = 0; i < nDep; i++) {
    const shares = i === nDep - 1 ? left : Math.min(left, Math.round((5000 + rnd() * (deposited / nDep) * 1.6) / 100) * 100);
    lines.push({ kind: 'deposit', wallet: pick(wallets), shares });
    left -= shares;
  }
  /* order them through the month */
  for (const l of lines) l.day = m.ym + '-' + String(1 + Math.floor(rnd() * 28)).padStart(2, '0');
  lines.sort((a, b) => a.day < b.day ? -1 : 1);
  return lines;
}

/* ------------------------------------------------------------- write ----- */
let prevHash = '0x' + '0'.repeat(64);
let price = 1.0;
const crypto = require('crypto');
const out = [];
for (const m of MONTHS) {
  const { lines, scheduledTotal } = rentLines(m);
  const costs = costLines(m);
  const moves = movementLines(m, price);
  const kept = m.collected - m.costs;
  const perShareRent = kept / m.supplyClose, perShareCurve = m.curve / m.supplyClose;
  const closing = price + perShareRent + perShareCurve;

  const rows = [['section', 'building', 'unit', 'lease_due', 'collected', 'collected_on', 'note']];
  rows.push(['header', 'month', m.ym, '', '', '', '']);
  rows.push(['header', 'opening_price', fmt(price), '', '', '', '']);
  rows.push(['header', 'closing_price', fmt(closing), '', '', '', '']);
  rows.push(['header', 'shares_open', String(m.supplyOpen), '', '', '', '']);
  rows.push(['header', 'shares_close', String(m.supplyClose), '', '', '', '']);
  rows.push(['header', 'buildings_at_cost', fmt(carried(m)), '', '', '', '']);
  for (const b of boughtIn(m)) rows.push(['header', 'bought', b.name, fmt(b.value), '', b.bought, b.city + ' — ' + b.units + ' apartments, let on completion']);
  rows.push(['header', 'previous_roll', prevHash, '', '', '', '']);
  for (const l of lines) rows.push(['rent', l.b.name, l.unit, fmt(l.due), fmt(l.collected), l.on, l.note]);
  for (const c of costs) rows.push(['cost', c.b, '', '', fmt(c.amount), m.last, c.payee + ' — invoice ' + c.ref]);
  for (const v of moves) rows.push(['movement', '', '', '', fmt(v.shares), v.day, v.kind + ' ' + v.wallet + (v.kind === 'redeem' ? ' at ' + fmt(price) + ' curve ' + v.pct.toFixed(2) + '% tax ' + v.tax.toFixed(2) : ' at ' + fmt(price))]);
  const csv = rows.map(r => r.map(csvq).join(',')).join('\n') + '\n';
  const file = path.join(__dirname, '..', 'rolls', m.ym + '.csv');
  fs.writeFileSync(file, csv);
  const hash = '0x' + crypto.createHash('sha256').update(csv).digest('hex');
  out.push({ month: m.ym, file: 'rolls/' + m.ym + '.csv', sha256: hash, scheduled: scheduledTotal, collected: m.collected, costs: m.costs, kept, curve: m.curve, closing: +closing.toFixed(6) });
  console.error(m.ym, 'scheduled', scheduledTotal, 'collected', m.collected, 'kept', kept, 'closing', closing.toFixed(6), hash.slice(0, 12));
  prevHash = hash; price = closing;
}
fs.writeFileSync(path.join(__dirname, '..', 'rolls', 'hashes.json'), JSON.stringify(out.map(o => ({ month: o.month, file: o.file, sha256: o.sha256 })), null, 2) + '\n');
console.error('wrote', out.length, 'rolls + hashes.json');
