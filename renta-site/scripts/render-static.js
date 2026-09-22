#!/usr/bin/env node
/* ===========================================================================
   render-static.js — writes the figures from data/vault.json into the HTML.

   Every region between <!-- data:key --> and <!-- /data:key --> in
   index.html and docs.html is replaced. The pages therefore carry the right
   numbers with JavaScript switched off, and can never disagree with the Rolls.

     node scripts/recompute.js && node scripts/render-static.js
   =========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const V = JSON.parse(fs.readFileSync(path.join(root, 'data', 'vault.json'), 'utf8'));
const last = V.closes[V.closes.length - 1];

const eur = (n, dp = 0) => '€' + n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const num = (n, dp = 0) => n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const cap = s => s[0].toUpperCase() + s.slice(1);
const monthName = ym => new Date(ym + '-01T00:00:00Z').toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
const monthShort = ym => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+ym.slice(5, 7) - 1];

const R = {};

R.heronote = `${V.buildingCount} buildings · ${V.cityCount} cities · share price <b class="rt-num">€${V.price.toFixed(4)}</b> · ${words[V.closes.length]} closes on the record`;
R.step2 = `Last month the vault kept <b>${eur(V.keptLast)}</b>`;
R.stats = `<div class="rt-stats rt-rise">
        <div class="rt-stat rt-stat--lit"><b class="rt-num" data-count="${V.units}">${V.units}</b><small>Apartments</small></div>
        <div class="rt-stat"><b class="rt-num" data-count="${V.buildingCount}">${V.buildingCount}</b><small>Buildings</small></div>
        <div class="rt-stat"><b class="rt-num" data-count="${V.cityCount}">${V.cityCount}</b><small>Cities</small></div>
        <div class="rt-stat"><b class="rt-num" data-count="${V.occupancy}" data-suffix="%">${V.occupancy}%</b><small>Occupied</small></div>
        <div class="rt-stat"><b class="rt-num">${eur(V.scheduledMonthly)}</b><small>Rent scheduled each month</small></div>
      </div>`;
R['props-head'] = `<h3>${cap(words[V.buildingCount])} buildings, ${words[V.cityCount]} cities</h3>
            <span>Net rent · ${monthName(last.month)}</span>`;
R.props = V.buildings.map(b =>
  `            <tr data-city="${b.city}" data-building="${b.id}"><td>${b.name}</td><td class="rt-c-muted">${b.city}</td><td>${b.units}</td><td class="rt-c-muted">${b.let}%</td><td>${eur(b.value)}</td><td class="rt-pos">${eur(b.net)}</td></tr>`
).join('\n') + '\n';
R['props-foot'] = `<span>Held by the vault <b>${eur(V.buildingsAtCost)}</b></span>
          <span>Kept in ${monthName(last.month)} <b>${eur(V.keptLast)}</b></span>`;
R.roll = V.closes.map(c =>
  `            <tr><td>${c.date}</td><td>${eur(c.collected)}</td><td class="rt-c-muted">−${eur(c.costs)}</td><td>${eur(c.kept)}</td><td>€${c.price.toFixed(4)}</td><td class="rt-pos">+${((c.price / c.opening - 1) * 100).toFixed(2)}%</td></tr>`
).join('\n') + '\n';

/* the month's story, told from the data rather than typed in */
const notes = [];
const roof = V.closes.map(c => c.topCost && { ...c.topCost, month: c.month }).filter(Boolean).sort((a, b) => b.amount - a.amount)[0];
if (roof) notes.push(`<span><b>${monthName(roof.month)}</b> was the ${roof.what.split(',')[0].toLowerCase()} on ${roof.building}: ${eur(roof.amount)} of it, paid once, out of the rent that month.</span>`);
for (let i = 1; i < V.closes.length; i++) {
  const c = V.closes[i], p = V.closes[i - 1];
  if (c.collected < p.collected && c.leasesEnded.length) {
    const l = c.leasesEnded[0]; const city = V.buildings.find(b => b.name === l.building).city;
    notes.push(`<span><b>${monthName(c.month)}</b> collected less than ${monthName(p.month)} — one lease in ${city} ended on the ${+l.on.slice(-2)}${['th', 'st', 'nd', 'rd'][(+l.on.slice(-2) % 10 < 4 && ![11, 12, 13].includes(+l.on.slice(-2))) ? +l.on.slice(-2) % 10 : 0]}.</span>`);
  }
}
for (const c of V.closes) for (const b of c.bought) notes.push(`<span><b>${monthName(c.month)}</b> bought ${b.building}, ${V.buildings.find(x => x.name === b.building).city}, for ${eur(b.value)}.</span>`);
notes.push(`<span>Next close <b>${V.nextClose}</b>.</span>`);
R['roll-note'] = `<div class="rt-roll-note">\n          ${notes.join('\n          ')}\n        </div>`;

R['chart-sub'] = `<div class="rt-chart-sub">1 ${monthShort(V.closes[0].month)} ${V.closes[0].month.slice(0, 4)} → ${last.date}</div>`;
R.figs = `<div class="rt-figs rt-rise">
          <div class="rt-fig"><span>Share price</span><b class="rt-num">€${V.price.toFixed(4)}</b></div>
          <div class="rt-fig"><span>Since 1 ${monthName(V.closes[0].month)}</span><b class="rt-num rt-pos">+${((V.price - 1) * 100).toFixed(2)}%</b></div>
          <div class="rt-fig"><span>vRENTA in issue</span><b class="rt-num">${num(V.sharesInIssue)}</b></div>
          <div class="rt-fig"><span>What the vault holds</span><b class="rt-num">${eur(V.held)}</b></div>
          <div class="rt-fig"><span>Deposit fee</span><b class="rt-num">0.00%</b></div>
          <div class="rt-fig"><span>Exit fee</span><b class="rt-num">0.00%</b></div>
        </div>`;
const D = 10000;
R.calc = `<div class="rt-row"><span>vRENTA you would hold</span><b class="rt-num" id="o-shares">${num(D, 2)} vRENTA</b></div>
            <div class="rt-row rt-row--big"><span>Worth today</span><b class="rt-num rt-pos" id="o-worth">${eur(D * V.price, 2)}</b></div>
            <div class="rt-row"><span>Of which rent</span><b class="rt-num" id="o-rent">+${eur(D * V.rentPerShareTotal, 2)}</b></div>
            <div class="rt-row"><span>Of which the curve tax</span><b class="rt-num" id="o-curve">+${eur(D * V.curvePerShareTotal, 2)}</b></div>`;
R.reserve = eur(V.reserve);

/* docs */
R.ledger = `<table class="rt-ledger">
      <tr><td>Rent scheduled by the leases</td><td>${eur(last.scheduled)}</td></tr>
      <tr><td>Rent collected${last.leasesEnded.length ? ' <span class="rt-c-muted">(one lease in ' + V.buildings.find(b => b.name === last.leasesEnded[0].building).city + ' ended on the ' + (+last.leasesEnded[0].on.slice(-2)) + 'th)</span>' : ''}</td><td>${eur(last.collected)}</td></tr>
      <tr><td>Property costs and fees</td><td>−${eur(last.costs)}</td></tr>
      <tr class="rt-sum"><td>Kept, and added to the reserve</td><td>${eur(last.kept)}</td></tr>
      <tr><td>Curve tax received from early redemptions</td><td>${eur(last.curveTax)}</td></tr>
      <tr><td>Shares in issue at the close</td><td>${num(last.sharesClose)}</td></tr>
      <tr><td>Change in the share price</td><td>+€${(last.price - last.opening).toFixed(6)}</td></tr>
      <tr class="rt-sum"><td>Closing price of one vRENTA</td><td>€${last.price.toFixed(6)}</td></tr>
    </table>`;
R['ledger-text'] = `<p>
      ${eur(last.kept)} across ${num(last.sharesClose)} shares is €${last.rentPerShare.toFixed(6)} a share. The curve tax added €${last.curvePerShare.toFixed(6)}. The
      price moved from €${last.opening.toFixed(6)} to €${last.price.toFixed(6)}, which the site rounds to €${last.price.toFixed(4)}. Every one of those
      numbers is in the Roll for ${monthName(last.month)}, and the Roll's hash is in the registry.
    </p>`;
R.hashes = `<table class="rt-kv rt-kv--hashes">
${V.closes.map(c => `      <tr><th><a href="${c.file}" download>${c.file}</a></th><td><code>${c.hash}</code></td></tr>`).join('\n')}
    </table>`;

let touched = 0;
for (const file of ['index.html', 'docs.html']) {
  const p = path.join(root, file);
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace(/<!-- data:([a-z-]+) -->[\s\S]*?<!-- \/data:\1 -->/g, (m, key) => {
    if (!(key in R)) { console.error('  no renderer for data:' + key + ' in ' + file); return m; }
    touched++;
    return `<!-- data:${key} -->${R[key]}<!-- /data:${key} -->`;
  });
  fs.writeFileSync(p, html);
}
console.error('rendered ' + touched + ' regions from ' + V.closes.length + ' closes (price €' + V.price + ')');
