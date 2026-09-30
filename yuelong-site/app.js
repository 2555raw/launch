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

  /* ---------- wallet (mock) ---------- */

  $$('[data-wallet]').forEach((btn) => btn.addEventListener('click', () => {
    const on = !document.body.classList.contains('is-connected');
    document.body.classList.toggle('is-connected', on);
    $$('.dn-nav [data-wallet]').forEach((b) => {
      b.textContent = on ? '0x7a3…c91e' : 'Connect wallet';
      b.classList.toggle('is-on', on);
    });
    const review = $('#review');
    if (review) review.textContent = on ? 'Review launch' : 'Connect wallet to review';
  }));

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

  const stack = $('#stack');
  if (stack) {
    stack.innerHTML = MARKETS.slice(0, 5).map((m) => `<img src="${tokenArt(m.ticker)}" alt="">`).join('')
      + `<span>${MARKETS.length} launches</span>`;
  }

  const grid = $('#market-grid');
  const renderMarkets = (filter) => {
    const list = MARKETS.filter((m) => filter === 'all' || m.kind === filter);
    grid.innerHTML = list.map((m) => `
      <a class="dn-mcard" href="#markets">
        <div class="dn-mcard-top">
          <img class="dn-av" src="${tokenArt(m.ticker)}" alt="">
          <span class="dn-meta">${esc(m.label)}${m.sn ? ' · ' + esc(m.sn) : ''} · ${esc(m.chain)}</span>
        </div>
        <h3>${esc(m.name)} <span>$${esc(m.ticker)}</span></h3>
        <p>${esc(m.desc)}</p>
        <div class="dn-stats"><span>${esc(m.price)}</span><span class="${m.curve > 50 ? 'is-hot' : ''}">${m.chain === 'Bittensor' ? 'pool' : m.curve.toFixed(1) + '% curve'}</span><span>${esc(m.age)} ago</span></div>
      </a>`).join('');
  };
  if (grid) {
    renderMarkets('all');
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
  if (meter) {
    const TARGET = 62;
    const n = 44;
    meter.innerHTML = Array.from({ length: n }, () => '<i></i>').join('');
    const bars = $$('i', meter);
    const paint = (p) => {
      const filled = Math.round((p / 100) * n);
      bars.forEach((b, i) => { b.className = i < filled - 3 ? 'k-res' : i < filled ? 'k-new' : ''; });
      $('#meter-v').textContent = Math.round(p);
    };
    if (reduced || !('IntersectionObserver' in window)) paint(TARGET);
    else {
      paint(0);
      const io = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t) => {
          const k = Math.min((t - t0) / 1400, 1);
          paint(TARGET * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, { threshold: 0.4 });
      io.observe(meter);
    }
  }

  const feed = $('#feed');
  if (feed) {
    const item = (m) => `<b>${esc(m.name)} · $${esc(m.ticker)}</b><span>${esc(m.desc)}</span><small>${esc(m.label)} · ${esc(m.age)} ago</small>`;
    feed.innerHTML = MARKETS.slice(0, 3).map((m) => `<div>${item(m)}</div>`).join('');
    if (!reduced) {
      let i = 3;
      setInterval(() => {
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
  if (rail) {
    const card = (t, hidden) => `
      <article class="dn-thesis"${hidden ? ' aria-hidden="true"' : ''}>
        <div class="dn-thesis-top">
          <img class="dn-av" src="${tokenArt(t.ticker)}" alt="">
          ${esc(t.label)}
          <span class="dn-meta">Thesis${t.sn ? ' · ' + esc(t.sn) : ''}</span>
        </div>
        <blockquote>${esc(t.quote)}</blockquote>
        <cite>${esc(t.name)} · $${esc(t.ticker)}</cite>
      </article>`;
    rail.innerHTML = `<div class="dn-rail-track">${THESES.map((t) => card(t)).join('')}${reduced ? '' : THESES.map((t) => card(t, true)).join('')}</div>`;
  }

  /* ---------- launch page ---------- */

  const form = $('#launch-form');
  if (form) {
    const qs = new URLSearchParams(location.search);
    let net = qs.get('chain') === 'robinhood' ? 'robinhood' : 'bittensor';

    const NET = {
      bittensor: {
        kicker: 'Bittensor EVM · native TAO', title: 'Straight into a pool.',
        sub: "One transaction deploys the token and opens its pool, funded by the reserve you set below. There's no extra platform fee to deploy.",
        note: '<p>Connect an EVM wallet such as MetaMask or Rabby on Bittensor EVM (chain ID 964). Gas and TAO-paired liquidity are paid in native TAO; alpha pairs need the wrapped alpha of the subnet you pick.</p><p>Switching networks in your wallet never moves funds between them.</p>',
        mech: 'Locked pool from block one', reserve: true,
        tnote: 'No curve and no graduation on this path: the full supply goes into the pool, and the creator buys afterwards like anyone else. Your starting reserve sets the opening price.',
        warn: 'Pool liquidity is sent to an address nobody controls, so the starting reserve can never be withdrawn. The contracts are tested but have not had an independent audit yet.',
        ack: "I understand the liquidity is locked for good and that this token isn't subnet alpha.",
      },
      robinhood: {
        kicker: 'Robinhood Chain · bonding curve', title: 'Start on a curve.',
        sub: 'One transaction deploys the token on a bonding curve. When the curve fills, its reserve and remaining supply move into a pool automatically.',
        note: '<p>Connect an EVM wallet on Robinhood Chain. Gas is paid in ETH; TAO pairs use bridged TAO, and the launch fee is read from the contract and shown before you sign.</p><p>Switching networks in your wallet never moves funds between them.</p>',
        mech: 'Bonding curve → pool', reserve: false,
        tnote: 'Anyone can buy or sell against the curve from the first block. Graduation happens on its own when the target is reached; nobody has to trigger it.',
        warn: 'Graduated liquidity is locked permanently. The contracts are tested but have not had an independent audit yet.',
        ack: "I understand graduated liquidity is locked for good and that this token isn't subnet alpha.",
      },
    };

    const pairSel = $('#f-pair');
    const name = $('#f-name');
    const ticker = $('#f-ticker');
    const desc = $('#f-desc');
    const reserve = $('#f-reserve');

    if (qs.get('ticker')) ticker.value = qs.get('ticker').slice(0, 10);
    if (qs.get('desc')) desc.value = qs.get('desc').slice(0, 600);
    if (qs.get('pair') === 'alpha') pairSel.value = 'SN19';

    const renderTerms = () => {
      const c = NET[net];
      const pairTxt = pairSel.value === 'TAO' ? 'Native TAO' : pairSel.value + ' alpha (wrapped)';
      const unit = pairSel.value === 'TAO' ? 'TAO' : pairSel.value + ' α';
      const rows = [
        ['Network', net === 'bittensor' ? 'Bittensor EVM' : 'Robinhood Chain'],
        ['Paired with', pairTxt],
        ['Total supply', '1,000,000,000'],
        ['Into the market', '100%'],
        ['Creator allocation', '0%'],
        ['Liquidity', 'Locked permanently'],
        ['Mechanism', c.mech],
      ];
      if (c.reserve) rows.splice(3, 0, ['Starting reserve', `${reserve.value || 0} ${unit}`]);
      $('#terms').innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
      $('#terms-note').textContent = c.tnote;
      $('#terms-warn').textContent = c.warn;
      $('#ack-text').textContent = c.ack;
      $('#reserve-unit').textContent = unit;
    };

    const renderNet = () => {
      const c = NET[net];
      $$('#nets button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.net === net)));
      $('#net-note').innerHTML = c.note;
      $('#form-kicker').textContent = net === 'bittensor' ? `Bittensor EVM · ${pairSel.value === 'TAO' ? 'native TAO' : pairSel.value + ' alpha'}` : c.kicker;
      $('#form-title').textContent = c.title;
      $('#form-sub').textContent = c.sub;
      $('#reserve-field').hidden = !c.reserve;
      renderTerms();
    };

    $('#nets').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-net]');
      if (!b) return;
      net = b.dataset.net;
      renderNet();
    });
    pairSel.addEventListener('change', renderNet);
    reserve.addEventListener('input', renderTerms);
    ticker.addEventListener('input', () => { ticker.value = ticker.value.replace(/[^a-z0-9]/gi, '').toUpperCase(); updateAvatar(); });
    name.addEventListener('input', () => updateAvatar());
    desc.addEventListener('input', () => { $('#f-count').textContent = `${desc.value.length} / 600`; });

    const avatar = $('#f-avatar');
    let hasImage = false;
    const updateAvatar = () => {
      if (hasImage) return;
      const t = ticker.value || name.value;
      avatar.textContent = t ? t[0].toUpperCase() : '?';
      avatar.style.background = t ? color(t.toUpperCase()) : '';
      avatar.style.color = t ? '#000' : '';
    };
    $('#f-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      const msg = $('#form-msg');
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { msg.textContent = 'That image is over 2 MB.'; msg.classList.add('is-bad'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        hasImage = true;
        avatar.textContent = '';
        avatar.style.backgroundImage = `url("${reader.result}")`;
      };
      reader.readAsDataURL(f);
    });

    $('#review').addEventListener('click', (e) => {
      if (!document.body.classList.contains('is-connected')) return; // the wallet handler connects first
      e.stopImmediatePropagation();
      const msg = $('#form-msg');
      const problems = [];
      [name, ticker, desc, reserve].forEach((el) => el.classList.remove('is-bad'));
      if (!name.value.trim()) { problems.push('a name'); name.classList.add('is-bad'); }
      if (ticker.value.length < 2) { problems.push('a ticker'); ticker.classList.add('is-bad'); }
      if (desc.value.trim().length < 20) { problems.push('a thesis of 20+ characters'); desc.classList.add('is-bad'); }
      if (NET[net].reserve && !(parseFloat(reserve.value) >= 0.01)) { problems.push('a reserve of at least 0.01'); reserve.classList.add('is-bad'); }
      if (!$('#f-ack').checked) problems.push('the confirmation box');
      if (problems.length) {
        msg.textContent = 'Still needed: ' + problems.join(', ') + '.';
        msg.classList.add('is-bad');
        return;
      }
      msg.classList.remove('is-bad');
      msg.textContent = 'Preview only — this page is not wired to the contracts yet.';
    }, true);

    desc.dispatchEvent(new Event('input'));
    updateAvatar();
    renderNet();
  }

  /* ---------- hero: live totals (sample) ---------- */

  const stats = $$('.dn-live-stats dd[data-count]');
  if (stats.length) {
    const fmt = (v, dec) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const show = (dd, v) => { const dec = +dd.dataset.dec || 0; dd.textContent = fmt(v, dec) + (dec ? ' τ' : ''); };
    const vals = stats.map((dd) => +dd.dataset.count);
    if (!reduced) {
      const t0 = performance.now();
      const run = (t) => {
        const k = Math.min((t - t0) / 1600, 1), e = 1 - Math.pow(1 - k, 3);
        stats.forEach((dd, i) => show(dd, vals[i] * e));
        if (k < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
      // now and then a new launch lands: nudge the totals and flash them
      setInterval(() => {
        if (document.hidden) return;
        vals[0] += Math.round((0.4 + Math.random() * 3.2) * 10) / 10;
        vals[1] += 1;
        stats.forEach((dd, i) => { if (i < 2) { show(dd, vals[i]); dd.classList.remove('is-tick'); void dd.offsetWidth; dd.classList.add('is-tick'); } });
      }, 7000);
    } else stats.forEach((dd, i) => show(dd, vals[i]));
  }

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
      }), { rootMargin: '0px 0px -10% 0px', threshold: 0.08 })
    : null;

  window.dnReveal = (els, now) => {
    els.forEach((el, i) => {
      el.classList.add('dn-reveal');
      el.style.setProperty('--d', `${Math.min(i % 6, 5) * 70}ms`);
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
