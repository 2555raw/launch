#!/usr/bin/env node
/* ===========================================================================
   render-static.js — writes the figures from data/vault.json into the HTML.

   Every region between <!-- data:key --> and <!-- /data:key --> in
   index.html and docs.html (and any translated copy in <lang>/) is replaced. The
   pages therefore carry the right numbers with JavaScript switched off, and
   can never disagree with the Rolls.

     node scripts/recompute.js && node scripts/render-static.js
   =========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const V = JSON.parse(fs.readFileSync(path.join(root, 'data', 'vault.json'), 'utf8'));
const FACADES = JSON.parse(fs.readFileSync(path.join(root, 'data', 'facades.json'), 'utf8'));
const last = V.closes[V.closes.length - 1];

/* ----------------------------------------------------- per-language ------ */
const LANGS = {
  en: {
    locale: 'en-GB', eur: (n, dp) => '€' + n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }),
    price: p => '€' + p.toFixed(4), price6: p => '€' + p.toFixed(6),
    words: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    ord: n => n + (['th', 'st', 'nd', 'rd'][(n % 10 < 4 && ![11, 12, 13].includes(n)) ? n % 10 : 0]),
    heronote: (b, c, p, n) => `${b} buildings · ${c} cities · share price <b class="rt-num">${p}</b> · ${n} closes on the record`,
    step2: k => `Last month the vault kept <b>${k}</b>`,
    stats: ['Apartments', 'Buildings', 'Cities', 'Occupied', 'Rent scheduled each month'],
    propsHead: (b, c) => `${b} buildings, ${c} cities`, netRent: m => `Net rent · ${m}`,
    heldBy: v => `Held by the vault <b>${v}</b>`, keptIn: (m, k) => `Kept in ${m} <b>${k}</b>`,
    noteTop: (m, what, b, a) => `<b>${m}</b> was the ${what} on ${b}: ${a} of it, paid once, out of the rent that month.`,
    noteLess: (m, pm, city, d) => `<b>${m}</b> collected less than ${pm} — one lease in ${city} ended on the ${d}.`,
    noteBought: (m, b, city, v) => `<b>${m}</b> bought ${b}, ${city}, for ${v}.`,
    noteNext: d => `Next close <b>${d}</b>.`,
    chartSub: (a, b) => `${a} → ${b}`,
    figs: ['Share price', 'Since 1 ', 'vRENTA in issue', 'What the vault holds', 'Deposit fee', 'Exit fee'],
    calc: ['vRENTA you would hold', 'Worth today', 'Of which rent', 'Of which the curve tax'],
    ledger: ['Rent scheduled by the leases', 'Rent collected', (city, d) => `(one lease in ${city} ended on the ${d})`, 'Property costs and fees', 'Kept, and added to the reserve', 'Curve tax received from early redemptions', 'Shares in issue at the close', 'Change in the share price', 'Closing price of one vRENTA'],
    ledgerText: (kept, sh, rps, cps, o, p, p4, m) => `${kept} across ${sh} shares is ${rps} a share. The curve tax added ${cps}. The\n      price moved from ${o} to ${p}, which the site rounds to ${p4}. Every one of those\n      numbers is in the Roll for ${m}, and the Roll's hash is in the registry.`,
    cities: {}, countries: {}
  }
};

function render(lang) {
  const L = LANGS[lang];
  const eur = (n, dp = 0) => L.eur(n, dp);
  const num = (n, dp = 0) => n.toLocaleString(L.locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const mi = ym => +ym.slice(5, 7) - 1;
  const monthName = ym => L.months[mi(ym)];
  const dateOf = (d) => { const [day, , year] = d.split(' '); const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(d.split(' ')[1]); return `${day} ${L.short[m]} ${year}`; };
  const city = c => L.cities[c] || c;
  const what = w => L.what ? (L.what[w.split(',')[0]] || w.split(',')[0].toLowerCase()) : w.split(',')[0].toLowerCase();
  const R = {};
  R.heronote = L.heronote(V.buildingCount, V.cityCount, L.price(V.price), L.words[V.closes.length]);
  R.step2 = L.step2(eur(V.keptLast));
  R.stats = `<div class="rt-stats rt-rise">
        <div class="rt-stat rt-stat--lit"><b class="rt-num" data-count="${V.units}">${V.units}</b><small>${L.stats[0]}</small></div>
        <div class="rt-stat"><b class="rt-num" data-count="${V.buildingCount}">${V.buildingCount}</b><small>${L.stats[1]}</small></div>
        <div class="rt-stat"><b class="rt-num" data-count="${V.cityCount}">${V.cityCount}</b><small>${L.stats[2]}</small></div>
        <div class="rt-stat"><b class="rt-num" data-count="${V.occupancy}" data-suffix="%">${V.occupancy}%</b><small>${L.stats[3]}</small></div>
        <div class="rt-stat"><b class="rt-num">${eur(V.scheduledMonthly)}</b><small>${L.stats[4]}</small></div>
      </div>`;
  R['props-head'] = `<h3>${cap(L.propsHead(L.words[V.buildingCount], L.words[V.cityCount]))}</h3>
            <span>${L.netRent(monthName(last.month))}</span>`;
  R.props = V.buildings.map(b =>
    `            <tr data-city="${b.city}" data-building="${b.id}" tabindex="0"><td><span class="rt-thumb">${FACADES[b.id] || ''}</span>${b.name}</td><td class="rt-c-muted">${city(b.city)}</td><td>${b.units}</td><td class="rt-c-muted">${b.let}%</td><td>${eur(b.value)}</td><td class="rt-pos">${eur(b.net)}</td></tr>`
  ).join('\n') + '\n';
  R['props-foot'] = `<span>${L.heldBy(eur(V.buildingsAtCost))}</span>
          <span>${L.keptIn(monthName(last.month), eur(V.keptLast))}</span>`;
  R.roll = V.closes.map(c =>
    `            <tr><td>${dateOf(c.date)}</td><td>${eur(c.collected)}</td><td class="rt-c-muted">−${eur(c.costs)}</td><td>${eur(c.kept)}</td><td>${L.price(c.price)}</td><td class="rt-pos">+${num((c.price / c.opening - 1) * 100, 2)}%</td></tr>`
  ).join('\n') + '\n';

  const notes = [];
  const roof = V.closes.map(c => c.topCost && { ...c.topCost, month: c.month }).filter(Boolean).sort((a, b) => b.amount - a.amount)[0];
  if (roof) notes.push('<span>' + L.noteTop(cap(monthName(roof.month)), what(roof.what), roof.building, eur(roof.amount)) + '</span>');
  for (let i = 1; i < V.closes.length; i++) {
    const c = V.closes[i], p = V.closes[i - 1];
    if (c.collected < p.collected && c.leasesEnded.length) {
      const l = c.leasesEnded[0]; const cty = V.buildings.find(b => b.name === l.building).city;
      notes.push('<span>' + L.noteLess(cap(monthName(c.month)), monthName(p.month), city(cty), L.ord(+l.on.slice(-2))) + '</span>');
    }
  }
  for (const c of V.closes) for (const b of c.bought) notes.push('<span>' + L.noteBought(cap(monthName(c.month)), b.building, city(V.buildings.find(x => x.name === b.building).city), eur(b.value)) + '</span>');
  notes.push('<span>' + L.noteNext(dateOf(V.nextClose)) + '</span>');
  R['roll-note'] = `<div class="rt-roll-note">\n          ${notes.join('\n          ')}\n        </div>`;

  R['chart-sub'] = `<div class="rt-chart-sub">${L.chartSub('1 ' + L.short[mi(V.closes[0].month)] + ' ' + V.closes[0].month.slice(0, 4), dateOf(last.date))}</div>`;
  R.figs = `<div class="rt-figs rt-rise">
          <div class="rt-fig"><span>${L.figs[0]}</span><b class="rt-num">${L.price(V.price)}</b></div>
          <div class="rt-fig"><span>${L.figs[1]}${monthName(V.closes[0].month)}</span><b class="rt-num rt-pos">+${num((V.price - 1) * 100, 2)}%</b></div>
          <div class="rt-fig"><span>${L.figs[2]}</span><b class="rt-num">${num(V.sharesInIssue)}</b></div>
          <div class="rt-fig"><span>${L.figs[3]}</span><b class="rt-num">${eur(V.held)}</b></div>
          <div class="rt-fig"><span>${L.figs[4]}</span><b class="rt-num">0,00%</b></div>
          <div class="rt-fig"><span>${L.figs[5]}</span><b class="rt-num">0,00%</b></div>
        </div>`.replace(/0,00%/g, lang === 'en' ? '0.00%' : '0,00 %');
  const D = 10000;
  R.calc = `<div class="rt-row"><span>${L.calc[0]}</span><b class="rt-num" id="o-shares">${num(D, 2)} vRENTA</b></div>
            <div class="rt-row rt-row--big"><span>${L.calc[1]}</span><b class="rt-num rt-pos" id="o-worth">${eur(D * V.price, 2)}</b></div>
            <div class="rt-row"><span>${L.calc[2]}</span><b class="rt-num" id="o-rent">+${eur(D * V.rentPerShareTotal, 2)}</b></div>
            <div class="rt-row"><span>${L.calc[3]}</span><b class="rt-num" id="o-curve">+${eur(D * V.curvePerShareTotal, 2)}</b></div>`;
  R.reserve = eur(V.reserve);

  const le = last.leasesEnded.length ? ' <span class="rt-c-muted">' + L.ledger[2](city(V.buildings.find(b => b.name === last.leasesEnded[0].building).city), L.ord(+last.leasesEnded[0].on.slice(-2))) + '</span>' : '';
  R.ledger = `<table class="rt-ledger">
      <tr><td>${L.ledger[0]}</td><td>${eur(last.scheduled)}</td></tr>
      <tr><td>${L.ledger[1]}${le}</td><td>${eur(last.collected)}</td></tr>
      <tr><td>${L.ledger[3]}</td><td>−${eur(last.costs)}</td></tr>
      <tr class="rt-sum"><td>${L.ledger[4]}</td><td>${eur(last.kept)}</td></tr>
      <tr><td>${L.ledger[5]}</td><td>${eur(last.curveTax)}</td></tr>
      <tr><td>${L.ledger[6]}</td><td>${num(last.sharesClose)}</td></tr>
      <tr><td>${L.ledger[7]}</td><td>+${L.price6(last.price - last.opening)}</td></tr>
      <tr class="rt-sum"><td>${L.ledger[8]}</td><td>${L.price6(last.price)}</td></tr>
    </table>`;
  R['ledger-text'] = `<p>
      ${L.ledgerText(eur(last.kept), num(last.sharesClose), L.price6(last.rentPerShare), L.price6(last.curvePerShare), L.price6(last.opening), L.price6(last.price), L.price(last.price), monthName(last.month))}
    </p>`;
  R.hashes = `<table class="rt-kv rt-kv--hashes">
${V.closes.map(c => `      <tr><th><a href="${lang === 'en' ? '' : '../'}${c.file}" download>${c.file}</a></th><td><code>${c.hash}</code></td></tr>`).join('\n')}
    </table>`;
  return R;
}

let touched = 0;
const targets = [['en', ['index.html', 'docs.html']]];
for (const lang of Object.keys(LANGS)) if (lang !== 'en' && fs.existsSync(path.join(root, lang))) targets.push([lang, [lang + '/index.html', lang + '/docs.html']]);
for (const [lang, files] of targets) {
  const R = render(lang);
  for (const file of files) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) { console.error('  (no ' + file + ' yet — run translate.js first)'); continue; }
    let html = fs.readFileSync(p, 'utf8');
    html = html.replace(/<!-- data:([a-z-]+) -->[\s\S]*?<!-- \/data:\1 -->/g, (m, key) => {
      if (!(key in R)) { console.error('  no renderer for data:' + key + ' in ' + file); return m; }
      touched++;
      return `<!-- data:${key} -->${R[key]}<!-- /data:${key} -->`;
    });
    fs.writeFileSync(p, html);
  }
}
console.error('rendered ' + touched + ' regions from ' + V.closes.length + ' closes (price €' + V.price + ')');
