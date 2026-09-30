/* Yuelong — page behaviour for index, launch and docs.
   No dependencies. Every block checks that its elements exist, so one file
   serves the three pages. All market figures below are sample data. */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.add('dn-js');

  /* ---------- sample data ---------- */

  const COLORS = ['#D9C3A0', '#F2C94C', '#C9A77A', '#B8A07C', '#BB6BD9', '#BFA57E', '#EB5757', '#9B9B9B'];

  const MARKETS = [
    { name: 'Inference Rush', ticker: 'INFR', kind: 'subnet',    label: 'Subnet Coin',      chain: 'Robinhood', sn: 'SN19', desc: 'Cheap open-model inference eats the cloud margin, starting here.', price: '0.0₆412 TAO', curve: 62.4, age: '6m' },
    { name: 'Jade Rabbit',    ticker: 'JADE', kind: 'ecosystem', label: 'TAO Ecosystem',    chain: 'Robinhood', sn: '',     desc: 'The moon-bound mascot of the Yuelong crowd.',                        price: '0.0₈203 ETH', curve: 0.4,  age: '14m' },
    { name: 'Fold Theory',    ticker: 'PRTN', kind: 'candidate', label: 'Subnet Candidate', chain: 'Robinhood', sn: '',     desc: 'A protein-structure subnet that pays for verified folds.',           price: '0.0₇93 TAO',  curve: 8.1,  age: '31m' },
    { name: 'Open Corpus',    ticker: 'DATA', kind: 'subnet',    label: 'Subnet Coin',      chain: 'Robinhood', sn: 'SN13', desc: 'Models come and go. The data underneath them compounds.',           price: '0.0₆201 TAO', curve: 91.7, age: '48m' },
    { name: 'Halving Clock',  ticker: 'HALV', kind: 'ecosystem', label: 'TAO Ecosystem',    chain: 'Bittensor', sn: '',     desc: 'The next emission cut is still underpriced by alpha holders.',        price: '0.0₅108 TAO', curve: 0,    age: '1h' },
    { name: 'Edge Compute',   ticker: 'EDGE', kind: 'candidate', label: 'Subnet Candidate', chain: 'Bittensor', sn: '',     desc: 'Idle gaming GPUs, pooled and scored for short inference jobs.',     price: '0.0₆77 TAO',  curve: 0,    age: '1h' },
    { name: 'Red Lantern',    ticker: 'LNTN', kind: 'ecosystem', label: 'TAO Ecosystem',    chain: 'Robinhood', sn: '',     desc: 'Light one for every subnet that ships this month.',                 price: '0.0₈176 ETH', curve: 2.3,  age: '2h' },
    { name: 'Pretrain Club',  ticker: 'PRE9', kind: 'subnet',    label: 'Subnet Coin',      chain: 'Robinhood', sn: 'SN9',  desc: 'Open pretraining closes the gap faster than the labs expect.',      price: '0.0₆330 TAO', curve: 44.9, age: '2h' },
    { name: 'Weather Mesh',   ticker: 'WTHR', kind: 'candidate', label: 'Subnet Candidate', chain: 'Robinhood', sn: '',     desc: 'Forecasts scored against what actually happened, every hour.',      price: '0.0₇18 TAO',  curve: 1.4,  age: '3h' },
    { name: 'Validator Row',  ticker: 'VROW', kind: 'ecosystem', label: 'TAO Ecosystem',    chain: 'Robinhood', sn: '',     desc: 'Stake concentrates before it spreads. Bet on the top five.',       price: '0.0₄55 ETH',  curve: 3.2,  age: '3h' },
    { name: 'Compute Bazaar', ticker: 'CBZR', kind: 'subnet',    label: 'Subnet Coin',      chain: 'Robinhood', sn: 'SN51', desc: 'A night market for GPU hours, priced by the minute.',               price: '0.0₆254 TAO', curve: 18.6, age: '4h' },
    { name: 'Agent Payroll',  ticker: 'PAYR', kind: 'ecosystem', label: 'TAO Ecosystem',    chain: 'Bittensor', sn: '',     desc: 'Agents will hire agents, and settle in TAO.',                        price: '0.0₅31 TAO',  curve: 0,    age: '5h' },
  ];

  const SUBNETS = {
    SN9:  { name: 'Pretraining', price: 0.0412, reserve: 48210, vol: 1840 },
    SN13: { name: 'Data',        price: 0.0288, reserve: 31950, vol: 1120 },
    SN19: { name: 'Inference',   price: 0.0531, reserve: 60440, vol: 2610 },
    SN25: { name: 'Protein',     price: 0.0174, reserve: 12880, vol: 540 },
    SN51: { name: 'Compute',     price: 0.0367, reserve: 40120, vol: 1930 },
  };

  const THESES = [
    { label: 'Subnet Coin',      sn: 'SN19', ticker: 'INFR', name: 'Inference Rush', quote: 'Within a year, serving open models on the network will cost less than renting the same GPUs from a cloud. This subnet is where that shows up first.' },
    { label: 'Subnet Candidate', sn: '',     ticker: 'PRTN', name: 'Fold Theory',    quote: 'Pay miners for protein structures that a lab later confirms, not for ones that merely look plausible.' },
    { label: 'TAO Ecosystem',    sn: '',     ticker: 'HALV', name: 'Halving Clock',  quote: 'Alpha holders are pricing the next emission cut as if it were years away.' },
    { label: 'Subnet Coin',      sn: 'SN13', ticker: 'DATA', name: 'Open Corpus',    quote: 'The best open dataset is the moat. Everyone trains on it; nobody can fork the years it took to collect.' },
    { label: 'TAO Ecosystem',    sn: '',     ticker: 'PAYR', name: 'Agent Payroll',  quote: 'Agents will hire other agents for narrow jobs, and the invoices will be in TAO.' },
    { label: 'TAO Ecosystem',    sn: '',     ticker: 'JADE', name: 'Jade Rabbit',    quote: 'Every network needs a mascot that outlives the roadmap. This one lives on the moon and answers to no one.' },
    { label: 'Subnet Coin',      sn: 'SN51', ticker: 'CBZR', name: 'Compute Bazaar', quote: 'GPU hours should trade like produce at a night market: priced by the minute, gone by morning.' },
  ];

  const color = (s) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

  // token art: a mirrored 6x6 pixel sprite seeded by the ticker, in two tones on a dark tile
  const ART = [['#D9C3A0', '#F3E9D8'], ['#F2C94C', '#FFF3C4'], ['#C9A77A', '#EFE0C8'], ['#B8A07C', '#E9DDC6'],
               ['#BB6BD9', '#EDD6F7'], ['#EB5757', '#FFD6D6'], ['#A48B67', '#E2D3BA'], ['#8C7A5B', '#DCCFB6']];
  const artCache = {};
  const tokenArt = (t) => {
    if (artCache[t]) return artCache[t];
    let h = 2166136261;
    for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const bit = (i) => (h >>> (i % 29)) & 1 ^ ((i * 7 + (h & 255)) >> 3) & 1;
    const [main, light] = ART[(h >>> 3) % ART.length];
    let cells = '';
    for (let y = 0; y < 6; y++) for (let x = 0; x < 3; x++) {
      const on = bit(y * 3 + x + 1), hi = bit(y * 5 + x * 3 + 11) && on;
      if (!on) continue;
      const fill = hi ? light : main;
      cells += `<rect x="${x + 1}" y="${y + 1}" width="1" height="1" fill="${fill}"/><rect x="${6 - x}" y="${y + 1}" width="1" height="1" fill="${fill}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect width="8" height="8" fill="#161616"/>${cells}</svg>`;
    return (artCache[t] = 'data:image/svg+xml,' + encodeURIComponent(svg));
  };
  window.YLart = tokenArt;

  /* ---------- terms gate ---------- */

  // Shown once on first visit, centred over a translucent, blurred backdrop.
  // "Accept" is remembered; "Decline" sends the visitor to DECLINE_URL.
  const DECLINE_URL = 'https://www.ponsfamily.com/launchpad';
  const CONSENT_KEY = 'yuelong-terms';
  const onPolicyPage = /(terms|privacy)\.html$/.test(location.pathname);

  let consent = null;
  try { consent = localStorage.getItem(CONSENT_KEY); } catch (_) { /* storage blocked */ }
  if (!consent && !onPolicyPage) {
    const gate = document.createElement('div');
    gate.className = 'dn-consent';
    gate.innerHTML = `
      <div class="dn-consent-card" role="dialog" aria-modal="true" aria-labelledby="dn-consent-title">
        <h2 id="dn-consent-title">Before you <em>continue</em></h2>
        <p>Yuelong is experimental software for launching and trading highly speculative tokens. You act from your own wallet and carry the risk.</p>
        <p>To use the site, please accept our <a href="terms.html" target="_blank" rel="noopener">Terms of Use</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</p>
        <div class="dn-consent-btns">
          <button type="button" class="dn-consent-no" data-choice="declined">Decline</button>
          <button type="button" class="dn-consent-yes" data-choice="accepted">Accept and enter</button>
        </div>
      </div>`;
    document.body.appendChild(gate);
    document.documentElement.classList.add('dn-locked');
    requestAnimationFrame(() => requestAnimationFrame(() => gate.classList.add('is-in')));
    $('.dn-consent-yes', gate).focus({ preventScroll: true });
    gate.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-choice]');
      if (!btn) return;
      if (btn.dataset.choice === 'declined') { location.href = DECLINE_URL; return; }
      try { localStorage.setItem(CONSENT_KEY, 'accepted'); } catch (_) { /* storage blocked */ }
      document.documentElement.classList.remove('dn-locked');
      gate.classList.remove('is-in');
      setTimeout(() => gate.remove(), 450);
    });
  }

  /* ---------- mobile menu ---------- */

  const burger = $('#burger');
  const links = $('#navlinks');
  burger?.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  links?.addEventListener('click', (e) => {
    if (e.target.closest('a')) { links.classList.remove('is-open'); burger?.setAttribute('aria-expanded', 'false'); }
  });

  /* ---------- hero composer ---------- */

  const cText = $('#composer-text');
  if (cText) {
    const tickerOut = $('#composer-ticker');
    const send = $('.dn-send');
    cText.addEventListener('input', () => {
      const m = cText.value.match(/\$([a-z0-9]{1,10})/i);
      tickerOut.textContent = m ? '$' + m[1].toUpperCase() : '';
      send.classList.toggle('is-ready', cText.value.trim().length > 0);
    });
    $('#composer').addEventListener('submit', (e) => {
      e.preventDefault();
      const params = new URLSearchParams();
      const m = cText.value.match(/\$([a-z0-9]{1,10})/i);
      if (m) params.set('ticker', m[1].toUpperCase());
      if (cText.value.trim()) params.set('desc', cText.value.replace(/\$[a-z0-9]{1,10}/i, '').trim());
      params.set('chain', $('#composer-chain').value.startsWith('Bittensor') ? 'bittensor' : 'robinhood');
      if ($('#composer-pair').value !== 'TAO') params.set('pair', 'alpha');
      location.href = 'launch.html?' + params.toString();
    });
  }

  /* ---------- steps light up as they pass ---------- */

  const steps = $$('#steps li');
  if (steps.length && 'IntersectionObserver' in window) {
    const build = $('.dn-build');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => en.target.classList.toggle('is-lit', en.isIntersecting || en.boundingClientRect.top < 0));
      // the token card beside the steps fills in one row per lit step
      if (build) {
        const stage = steps.filter((li) => li.classList.contains('is-lit')).length;
        build.dataset.stage = String(stage);
        $('.dn-build-badge', build).textContent = stage >= 3 ? 'Live' : 'Draft';
      }
    }, { rootMargin: '0px 0px -28% 0px' });
    steps.forEach((li) => io.observe(li));
  } else {
    steps.forEach((li) => li.classList.add('is-lit'));
    const build = $('.dn-build');
    if (build) { build.dataset.stage = '4'; $('.dn-build-badge', build).textContent = 'Live'; }
  }

  const buildAv = $('.dn-build-av');
  if (buildAv) buildAv.style.backgroundImage = `url("${tokenArt('LNTN')}")`;

  /* ---------- markets ---------- */

  // Cards are drawn from one shape, so the sample set and the live index share the renderer.
  const KIND_LABEL = { subnet: 'Subnet Coin', candidate: 'Subnet Candidate', ecosystem: 'TAO Ecosystem' };
  let cards = MARKETS.map((m) => ({
    href: 'launch.html', img: tokenArt(m.ticker), fallback: '', kind: m.kind, name: m.name, ticker: m.ticker, desc: m.desc,
    meta: `${m.label}${m.sn ? ' · ' + m.sn : ''} · ${m.chain}`,
    stats: [m.price, m.chain === 'Bittensor' ? 'pool' : m.curve.toFixed(1) + '% curve', m.age + ' ago'], hot: m.curve > 50,
  }));
  const liveCard = (t, nets) => {
    const Y = window.YL, net = nets.find((n) => n.chainId === t.chainId);
    return {
      href: `token.html?chain=${t.chainId}&c=${t.curve}`, img: t.image || tokenArt(t.symbol), fallback: tokenArt(t.symbol),
      kind: t.category, name: t.name, ticker: t.symbol, desc: t.description,
      meta: `${KIND_LABEL[t.category] || 'TAO Ecosystem'}${t.subnet != null ? ' · SN' + t.subnet : ''} · ${net ? net.short : ''}`,
      stats: [`${Y.fmtPrice(Y.toNum(t.price))} ${t.quoteSymbol}`, t.graduated ? 'graduated' : (t.progress * 100).toFixed(1) + '% curve', Y.ago(t.createdAt) + ' ago'],
      hot: t.graduated || t.progress > 0.5,
    };
  };

  const stack = $('#stack');
  const renderStack = (n) => {
    if (stack) stack.innerHTML = cards.slice(0, 5).map((m) => `<img src="${esc(m.img)}" alt="">`).join('') + `<span>${n} launch${n === 1 ? '' : 'es'}</span>`;
  };
  renderStack(MARKETS.length);

  const grid = $('#market-grid');
  let marketFilter = 'all', isLive = false;
  const renderMarkets = (filter) => {
    marketFilter = filter;
    const list = cards.filter((m) => filter === 'all' || m.kind === filter);
    grid.innerHTML = list.map((m) => `
      <a class="dn-mcard" href="${esc(m.href)}">
        <div class="dn-mcard-top">
          <img class="dn-av" src="${esc(m.img)}" alt=""${m.fallback ? ` data-fallback="${esc(m.fallback)}"` : ''}>
          <span class="dn-meta">${esc(m.meta)}</span>
        </div>
        <h3>${esc(m.name)} <span>$${esc(m.ticker)}</span></h3>
        <p>${esc(m.desc)}</p>
        <div class="dn-stats"><span>${esc(m.stats[0])}</span><span class="${m.hot ? 'is-hot' : ''}">${esc(m.stats[1])}</span><span>${esc(m.stats[2])}</span></div>
      </a>`).join('') || `
      <div class="dn-mcard yl-empty">
        <h3>${isLive ? 'Nothing here yet.' : 'No coins in this list.'}</h3>
        <p>${isLive ? 'Be the first: a launch takes one transaction.' : ''}</p>
        <div class="dn-stats"><a class="dn-chip" href="launch.html">Launch a coin</a></div>
      </div>`;
  };
  if (grid) {
    renderMarkets('all');
    grid.addEventListener('error', (e) => { const f = e.target.dataset?.fallback; if (f && e.target.src !== f) e.target.src = f; }, true);
    $('#market-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      $$('#market-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      renderMarkets(btn.dataset.filter);
      window.dnReveal?.($$('.dn-mcard', grid), true);
    });
  }

  /* ---------- chat panels ---------- */

  // Each panel plays its demo question when it scrolls into view: the question types itself
  // into the box, is sent, the assistant "types", and the answer rows slide in one by one.
  // Visitors can then ask their own; the same sequence runs for them.

  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
  const botIco = '<span class="dn-chat-ico dn-bot-ico" aria-hidden="true">✦</span>';

  const lookupAnswer = (q) => {
    const found = [...new Set((q.toUpperCase().match(/\$?[A-Z0-9]{3,8}/g) || []).map((t) => t.replace('$', '')))]
      .map((t) => MARKETS.find((m) => m.ticker === t)).filter(Boolean);
    if (!found.length) return `<div class="dn-res"><p class="dn-res-note">I don't know that ticker yet. Try <b>$INFR</b>, <b>$DATA</b>, <b>$JADE</b> or <b>$PRTN</b>.</p></div>`;
    return `<div class="dn-res">${found.map((m, i) => `
      <div class="dn-res-row" style="--i:${i}">
        <img class="dn-av" src="${tokenArt(m.ticker)}" alt="">
        <span class="dn-res-name"><b>${esc(m.name)}</b><small>$${esc(m.ticker)} · ${esc(m.label)}</small></span>
        <span class="dn-res-val"><b>${esc(m.price)}</b><small>${m.chain === 'Bittensor' ? 'locked pool' : m.curve.toFixed(1) + '% curve'}</small></span>
      </div>`).join('')}</div>`;
  };

  const kTau = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)}K` : v.toFixed(2)) + ' τ';
  const faceoffAnswer = (q) => {
    const ids = [...new Set((q.toUpperCase().match(/SN\s?\d+/g) || []).map((s) => s.replace(/\s/g, '')))].filter((s) => SUBNETS[s]);
    if (ids.length < 2) return `<div class="dn-res"><p class="dn-res-note">Name two of <b>SN9</b>, <b>SN13</b>, <b>SN19</b>, <b>SN25</b> or <b>SN51</b>.</p></div>`;
    const pair = ids.slice(0, 2).map((id) => ({ id, ...SUBNETS[id] }));
    const lead = pair[0].vol >= pair[1].vol ? pair[0] : pair[1];
    return `<div class="dn-res dn-vs">${pair.map((s, i) => `
      <div class="dn-vs-card${s === lead ? ' is-lead' : ''}" style="--i:${i}">
        <b><span>${esc(s.name)}</span><i>${s.id}</i></b>
        <span>Alpha price <em>${s.price.toFixed(5)} τ</em></span>
        <span>TAO reserve <em>${kTau(s.reserve)}</em></span>
        <span>7d volume <em>${kTau(s.vol)}</em></span>
      </div>`).join('')}</div>`;
  };

  $$('.dn-chat').forEach((chat) => {
    const body = $('.dn-chat-body', chat);
    const form = $('form', chat);
    const input = $('input', form);
    const answer = chat.dataset.chat === 'faceoff' ? faceoffAnswer : lookupAnswer;
    const demo = $('.dn-bubble-me', body)?.textContent.trim() || '';
    let busy = false;
    let autoplay = null; // cancelled when the visitor takes over

    const scrollDown = () => body.scrollTo({ top: body.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });

    const ask = async (q) => {
      busy = true;
      form.classList.add('is-busy');
      body.appendChild(el(`<div class="dn-bubble dn-bubble-me dn-pop"></div>`)).textContent = q;
      scrollDown();
      await sleep(350);
      const typing = body.appendChild(el(`<div class="dn-msg-bot dn-pop">${botIco}<span class="dn-typing" aria-label="typing"><i></i><i></i><i></i></span></div>`));
      scrollDown();
      await sleep(900);
      typing.replaceWith(el(`<div class="dn-msg-bot is-answer">${botIco}${answer(q)}</div>`));
      scrollDown();
      await sleep(600);
      scrollDown();
      form.classList.remove('is-busy');
      busy = false;
    };

    const typeInto = async (text, token) => {
      input.classList.add('is-typing');
      for (let i = 1; i <= text.length; i++) {
        if (token.cancelled) return false;
        input.value = text.slice(0, i);
        await sleep(38 + Math.random() * 40);
      }
      input.classList.remove('is-typing');
      await sleep(250);
      return !token.cancelled;
    };

    const play = async () => {
      if (!demo) return;
      const token = (autoplay = { cancelled: false });
      body.innerHTML = '';
      if (reduced) { body.appendChild(el(`<div class="dn-bubble dn-bubble-me"></div>`)).textContent = demo; body.appendChild(el(`<div class="dn-msg-bot is-answer">${botIco}${answer(demo)}</div>`)); return; }
      await sleep(500);
      if (!(await typeInto(demo, token))) return;
      form.querySelector('button').classList.add('is-sent');
      setTimeout(() => form.querySelector('button').classList.remove('is-sent'), 400);
      input.value = '';
      await ask(demo);
      autoplay = null;
    };

    body.innerHTML = '';
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); play(); } }, { threshold: 0.55 });
      io.observe(chat);
    } else play();

    input.addEventListener('focus', () => {
      if (autoplay) { autoplay.cancelled = true; autoplay = null; input.value = ''; input.classList.remove('is-typing'); }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q || busy) return;
      input.value = '';
      ask(q);
    });
  });

  /* ---------- bento ---------- */

  const snGrid = $('#sn-grid');
  if (snGrid) {
    const cells = ['', 'SN21', 'SN22', 'SN24', '', 'SN27', 'τ', 'SN1', 'SN3', 'SN32', 'SN4', 'SN5', 'SN8', 'SN9', 'SN10', 'SN34', 'SN11', 'SN13', 'SN19', 'SN51', '', 'SN64', 'SN80', '', ''];
    snGrid.innerHTML = cells.map((c) => `<span class="${c === 'τ' ? 'is-tao' : c ? '' : 'is-ghost'}">${c}</span>`).join('');
  }

  const meter = $('#meter');
  let meterTo = null;
  if (meter) {
    let target = 62;
    const n = 44;
    meter.innerHTML = Array.from({ length: n }, () => '<i></i>').join('');
    const bars = $$('i', meter);
    const paint = (p) => {
      const filled = Math.round((p / 100) * n);
      bars.forEach((b, i) => { b.className = i < filled - 3 ? 'k-res' : i < filled ? 'k-new' : ''; });
      $('#meter-v').textContent = p >= 10 ? Math.round(p) : p.toFixed(1);
    };
    let shown = false, current = 0;
    const animate = () => {
      const from = current, t0 = performance.now();
      const tick = (t) => {
        const k = Math.min((t - t0) / 1400, 1);
        current = from + (target - from) * (1 - Math.pow(1 - k, 3));
        paint(current);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    meterTo = (p) => { target = p; if (shown || reduced) { if (reduced) paint(p); else animate(); } };
    if (reduced || !('IntersectionObserver' in window)) { shown = true; paint(target); }
    else {
      paint(0);
      const io = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return;
        io.disconnect();
        shown = true;
        animate();
      }, { threshold: 0.4 });
      io.observe(meter);
    }
  }

  const feed = $('#feed');
  let feedTimer = 0;
  if (feed) {
    const item = (m) => `<b>${esc(m.name)} · $${esc(m.ticker)}</b><span>${esc(m.desc)}</span><small>${esc(m.label)} · ${esc(m.age)} ago</small>`;
    feed.innerHTML = MARKETS.slice(0, 3).map((m) => `<div>${item(m)}</div>`).join('');
    if (!reduced) {
      let i = 3;
      feedTimer = setInterval(() => {
        if (document.hidden) return;
        const m = { ...MARKETS[i % MARKETS.length], age: 'now' };
        i += 1;
        const d = document.createElement('div');
        d.className = 'is-new';
        d.innerHTML = item(m);
        feed.prepend(d);
        while (feed.children.length > 3) feed.lastElementChild.remove();
      }, 4200);
    }
  }

  /* ---------- theses rail ---------- */

  // The cards drift left in an endless loop: the set is rendered twice and the track slides by
  // exactly one set, so the seam never shows. Hover pauses it; reduced motion leaves it still.
  const rail = $('#rail');
  let renderRail = null;
  if (rail) {
    const card = (t, hidden) => `
      <${t.href ? `a href="${esc(t.href)}"` : 'article'} class="dn-thesis"${hidden ? ' aria-hidden="true" tabindex="-1"' : ''}>
        <div class="dn-thesis-top">
          <img class="dn-av" src="${esc(t.img || tokenArt(t.ticker))}" alt="">
          ${esc(t.label)}
          <span class="dn-meta">Thesis${t.sn ? ' · ' + esc(t.sn) : ''}</span>
        </div>
        <blockquote>${esc(t.quote)}</blockquote>
        <cite>${esc(t.name)} · $${esc(t.ticker)}</cite>
      </${t.href ? 'a' : 'article'}>`;
    renderRail = (list) => { rail.innerHTML = `<div class="dn-rail-track">${list.map((t) => card(t)).join('')}${reduced ? '' : list.map((t) => card(t, true)).join('')}</div>`; };
    renderRail(THESES);
  }

  /* ---------- launch page ---------- */

  // The networks come from /api/config, the pair's economics from the factory itself, and the
  // launch is one transaction from the visitor's wallet. Until a deployment exists the form
  // still fills in as a preview and says so.
  const form = $('#launch-form');
  if (form && window.YL) {
    const Y = window.YL;
    const W = Y.wallet;
    const qs = new URLSearchParams(location.search);
    const el = (id) => document.getElementById(id);
    const pairSel = el('f-pair'), kind = el('f-kind'), sn = el('f-sn'), name = el('f-name'), ticker = el('f-ticker');
    const desc = el('f-desc'), url = el('f-url'), buy = el('f-buy'), tax = el('f-tax'), ack = el('f-ack');
    const btn = el('review'), msg = el('form-msg'), avatar = el('f-avatar');
    const SUPPLY = 10n ** 27n;
    let cfg = { live: false, networks: [], known: [] }, net = null, econ = null, image = '', busy = false;

    const toWei = (v) => {
      const [i, f = ''] = String(v || '0').trim().split('.');
      if (!/^\d*$/.test(i) || !/^\d*$/.test(f)) return -1n;
      return BigInt(i || '0') * 10n ** 18n + BigInt((f + '0'.repeat(18)).slice(0, 18) || '0');
    };
    const say = (t, bad) => { msg.textContent = t; msg.classList.toggle('is-bad', !!bad); };
    const pair = () => net?.pairs.find((p) => p.address === pairSel.value);
    const unit = () => pair()?.symbol || net?.native || 'TAO';

    if (qs.get('ticker')) ticker.value = qs.get('ticker').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8);
    if (qs.get('desc')) desc.value = qs.get('desc').slice(0, 600);

    const renderNets = () => {
      const list = cfg.live ? cfg.networks : cfg.known.filter((n) => !n.testnet);
      $('#nets').innerHTML = list.map((n) => `
        <button type="button" role="radio" aria-checked="${!!net && n.chainId === net.chainId}" data-chain="${n.chainId}"${cfg.live ? '' : ' disabled'}>
          <b>${esc(n.name)} ${cfg.live ? `<em class="dn-live${n.testnet ? ' is-test' : ''}">${n.testnet ? 'testnet' : 'live'}</em>` : ''}</b>
          <span>Paired with ${esc(n.native)} · bonding curve, then a locked pool</span>
        </button>`).join('');
      $('#net-note').innerHTML = !cfg.live
        ? '<p>Fill in your coin below. Launching switches on when the contracts go live; until then nothing is sent.</p>'
        : `<p>Connect an EVM wallet such as MetaMask or Rabby. If it doesn't know ${esc(net.name)} (chain ID ${net.chainId}) yet, Yuelong adds it for you. Gas and the pair are paid in native ${esc(net.native)}.</p><p>${net.testnet ? 'This is a test network: its coins have no value. ' : ''}Switching networks in your wallet never moves funds between them.</p>`;
      pairSel.innerHTML = (net ? net.pairs : [{ address: '', symbol: 'TAO', native: true }])
        .map((p) => `<option value="${esc(p.address)}">${p.native ? 'Native ' + esc(p.symbol) : esc(p.symbol)}</option>`).join('');
      $('#form-kicker').textContent = `${net ? net.short : 'Bittensor EVM'} · bonding curve · ${unit()}`;
    };

    const loadEcon = async () => {
      econ = null;
      renderTerms();
      if (!net || !pairSel.value) return;
      try {
        const [A, p, e] = await Promise.all([Y.abi(), Y.reader(net), Y.ethers()]);
        const f = new e.Contract(net.factory, A.YuelongFactory, p);
        const [s, feeBps, launchFee, paused] = await Promise.all([f.stocks(pairSel.value), f.feeBps(), f.launchFee(), f.paused()]);
        econ = { phantom: s[0], threshold: s[1], enabled: s[2], feeBps: BigInt(feeBps), launchFee, paused };
      } catch (_) { econ = { error: true }; }
      renderTerms();
    };

    const estimate = () => {
      const v = toWei(buy.value);
      if (!econ?.threshold || v <= 0n) return 0n;
      const net_ = v - v * econ.feeBps / 10000n - v * BigInt(tax.value) / 10000n;
      return net_ * SUPPLY / (econ.phantom + net_);
    };

    const renderTerms = () => {
      const u = unit(), n = (w) => Y.fmtAmt(Y.toNum(w));
      const dev = toWei(buy.value), est = estimate();
      const rows = [
        ['Network', net ? net.name : 'Bittensor EVM'],
        ['Paired with', pair()?.native ? `Native ${u}` : u],
        ['Total supply', '1,000,000,000'],
        ['Creator allocation', '0% (buy like anyone)'],
        ['Launch fee', econ?.launchFee !== undefined ? (econ.launchFee ? `${n(econ.launchFee)} ${u}` : 'Free') : '…'],
        ['First buy', dev > 0n ? `${n(dev)} ${u}` : 'None'],
        ['Creator fee', tax.value === '0' ? 'None' : `${+tax.value / 100}% per trade`],
        ['Graduates at', econ?.threshold ? `${n(econ.threshold)} ${u} raised` : '…'],
        ['Liquidity', 'Locked permanently'],
      ];
      $('#terms').innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
      $$('.yl-unit').forEach((x) => { x.textContent = u; });
      const estEl = el('f-buy-est');
      if (dev > 0n && econ?.threshold) {
        const pct = Number(est * 10000n / SUPPLY) / 100;
        estEl.textContent = `≈ ${Y.fmtAmt(Y.toNum(est))} coins, ${pct.toFixed(2)}% of the supply.` + (dev >= econ.threshold ? ' That fills the curve: the coin graduates in the same transaction.' : '');
      } else estEl.textContent = 'Optional. Lands in the same transaction, before anyone else can trade, with no snipe tax.';
      renderButton();
    };

    const renderButton = () => {
      if (busy) return;
      btn.disabled = !cfg.live;
      if (!cfg.live) btn.textContent = 'Launching not open yet';
      else if (!W.state.account) btn.textContent = 'Connect wallet';
      else if (W.state.chainId !== net.chainId) btn.textContent = `Switch to ${net.short}`;
      else btn.textContent = ticker.value.length >= 2 ? `Launch $${ticker.value}` : 'Launch';
    };
    W.onChange(renderButton);

    $('#nets').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-chain]');
      if (!b || !cfg.live) return;
      net = cfg.networks.find((n) => n.chainId === +b.dataset.chain);
      renderNets(); loadEcon();
    });
    pairSel.addEventListener('change', loadEcon);
    kind.addEventListener('change', () => { el('sn-field').hidden = kind.value !== 'subnet'; });
    [buy, tax].forEach((x) => x.addEventListener('input', renderTerms));
    ticker.addEventListener('input', () => { ticker.value = ticker.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8); updateAvatar(); renderButton(); });
    name.addEventListener('input', () => updateAvatar());
    desc.addEventListener('input', () => { el('f-count').textContent = `${desc.value.length} / 600`; });

    const updateAvatar = () => {
      if (image) return;
      const t = ticker.value || name.value;
      avatar.textContent = t ? t[0].toUpperCase() : '?';
      avatar.style.background = t ? color(t.toUpperCase()) : '';
      avatar.style.color = t ? '#000' : '';
    };
    const showImage = (src) => { avatar.textContent = ''; avatar.style.background = ''; avatar.style.backgroundImage = `url("${src}")`; };

    // the image is uploaded when picked, so the launch transaction only carries its address
    el('f-file').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      const up = el('f-upmsg');
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { up.textContent = 'That image is over 2 MB.'; return; }
      showImage(URL.createObjectURL(f));
      up.textContent = 'Uploading…';
      try {
        const j = await Y.api('/api/upload', { method: 'POST', headers: { 'content-type': f.type || 'application/octet-stream' }, body: f });
        image = location.protocol === 'https:' ? location.origin + j.url : j.url;
        url.value = '';
        up.textContent = 'Uploaded.';
      } catch (err) { image = ''; up.textContent = err.message; updateAvatar(); }
    });
    url.addEventListener('change', () => {
      const v = url.value.trim();
      if (/^https:\/\/\S+$/i.test(v)) { image = v; showImage(v); } else if (!v) { image = ''; avatar.style.backgroundImage = ''; updateAvatar(); }
    });

    const https = (v) => (/^https:\/\/\S+$/i.test(v.trim()) ? v.trim().slice(0, 200) : '');

    btn.addEventListener('click', async () => {
      if (busy || !cfg.live) return;
      try {
        if (!W.state.account) { await W.connect(); return; }
        if (W.state.chainId !== net.chainId) { await W.ensureChain(net); return; }
      } catch (err) { if (err.message !== 'closed') say(Y.cleanError(err), true); return; }

      const problems = [];
      [name, ticker, desc, buy, sn].forEach((x) => x.classList.remove('is-bad'));
      if (!name.value.trim()) { problems.push('a name'); name.classList.add('is-bad'); }
      if (ticker.value.length < 2) { problems.push('a ticker of 2–8 letters'); ticker.classList.add('is-bad'); }
      if (desc.value.trim().length < 20) { problems.push('a thesis of 20+ characters'); desc.classList.add('is-bad'); }
      if (kind.value === 'subnet' && !(sn.value !== '' && +sn.value >= 0)) { problems.push('the subnet number'); sn.classList.add('is-bad'); }
      if (toWei(buy.value) < 0n) { problems.push('a valid first buy'); buy.classList.add('is-bad'); }
      if (!ack.checked) problems.push('the confirmation box');
      if (!econ || econ.error) problems.push('the pair settings (still loading)');
      else if (!econ.enabled) problems.push('a pair that is open for launches');
      else if (econ.paused) problems.push('launches to be unpaused');
      if (problems.length) { say('Still needed: ' + problems.join(', ') + '.', true); return; }

      busy = true; btn.disabled = true; btn.textContent = 'Check your wallet…';
      try {
        const [e, A, signer] = await Promise.all([Y.ethers(), Y.abi(), W.signer(net)]);
        const factory = new e.Contract(net.factory, A.YuelongFactory, signer);
        const dev = toWei(buy.value), p = pair();
        if (dev > 0n && !p.native) {
          const erc = new e.Contract(p.address, ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'], signer);
          if (await erc.allowance(W.state.account, net.factory) < dev) {
            say(`Approve ${p.symbol} for the first buy…`);
            await (await erc.approve(net.factory, dev)).wait();
          }
        }
        const meta = { description: desc.value.trim(), category: kind.value };
        if (kind.value === 'subnet') meta.subnet = Math.floor(+sn.value);
        if (image) meta.image = image;
        const links = { website: https(el('f-web').value), x: https(el('f-x').value), telegram: https(el('f-tg').value) };
        for (const [k, v] of Object.entries(links)) if (v) meta[k] = v;
        const params = {
          name: name.value.trim().slice(0, 40), symbol: ticker.value, metadata: JSON.stringify(meta), stock: p.address,
          creatorTaxBps: +tax.value, snipeExemptions: [], devBuyQuote: dev, minDevTokens: estimate() * 99n / 100n,
          salt: e.hexlify(e.randomBytes(32)),
        };
        const value = econ.launchFee + (p.native ? dev : 0n);
        say('Confirm the launch in your wallet…');
        const tx = await factory.launch(params, { value });
        try { localStorage.setItem('yuelong-last-launch', tx.hash); } catch (_) { /* storage blocked */ }
        btn.textContent = 'Launching…';
        say('Sent. Waiting for the block…');
        const rc = await tx.wait();
        const ev = rc.logs.map((l) => { try { return factory.interface.parseLog(l); } catch (_) { return null; } }).find((x) => x && x.name === 'PairCreated');
        if (!ev) throw new Error('The transaction went through but no coin was created.');
        fetch(`/api/poke/${net.chainId}`, { method: 'POST' }).catch(() => {});
        say('Launched. Opening your coin…');
        location.href = `token.html?chain=${net.chainId}&c=${ev.args.curve}&new=1`;
        return;
      } catch (err) {
        say(Y.cleanError(err), true);
      }
      busy = false;
      renderButton();
    });

    // find a launch by its transaction: the receipt names the curve
    const findTx = el('find-tx');
    try { const last = localStorage.getItem('yuelong-last-launch'); if (last) findTx.value = last; } catch (_) { /* storage blocked */ }
    el('find-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const h = findTx.value.trim();
      if (!/^0x[0-9a-f]{64}$/i.test(h)) { Y.toast('That is not a transaction hash.', 'is-bad'); return; }
      const [eth, A] = await Promise.all([Y.ethers(), Y.abi()]);
      const iface = new eth.Interface(A.YuelongFactory);
      for (const n of cfg.networks) {
        try {
          const rc = await (await Y.reader(n)).getTransactionReceipt(h);
          if (!rc) continue;
          if (!rc.status) { Y.toast(`That transaction failed on ${esc(n.name)}, so nothing was launched.`, 'is-bad'); return; }
          const log = rc.logs.find((l) => l.address.toLowerCase() === n.factory.toLowerCase());
          const ev = log && iface.parseLog(log);
          if (ev && ev.name === 'PairCreated') { location.href = `token.html?chain=${n.chainId}&c=${ev.args.curve}`; return; }
        } catch (_) { /* not on this network */ }
      }
      Y.toast('No launch found for that transaction yet. If it was just sent, wait a few seconds and try again.', 'is-bad');
    });

    desc.dispatchEvent(new Event('input'));
    updateAvatar();
    Y.config().then((c) => {
      cfg = c;
      if (cfg.live) {
        const want = qs.get('chain');
        net = cfg.networks.find((n) => String(n.chainId) === want || n.key === want)
          || cfg.networks.find((n) => want && n.key.startsWith(want)) || cfg.networks[0];
      }
      renderNets();
      loadEcon();
    });
    renderNets();
    renderTerms();
  }

  /* ---------- hero: totals ---------- */

  const stats = $$('.dn-live-stats dd[data-count]');
  const fmtStat = (v, dec) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const showStat = (dd, v) => { const dec = +dd.dataset.dec || 0; dd.textContent = fmtStat(v, dec) + (dec ? ' τ' : ''); };
  let statsTimer = 0, statVals = stats.map((dd) => +dd.dataset.count);
  const countUp = () => {
    if (reduced) { stats.forEach((dd, i) => showStat(dd, statVals[i])); return; }
    const t0 = performance.now();
    const run = (t) => {
      const k = Math.min((t - t0) / 1600, 1), e = 1 - Math.pow(1 - k, 3);
      stats.forEach((dd, i) => showStat(dd, statVals[i] * e));
      if (k < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  };
  const flashStats = (vals) => {
    stats.forEach((dd, i) => {
      if (vals[i] === statVals[i]) return;
      statVals[i] = vals[i];
      showStat(dd, vals[i]);
      dd.classList.remove('is-tick'); void dd.offsetWidth; dd.classList.add('is-tick');
    });
  };

  /* ---------- live data ---------- */

  // Once a deployment is live the homepage shows the chain: coins, totals, the feed and the
  // fullest curve, refreshed every 15 seconds. Before that it keeps the samples above.
  if (window.YL && (grid || stats.length || feed || meter || rail)) {
    const Y = window.YL;
    Y.config().then((cfg) => {
      if (!cfg.live) {
        countUp();
        if (!reduced && stats.length) statsTimer = setInterval(() => {
          if (document.hidden) return;
          flashStats([statVals[0] + Math.round((0.4 + Math.random() * 3.2) * 10) / 10, statVals[1] + 1, statVals[2]]);
        }, 7000);
        return;
      }
      isLive = true;
      clearInterval(feedTimer);
      const dl = $('.dn-live-stats');
      if (dl) { dl.setAttribute('aria-label', 'Network totals'); const dt = $('dt', dl); if (dt) dt.textContent = `${cfg.networks[0].native} traded`; }
      const netName = (id) => (cfg.networks.find((n) => n.chainId === id) || {}).short || '';
      const nt = (w, sym) => `${Y.fmtAmt(Y.toNum(w))} ${sym}`;

      const load = async (first) => {
        const [m, st, fd] = await Promise.all([Y.api('/api/markets'), Y.api('/api/stats'), Y.api('/api/feed')]);
        const toks = m.tokens;
        cards = toks.map((t) => liveCard(t, cfg.networks));
        if (grid) { renderMarkets(marketFilter); if (first) window.dnReveal?.($$('.dn-mcard', grid), true); }
        renderStack(toks.length);

        const vals = [st.networks.reduce((a, n) => a + Y.toNum(n.volume), 0), st.launches, st.graduated];
        if (first) { statVals = vals; countUp(); } else flashStats(vals);

        if (meter && meterTo) {
          const open = toks.filter((t) => !t.graduated).sort((a, b) => b.progress - a.progress)[0] || toks.find((t) => t.graduated);
          const tile = meter.closest('.dn-tile');
          if (open && tile) {
            $('.dn-mini-head span', tile).textContent = `$${open.symbol} · curve progress`;
            const lg = $$('.dn-legend span', tile);
            if (lg[0]) lg[0].innerHTML = `<i class="k-res"></i>${esc(nt(open.quoteReserve, open.quoteSymbol))} raised`;
            if (lg[2]) lg[2].innerHTML = `<i class="k-left"></i>${open.graduated ? 'Graduated' : esc(nt(BigInt(open.threshold) - BigInt(open.quoteReserve), open.quoteSymbol)) + ' to go'}`;
            meterTo(open.progress * 100);
          }
        }

        if (feed) {
          const events = [
            ...toks.map((t) => ({ t: t.createdAt, html: `<b>${esc(t.name)} · $${esc(t.symbol)}</b><span>${esc(t.description || 'Launched on a bonding curve.')}</span><small>Launched · ${esc(netName(t.chainId))} · ${Y.ago(t.createdAt)} ago</small>` })),
            ...fd.trades.map((x) => ({ t: x.t, html: `<b>$${esc(x.symbol)} · ${x.s === 'b' ? 'buy' : 'sell'}</b><span>${esc(nt(x.q, (toks.find((t) => t.curve === x.curve) || {}).quoteSymbol || ''))} ${x.s === 'b' ? 'for' : 'from'} ${esc(Y.fmtAmt(Y.toNum(x.n)))} coins</span><small>${esc(Y.short(x.w))} · ${Y.ago(x.t)} ago</small>` })),
          ].sort((a, b) => b.t - a.t).slice(0, 3);
          const html = events.map((e) => `<div>${e.html}</div>`).join('') || '<div><b>Waiting for the first launch</b><span>New coins and trades appear here as the chain confirms them.</span></div>';
          if (feed.dataset.last !== html) { feed.innerHTML = html; if (!first && feed.firstElementChild) feed.firstElementChild.className = 'is-new'; feed.dataset.last = html; }
        }

        if (renderRail && first) {
          const th = toks.filter((t) => (t.description || '').length >= 40).slice(0, 12);
          if (th.length >= 4) renderRail(th.map((t) => ({ label: KIND_LABEL[t.category] || 'TAO Ecosystem', sn: t.subnet != null ? 'SN' + t.subnet : '', ticker: t.symbol, name: t.name, quote: t.description, img: t.image || tokenArt(t.symbol), href: `token.html?chain=${t.chainId}&c=${t.curve}` })));
        }
      };
      load(true).catch(() => countUp());
      setInterval(() => { if (!document.hidden) load(false).catch(() => {}); }, 15000);
    });
  } else if (stats.length) countUp();

  /* ---------- the Dragon Gate ---------- */

  const gateSec = $('#dragon-gate');
  if (gateSec) {
    const carp = $('.dn-carp', gateSec);
    const steps = $$('.dn-gate-steps li', gateSec);
    const meterBar = $('.dn-gate-meter b', gateSec);
    const meterTxt = $('.dn-gate-meter em', gateSec);
    // the leap: out of the river, up the face of the falls, over the gate
    const P = [[150, 470], [170, 430], [200, 360], [228, 290], [250, 230], [268, 180], [290, 150], [318, 150], [350, 170]];
    const along = (k) => {
      const f = k * (P.length - 1), i = Math.min(Math.floor(f), P.length - 2), u = f - i;
      const [x0, y0] = P[i], [x1, y1] = P[i + 1];
      return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI];
    };
    const setStep = (n) => steps.forEach((li, i) => li.classList.toggle('is-on', i <= n));
    const setMeter = (p) => { meterBar.style.width = p + '%'; meterTxt.textContent = Math.round(p) + '%'; };
    let raf = 0;

    const play = () => {
      cancelAnimationFrame(raf);
      gateSec.classList.remove('is-risen');
      setStep(0); setMeter(0);
      if (reduced) { gateSec.classList.add('is-risen'); setStep(2); setMeter(100); return; }
      gateSec.classList.add('is-leaping');
      const t0 = performance.now(), D = 3200;
      const tick = (t) => {
        const k = Math.min((t - t0) / D, 1);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const [x, y, a] = along(e);
        carp.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)})`);
        setMeter(e * 100);
        setStep(e < 0.25 ? 0 : e < 0.85 ? 1 : 2);
        if (k < 1) raf = requestAnimationFrame(tick);
        else { gateSec.classList.remove('is-leaping'); gateSec.classList.add('is-risen'); }
      };
      raf = requestAnimationFrame(tick);
    };

    carp.setAttribute('transform', 'translate(150 470) rotate(-60)');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); play(); } }, { threshold: 0.6 });
      io.observe($('.dn-gate-art', gateSec));
    } else play();
    $('.dn-gate-replay', gateSec).addEventListener('click', play);
  }

  /* ---------- scroll motion ---------- */

  // Entrances: things fade up out of a slight blur as they reach the viewport, staggered
  // among their siblings. Panels slide in from their own side.
  const revealIO = !reduced && 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        revealIO.unobserve(en.target);
      }), { rootMargin: '0px 0px -4% 0px', threshold: 0.01 })
    : null;

  window.dnReveal = (els, now) => {
    els.forEach((el, i) => {
      el.classList.add('dn-reveal');
      el.style.setProperty('--d', `${Math.min(i % 6, 3) * 40}ms`);
      if (!revealIO) { el.classList.add('is-in'); return; }
      if (now) { el.classList.remove('is-in'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in'))); }
      else revealIO.observe(el);
    });
  };

  const groups = [
    '.dn-sec .dn-center > *', '.dn-steps-side > h2', '#market-tabs', '.dn-market-grid .dn-mcard',
    '.dn-bento .dn-tile', '.dn-rail', '.dn-gate-copy > *', '.dn-gate-art', '.dn-faq-wrap > h2', '.dn-faq details',
    '.dn-foot-top > *, .dn-foot-cols > div', '.dn-launch > *', '.dn-launch-grid > *', '.dn-doc section',
  ];
  groups.forEach((sel) => window.dnReveal($$(sel)));
  $$('.dn-panel').forEach((panel) => {
    const flip = panel.classList.contains('dn-panel-flip');
    window.dnReveal([panel]);
    $('.dn-panel-art', panel).classList.add(flip ? 'dn-from-right' : 'dn-from-left');
    $('.dn-panel-copy', panel).classList.add(flip ? 'dn-from-left' : 'dn-from-right');
  });

  // Hero parallax and the nav tightening.
  const heroBg = $('.dn-hero-bg');
  const heroIn = $('.dn-hero-in');
  const navWrap = $('.dn-nav-wrap');

  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY, vh = window.innerHeight;
    navWrap?.classList.toggle('is-scrolled', y > 40);
    if (reduced || !heroBg) return;
    const p = Math.min(y / vh, 1);
    heroBg.style.transform = `translate3d(0, ${(y * 0.35).toFixed(1)}px, 0) scale(${(1.04 + p * 0.1).toFixed(4)})`;
    if (heroIn) {
      heroIn.style.transform = `translate3d(0, ${(-y * 0.18).toFixed(1)}px, 0)`;
      heroIn.style.opacity = String(Math.max(0, 1 - p * 1.35).toFixed(3));
    }
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- docs table of contents ---------- */

  const toc = $$('.dn-toc a[href^="#"]');
  if (toc.length && 'IntersectionObserver' in window) {
    const secs = toc.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        toc.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-120px 0px -65% 0px' });
    secs.forEach((s) => spy.observe(s));
  }
})();
