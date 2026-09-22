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
  },
  zh: {
    locale: 'zh-CN', eur: (n, dp) => '€' + n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }),
    price: p => '€' + p.toFixed(4), price6: p => '€' + p.toFixed(6),
    words: ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'],
    months: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    short: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    ord: n => n + ' 日',
    heronote: (b, c, p, n) => `${b} 栋楼 · ${c} 座城市 · 份额价格 <b class="rt-num">${p}</b> · 已记录 ${n} 次结算`,
    step2: k => `上个月金库留存了 <b>${k}</b>`,
    stats: ['套公寓', '栋楼', '座城市', '出租率', '每月应收租金'],
    propsHead: (b, c) => `${b}栋楼，${c}座城市`, netRent: m => `净租金 · ${m}`,
    heldBy: v => `金库账面持有 <b>${v}</b>`, keptIn: (m, k) => `${m}留存 <b>${k}</b>`,
    noteTop: (m, what, b, a) => `<b>${m}</b>是 ${b} 的${what}：${a}，一次付清，从当月租金中支出。`,
    noteLess: (m, pm, city, d) => `<b>${m}</b>的实收少于${pm}——${city}的一份租约于 ${d}到期。`,
    noteBought: (m, b, city, v) => `<b>${m}</b>以 ${v} 买入 ${b}（${city}）。`,
    noteNext: d => `下次结算：<b>${d}</b>。`,
    chartSub: (a, b) => `${a} → ${b}`,
    figs: ['份额价格', '自 3 月 1 日起 ', 'vRENTA 流通量', '金库持有', '存入费', '赎回费'],
    calc: ['你将持有的 vRENTA', '今日价值', '其中租金', '其中曲线税'],
    ledger: ['租约应收租金', '实收租金', (city, d) => `（${city}的一份租约于 ${d}到期）`, '物业成本与费用', '留存并计入储备', '提前赎回缴纳的曲线税', '结算时流通份额', '份额价格变动', '一个 vRENTA 的结算价格'],
    ledgerText: (kept, sh, rps, cps, o, p, p4, m) => `${kept} 分摊到 ${sh} 份，每份 ${rps}。曲线税增加了 ${cps}。价格从 ${o}\n      变为 ${p}，网站将其取整为 ${p4}。这些数字每一个都在${m}的月报里，月报的哈希在登记合约中。`,
    cities: { Lisbon: '里斯本', Madrid: '马德里', Barcelona: '巴塞罗那', Terrassa: '特拉萨', Turin: '都灵', Leipzig: '莱比锡', Rotterdam: '鹿特丹', 'Kraków': '克拉科夫' },
    countries: { Portugal: '葡萄牙', Spain: '西班牙', Italy: '意大利', Germany: '德国', Netherlands: '荷兰', Poland: '波兰' },
    what: { roof: '屋顶', plumbing: '管道维修', 'boiler service': '锅炉保养', 'lift inspection': '电梯检查', 'common-parts cleaning': '公共区域清洁', 'lock change': '换锁', 'window seal': '窗户密封', electrician: '电工', 'painting': '粉刷', gutter: '排水槽', 'intercom repair': '对讲机维修' }
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
          <div class="rt-fig"><span>${lang === 'zh' ? '自 ' + monthName(V.closes[0].month) + ' 1 日起' : L.figs[1] + monthName(V.closes[0].month)}</span><b class="rt-num rt-pos">+${num((V.price - 1) * 100, 2)}%</b></div>
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
    html = html.replace(/<!-- data:([a-z0-9-]+) -->[\s\S]*?<!-- \/data:\1 -->/g, (m, key) => {
      if (!(key in R)) { console.error('  no renderer for data:' + key + ' in ' + file); return m; }
      touched++;
      return `<!-- data:${key} -->${R[key]}<!-- /data:${key} -->`;
    });
    fs.writeFileSync(p, html);
  }
}
console.error('rendered ' + touched + ' regions from ' + V.closes.length + ' closes (price €' + V.price + ')');
