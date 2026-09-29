/* Dendra — page behaviour for index, launch and docs.
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

  const COLORS = ['#FF5B26', '#F2C94C', '#6FCF97', '#56CCF2', '#BB6BD9', '#F2994A', '#EB5757', '#9B9B9B'];

  const MARKETS = [
    { name: 'Inference Rush', ticker: 'INFR', kind: 'subnet',    label: 'Subnet coin',      chain: 'Robinhood', sn: 'SN19', desc: 'Cheap open-model inference eats the cloud margin, starting here.', price: '0.0₆412 TAO', curve: 62.4, age: '12m' },
    { name: 'Halving Clock',  ticker: 'HALV', kind: 'thesis',    label: 'Thesis',           chain: 'Bittensor', sn: '',     desc: 'The next emission cut is still underpriced by alpha holders.',        price: '0.0₅108 TAO', curve: 0,    age: '31m' },
    { name: 'Fold Theory',    ticker: 'PRTN', kind: 'candidate', label: 'Subnet candidate', chain: 'Robinhood', sn: '',     desc: 'A protein-structure subnet that pays for verified folds.',           price: '0.0₇93 TAO',  curve: 8.1,  age: '46m' },
    { name: 'Open Corpus',    ticker: 'DATA', kind: 'subnet',    label: 'Subnet coin',      chain: 'Robinhood', sn: 'SN13', desc: 'Models come and go. The data underneath them compounds.',           price: '0.0₆201 TAO', curve: 91.7, age: '1h' },
    { name: 'Validator Row',  ticker: 'VROW', kind: 'thesis',    label: 'Thesis',           chain: 'Robinhood', sn: '',     desc: 'Stake concentrates before it spreads. Bet on the top five.',       price: '0.0₄55 ETH',  curve: 3.2,  age: '1h' },
    { name: 'Edge Compute',   ticker: 'EDGE', kind: 'candidate', label: 'Subnet candidate', chain: 'Bittensor', sn: '',     desc: 'Idle gaming GPUs, pooled and scored for short inference jobs.',     price: '0.0₆77 TAO',  curve: 0,    age: '2h' },
    { name: 'Pretrain Club',  ticker: 'PRE9', kind: 'subnet',    label: 'Subnet coin',      chain: 'Robinhood', sn: 'SN9',  desc: 'Open pretraining closes the gap faster than the labs expect.',      price: '0.0₆330 TAO', curve: 44.9, age: '3h' },
    { name: 'Agent Payroll',  ticker: 'PAYR', kind: 'thesis',    label: 'Thesis',           chain: 'Bittensor', sn: '',     desc: 'Agents will hire agents, and settle in TAO.',                        price: '0.0₅31 TAO',  curve: 0,    age: '4h' },
    { name: 'Weather Mesh',   ticker: 'WTHR', kind: 'candidate', label: 'Subnet candidate', chain: 'Robinhood', sn: '',     desc: 'Forecasts scored against what actually happened, every hour.',      price: '0.0₇18 TAO',  curve: 1.4,  age: '5h' },
  ];

  const SUBNETS = {
    SN9:  { name: 'Pretraining', price: 0.0412, reserve: 48210, vol: 1840 },
    SN13: { name: 'Data',        price: 0.0288, reserve: 31950, vol: 1120 },
    SN19: { name: 'Inference',   price: 0.0531, reserve: 60440, vol: 2610 },
    SN25: { name: 'Protein',     price: 0.0174, reserve: 12880, vol: 540 },
    SN51: { name: 'Compute',     price: 0.0367, reserve: 40120, vol: 1930 },
  };

  const THESES = [
    { label: 'Subnet coin',      sn: 'SN19', ticker: 'INFR', name: 'Inference Rush', quote: 'Within a year, serving open models on the network will cost less than renting the same GPUs from a cloud. This subnet is where that shows up first.' },
    { label: 'Subnet candidate', sn: '',     ticker: 'PRTN', name: 'Fold Theory',    quote: 'Pay miners for protein structures that a lab later confirms, not for ones that merely look plausible.' },
    { label: 'Thesis',           sn: '',     ticker: 'HALV', name: 'Halving Clock',  quote: 'Alpha holders are pricing the next emission cut as if it were years away.' },
    { label: 'Subnet coin',      sn: 'SN13', ticker: 'DATA', name: 'Open Corpus',    quote: 'The best open dataset is the moat. Everyone trains on it; nobody can fork the years it took to collect.' },
    { label: 'Thesis',           sn: '',     ticker: 'PAYR', name: 'Agent Payroll',  quote: 'Agents will hire other agents for narrow jobs, and the invoices will be in TAO.' },
  ];

  const color = (s) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

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
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => en.target.classList.toggle('is-lit', en.isIntersecting || en.boundingClientRect.top < 0));
    }, { rootMargin: '0px 0px -45% 0px' });
    steps.forEach((li) => io.observe(li));
  } else {
    steps.forEach((li) => li.classList.add('is-lit'));
  }

  /* ---------- markets ---------- */

  const stack = $('#stack');
  if (stack) {
    stack.innerHTML = MARKETS.slice(0, 5).map((m) => `<i style="background:${color(m.ticker)}">${esc(m.ticker.slice(0, 2))}</i>`).join('')
      + `<span>${MARKETS.length} launches</span>`;
  }

  const grid = $('#market-grid');
  const renderMarkets = (filter) => {
    const list = MARKETS.filter((m) => filter === 'all' || m.kind === filter);
    grid.innerHTML = list.map((m) => `
      <a class="dn-mcard" href="#markets">
        <div class="dn-mcard-top">
          <span class="dn-av" style="background:${color(m.ticker)}">${esc(m.ticker.slice(0, 2))}</span>
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
    });
  }

  /* ---------- chat panels ---------- */

  const bubble = (html, me) => {
    const d = document.createElement('div');
    d.className = 'dn-bubble ' + (me ? 'dn-bubble-me' : 'dn-bubble-bot');
    if (me) d.textContent = html; else d.innerHTML = html;
    return d;
  };

  const answerLookup = (q) => {
    const found = (q.toUpperCase().match(/\$?[A-Z0-9]{3,5}/g) || [])
      .map((t) => MARKETS.find((m) => m.ticker === t.replace('$', '')))
      .filter(Boolean);
    if (!found.length) return `I don't know that ticker yet. Try <b>$INFR</b>, <b>$DATA</b>, <b>$PRTN</b> or <b>$HALV</b>.`;
    return found.map((m) => `
      <b>$${esc(m.ticker)}</b> · ${esc(m.name)}
      <div class="dn-row"><span>price</span><span>${esc(m.price)}</span></div>
      <div class="dn-bar"><i style="width:${m.curve}%"></i></div>
      <div class="dn-row"><span>${m.chain === 'Bittensor' ? 'locked pool' : 'curve'}</span><span>${m.chain === 'Bittensor' ? '—' : m.curve.toFixed(1) + '%'}</span></div>`).join('<br>');
  };

  const answerFaceoff = (q) => {
    const ids = (q.toUpperCase().match(/SN\s?\d+/g) || []).map((s) => s.replace(/\s/g, '')).filter((s) => SUBNETS[s]);
    if (ids.length < 2) return `Name two of <b>SN9</b>, <b>SN13</b>, <b>SN19</b>, <b>SN25</b> or <b>SN51</b>.`;
    const [a, b] = ids.slice(0, 2).map((id) => ({ id, ...SUBNETS[id] }));
    const pct = (x, y) => Math.round((x / (x + y)) * 100);
    const row = (s, o, cls) => `
      <div class="dn-row"><span><b>${s.id}</b> ${esc(s.name)}</span><span>${pct(s.vol, o.vol)}% vol</span></div>
      <div class="dn-bar ${cls}"><i style="width:${pct(s.vol, o.vol)}%"></i></div>
      <div class="dn-row"><span>α ${s.price.toFixed(4)} TAO</span><span>${s.reserve.toLocaleString('en-US')} τ reserve</span></div>`;
    const lead = a.vol >= b.vol ? a : b;
    return `${row(a, b, '')}${row(b, a, 'is-b')}<br>7-day volume leans <b>${lead.id}</b>.`;
  };

  $$('.dn-chat').forEach((chat) => {
    const body = $('.dn-chat-body', chat);
    const answer = chat.dataset.chat === 'faceoff' ? answerFaceoff : answerLookup;
    const first = $('.dn-bubble-me', body);
    if (first) body.appendChild(bubble(answer(first.textContent)));
    $('form', chat).addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('input', chat);
      const q = input.value.trim();
      if (!q) return;
      body.appendChild(bubble(q, true));
      body.appendChild(bubble(answer(q)));
      input.value = '';
      body.scrollTop = body.scrollHeight;
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

  const rail = $('#rail');
  if (rail) {
    rail.innerHTML = THESES.map((t) => `
      <article class="dn-thesis">
        <div class="dn-thesis-top">
          <span class="dn-av" style="background:${color(t.ticker)}">${esc(t.ticker.slice(0, 2))}</span>
          ${esc(t.label)}
          <span class="dn-meta">Thesis${t.sn ? ' · ' + esc(t.sn) : ''}</span>
        </div>
        <blockquote>${esc(t.quote)}</blockquote>
        <cite>${esc(t.name)} · $${esc(t.ticker)}</cite>
      </article>`).join('');
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
