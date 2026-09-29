// Nebari — the garden: every launch from the factory, each with its own bonsai.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  function card(L, s) {
    const a = document.createElement('a');
    a.className = 'tree-card';
    a.href = 'token.html?token=' + L.token;
    const canvas = document.createElement('canvas');
    a.appendChild(canvas);
    const body = document.createElement('div');
    body.className = 'tc-body';
    body.innerHTML = `
      <div class="tc-row"><h3>${escape(s.name)}</h3><span class="pill pill-pink">${escape(s.symbol)}</span></div>
      <div class="tc-pair" style="margin-top:6px">rooted to <span class="pair-logo"></span> ${escape(s.pair.symbol)}</div>
      <div class="tc-stats">
        <div><span>Price</span><b>${Nebari.fmt.num(s.price)} ${escape(s.pair.symbol)}</b></div>
        <div><span>Market cap</span><b>${Nebari.fmt.num(s.marketCap)} ${escape(s.pair.symbol)}</b></div>
        <div><span>Volume</span><b>${Nebari.fmt.num(s.volume)} ${escape(s.pair.symbol)}</b></div>
        <div><span>Paid to holders</span><b>${Nebari.fmt.units(s.totalDistributed, s.pair.decimals)} ${escape(s.pair.symbol)}</b></div>
      </div>`;
    const pick = Nebari.C.quickPicks.find((p) => p.address.toLowerCase() === s.pair.address.toLowerCase());
    body.querySelector('.pair-logo').replaceWith(Chrome.logoEl(pick || s.pair));
    a.appendChild(body);
    Bonsai.mount(canvas, (w, h) => ({ x: w * 0.5, y: h * 0.9, height: h * 0.78, seed: L.token.toLowerCase(), growth: s.growth }));
    return a;
  }
  function escape(str) { return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  async function load() {
    const garden = $('garden'), empty = $('empty');
    garden.innerHTML = '';
    if (!Nebari.configured()) { $('not-configured').hidden = false; return; }
    try {
      const factory = Nebari.factory();
      const n = Number(await factory.tokenCount());
      if (n === 0) { empty.hidden = false; return; }
      empty.hidden = true;
      const launches = await factory.getLaunches(Math.max(0, n - 60), 60);
      const list = Array.from(launches).reverse();
      const stats = await Promise.all(list.map((L) => Nebari.tokenStats(L).catch((e) => { console.warn(e); return null; })));
      list.forEach((L, i) => { if (stats[i]) garden.appendChild(card(L, stats[i])); });
    } catch (e) {
      console.error(e);
      garden.innerHTML = `<div class="empty" style="grid-column:1/-1">Could not read the chain: ${escape(Nebari.explainError(e))}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    $('refresh').addEventListener('click', load);
  });
})();
