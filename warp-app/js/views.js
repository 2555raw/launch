/* The screens. Each one is a function that returns a node, so the router knows
   nothing about their insides and one screen cannot write into another. None of
   them works out a market rule on its own: anything that is a rule, they ask
   the engine for. */

import { VENUE } from './config.js';
import { CLASSES, tradableAssets, byClass, getAsset } from './registry.js';
import { state, getIndex, openPositions, myIndices, resetAll } from './store.js';
import {
  indexValue, indexChange, indexLegs, openInterest, simulatedDepth, fundingRate,
  quoteOrder, openPosition, markPosition, closePosition, listIndex, delistIndex,
  validateBasket, claimFees, pendingFees, accountSummary,
} from './engine.js';
import { spot, changePct, series, basketSeries, volume24h } from './market.js';
import { sparkline } from './chart.js';
import { usdg, pct, num, auto, compact, dir, lev, ago, dateTime, NA_TEXT } from './format.js';
import { markEl, markProvenance } from './logos.js';
import {
  el, frag, card, stat, kv, table, note, emptyState, indexIdent, assetIdent,
  symPill, changePill, weightsBar, donut, chartBlock, spark, toast,
} from './ui/components.js';

const DAY = 86400e3, HOUR = 3600e3;
export const go = (hash) => { location.hash = hash; };

/** An index's colour is the brand colour of its heaviest leg: a basket is
 *  recognised by what weighs most inside it. */
export function indexColor(legs) {
  const top = [...legs].sort((a, b) => b.weight - a.weight)[0];
  return top?.asset?.color || '#1F58F5';
}
const indexSeries = (ix, hours) => basketSeries(ix.legs, ix.refs, Date.now() - hours * HOUR, Date.now(), 170, VENUE.indexBase);

function head(title, text, actions) {
  return el('div', { class: 'wp-head' }, [
    el('div', {}, [el('h1', { text: title }), text ? el('p', { text }) : null]),
    actions ? el('div', { class: 'wp-head-actions' }, actions) : null,
  ]);
}
const primaryBtn = (label, onClick, cls = '') =>
  el('button', { class: `wp-btn ${cls}`, type: 'button', text: label, on: { click: onClick } });

/* ============================ dashboard ============================ */

export function panelView() {
  const t = Date.now();
  const acc = accountSummary(t);
  const rows = state.indices.map(ix => ({ ix, legs: indexLegs(ix), ch: indexChange(ix, 24, t) }));
  const movers = [...rows].sort((a, b) => Math.abs(b.ch ?? 0) - Math.abs(a.ch ?? 0)).slice(0, 6);
  const assetMovers = tradableAssets()
    .map(a => ({ a, ch: changePct(a.id, 24, t) }))
    .sort((x, y) => Math.abs(y.ch) - Math.abs(x.ch)).slice(0, 8);

  return frag([
    head('Dashboard', 'Bundle three to five assets into a fixed-weight basket, list it as an index, and take a long or short side on it.', [
      primaryBtn('Create index', () => go('#/create')),
    ]),


    el('div', { class: 'wp-grid cols-4' }, [
      stat('Equity', usdg(acc.equity), { sub: 'Balance, margin and open result' }),
      stat('Available', usdg(acc.balance), { sub: `${acc.open} open ${acc.open === 1 ? 'position' : 'positions'}` }),
      stat('Open result', usdg(acc.unrealised, { sign: true }), { cls: dir(acc.unrealised), sub: `Realised ${usdg(acc.realised, { sign: true })}` }),
      stat('Fees to claim', usdg(acc.claimable), { sub: `${Math.round(VENUE.creatorShare * 100)}% of what every trade pays` }),
    ]),

    card({
      title: 'Biggest movers', note: "The basket's 24 h change",
      tight: true,
      body: table(['Index', 'Value', '24 h', 'Composition', 'Shape'], movers.map(({ ix, legs, ch }) => {
        const v = indexValue(ix, t);
        return el('tr', { class: 'clickable', on: { click: () => go(`#/i/${ix.id}`) } }, [
          el('td', { class: 'wide' }, [indexIdent(ix, legs)]),
          el('td', { class: 'num', text: v === null ? NA_TEXT : auto(v) }),
          el('td', {}, [changePill(ch)]),
          el('td', { style: { minWidth: '140px' } }, [weightsBar(legs)]),
          el('td', {}, [spark(indexSeries(ix, 24 * 30), indexColor(legs))]),
        ]);
      })),
    }),

    el('div', { class: 'wp-grid cols-2' }, [
      card({
        title: 'Your positions', note: acc.open ? `${acc.open} open` : null, tight: true,
        body: acc.open
          ? positionsTable(t, { compact: true })
          : emptyState({
              title: 'No positions yet',
              text: 'Pick an index from the market and take a long or short side with up to ' + VENUE.maxLeverage + 'x.',
              action: primaryBtn('See the market', () => go('#/market'), 'ghost'),
            }),
      }),
      card({
        title: 'Legs setting the pace', note: 'Single assets, 24 h', tight: true,
        body: table(['Asset', 'Sim. price', '24 h'], assetMovers.map(({ a, ch }) =>
          el('tr', { class: 'clickable', on: { click: () => go(`#/a/${a.id}`) } }, [
            el('td', { class: 'wide' }, [assetIdent(a, { size: 30 })]),
            el('td', { class: 'num', text: auto(spot(a.id, t)) }),
            el('td', {}, [changePill(ch)]),
          ]))),
      }),
    ]),
  ]);
}

/* ============================ market ============================ */

let marketFilter = 'all';
let marketSort = 'depth';

export function marketView() {
  const t = Date.now();
  const wrap = el('div', { class: 'wp-grid' });

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'metals', label: 'With metals' },
    { id: 'stocks', label: 'Stocks only' },
    { id: 'mine', label: 'Listed by me' },
  ];
  const sorts = [
    { id: 'depth', label: 'Depth' },
    { id: 'change', label: 'Change' },
    { id: 'recent', label: 'Recent' },
  ];

  const seg = (opts, current, onPick) => el('div', { class: 'wp-seg' }, opts.map(o =>
    el('button', {
      type: 'button', text: o.label, class: o.id === current ? 'is-on' : '',
      on: { click: () => { onPick(o.id); render(); } },
    })));

  const body = el('div');
  function render() {
    let rows = state.indices.map(ix => {
      const legs = indexLegs(ix);
      return {
        ix, legs,
        value: indexValue(ix, t),
        ch24: indexChange(ix, 24, t),
        ch7: indexChange(ix, 24 * 7, t),
        depth: simulatedDepth(ix, t),
        oi: openInterest(ix.id),
        funding: fundingRate(ix.id),
      };
    });
    if (marketFilter === 'metals') rows = rows.filter(r => r.legs.some(l => l.asset.class === 'metal'));
    if (marketFilter === 'stocks') rows = rows.filter(r => r.legs.every(l => l.asset.class === 'stock'));
    if (marketFilter === 'mine') rows = rows.filter(r => r.ix.creator === 'me');

    if (marketSort === 'depth') rows.sort((a, b) => b.depth - a.depth);
    if (marketSort === 'change') rows.sort((a, b) => Math.abs(b.ch24 ?? 0) - Math.abs(a.ch24 ?? 0));
    if (marketSort === 'recent') rows.sort((a, b) => b.ix.listedAt - a.ix.listedAt);

    body.replaceChildren(card({
      title: `${rows.length} indices listed`,
      note: 'Depth is a simulator figure. Open interest and funding come from the positions that actually exist.',
      tight: true,
      body: rows.length ? table(
        ['Index', 'Value', '24 h', '7 d', 'Composition', 'Sim. depth', 'Open interest', 'Funding 8 h', 'Shape'],
        rows.map(r => el('tr', { class: 'clickable', on: { click: () => go(`#/i/${r.ix.id}`) } }, [
          el('td', { class: 'wide' }, [indexIdent(r.ix, r.legs)]),
          el('td', { class: 'num', text: r.value === null ? NA_TEXT : auto(r.value) }),
          el('td', {}, [changePill(r.ch24)]),
          el('td', {}, [changePill(r.ch7)]),
          el('td', { style: { minWidth: '130px' } }, [weightsBar(r.legs)]),
          el('td', { class: 'num dim', text: compact(r.depth) }),
          el('td', { class: 'num', text: r.oi.total ? usdg(r.oi.total) : '—' }),
          el('td', { class: `num ${r.funding > 0 ? 'down' : r.funding < 0 ? 'up' : 'flat'}`, text: pct(r.funding * 100, { d: 4 }) }),
          el('td', {}, [spark(indexSeries(r.ix, 24 * 30), indexColor(r.legs))]),
        ]))
      ) : emptyState({ title: 'No index matches that filter', text: 'Try another one, or list a basket of your own.', action: primaryBtn('Create index', () => go('#/create'), 'ghost') }),
    }));
  }

  wrap.append(
    head('Market', "Every row is a fixed-weight basket with a perpetual of its own. The composition reads off the colour bar: each band is a leg, in the asset's brand colour.", [
      primaryBtn('Create index', () => go('#/create')),
    ]),
    el('div', { class: 'wp-tabs' }, [
      seg(filters, marketFilter, v => { marketFilter = v; }),
      seg(sorts, marketSort, v => { marketSort = v; }),
    ]),
    body,
  );
  render();
  return wrap;
}

/* ============================ assets ============================ */

let assetTab = 'stock';

export function assetsView() {
  const t = Date.now();
  const wrap = el('div', { class: 'wp-grid' });
  const body = el('div');
  const tabs = ['stock', 'metal', 'crypto', 'etf'];

  const tabBar = el('div', { class: 'wp-seg' }, tabs.map(id =>
    el('button', {
      type: 'button', text: CLASSES[id].plural, data: { cls: id }, class: id === assetTab ? 'is-on' : '',
      on: { click: () => { assetTab = id; [...tabBar.children].forEach(b => b.classList.toggle('is-on', b.dataset.cls === id)); render(); } },
    })));

  function render() {
    const list = byClass(assetTab);
    const isMetal = assetTab === 'metal';
    body.replaceChildren(card({
      title: `${list.length} ${CLASSES[assetTab].plural.toLowerCase()}`,
      note: isMetal
        ? "A metal has no logo because it is not a company: its mark is its official chemical symbol in the real colour of the metal, and the last column says where it is priced."
        : "Each asset's mark is its official logo, resolved at runtime from its own domain.",
      tight: true,
      body: table(
        ['Asset', 'Symbol', 'Sim. price', '24 h', '7 d', 'Shape', isMetal ? 'Market and unit' : 'Market'],
        list.map(a => el('tr', { class: 'clickable', on: { click: () => go(`#/a/${a.id}`) } }, [
          el('td', { class: 'wide' }, [assetIdent(a, { size: 34, sub: a.sector })]),
          el('td', {}, [symPill(a)]),
          el('td', { class: 'num', text: auto(spot(a.id, t)) }),
          el('td', {}, [changePill(changePct(a.id, 24, t))]),
          el('td', {}, [changePill(changePct(a.id, 24 * 7, t))]),
          el('td', {}, [spark(series(a.id, t - 30 * DAY, t, 40), a.color)]),
          el('td', { class: 'dim', text: isMetal ? `${a.venue} · ${a.unit}` : a.venue }),
        ]))
      ),
    }));
  }

  wrap.append(
    head('Assets', 'The universe a basket is built from. Every asset carries its symbol and its real mark, and that same pair is used on every screen.', null),
    tabBar, body,
  );
  render();
  return wrap;
}

/* ============================ asset page ============================ */

export function assetView(id) {
  const a = getAsset(id);
  if (!a) return notFound('That asset is not in the registry.');
  const t = Date.now();
  const inIndices = state.indices
    .map(ix => ({ ix, legs: indexLegs(ix), leg: ix.legs.find(l => l.id === a.id) }))
    .filter(r => r.leg);
  const chart = chartBlock({
    load: (hours) => series(a.id, t - hours * HOUR, t, 170),
    color: a.color, initial: '1M',
  });

  return frag([
    el('div', { class: 'wp-head' }, [
      el('div', { class: 'wp-ident' }, [
        markEl(a, 52),
        el('div', {}, [
          el('h1', { text: a.name, style: { fontSize: '20px' } }),
          el('div', { class: 'wp-ident-sub', style: { marginTop: '5px' } }, [
            symPill(a),
            el('span', { text: `${CLASSES[a.class]?.label} · ${a.sector} · ${a.venue}` }),
          ]),
        ]),
      ]),
      el('div', { class: 'wp-head-actions' }, [
        el('span', { class: 'num', style: { fontSize: '22px', fontWeight: '600' }, text: auto(spot(a.id, t)) }),
        changePill(changePct(a.id, 24, t)),
      ]),
    ]),

    card({
      title: 'Simulated price', note: 'A series computed by the simulator, not a quote',
      actions: chart.ranges, body: chart.wrap,
    }),

    el('div', { class: 'wp-grid cols-2' }, [
      card({
        title: 'Identity', body: kv([
          { k: 'Legal name', v: a.name },
          { k: 'Symbol', v: a.symbol },
          a.element ? { k: 'Chemical symbol', v: a.element } : null,
          { k: 'Class', v: CLASSES[a.class]?.label || '—' },
          { k: 'Sector', v: a.sector },
          { k: 'Market', v: a.venue },
          a.unit ? { k: 'Unit', v: a.unit } : null,
          { k: a.class === 'metal' ? "Market's domain" : 'Official domain', v: a.venueDomain || a.domain || '—' },
          { k: 'Brand colour', v: a.color.toUpperCase() },
        ]),
        extra: note(`<strong>Its mark.</strong> ${markProvenance(a).text}.`),
      }),
      card({
        title: 'Simulated change', body: kv([
          { k: '24 hours', v: pct(changePct(a.id, 24, t)), cls: dir(changePct(a.id, 24, t)) },
          { k: '7 days', v: pct(changePct(a.id, 24 * 7, t)), cls: dir(changePct(a.id, 24 * 7, t)) },
          { k: '30 days', v: pct(changePct(a.id, 24 * 30, t)), cls: dir(changePct(a.id, 24 * 30, t)) },
          { k: 'Sim. 24 h volume', v: compact(volume24h(a.id, t)), line: true },
        ]),
      }),
    ]),

    card({
      title: 'Indices that hold it', tight: true,
      body: inIndices.length ? table(['Index', 'Weight', 'Value', '24 h'], inIndices.map(r =>
        el('tr', { class: 'clickable', on: { click: () => go(`#/i/${r.ix.id}`) } }, [
          el('td', { class: 'wide' }, [indexIdent(r.ix, r.legs)]),
          el('td', { class: 'num', text: num(r.leg.weight, 1) + '%' }),
          el('td', { class: 'num', text: auto(indexValue(r.ix, t)) }),
          el('td', {}, [changePill(indexChange(r.ix, 24, t))]),
        ]))) : emptyState({
          title: 'No listed index holds it',
          text: `You can be the first to put ${a.short} in a basket.`,
          action: primaryBtn('Create an index with ' + a.short, () => go(`#/create?seed=${a.id}`), 'ghost'),
        }),
    }),
  ]);
}

export function notFound(text) {
  return frag([
    head('Not found', null, null),
    card({ body: emptyState({ title: 'There is nothing here', text, action: primaryBtn('Back to the dashboard', () => go('#/'), 'ghost') }) }),
  ]);
}

/* ---- positions table, shared by the dashboard, the portfolio and the index ---- */

export function positionsTable(t = Date.now(), { indexId = null, compact: small = false } = {}) {
  const rows = openPositions(indexId);
  if (!rows.length) return null;
  const cols = small
    ? ['Index', 'Side', 'Result', '']
    : ['Index', 'Side', 'Margin', 'Notional', 'Entry', 'Mark', 'Liquidation', 'Funding', 'Result', ''];

  return table(cols, rows.map(p => {
    const m = markPosition(p, t);
    const ix = getIndex(p.indexId);
    const legs = indexLegs(ix);
    const side = el('span', { class: `wp-pill ${p.side === 'long' ? 'up' : 'down'}`, text: `${p.side === 'long' ? 'Long' : 'Short'} ${lev(p.leverage)}` });
    const result = el('td', {}, [
      el('div', { class: `num ${dir(m.pnl - m.funding)}`, text: usdg(m.pnl - m.funding, { sign: true }) }),
      el('div', { class: `wp-ident-sub num ${dir(m.roe)}`, text: pct(m.roe) }),
    ]);
    const close = el('td', {}, [
      el('button', {
        class: 'wp-btn sm ghost', type: 'button', text: 'Close',
        on: { click: (ev) => { ev.stopPropagation(); const r = closePosition(p.id); toast(r.ok ? `Position closed: ${usdg(r.closed.pnl, { sign: true })}` : r.error, r.ok ? (r.closed.pnl >= 0 ? 'good' : '') : 'bad'); } },
      }),
    ]);
    const cells = small
      ? [el('td', { class: 'wide' }, [indexIdent(ix, legs)]), el('td', {}, [side]), result, close]
      : [
          el('td', { class: 'wide' }, [indexIdent(ix, legs)]),
          el('td', {}, [side]),
          el('td', { class: 'num', text: usdg(p.margin) }),
          el('td', { class: 'num', text: usdg(p.notional) }),
          el('td', { class: 'num', text: auto(p.entry) }),
          el('td', { class: 'num', text: m.mark === null ? NA_TEXT : auto(m.mark) }),
          el('td', { class: 'num dim', text: auto(m.liq) }),
          el('td', { class: `num ${m.funding > 0 ? 'down' : m.funding < 0 ? 'up' : 'dim'}`, text: usdg(-m.funding, { sign: true }) }),
          result, close,
        ];
    return el('tr', { class: 'clickable', on: { click: () => go(`#/i/${p.indexId}`) } }, cells);
  }));
}

/* ============================ index page ============================ */

export function indexView(id) {
  const ix = getIndex(id);
  if (!ix) return notFound('That index is not listed.');
  const t = Date.now();
  const legs = indexLegs(ix);
  const color = indexColor(legs);
  const value = indexValue(ix, t);
  const oi = openInterest(ix.id);
  const funding = fundingRate(ix.id);
  const ch24 = indexChange(ix, 24, t);

  const chart = chartBlock({
    load: (hours) => indexSeries(ix, hours),
    color, baseline: VENUE.indexBase, initial: '1M',
  });

  const legRows = legs.map(l => {
    const p = spot(l.asset.id, t);
    const ref = ix.refs[l.asset.id];
    const sinceList = ref ? (p / ref - 1) * 100 : null;
    // What the leg contributes to the basket's move since it listed.
    const contrib = sinceList === null ? null : sinceList * (l.weight / 100);
    return el('tr', { class: 'clickable', on: { click: () => go(`#/a/${l.asset.id}`) } }, [
      el('td', { class: 'wide' }, [assetIdent(l.asset, { size: 30 })]),
      el('td', { class: 'num', text: num(l.weight, 1) + '%' }),
      el('td', { class: 'num', text: auto(p) }),
      el('td', { class: 'num dim', text: ref ? auto(ref) : NA_TEXT }),
      el('td', {}, [changePill(changePct(l.asset.id, 24, t))]),
      el('td', { class: `num ${dir(contrib)}`, text: contrib === null ? NA_TEXT : pct(contrib) }),
    ]);
  });

  const left = el('div', { class: 'wp-grid' }, [
    card({
      title: 'Index value',
      note: `Base ${VENUE.indexBase} the day it listed, ${ago(ix.listedAt)}`,
      actions: chart.ranges, body: chart.wrap,
    }),
    card({
      title: 'Composition',
      note: "Fixed weight: it never rebalances, so today's basket is the one that listed",
      body: el('div', { class: 'wp-grid' }, [
        donut(legs, 128),
        note('The <strong>contribution</strong> column is how much of the index\'s change since it listed comes from each leg: its move times its weight.'),
      ]),
    }),
    card({
      title: 'Leg detail', tight: true,
      body: table(['Asset', 'Weight', 'Sim. price', 'At listing', '24 h', 'Contribution'], legRows),
    }),
    card({
      title: 'Your positions in this index', tight: true,
      body: positionsTable(t, { indexId: ix.id })
        || emptyState({ title: 'No position open here', text: 'Use the panel on the right to open one.' }),
    }),
  ]);

  const right = el('div', { class: 'wp-grid' }, [
    tradePanel(ix, value),
    card({
      title: 'Market state',
      body: frag([
        kv([
          { k: 'Value', v: value === null ? NA_TEXT : auto(value) },
          { k: '24 h change', v: pct(ch24), cls: dir(ch24) },
          { k: '7 d change', v: pct(indexChange(ix, 24 * 7, t)), cls: dir(indexChange(ix, 24 * 7, t)) },
          { k: 'Sim. 24 h depth', v: compact(simulatedDepth(ix, t)), line: true },
          { k: 'Open interest', v: oi.total ? usdg(oi.total) : '—' },
          { k: 'Longs', v: oi.long ? usdg(oi.long) : '—', cls: 'up' },
          { k: 'Shorts', v: oi.short ? usdg(oi.short) : '—', cls: 'down' },
          { k: 'Funding 8 h', v: pct(funding * 100, { d: 4 }), cls: funding > 0 ? 'down' : funding < 0 ? 'up' : 'flat' },
        ]),
        el('div', { style: { marginTop: '12px' } }, [
          el('div', { class: 'wp-weights', title: 'Split of open interest between longs and shorts' }, [
            el('span', { style: { width: `${oi.total ? (oi.long / oi.total) * 100 : 50}%`, background: 'var(--up)' } }),
            el('span', { style: { width: `${oi.total ? (oi.short / oi.total) * 100 : 50}%`, background: 'var(--down)' } }),
          ]),
          el('div', { class: 'wp-hint', style: { marginTop: '6px' },
            text: funding > 0 ? 'More longs than shorts: the longs pay.'
                : funding < 0 ? 'More shorts than longs: the shorts pay.'
                : 'No imbalance: funding sits at its base rate.' }),
        ]),
      ]),
    }),
    card({
      title: 'Who listed it',
      body: frag([
        kv([
          { k: 'Symbol', v: ix.symbol },
          { k: 'Creator', v: ix.creator === 'me' ? 'You' : 'Warp demo account' },
          { k: 'Listed', v: dateTime(ix.listedAt) },
          { k: 'Legs', v: String(legs.length) },
          { k: 'Fees generated', v: usdg(ix.feesAccrued), line: true },
        ]),
        ix.note ? el('p', { class: 'wp-hint', style: { marginTop: '10px' }, text: ix.note }) : null,
        ix.creator === 'me'
          ? el('div', { style: { marginTop: '12px', display: 'grid', gap: '8px' } }, [
              el('button', {
                class: 'wp-btn quiet block', type: 'button',
                text: `Claim ${usdg(pendingFees(ix))}`, disabled: pendingFees(ix) <= 0,
                on: { click: () => { const r = claimFees(ix.id); toast(r.ok ? `Claimed ${usdg(r.claimed)}` : r.error, r.ok ? 'good' : 'bad'); } },
              }),
              el('button', {
                class: 'wp-btn danger block sm', type: 'button', text: 'Delist the index',
                on: { click: () => { const r = delistIndex(ix.id); if (r.ok) { toast('Index delisted'); go('#/creator'); } else toast(r.error, 'bad'); } },
              }),
            ])
          : null,
      ]),
    }),
  ]);

  return frag([
    el('div', { class: 'wp-head' }, [
      el('div', {}, [
        indexIdent(ix, legs, { size: 34 }),
        ix.note ? el('p', { text: ix.note }) : null,
      ]),
      el('div', { class: 'wp-head-actions' }, [
        el('span', { class: 'num', style: { fontSize: '24px', fontWeight: '650' }, text: value === null ? NA_TEXT : auto(value) }),
        changePill(ch24),
      ]),
    ]),
    el('div', { class: 'wp-split' }, [left, right]),
  ]);
}

/* What the user has typed into the trading panel, per index. It lives outside
   the screen so the periodic price refresh does not wipe their side or a margin
   they are half way through typing. */
const tickets = new Map();
function ticket(indexId) {
  if (!tickets.has(indexId)) {
    tickets.set(indexId, {
      side: 'long',
      margin: Math.min(100, Math.max(VENUE.minMargin, Math.floor(state.wallet.balance * 0.1))),
      leverage: 2,
    });
  }
  return tickets.get(indexId);
}

/** The trading panel. Every figure it shows comes from quoteOrder(), the same
 *  function that validates the order on the way in: it cannot promise one
 *  liquidation and then apply another. */
function tradePanel(ix, value) {
  const tk = ticket(ix.id);

  const sideSeg = el('div', { class: 'wp-seg side', style: { display: 'flex' } }, ['long', 'short'].map(s =>
    el('button', {
      type: 'button', data: { side: s }, style: { flex: '1' },
      text: s === 'long' ? 'Long' : 'Short',
      class: s === tk.side ? 'is-on' : '',
      on: { click: () => { tk.side = s; [...sideSeg.children].forEach(b => b.classList.toggle('is-on', b.dataset.side === s)); refresh(); } },
    })));

  const marginInput = el('input', {
    class: 'wp-input num', type: 'number', min: VENUE.minMargin, step: '1', value: String(tk.margin),
    on: { input: () => { tk.margin = Number(marginInput.value); refresh(); } },
  });
  const levInput = el('input', {
    class: 'wp-range', type: 'range', min: '1', max: String(VENUE.maxLeverage), step: '0.5', value: String(tk.leverage),
    on: { input: () => { tk.leverage = Number(levInput.value); refresh(); } },
  });
  const levLabel = el('span', { class: 'num', text: lev(tk.leverage) });

  const quick = el('div', { style: { display: 'flex', gap: '6px' } }, [0.25, 0.5, 1].map(f =>
    el('button', {
      class: 'wp-btn sm quiet', type: 'button', style: { flex: '1' },
      text: f === 1 ? 'Max' : `${f * 100}%`,
      on: { click: () => { tk.margin = Math.max(VENUE.minMargin, Math.floor(state.wallet.balance * f * 100) / 100); marginInput.value = String(tk.margin); refresh(); } },
    })));

  const summary = el('div');
  const problem = el('div');
  const risk = el('div');
  const submit = el('button', { class: 'wp-btn block', type: 'button' });

  function refresh() {
    levLabel.textContent = lev(tk.leverage);
    const q = quoteOrder({ indexId: ix.id, side: tk.side, margin: tk.margin, leverage: tk.leverage });
    summary.replaceChildren(kv([
      { k: 'Notional', v: usdg(q.notional) },
      { k: 'Entry', v: q.entry === null ? NA_TEXT : auto(q.entry) },
      { k: 'Liquidation', v: q.liq === null ? NA_TEXT : auto(q.liq), cls: 'down' },
      { k: `Fee ${pct(VENUE.takerFee * 100, { sign: false, d: 3 })}`, v: usdg(q.fee) },
      { k: 'Of it, to the creator', v: usdg(q.creatorFee), line: true },
      { k: 'Total to lock up', v: usdg(q.margin + q.fee) },
    ]));
    problem.replaceChildren(q.ok ? '' : el('div', { class: 'wp-error', text: q.error }));
    // The warning speaks about the leverage selected right now, not the
    // maximum: a warning that does not describe your order warns of nothing.
    risk.replaceChildren(note(
      `At ${lev(tk.leverage)}, a <strong>${num(100 / tk.leverage, 1)}%</strong> move against you takes the whole margin. ` +
      `The engine applies the liquidation on its own; you do not need the screen open.`, 'risk'));
    submit.textContent = `${tk.side === 'long' ? 'Open long' : 'Open short'} ${lev(tk.leverage)}`;
    submit.className = `wp-btn block ${tk.side === 'long' ? 'long' : 'short'}`;
    submit.disabled = !q.ok;
  }
  submit.addEventListener('click', () => {
    const r = openPosition({ indexId: ix.id, side: tk.side, margin: tk.margin, leverage: tk.leverage });
    toast(r.ok ? `${tk.side === 'long' ? 'Long' : 'Short'} opened on ${ix.symbol} for ${usdg(r.position.notional)}` : r.error, r.ok ? 'good' : 'bad');
  });
  refresh();

  return card({
    title: 'Trade', note: value === null ? 'No value' : `Mark ${auto(value)}`,
    body: el('div', { class: 'wp-grid', style: { gap: '13px' } }, [
      sideSeg,
      el('div', { class: 'wp-field' }, [
        el('label', { text: `Margin (${usdg(state.wallet.balance)} available)` }),
        el('div', { class: 'wp-input-unit' }, [marginInput, el('span', { class: 'wp-unit', text: VENUE.settle })]),
        quick,
      ]),
      el('div', { class: 'wp-field' }, [
        el('label', {}, [el('span', { text: 'Leverage ' }), levLabel]),
        levInput,
        el('div', { class: 'wp-range-marks' }, ['1x', '2x', '3x', '4x', '5x'].map(x => el('span', { text: x }))),
      ]),
      summary,
      problem,
      submit,
      risk,
    ]),
  });
}

/* ============================ create an index ============================ */

let draft = null;

export function createView(seedId) {
  if (!draft) draft = { symbol: '', name: '', note: '', legs: [] };
  if (seedId && getAsset(seedId) && !draft.legs.some(l => l.id === seedId) && draft.legs.length < VENUE.maxLegs) {
    draft.legs.push({ id: seedId, weight: 0 });
    equalise();
  }

  const wrap = el('div', { class: 'wp-grid' });
  const legsBox = el('div', { class: 'wp-grid', style: { gap: '8px' } });
  const pickerBox = el('div', { class: 'wp-picker' });
  const preview = el('div', { class: 'wp-grid' });
  const totalLine = el('div', { class: 'wp-hint' });
  let pickerTab = 'stock';
  let pickerQuery = '';

  function equalise() {
    const n = draft.legs.length;
    if (!n) return;
    const each = Math.floor((100 / n) * 10) / 10;
    draft.legs.forEach((l, i) => { l.weight = i === n - 1 ? Math.round((100 - each * (n - 1)) * 10) / 10 : each; });
  }
  const total = () => draft.legs.reduce((s, l) => s + (Number(l.weight) || 0), 0);

  function addLeg(id) {
    if (draft.legs.length >= VENUE.maxLegs) return toast(`An index holds at most ${VENUE.maxLegs} assets.`, 'bad');
    if (draft.legs.some(l => l.id === id)) return;
    draft.legs.push({ id, weight: 0 });
    equalise();
    renderAll();
  }
  function removeLeg(id) {
    draft.legs = draft.legs.filter(l => l.id !== id);
    equalise();
    renderAll();
  }

  const symbolInput = el('input', {
    class: 'wp-input num', maxlength: '12', placeholder: 'MYBASKET', value: draft.symbol,
    on: { input: () => { draft.symbol = symbolInput.value = symbolInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); renderPreview(); } },
  });
  const nameInput = el('input', {
    class: 'wp-input', maxlength: '48', placeholder: 'My metals basket', value: draft.name,
    on: { input: () => { draft.name = nameInput.value; renderPreview(); } },
  });
  const noteInput = el('input', {
    class: 'wp-input', maxlength: '120', placeholder: 'What idea this basket expresses (optional)', value: draft.note,
    on: { input: () => { draft.note = noteInput.value; } },
  });

  function renderLegs() {
    legsBox.replaceChildren(...(draft.legs.length ? draft.legs.map(l => {
      const a = getAsset(l.id);
      const w = el('input', {
        class: 'wp-input num wp-leg-w', type: 'number', min: '0.1', max: '100', step: '0.1', value: String(l.weight),
        on: { input: () => { l.weight = Number(w.value); renderPreview(); } },
      });
      return el('div', { class: 'wp-leg' }, [
        markEl(a, 30),
        el('div', { style: { flex: '1', minWidth: '0' } }, [
          el('div', { class: 'wp-ident-name', text: a.short }),
          el('div', { class: 'wp-ident-sub' }, [symPill(a), el('span', { text: CLASSES[a.class]?.label })]),
        ]),
        w,
        el('span', { class: 'dim', text: '%' }),
        el('button', { class: 'wp-leg-x', type: 'button', text: '×', title: `Remove ${a.short}`, on: { click: () => removeLeg(l.id) } }),
      ]);
    }) : [note(`Pick between ${VENUE.minLegs} and ${VENUE.maxLegs} assets from the list below. You can mix stocks, metals, crypto and ETFs in the same basket.`)]));
    const tt = total();
    totalLine.className = `wp-hint ${Math.abs(tt - 100) > 0.01 ? 'wp-error' : ''}`;
    totalLine.textContent = `${draft.legs.length} of ${VENUE.maxLegs} assets · weights add up to ${num(tt, 1)}%` +
      (Math.abs(tt - 100) > 0.01 ? ', and they have to add up to 100%' : '');
  }

  function renderPicker() {
    const q = pickerQuery.trim().toLowerCase();
    const list = byClass(pickerTab).filter(a =>
      !q || a.short.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q) || (a.aliases || []).some(x => x.includes(q)));
    pickerBox.replaceChildren(...(list.length ? list.map(a => {
      const on = draft.legs.some(l => l.id === a.id);
      return el('button', {
        class: `wp-chip ${on ? 'is-on' : ''}`, type: 'button',
        disabled: !on && draft.legs.length >= VENUE.maxLegs,
        on: { click: () => (on ? removeLeg(a.id) : addLeg(a.id)) },
      }, [markEl(a, 20), el('span', { text: a.short }), el('span', { class: 'dim num', style: { fontSize: '11px' }, text: a.symbol })]);
    }) : [el('span', { class: 'wp-hint', text: 'Nothing matches that search in this class.' })]));
  }

  function renderPreview() {
    const check = validateBasket(draft);
    const legs = draft.legs.map(l => ({ ...l, asset: getAsset(l.id) })).filter(l => l.asset);
    const kids = [];

    if (legs.length >= 2 && Math.abs(total() - 100) < 0.01) {
      // Backcast: what this basket, at these weights, would have done had it
      // listed thirty days ago. The simulator says so, not the market.
      const from = Date.now() - 30 * DAY;
      const refs = {};
      legs.forEach(l => { refs[l.id] = spot(l.id, from); });
      const rows = basketSeries(legs, refs, from, Date.now(), 120, VENUE.indexBase);
      const last = rows[rows.length - 1]?.c;
      kids.push(
        donut(legs, 118),
        el('div', {}, [
          el('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px' } }, [
            el('span', { class: 'num', style: { fontSize: '22px', fontWeight: '650' }, text: auto(last) }),
            changePill(last ? last - VENUE.indexBase : 0),
            el('span', { class: 'wp-hint', text: 'over 30 days, from base 100' }),
          ]),
        ]),
        el('div', { class: 'wp-chart sm' }, [
          (() => {
            const c = el('canvas');
            requestAnimationFrame(() => sparkline(c, rows, indexColor(legs)));
            return c;
          })(),
        ]),
        note('This is a <strong>simulator backcast</strong>: what these weights would have done if the basket had existed for the last thirty days. It is not the index\'s history, because the index does not exist yet.'),
      );
    } else {
      kids.push(emptyState({ title: 'No basket to draw yet', text: `Add at least ${VENUE.minLegs} assets and leave the weights adding up to 100%.` }));
    }

    if (!check.ok && draft.legs.length) {
      kids.push(el('ul', { class: 'wp-errors' }, check.errors.map(e => el('li', { text: e }))));
    }

    kids.push(el('button', {
      class: 'wp-btn block', type: 'button', text: 'List the index', disabled: !check.ok,
      on: { click: () => {
        const r = listIndex(draft);
        if (!r.ok) return toast(r.error, 'bad');
        toast(`${r.index.symbol} listed`, 'good');
        draft = null;
        go(`#/i/${r.index.id}`);
      } },
    }));
    kids.push(note(`On listing, the basket freezes each leg's price as a reference and starts at base ${VENUE.indexBase}. From that moment you take <strong>${Math.round(VENUE.creatorShare * 100)}%</strong> of the fees every trade on it pays.`));

    preview.replaceChildren(...kids);
  }

  const renderAll = () => { renderLegs(); renderPicker(); renderPreview(); };

  const tabBar = el('div', { class: 'wp-seg' }, ['stock', 'metal', 'crypto', 'etf'].map(id =>
    el('button', {
      type: 'button', text: CLASSES[id].plural, class: id === pickerTab ? 'is-on' : '',
      on: { click: (ev) => { pickerTab = id; [...tabBar.children].forEach(b => b.classList.remove('is-on')); ev.currentTarget.classList.add('is-on'); renderPicker(); } },
    })));
  const pickerSearch = el('input', {
    class: 'wp-input', placeholder: 'Filter within this class', type: 'search',
    on: { input: () => { pickerQuery = pickerSearch.value; renderPicker(); } },
  });

  wrap.append(
    head('Create index', `A fixed-weight basket of ${VENUE.minLegs} to ${VENUE.maxLegs} assets. You list it, anyone can trade it, and you keep ${Math.round(VENUE.creatorShare * 100)}% of the fees.`, null),
    el('div', { class: 'wp-split' }, [
      el('div', { class: 'wp-grid' }, [
        card({
          title: "The index's identity",
          body: el('div', { class: 'wp-grid cols-2', style: { gap: '13px' } }, [
            el('div', { class: 'wp-field' }, [el('label', { text: 'Symbol' }), symbolInput, el('span', { class: 'wp-hint', text: '3 to 12 letters or digits' })]),
            el('div', { class: 'wp-field' }, [el('label', { text: 'Name' }), nameInput]),
            el('div', { class: 'wp-field', style: { gridColumn: '1 / -1' } }, [el('label', { text: 'Description' }), noteInput]),
          ]),
        }),
        card({
          title: 'The basket',
          actions: el('button', { class: 'wp-btn sm quiet', type: 'button', text: 'Equal weights', on: { click: () => { equalise(); renderAll(); } } }),
          body: el('div', { class: 'wp-grid', style: { gap: '10px' } }, [legsBox, totalLine]),
        }),
        card({
          title: 'Add assets',
          note: 'Stocks, metals, crypto and ETFs in the same basket',
          body: el('div', { class: 'wp-grid', style: { gap: '11px' } }, [tabBar, pickerSearch, pickerBox]),
        }),
      ]),
      card({ title: 'Preview', body: preview }),
    ]),
  );
  renderAll();
  return wrap;
}

/* ============================ portfolio ============================ */

export function portfolioView() {
  const t = Date.now();
  const acc = accountSummary(t);

  const history = state.history.slice(0, 40).map(h => {
    const ix = getIndex(h.indexId);
    const legs = ix ? indexLegs(ix) : [];
    return el('tr', {}, [
      el('td', { class: 'wide' }, [ix ? indexIdent(ix, legs) : el('span', { class: 'dim', text: 'Index delisted' })]),
      el('td', {}, [el('span', { class: `wp-pill ${h.side === 'long' ? 'up' : 'down'}`, text: `${h.side === 'long' ? 'Long' : 'Short'} ${lev(h.leverage)}` })]),
      el('td', { class: 'num', text: auto(h.entry) }),
      el('td', { class: 'num', text: auto(h.exit) }),
      el('td', { class: 'num dim', text: usdg(h.feesTotal) }),
      el('td', { class: 'num dim', text: usdg(-h.fundingTotal, { sign: true }) }),
      el('td', { class: `num ${dir(h.pnl)}`, text: usdg(h.pnl, { sign: true }) }),
      el('td', {}, [el('span', { class: `wp-pill ${h.reason === 'liquidation' ? 'down' : ''}`, text: h.reason === 'liquidation' ? 'Liquidated' : 'Closed' })]),
      el('td', { class: 'dim', text: ago(h.closedAt) }),
    ]);
  });

  return frag([
    head('Portfolio', 'Balance, committed margin and result. The open result is recomputed from price, never stored.', [
      primaryBtn('See the market', () => go('#/market'), 'ghost'),
    ]),
    el('div', { class: 'wp-grid cols-4' }, [
      stat('Equity', usdg(acc.equity), { sub: 'Available + margin + open' }),
      stat('Available', usdg(acc.balance)),
      stat('Committed margin', usdg(acc.marginUsed), { sub: `${acc.open} ${acc.open === 1 ? 'position' : 'positions'}` }),
      stat('Open result', usdg(acc.unrealised, { sign: true }), { cls: dir(acc.unrealised), sub: `Realised ${usdg(acc.realised, { sign: true })}` }),
    ]),
    card({
      title: 'Open positions', tight: true,
      note: 'Funding accrues over time and is already netted off the result',
      body: positionsTable(t) || emptyState({
        title: 'No open positions',
        text: "Open one from any index's page.",
        action: primaryBtn('Go to the market', () => go('#/market'), 'ghost'),
      }),
    }),
    card({
      title: 'History', tight: true, note: history.length ? `${state.history.length} closed ${state.history.length === 1 ? 'trade' : 'trades'}` : null,
      body: history.length
        ? table(['Index', 'Side', 'Entry', 'Exit', 'Fees', 'Funding', 'Result', 'Close', 'When'], history)
        : emptyState({ title: 'History is empty', text: 'The positions you close, or that get liquidated, will show up here.' }),
    }),
  ]);
}

/* ============================ my indices ============================ */

export function creatorView() {
  const t = Date.now();
  const mine = myIndices();
  const totalPending = mine.reduce((s, ix) => s + pendingFees(ix), 0);
  const totalEarned = mine.reduce((s, ix) => s + ix.feesAccrued, 0);

  const rows = mine.map(ix => {
    const legs = indexLegs(ix);
    const oi = openInterest(ix.id);
    const due = pendingFees(ix);
    return el('tr', {}, [
      el('td', { class: 'wide clickable', on: { click: () => go(`#/i/${ix.id}`) } }, [indexIdent(ix, legs)]),
      el('td', { class: 'num', text: auto(indexValue(ix, t)) }),
      el('td', {}, [changePill(indexChange(ix, 24, t))]),
      el('td', { class: 'num', text: oi.total ? usdg(oi.total) : '—' }),
      el('td', { class: 'num', text: usdg(ix.feesAccrued) }),
      el('td', { class: `num ${due > 0 ? 'up' : 'dim'}`, text: usdg(due) }),
      el('td', { class: 'dim', text: ago(ix.listedAt) }),
      el('td', {}, [el('div', { style: { display: 'flex', gap: '6px', justifyContent: 'flex-end' } }, [
        el('button', {
          class: 'wp-btn sm', type: 'button', text: 'Claim', disabled: due <= 0,
          on: { click: () => { const r = claimFees(ix.id); toast(r.ok ? `Claimed ${usdg(r.claimed)}` : r.error, r.ok ? 'good' : 'bad'); } },
        }),
        el('button', {
          class: 'wp-btn sm ghost', type: 'button', text: 'Delist',
          on: { click: () => { const r = delistIndex(ix.id); toast(r.ok ? 'Index delisted' : r.error, r.ok ? '' : 'bad'); } },
        }),
      ])]),
    ]);
  });

  return frag([
    head('My indices', `What you have listed yourself. Of every fee a trade on one of your indices pays, ${Math.round(VENUE.creatorShare * 100)}% accrues here until you claim it.`, [
      primaryBtn('Create index', () => go('#/create')),
    ]),
    el('div', { class: 'wp-grid cols-3' }, [
      stat('Indices listed', String(mine.length)),
      stat('Fees generated', usdg(totalEarned), { sub: `${Math.round(VENUE.creatorShare * 100)}% of every trade` }),
      stat('Pending to claim', usdg(totalPending), { cls: totalPending > 0 ? 'up' : '' }),
    ]),
    card({
      title: 'Your indices', tight: true,
      body: rows.length
        ? table(['Index', 'Value', '24 h', 'Open interest', 'Generated', 'Pending', 'Listed', ''], rows)
        : emptyState({
            title: 'You have not listed an index yet',
            text: `Bundle ${VENUE.minLegs} to ${VENUE.maxLegs} assets, give it a symbol and list it. From that moment you earn a share of everything traded on it.`,
            action: primaryBtn('Create my first index', () => go('#/create')),
          }),
    }),
    card({
      title: 'How a fee is split',
      body: kv([
        { k: 'Fee per trade', v: pct(VENUE.takerFee * 100, { sign: false, d: 3 }) + ' of notional' },
        { k: 'Charged', v: 'On opening and on closing' },
        { k: "To the index's creator", v: pct(VENUE.creatorShare * 100, { sign: false, d: 0 }) },
        { k: 'Kept by the protocol', v: pct((1 - VENUE.creatorShare) * 100, { sign: false, d: 0 }) },
        { k: 'On a liquidation', v: 'No closing fee', line: true },
      ]),
    }),
  ]);
}

/* ============================ account ============================ */

export function confirmReset() {
  const acc = accountSummary();
  const ok = window.confirm(
    `Resetting the account deletes your positions, your history and the indices you have listed, ` +
    `and returns the balance to ${VENUE.openingBalance} ${VENUE.settle}.\n\n` +
    `Right now you have ${acc.open} open positions and ${usdg(acc.equity)} of equity.\n\nGo ahead?`);
  if (!ok) return;
  resetAll();
  toast('Account reset');
  go('#/');
}
