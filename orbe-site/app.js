/* ORBE — page behaviour.
   No dependencies: mobile menu, anchor navigation, active section, scroll
   reveal and the live-price mockup in the hero panel. */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  document.documentElement.classList.add('js');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- mobile menu ---------- */

  const burger = $('#burger');
  const links  = $('#navlinks');

  const closeMenu = () => {
    links?.classList.remove('is-open');
    burger?.setAttribute('aria-expanded', 'false');
  };

  burger?.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });

  /* ---------- anchor navigation ---------- */

  // scrollIntoView rather than window.scrollTo: when the page is embedded, the
  // scrolling element may be the parent's, and only scrollIntoView reaches it.
  // Sections carry scroll-margin-top for the sticky nav.
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-scroll]');
    if (!el) return;
    const target = document.getElementById(el.dataset.scroll);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });

  /* ---------- active section in the nav ---------- */

  const navLinks = $$('.nav__links a[data-scroll]:not(.btn)');
  const sections = navLinks.map((a) => document.getElementById(a.dataset.scroll)).filter(Boolean);

  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.scroll === entry.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => spy.observe(s));

    /* ---------- scroll reveal ---------- */

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: .12 });

    $$('.reveal').forEach((el, i) => {
      el.style.transitionDelay = `${(i % 3) * 80}ms`;
      io.observe(el);
    });
  } else {
    $$('.reveal').forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- dashboard mockup ---------- */

  // Sample data only: four per-network price walks around one mid, a ranked
  // best price, and a feed of routed orders. Nothing here is live.
  const NETS = [
    { name: 'Solana',   color: '#8fb0ff', off: 0,     width: 2.6 },
    { name: 'Base',     color: '#4c6fd1', off: -.07,  width: 1.6 },
    { name: 'Arbitrum', color: '#2d4a9e', off: -.11,  width: 1.6 },
    { name: 'Ethereum', color: '#56607a', off: -.2,   width: 1.6 },
  ];
  const chart = $('#chart');
  const legend = $('#legend');
  const oBody = $('#oBody');
  const N = 48, CW = 600, CH = 260;

  if (chart && legend && oBody) {
    let mid = 142.1;
    let mids = [];
    for (let i = 0; i < N; i++) { mid += (Math.random() - .47) * .09; mids.push(mid); }
    const jitter = () => (Math.random() - .5) * .025;
    let series = NETS.map((n) => mids.map((m) => m + n.off + jitter()));

    legend.innerHTML = NETS.map((n) => `<li><i style="background:${n.color}"></i>${n.name}</li>`).join('');

    let saved = 184.2, count = 37;
    const pad2 = (n) => String(n).padStart(2, '0');
    const clock = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

    const drawChart = () => {
      const all = series.flat();
      const min = Math.min(...all) - .02, max = Math.max(...all) + .02;
      const y = (v) => CH - ((v - min) / (max - min)) * CH;
      let out = '';
      for (let g = 1; g < 4; g++) out += `<line class="grid" x1="0" x2="${CW}" y1="${(CH / 4) * g}" y2="${(CH / 4) * g}"/>`;
      // draw the best (Solana) line last so it sits on top
      [...NETS.keys()].reverse().forEach((k) => {
        const d = series[k].map((v, i) => `${i ? 'L' : 'M'}${((i / (N - 1)) * CW).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
        const glow = k === 0 ? ' style="filter:drop-shadow(0 0 6px rgba(143,176,255,.7))"' : '';
        out += `<path d="${d}" stroke="${NETS[k].color}" stroke-width="${NETS[k].width}"${glow}/>`;
      });
      chart.innerHTML = out;
    };

    const drawTiles = () => {
      const last = series.map((s) => s[N - 1]);
      const best = Math.max(...last), worst = Math.min(...last);
      $('#tBest').textContent = best.toFixed(3);
      $('#tBestNet').textContent = `on ${NETS[last.indexOf(best)].name}`;
      $('#tSpread').textContent = `${(((best - worst) / best) * 100).toFixed(2)}%`;
      $('#tSpreadAbs').textContent = `${(best - worst).toFixed(3)} USDC best to worst`;
      $('#tSaved').textContent = `+$${saved.toFixed(2)}`;
      $('#tOrders').textContent = `vs. worst venue · ${count} orders`;
      $('#oCount').textContent = `5 / ${count}`;
    };

    const orderRow = (fresh) => {
      const last = series.map((s) => s[N - 1]);
      const bestIdx = last.indexOf(Math.max(...last));
      const buy = Math.random() > .35;
      const gain = .02 + Math.random() * .6;
      const tr = document.createElement('tr');
      if (fresh) tr.className = 'is-new';
      tr.innerHTML = `<td>${clock(new Date(Date.now() - (fresh ? 0 : Math.random() * 60000)))}</td>
        <td><span class="side side--${buy ? 'buy' : 'sell'}">${buy ? 'BUY' : 'SELL'}</span></td>
        <td>${NETS[bestIdx].name}</td>
        <td class="r mono">${last[bestIdx].toFixed(3)}</td>
        <td class="r saved">+$${gain.toFixed(2)}</td>`;
      return { tr, gain };
    };

    const seed = [];
    for (let i = 0; i < 5; i++) seed.push(orderRow(false).tr);
    // oldest first, so newest ends up on top once prepended
    seed.forEach((tr) => oBody.prepend(tr));

    drawChart();
    drawTiles();

    if (!reduced) {
      let tick = 0;
      setInterval(() => {
        mid = mids[N - 1] + (Math.random() - .47) * .09;
        mids = [...mids.slice(1), mid];
        series = series.map((s, k) => [...s.slice(1), mid + NETS[k].off + jitter()]);
        drawChart();
        if (++tick % 3 === 0) {
          const { tr, gain } = orderRow(true);
          oBody.prepend(tr);
          while (oBody.children.length > 5) oBody.lastElementChild.remove();
          saved += gain; count += 1;
        }
        drawTiles();
      }, 1200);
    }
  }

  /* ---------- demo app ---------- */

  // Sample mid prices and per-venue spread (%) and fee (USD). Illustrative only.
  const PAIRS = {
    SOL: { name: 'SOL', mid: 142.3 },
    ETH: { name: 'ETH', mid: 3480.5 },
    BTC: { name: 'WBTC', mid: 96250 },
  };
  const VENUES = [
    { net: 'Solana',   spread: .02, fee: .01 },
    { net: 'Base',     spread: .05, fee: .04 },
    { net: 'Arbitrum', spread: .07, fee: .06 },
    { net: 'Ethereum', spread: .04, fee: 2.8 },
  ];

  const dlg     = $('#demo');
  const form    = $('#demoForm');
  const pairSel = $('#demoPair');
  const amtIn   = $('#demoAmt');
  const quotesEl = $('#demoQuotes');
  const result  = $('#demoResult');

  const money = (n, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  const quote = () => {
    const pair = PAIRS[pairSel.value];
    const side = form.elements.side.value;
    const amt  = Math.max(parseFloat(amtIn.value) || 0, 0);
    const rows = VENUES.map((v) => {
      const px = pair.mid * (side === 'buy' ? 1 + v.spread / 100 : 1 - v.spread / 100);
      // buy: USDC in, token out. sell: USDC worth of token in, USDC out.
      const out = side === 'buy' ? Math.max(amt - v.fee, 0) / px : Math.max((amt / pair.mid) * px - v.fee, 0);
      return { ...v, px, out };
    }).sort((a, b) => b.out - a.out);
    return { pair, side, amt, rows };
  };

  const render = () => {
    const { pair, side, amt, rows } = quote();
    const unit = side === 'buy' ? pair.name : 'USDC';
    const digits = side === 'buy' ? (pair.mid > 1000 ? 6 : 4) : 2;
    quotesEl.innerHTML = rows.map((r, i) => `
      <li class="${i ? '' : 'is-best'}">
        <span class="chip">${r.net}${i ? '' : ' <span class="tag tag--best">best</span>'}</span>
        <span class="q__out">${money(r.out, digits)} ${unit}</span>
        <span class="q__fee">fee $${money(r.fee)}</span>
      </li>`).join('');
    $('#demoGo').disabled = amt <= 0;
    $('#demoGo').textContent = amt > 0 ? `Simulate on ${rows[0].net}` : 'Enter an amount';
    result.hidden = true;
  };

  const openDemo = (pairKey) => {
    if (pairKey && PAIRS[pairKey]) pairSel.value = pairKey;
    closeMenu();
    render();
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    amtIn.focus();
  };

  const closeDemo = () => {
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-demo]');
    if (!el) return;
    e.preventDefault();
    openDemo(el.dataset.demo);
  });

  $('#demoClose').addEventListener('click', closeDemo);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDemo(); });
  form.addEventListener('input', render);
  form.addEventListener('change', render);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { pair, side, amt, rows } = quote();
    if (amt <= 0) return;
    const best = rows[0];
    const saved = best.out - rows[rows.length - 1].out;
    const unit = side === 'buy' ? pair.name : 'USDC';
    const digits = side === 'buy' ? (pair.mid > 1000 ? 6 : 4) : 2;
    result.innerHTML = side === 'buy'
      ? `Simulated: <strong>${money(best.out, digits)} ${unit}</strong> for ${money(amt)} USDC on ${best.net}. That is ${money(saved, digits)} ${unit} more than the worst venue.`
      : `Simulated: <strong>${money(best.out)} USDC</strong> for ${money(amt / pair.mid, 6)} ${pair.name} on ${best.net}. That is $${money(saved)} more than the worst venue.`;
    result.hidden = false;
  });

  /* ---------- footer year ---------- */

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
