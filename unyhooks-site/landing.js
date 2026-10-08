/* UnyHooks — the landing page's moving parts.

   - the rules ticker, written twice so it can loop
   - "See it react": three hooks with the settings a launch would use. Press an
     event and the rules it touches light up, and the pool's state changes. It
     is a simulation of what the deployed contracts do, not a live pool.
   - the line down the left edge: a dot per section, a gold fill and the hook
     following the scroll
   - "Live on Robinhood Chain": the launches made with UnyHooks, from the
     server's index of the chain (/api/launches, server/launch-index.js). On a
     host without that server the section stays hidden.

   With prefers-reduced-motion the hook stays put and nothing animates. */

(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- live launches ---------- */

  const live = $('#live');
  if (live && window.fetch) {
    const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
    const ago = (t) => {
      const s = Math.max(0, Date.now() / 1000 - t);
      return s < 3600 ? `${Math.max(1, Math.round(s / 60))} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`;
    };
    const date = (t) => new Date(t * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const lockText = (x) => (!x.lock ? 'No lock' : x.forever ? 'Locked forever' : `Locked until ${date(Number(x.unlockAt))}`);
    const page = (hook) => `hook.html?a=${encodeURIComponent(hook)}`;
    fetch('/api/launches', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !d.ready) return;
        const S = d.stats;
        if (S.launches > 0) {
          $('#lv-launches').textContent = num(S.launches);
          $('#lv-eth').textContent = `${num(S.ethPaired, 3)} ETH`;
          $('#lv-locked').textContent = `${num(S.locked)} of ${num(S.launches)}`;
          $('#lv-swaps').textContent = num(S.swaps);
          $('#lv-stats').hidden = false;
          $('#lv-list').innerHTML = d.latest.map((x) => `
            <a class="uh-live-item" href="${esc(page(x.hook))}">
              <b>$${esc(x.symbol)}</b><span class="uh-live-name">${esc(x.name || '')}</span>
              <span class="uh-live-meta">${esc(num(x.eth, 3))} ETH · <span class="${x.lock ? 'is-locked' : 'is-open'}">${esc(lockText(x))}</span></span>
              <small>${x.time ? esc(ago(x.time)) : ''}</small>
            </a>`).join('');
        } else {
          $('#lv-list').innerHTML = '<div class="uh-live-empty"><p>No launches yet. The first one shows up here a few minutes after it happens.</p><a class="uh-btn uh-btn-pink uh-btn-sm" href="launch.html">Launch a token</a></div>';
        }
        if (d.updatedAt) $('#lv-time').textContent = ` · updated ${ago(Date.parse(d.updatedAt) / 1000)}`;
        live.hidden = false;
      })
      .catch(() => {});
  }

  /* ---------- the rules ticker ---------- */

  const TICKER = [
    ['buy > 0.1 ETH', 'refuse'],
    ['any swap', 'send 1% to the treasury'],
    ['price moved ≥ 2%', 'fee = 1%'],
    ['same wallet within 30 s', 'refuse'],
    ['outside 13:30–20:00 UTC', 'refuse'],
    ['60 min since launch', 'lift the cap'],
    ['before the lock date', 'keep the liquidity']
  ];
  const ticker = $('#ticker');
  if (ticker) {
    const row = TICKER.map(([c, a]) => `<span class="uh-ticker-item">when <code>${c}</code> then <em>${a}</em></span>`).join('');
    ticker.innerHTML = row + row.replace(/class="uh-ticker-item"/g, 'class="uh-ticker-item" aria-hidden="true"');
  }

  /* ---------- see it react ---------- */

  const eth = (v) => `${Number(v.toFixed(4))} ETH`;
  const pct = (v) => `${v.toFixed(2)}%`;

  const HOOKS = {
    launch: {
      tab: 'Launch guard',
      desc: 'A new token paired with ETH. For the first hour every buy is capped at 0.1 ETH and each wallet waits 30 seconds between buys. The liquidity is locked for a year.',
      rules: [
        { id: 'cap', code: 'when <b>buy &gt; 0.1 ETH</b> and <b>under 60 min</b> then <i>refuse</i>', mode: 'repeatable' },
        { id: 'cool', code: 'when <b>same wallet within 30 s</b> and <b>under 60 min</b> then <i>refuse</i>', mode: 'repeatable' },
        { id: 'lift', code: 'when <b>60 min since launch</b> then <i>lift both limits</i>', mode: 'once' },
        { id: 'lock', code: 'when <b>liquidity is removed</b> before <b>the lock date</b> then <i>refuse</i>', mode: 'repeatable' }
      ],
      start: () => ({ minutes: 0 }),
      econ: (s) => [
        ['Largest buy', s.minutes < 60 ? '0.1 ETH' : 'no limit'],
        ['Wait between buys', s.minutes < 60 ? '30 s per wallet' : 'none'],
        ['Selling', 'always open'],
        ['Liquidity', 'locked until Oct 2027'],
        ['Since launch', `${s.minutes} min`]
      ],
      events: [
        ['A sniper tries to buy 2 ETH', (s) => (s.minutes < 60
          ? { fire: ['cap'], no: true, log: 'The buy is over the 0.1 ETH cap, so the swap reverts. The sniper keeps their ETH; the pool is untouched.' }
          : { log: 'The launch window is over, so the buy goes through like any other.' })],
        ['One wallet buys 0.05 ETH twice in 10 s', (s) => (s.minutes < 60
          ? { fire: ['cool'], no: true, log: 'The first buy goes through. The second comes 10 seconds later, inside the 30 second wait, and reverts.' }
          : { log: 'Both buys go through: the cooldown ended with the launch window.' })],
        ['A holder sells 5M tokens', () => ({ log: 'The sell goes through. Launch protection never limits sells.' })],
        ['60 minutes pass', (s) => {
          if (s.minutes >= 60) return { log: 'Nothing new: the limits were already lifted.' };
          s.minutes = 60;
          return { fire: ['lift'], log: 'The launch window closes. Buys are no longer capped and wallets no longer wait.' };
        }],
        ['The launcher tries to pull the liquidity', () => ({ fire: ['lock'], no: true, log: 'The lock refuses: StillLocked. The position only comes back after the lock date, and the date can only move later.' })]
      ],
      off: (s, id) => s.minutes >= 60 && (id === 'cap' || id === 'cool')
    },
    fee: {
      tab: 'Fee on every swap',
      desc: '1% of every swap goes to the project\'s treasury, taken inside the swap. The rate and the wallet are fixed when the hook is deployed.',
      rules: [
        { id: 'fee', code: 'when <b>any swap</b> then <i>send 1% to the treasury</i>', mode: 'repeatable' },
        { id: 'fixed', code: 'when <b>anyone tries to change the fee</b> then <i>there is no function for it</i>', mode: 'repeatable' }
      ],
      start: () => ({ earned: 0, swaps: 0 }),
      econ: (s) => [
        ['Fee per swap', '1.00%'],
        ['Goes to', 'treasury 0x7a3…20C0'],
        ['Swaps so far', String(s.swaps)],
        ['Treasury earned', eth(s.earned)]
      ],
      events: [
        ['Someone buys with 1 ETH', (s) => { s.swaps += 1; s.earned += 0.01; return { fire: ['fee'], log: 'The buy goes through and 0.01 ETH goes to the treasury in the same transaction.' }; }],
        ['Someone sells for 2.5 ETH', (s) => { s.swaps += 1; s.earned += 0.025; return { fire: ['fee'], log: 'The seller receives 2.475 ETH; 0.025 ETH goes to the treasury.' }; }],
        ['The launcher tries to raise the fee to 5%', () => ({ fire: ['fixed'], no: true, log: 'There is nothing to call. The fee is a constant in the contract, so it stays at 1% for good.' })]
      ]
    },
    dynamic: {
      tab: 'Dynamic fee',
      desc: 'The fee sits at 0.05% while the market is calm and climbs with the price move, up to 1% when the price moves 2% within five minutes. Liquidity providers earn more when trading gets wild.',
      rules: [
        { id: 'calm', code: 'when <b>price is calm</b> then <i>fee = 0.05%</i>', mode: 'repeatable' },
        { id: 'scale', code: 'when <b>price moves</b> then <i>fee rises with the move</i>', mode: 'repeatable' },
        { id: 'max', code: 'when <b>move ≥ 2% in 5 min</b> then <i>fee = 1%</i>', mode: 'repeatable' }
      ],
      start: () => ({ move: 0 }),
      econ: (s) => {
        const fee = Math.min(1, 0.05 + (Math.min(s.move, 2) / 2) * 0.95);
        return [['Fee now', pct(fee)], ['Price move, last 5 min', `${s.move.toFixed(1)}%`], ['Range', '0.05% – 1.00%']];
      },
      events: [
        ['The price moves 1% in a minute', (s) => { s.move = 1; return { fire: ['scale'], log: 'Half of the 2% that reaches the ceiling, so the fee goes to about half way: 0.53%.' }; }],
        ['A whale moves the price 4%', (s) => { s.move = 4; return { fire: ['max'], log: 'The move is past 2%, so the fee hits the 1% ceiling.' }; }],
        ['Five quiet minutes pass', (s) => { s.move = 0; return { fire: ['calm'], log: 'The window resets. The fee falls back to 0.05%.' }; }]
      ]
    }
  };

  const sim = $('#sim');
  if (sim) {
    let key = 'launch';
    let state = null;
    let counts = {};
    let lastFired = [];
    let lastEcon = {};

    const tabs = $('#sim-tabs');
    tabs.innerHTML = Object.entries(HOOKS).map(([k, h]) => `<button type="button" role="tab" data-k="${k}" aria-selected="${k === key}">${h.tab}</button>`).join('');

    const draw = () => {
      const h = HOOKS[key];
      $('#sim-desc').textContent = h.desc;
      $('#sim-rules').innerHTML = h.rules.map((r, i) => {
        const n = counts[r.id] || 0;
        const off = h.off && h.off(state, r.id);
        const pill = off ? '<span class="uh-pill is-off">Ended</span>'
          : n && r.mode === 'once' ? '<span class="uh-pill is-fired">Fired</span>'
            : n ? `<span class="uh-pill is-fired">Fired ×${n}</span>` : '<span class="uh-pill is-armed">Armed</span>';
        return `<div class="uh-rule${lastFired.includes(r.id) ? ' is-fired' : ''}"><code>${r.code}</code><div class="uh-rule-meta">Rule ${i + 1} · ${r.mode} ${pill}</div></div>`;
      }).join('');
      $('#sim-events').innerHTML = h.events.map(([label], i) => `<button type="button" data-e="${i}">${label}</button>`).join('');
      const rows = h.econ(state);
      $('#sim-econ').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd class="${lastEcon[k] !== undefined && lastEcon[k] !== v ? 'is-changed' : ''}">${v}</dd></div>`).join('');
      lastEcon = Object.fromEntries(rows);
    };

    const reset = () => {
      state = HOOKS[key].start();
      counts = {};
      lastFired = [];
      lastEcon = {};
      $('#sim-log').textContent = 'No rule has fired yet. Press an event on the left.';
      draw();
    };

    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      key = b.dataset.k;
      tabs.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      reset();
    });
    $('#sim-events').addEventListener('click', (e) => {
      const b = e.target.closest('[data-e]');
      if (!b) return;
      const [label, run] = HOOKS[key].events[Number(b.dataset.e)];
      const out = run(state) || {};
      lastFired = out.fire || [];
      lastFired.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
      const verdict = out.no ? '<b class="is-no">Refused.</b>' : '<b>Went through.</b>';
      $('#sim-log').innerHTML = `${label}. ${verdict} ${out.log}`;
      draw();
    });
    $('#sim-reset').addEventListener('click', reset);
    reset();
  }

  /* ---------- the line down the left ---------- */

  // The hook's place on the line is how far the page has scrolled. A section's
  // dot sits where the hook will be when that section's top reaches 40% of the
  // window, so the dot lights the moment the section comes into view. While
  // scrolling the hook swings a little with the speed and settles when you stop.
  const rail = $('#rail');
  const hook = $('#rail-hook');
  const sections = [...document.querySelectorAll('main > section')];
  if (rail && hook && sections.length) {
    const dots = sections.map(() => {
      const d = document.createElement('span');
      d.className = 'uh-rail-dot';
      rail.appendChild(d);
      return d;
    });
    let frame = 0;
    let lastY = window.scrollY;
    let tilt = 0;
    const place = () => {
      frame = 0;
      const doc = document.documentElement;
      const run = Math.max(1, rail.clientHeight - hook.getBoundingClientRect().height);
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const at = (scroll) => Math.min(1, Math.max(0, scroll / max)) * run;
      const y = still ? 0 : at(window.scrollY);
      rail.style.setProperty('--rail-y', `${y.toFixed(1)}px`);
      sections.forEach((s, i) => {
        dots[i].hidden = s.hidden;
        if (s.hidden) return;
        const top = s.getBoundingClientRect().top + window.scrollY;
        const dy = at(top - window.innerHeight * 0.4);
        dots[i].style.top = `${dy + 4}px`;
        dots[i].classList.toggle('is-past', !still && dy <= y + 1);
      });
      if (still) return;
      // Swing against the direction of travel, then ease back to rest.
      const v = window.scrollY - lastY;
      lastY = window.scrollY;
      tilt = tilt * 0.82 + Math.max(-14, Math.min(14, v * 0.35)) * 0.18;
      rail.style.setProperty('--rail-tilt', `${tilt.toFixed(2)}deg`);
      if (Math.abs(tilt) > 0.05) ask();
    };
    const ask = () => { if (!frame) frame = requestAnimationFrame(place); };
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    window.addEventListener('load', ask);
    place();
  }
})();
