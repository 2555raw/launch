/* The shell: routing, search, clock and the heartbeat that liquidates.

   A screen paints whole on entry and repaints when the state changes or the
   price advances. The repaint is skipped if the user has focus in a field, so
   nothing they are typing gets wiped, and it never touches the create-index
   screen, which is a long form. */

import { VENUE } from './config.js';
import { state, onChange } from './store.js';
import { liquidationSweep, accountSummary } from './engine.js';
import { feed } from './market.js';
import { search } from './search.js';
import { usdg, dir, clock, marketDay, marketZone, MARKET_TZ_LABEL } from './format.js';
import { markStack, markEl } from './logos.js';
import { indexLegs } from './engine.js';
import { el, toast } from './ui/components.js';
import { requireAcceptance, openTerms, scheduleStorageNotice } from './terms.js';
import {
  panelView, marketView, createView, portfolioView, creatorView,
  assetsView, assetView, indexView, notFound, confirmReset,
} from './views.js';

const view = document.getElementById('view');
const nav = document.getElementById('nav');
const input = document.getElementById('q');
const results = document.getElementById('results');
const combobox = input.closest('.wp-search');

/* ---------------- routing ---------------- */

function parseHash() {
  const raw = (location.hash || '#/').slice(1);
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');
  if (!parts.length) return { route: 'dashboard', params };
  if (parts[0] === 'i') return { route: 'index', id: parts[1], params };
  if (parts[0] === 'a') return { route: 'asset', id: parts[1], params };
  return { route: parts[0], id: parts[1], params };
}

const PAGES = {
  dashboard: () => panelView(),
  market: () => marketView(),
  create: (r) => createView(r.params.get('seed')),
  portfolio: () => portfolioView(),
  creator: () => creatorView(),
  assets: () => assetsView(),
  index: (r) => indexView(r.id),
  asset: (r) => assetView(r.id),
};

/* Tab title: says where you are without looking at the sidebar. */
const TITLES = {
  dashboard: 'Dashboard', market: 'Market', create: 'Create index',
  portfolio: 'Portfolio', creator: 'My indices', assets: 'Assets',
};

let current = parseHash();

function render() {
  const r = current;
  const build = PAGES[r.route];
  view.replaceChildren(build ? build(r) : notFound('That address does not exist in Warp.'));
  document.title = `${TITLES[r.route] || 'Warp'} · Warp`;
  [...nav.querySelectorAll('a')].forEach(a => {
    const active = a.dataset.route === r.route
      || (r.route === 'index' && a.dataset.route === 'market')
      || (r.route === 'asset' && a.dataset.route === 'assets');
    a.classList.toggle('is-active', active);
    a.setAttribute('aria-current', active ? 'page' : 'false');
  });
  paintSide();
}

function navigate() {
  const next = parseHash();
  const same = next.route === current.route && next.id === current.id;
  current = next;
  render();
  if (!same) { window.scrollTo({ top: 0 }); closeResults(); }
}
window.addEventListener('hashchange', navigate);

/* ---------------- sidebar ---------------- */

const sideEquity = document.getElementById('sideEquity');
const navOpen = document.getElementById('navOpen');

function paintSide() {
  const acc = accountSummary();
  sideEquity.replaceChildren(
    el('dt', { text: `Equity (${VENUE.settle})` }),
    el('dd', { text: usdg(acc.equity).replace(' ' + VENUE.settle, '') }),
    el('div', { class: 'wp-equity-row' }, [
      el('span', { text: 'Available' }),
      el('span', { class: 'num', text: usdg(acc.balance).replace(' ' + VENUE.settle, '') }),
    ]),
    el('div', { class: 'wp-equity-row' }, [
      el('span', { text: 'Open' }),
      el('span', { class: `num ${dir(acc.unrealised)}`, text: usdg(acc.unrealised, { sign: true }).replace(' ' + VENUE.settle, '') }),
    ]),
  );
  navOpen.hidden = !state.positions.length;
  navOpen.textContent = String(state.positions.length);
}

document.getElementById('resetBtn').addEventListener('click', confirmReset);
document.getElementById('termsBtn').addEventListener('click', openTerms);

/* The X mark has no destination yet. Rather than a link that goes nowhere, it
   says so. */
document.getElementById('xBtn').addEventListener('click', () => {
  toast('The X profile is not linked yet.');
});

/* ---------------- search ---------------- */

let hits = [];
let cursor = -1;

function closeResults() {
  results.hidden = true;
  combobox.setAttribute('aria-expanded', 'false');
  cursor = -1;
}

function openHit(hit) {
  input.value = '';
  closeResults();
  location.hash = hit.kind === 'index' ? `#/i/${hit.index.id}` : `#/a/${hit.asset.id}`;
}

function paintResults() {
  results.replaceChildren();
  if (!hits.length) {
    results.append(el('div', { class: 'wp-res-empty', text: 'Nothing matches. Try the symbol, the name or the metal ("nickel", "XAU").' }));
  } else {
    hits.forEach((hit, i) => {
      const mark = hit.kind === 'index'
        ? markStack(indexLegs(hit.index).map(l => l.asset), 22)
        : markEl(hit.asset, 26);
      results.append(el('button', {
        class: `wp-res ${i === cursor ? 'is-on' : ''}`, type: 'button', role: 'option',
        on: { click: () => openHit(hit) },
      }, [
        mark,
        el('span', {}, [
          el('span', { class: 'wp-res-label', text: hit.label }),
          el('br'),
          el('span', { class: 'wp-res-sub', text: hit.sub }),
        ]),
        el('span', { class: 'wp-res-sym num', text: hit.kind === 'index' ? hit.index.symbol : hit.asset.symbol }),
      ]));
    });
  }
  results.hidden = false;
  combobox.setAttribute('aria-expanded', 'true');
}

input.addEventListener('input', () => {
  const q = input.value.trim();
  if (!q) return closeResults();
  hits = search(q);
  cursor = hits.length ? 0 : -1;
  paintResults();
});
input.addEventListener('focus', () => { if (input.value.trim()) paintResults(); });
input.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { input.value = ''; closeResults(); input.blur(); return; }
  if (!hits.length || results.hidden) return;
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    cursor = (cursor + (ev.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
    paintResults();
  } else if (ev.key === 'Enter' && cursor >= 0) {
    ev.preventDefault();
    openHit(hits[cursor]);
  }
});
document.addEventListener('click', (ev) => { if (!combobox.contains(ev.target)) closeResults(); });
document.addEventListener('keydown', (ev) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if (ev.key === '/' && !typing) { ev.preventDefault(); input.focus(); }
});

/* ---------------- the heartbeat ---------------- */

const clockEl = document.getElementById('clock');
const stamp = document.getElementById('stamp');

/** The screen repaints unless the user is typing in it, and never the
 *  create-index one: a half-finished form is left alone. */
function canRepaint() {
  if (current.route === 'create') return false;
  const a = document.activeElement;
  return !(a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}

/* The clock gets its own beat, because a market clock that advances in
   five-second jumps is not a clock. It only writes into three text nodes, so
   running it every second costs nothing and never touches the layout. */
const clockParts = {
  day: el('span', { class: 'wp-clock-day' }),
  time: el('b'),
  zone: el('span', { class: 'wp-clock-zone' }),
};
clockEl.append(clockParts.day, clockParts.time, clockParts.zone);
function paintClock() {
  const now = Date.now();
  clockParts.day.textContent = marketDay(now);
  clockParts.time.textContent = clock(now);
  clockParts.zone.textContent = `${MARKET_TZ_LABEL} ${marketZone(now)}`;
}

function tick() {
  stamp.textContent = `${feed.label}${feed.isSimulated ? ' · simulated price' : ''} · ${clock()} ${MARKET_TZ_LABEL}`;
  // A position with no margin is liquidated by the rule, not because someone is
  // watching.
  const killed = liquidationSweep();
  if (killed) toast(`${killed} ${killed === 1 ? 'position' : 'positions'} liquidated for want of margin`, 'bad');
  if (canRepaint()) render(); else paintSide();
}

onChange(() => { if (canRepaint()) render(); else paintSide(); });

/* Nothing runs before the terms are accepted: no routing, no clock, no
   heartbeat. The gate is not a banner over a working application, it is the
   application not having started. */
function start() {
  navigate();
  paintClock();
  tick();
  setInterval(paintClock, 1000);
  setInterval(tick, 5000);
  // The storage notice arrives a while in, once there is something to talk about.
  scheduleStorageNotice();
}

requireAcceptance(start);
