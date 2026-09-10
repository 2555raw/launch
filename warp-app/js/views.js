/* Las pantallas. Cada una es una funcion que devuelve un nodo, asi que el
   enrutador no sabe nada de su interior y una pantalla no puede escribir en
   otra. Ninguna calcula reglas de mercado por su cuenta: todo lo que es una
   regla se lo pregunta al motor. */

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
import { markEl } from './logos.js';
import {
  el, frag, card, stat, kv, table, note, emptyState, indexIdent, assetIdent,
  symPill, changePill, weightsBar, donut, chartBlock, spark, toast,
} from './ui/components.js';

const DAY = 86400e3, HOUR = 3600e3;
export const go = (hash) => { location.hash = hash; };

/** El color de un indice es el color de marca de su pata de mayor peso: el
 *  cesto se reconoce por lo que mas pesa dentro. */
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

/* ============================ panel ============================ */

export function panelView() {
  const t = Date.now();
  const acc = accountSummary(t);
  const rows = state.indices.map(ix => ({ ix, legs: indexLegs(ix), ch: indexChange(ix, 24, t) }));
  const movers = [...rows].sort((a, b) => Math.abs(b.ch ?? 0) - Math.abs(a.ch ?? 0)).slice(0, 6);
  const assetMovers = tradableAssets()
    .map(a => ({ a, ch: changePct(a.id, 24, t) }))
    .sort((x, y) => Math.abs(y.ch) - Math.abs(x.ch)).slice(0, 8);

  return frag([
    head('Panel', 'Agrupa de tres a cinco activos en un cesto de peso fijo, listalo como indice y ponte largo o corto sobre el.', [
      primaryBtn('Crear indice', () => go('#/crear')),
    ]),

    note('<strong>Esto es un mercado de practica.</strong> El precio de cada activo lo produce un simulador reproducible, no un proveedor de mercado, y ningun numero de esta aplicacion describe el mercado real. Lo que si es real dentro de la aplicacion es tu actividad: las posiciones, las comisiones y los indices que listas.', 'warn'),

    el('div', { class: 'wp-grid cols-4' }, [
      stat('Patrimonio', usdg(acc.equity), { sub: 'Saldo, margen y resultado abierto' }),
      stat('Disponible', usdg(acc.balance), { sub: `${acc.open} posiciones abiertas` }),
      stat('Resultado abierto', usdg(acc.unrealised, { sign: true }), { cls: dir(acc.unrealised), sub: `Realizado ${usdg(acc.realised, { sign: true })}` }),
      stat('Comisiones por cobrar', usdg(acc.claimable), { sub: `${Math.round(VENUE.creatorShare * 100)} % de lo que paga cada operacion` }),
    ]),

    card({
      title: 'Lo que mas se mueve', note: 'Variacion de 24 h del cesto',
      tight: true,
      body: table(['Indice', 'Valor', '24 h', 'Composicion', 'Forma'], movers.map(({ ix, legs, ch }) => {
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
        title: 'Tus posiciones', note: acc.open ? `${acc.open} abiertas` : null, tight: true,
        body: acc.open
          ? positionsTable(t, { compact: true })
          : emptyState({
              title: 'Todavia no tienes posiciones',
              text: 'Elige un indice del mercado y ponte largo o corto con hasta ' + VENUE.maxLeverage + 'x.',
              action: primaryBtn('Ver el mercado', () => go('#/mercado'), 'ghost'),
            }),
      }),
      card({
        title: 'Patas que mandan hoy', note: 'Activos sueltos, 24 h', tight: true,
        body: table(['Activo', 'Precio sim.', '24 h'], assetMovers.map(({ a, ch }) =>
          el('tr', { class: 'clickable', on: { click: () => go(`#/a/${a.id}`) } }, [
            el('td', { class: 'wide' }, [assetIdent(a, { size: 30 })]),
            el('td', { class: 'num', text: auto(spot(a.id, t)) }),
            el('td', {}, [changePill(ch)]),
          ]))),
      }),
    ]),
  ]);
}

/* ============================ mercado ============================ */

let marketFilter = 'todos';
let marketSort = 'volumen';

export function marketView() {
  const t = Date.now();
  const wrap = el('div', { class: 'wp-grid' });

  const filters = [
    { id: 'todos', label: 'Todos' },
    { id: 'metales', label: 'Con metales' },
    { id: 'acciones', label: 'Solo acciones' },
    { id: 'mios', label: 'Listados por mi' },
  ];
  const sorts = [
    { id: 'volumen', label: 'Profundidad' },
    { id: 'variacion', label: 'Variacion' },
    { id: 'nuevos', label: 'Recientes' },
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
    if (marketFilter === 'metales') rows = rows.filter(r => r.legs.some(l => l.asset.class === 'metal'));
    if (marketFilter === 'acciones') rows = rows.filter(r => r.legs.every(l => l.asset.class === 'stock'));
    if (marketFilter === 'mios') rows = rows.filter(r => r.ix.creator === 'yo');

    if (marketSort === 'volumen') rows.sort((a, b) => b.depth - a.depth);
    if (marketSort === 'variacion') rows.sort((a, b) => Math.abs(b.ch24 ?? 0) - Math.abs(a.ch24 ?? 0));
    if (marketSort === 'nuevos') rows.sort((a, b) => b.ix.listedAt - a.ix.listedAt);

    body.replaceChildren(card({
      title: `${rows.length} indices listados`,
      note: 'La profundidad es una cifra del simulador. El interes abierto y la financiacion salen de las posiciones que hay de verdad.',
      tight: true,
      body: rows.length ? table(
        ['Indice', 'Valor', '24 h', '7 d', 'Composicion', 'Profundidad sim.', 'Interes abierto', 'Financiacion 8 h', 'Forma'],
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
      ) : emptyState({ title: 'Ningun indice cumple ese filtro', text: 'Prueba con otro, o lista tu propio cesto.', action: primaryBtn('Crear indice', () => go('#/crear'), 'ghost') }),
    }));
  }

  wrap.append(
    head('Mercado', 'Cada fila es un cesto de peso fijo con su propio perpetuo. La composicion se lee en la barra de colores: cada tramo es una pata, con el color de marca del activo.', [
      primaryBtn('Crear indice', () => go('#/crear')),
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

/* ============================ activos ============================ */

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
        ? 'Un metal no tiene logo porque no es una empresa: su marca es su simbolo quimico oficial en el color real del metal, y la ultima columna dice donde cotiza.'
        : 'La marca de cada activo es su logo oficial, resuelto en tiempo de ejecucion de su propio dominio.',
      tight: true,
      body: table(
        ['Activo', 'Simbolo', 'Precio sim.', '24 h', '7 d', 'Forma', isMetal ? 'Mercado y unidad' : 'Mercado'],
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
    head('Activos', 'El universo del que se construye un cesto. Cada activo lleva su simbolo y su marca real, y ese mismo par se usa en todas las pantallas.', null),
    tabBar, body,
  );
  render();
  return wrap;
}

/* ============================ ficha de un activo ============================ */

export function assetView(id) {
  const a = getAsset(id);
  if (!a) return notFound('Ese activo no esta en el registro.');
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
      title: 'Precio simulado', note: 'Serie calculada por el simulador, no una cotizacion',
      actions: chart.ranges, body: chart.wrap,
    }),

    el('div', { class: 'wp-grid cols-2' }, [
      card({
        title: 'Identidad', body: kv([
          { k: 'Nombre legal', v: a.name },
          { k: 'Simbolo', v: a.symbol },
          a.element ? { k: 'Simbolo quimico', v: a.element } : null,
          { k: 'Clase', v: CLASSES[a.class]?.label || '—' },
          { k: 'Sector', v: a.sector },
          { k: 'Mercado', v: a.venue },
          a.unit ? { k: 'Unidad', v: a.unit } : null,
          { k: a.class === 'metal' ? 'Dominio del mercado' : 'Dominio oficial', v: a.venueDomain || a.domain || '—' },
          { k: 'Color de marca', v: a.color.toUpperCase() },
        ]),
      }),
      card({
        title: 'Variacion simulada', body: kv([
          { k: '24 horas', v: pct(changePct(a.id, 24, t)), cls: dir(changePct(a.id, 24, t)) },
          { k: '7 dias', v: pct(changePct(a.id, 24 * 7, t)), cls: dir(changePct(a.id, 24 * 7, t)) },
          { k: '30 dias', v: pct(changePct(a.id, 24 * 30, t)), cls: dir(changePct(a.id, 24 * 30, t)) },
          { k: 'Volumen 24 h sim.', v: compact(volume24h(a.id, t)), line: true },
        ]),
      }),
    ]),

    card({
      title: 'Indices que lo llevan', tight: true,
      body: inIndices.length ? table(['Indice', 'Peso', 'Valor', '24 h'], inIndices.map(r =>
        el('tr', { class: 'clickable', on: { click: () => go(`#/i/${r.ix.id}`) } }, [
          el('td', { class: 'wide' }, [indexIdent(r.ix, r.legs)]),
          el('td', { class: 'num', text: num(r.leg.weight, 1) + ' %' }),
          el('td', { class: 'num', text: auto(indexValue(r.ix, t)) }),
          el('td', {}, [changePill(indexChange(r.ix, 24, t))]),
        ]))) : emptyState({
          title: 'Ningun indice listado lo lleva',
          text: `Puedes ser el primero en meter ${a.short} en un cesto.`,
          action: primaryBtn('Crear indice con ' + a.short, () => go(`#/crear?seed=${a.id}`), 'ghost'),
        }),
    }),
  ]);
}

export function notFound(text) {
  return frag([
    head('No encontrado', null, null),
    card({ body: emptyState({ title: 'Aqui no hay nada', text, action: primaryBtn('Volver al panel', () => go('#/'), 'ghost') }) }),
  ]);
}

/* ---- tabla de posiciones, compartida por el panel, la cartera y la ficha ---- */

export function positionsTable(t = Date.now(), { indexId = null, compact: small = false } = {}) {
  const rows = openPositions(indexId);
  if (!rows.length) return null;
  const cols = small
    ? ['Indice', 'Lado', 'Resultado', '']
    : ['Indice', 'Lado', 'Margen', 'Nocional', 'Entrada', 'Marca', 'Liquidacion', 'Financiacion', 'Resultado', ''];

  return table(cols, rows.map(p => {
    const m = markPosition(p, t);
    const ix = getIndex(p.indexId);
    const legs = indexLegs(ix);
    const side = el('span', { class: `wp-pill ${p.side === 'long' ? 'up' : 'down'}`, text: `${p.side === 'long' ? 'Largo' : 'Corto'} ${lev(p.leverage)}` });
    const result = el('td', {}, [
      el('div', { class: `num ${dir(m.pnl - m.funding)}`, text: usdg(m.pnl - m.funding, { sign: true }) }),
      el('div', { class: `wp-ident-sub num ${dir(m.roe)}`, text: pct(m.roe) }),
    ]);
    const close = el('td', {}, [
      el('button', {
        class: 'wp-btn sm ghost', type: 'button', text: 'Cerrar',
        on: { click: (ev) => { ev.stopPropagation(); const r = closePosition(p.id); toast(r.ok ? `Posicion cerrada: ${usdg(r.closed.pnl, { sign: true })}` : r.error, r.ok ? (r.closed.pnl >= 0 ? 'good' : '') : 'bad'); } },
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

/* ============================ ficha de un indice ============================ */

export function indexView(id) {
  const ix = getIndex(id);
  if (!ix) return notFound('Ese indice no esta listado.');
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
    // Lo que aporta la pata al movimiento del cesto desde que se listo.
    const contrib = sinceList === null ? null : sinceList * (l.weight / 100);
    return el('tr', { class: 'clickable', on: { click: () => go(`#/a/${l.asset.id}`) } }, [
      el('td', { class: 'wide' }, [assetIdent(l.asset, { size: 30 })]),
      el('td', { class: 'num', text: num(l.weight, 1) + ' %' }),
      el('td', { class: 'num', text: auto(p) }),
      el('td', { class: 'num dim', text: ref ? auto(ref) : NA_TEXT }),
      el('td', {}, [changePill(changePct(l.asset.id, 24, t))]),
      el('td', { class: `num ${dir(contrib)}`, text: contrib === null ? NA_TEXT : pct(contrib) }),
    ]);
  });

  const left = el('div', { class: 'wp-grid' }, [
    card({
      title: 'Valor del indice',
      note: `Base ${VENUE.indexBase} el dia que se listo, ${ago(ix.listedAt)}`,
      actions: chart.ranges, body: chart.wrap,
    }),
    card({
      title: 'Composicion',
      note: 'Peso fijo: no se rebalancea, asi que el cesto de hoy es el que se listo',
      body: el('div', { class: 'wp-grid' }, [
        donut(legs, 128),
        note('La columna <strong>aportacion</strong> es cuanto de la variacion del indice desde que se listo viene de cada pata: su movimiento por su peso.'),
      ]),
    }),
    card({
      title: 'Detalle de las patas', tight: true,
      body: table(['Activo', 'Peso', 'Precio sim.', 'Al listar', '24 h', 'Aportacion'], legRows),
    }),
    card({
      title: 'Tus posiciones en este indice', tight: true,
      body: positionsTable(t, { indexId: ix.id })
        || emptyState({ title: 'Ninguna posicion abierta aqui', text: 'Usa el panel de la derecha para abrir una.' }),
    }),
  ]);

  const right = el('div', { class: 'wp-grid' }, [
    tradePanel(ix, value),
    card({
      title: 'Estado del mercado',
      body: frag([
        kv([
          { k: 'Valor', v: value === null ? NA_TEXT : auto(value) },
          { k: 'Variacion 24 h', v: pct(ch24), cls: dir(ch24) },
          { k: 'Variacion 7 d', v: pct(indexChange(ix, 24 * 7, t)), cls: dir(indexChange(ix, 24 * 7, t)) },
          { k: 'Profundidad sim. 24 h', v: compact(simulatedDepth(ix, t)), line: true },
          { k: 'Interes abierto', v: oi.total ? usdg(oi.total) : '—' },
          { k: 'Largos', v: oi.long ? usdg(oi.long) : '—', cls: 'up' },
          { k: 'Cortos', v: oi.short ? usdg(oi.short) : '—', cls: 'down' },
          { k: 'Financiacion 8 h', v: pct(funding * 100, { d: 4 }), cls: funding > 0 ? 'down' : funding < 0 ? 'up' : 'flat' },
        ]),
        el('div', { style: { marginTop: '12px' } }, [
          el('div', { class: 'wp-weights', title: 'Reparto del interes abierto entre largos y cortos' }, [
            el('span', { style: { width: `${oi.total ? (oi.long / oi.total) * 100 : 50}%`, background: 'var(--up)' } }),
            el('span', { style: { width: `${oi.total ? (oi.short / oi.total) * 100 : 50}%`, background: 'var(--down)' } }),
          ]),
          el('div', { class: 'wp-hint', style: { marginTop: '6px' },
            text: funding > 0 ? 'Hay mas largos que cortos: pagan los largos.'
                : funding < 0 ? 'Hay mas cortos que largos: pagan los cortos.'
                : 'Sin desequilibrio: la financiacion esta en su tipo base.' }),
        ]),
      ]),
    }),
    card({
      title: 'Quien lo listo',
      body: frag([
        kv([
          { k: 'Simbolo', v: ix.symbol },
          { k: 'Creador', v: ix.creator === 'yo' ? 'Tu' : 'Cuenta demo de Warp' },
          { k: 'Listado', v: dateTime(ix.listedAt) },
          { k: 'Patas', v: String(legs.length) },
          { k: 'Comisiones generadas', v: usdg(ix.feesAccrued), line: true },
        ]),
        ix.note ? el('p', { class: 'wp-hint', style: { marginTop: '10px' }, text: ix.note }) : null,
        ix.creator === 'yo'
          ? el('div', { style: { marginTop: '12px', display: 'grid', gap: '8px' } }, [
              el('button', {
                class: 'wp-btn quiet block', type: 'button',
                text: `Cobrar ${usdg(pendingFees(ix))}`, disabled: pendingFees(ix) <= 0,
                on: { click: () => { const r = claimFees(ix.id); toast(r.ok ? `Cobradas ${usdg(r.claimed)}` : r.error, r.ok ? 'good' : 'bad'); } },
              }),
              el('button', {
                class: 'wp-btn danger block sm', type: 'button', text: 'Retirar el indice',
                on: { click: () => { const r = delistIndex(ix.id); if (r.ok) { toast('Indice retirado'); go('#/creador'); } else toast(r.error, 'bad'); } },
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

/* Lo que el usuario ha escrito en el panel de trading, por indice. Vive fuera
   de la pantalla para que el refresco periodico del precio no le borre el lado
   ni el margen a medio escribir. */
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

/** El panel de trading. Toda cifra que muestra sale de quoteOrder(), que es la
 *  misma funcion que valida la orden al abrirla: no puede prometer una
 *  liquidacion y luego aplicar otra. */
function tradePanel(ix, value) {
  const tk = ticket(ix.id);

  const sideSeg = el('div', { class: 'wp-seg side', style: { display: 'flex' } }, ['long', 'short'].map(s =>
    el('button', {
      type: 'button', data: { side: s }, style: { flex: '1' },
      text: s === 'long' ? 'Largo' : 'Corto',
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
      text: f === 1 ? 'Maximo' : `${f * 100} %`,
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
      { k: 'Nocional', v: usdg(q.notional) },
      { k: 'Entrada', v: q.entry === null ? NA_TEXT : auto(q.entry) },
      { k: 'Liquidacion', v: q.liq === null ? NA_TEXT : auto(q.liq), cls: 'down' },
      { k: `Comision ${pct(VENUE.takerFee * 100, { sign: false, d: 3 })}`, v: usdg(q.fee) },
      { k: 'De ella al creador', v: usdg(q.creatorFee), line: true },
      { k: 'Total a bloquear', v: usdg(q.margin + q.fee) },
    ]));
    problem.replaceChildren(q.ok ? '' : el('div', { class: 'wp-error', text: q.error }));
    // El aviso habla del apalancamiento que hay elegido ahora, no del maximo:
    // un aviso que no describe tu orden no avisa de nada.
    risk.replaceChildren(note(
      `A ${lev(tk.leverage)}, un movimiento del <strong>${num(100 / tk.leverage, 1)} %</strong> en contra se lleva el margen entero. ` +
      `La liquidacion la aplica el motor solo, no hace falta tener la pantalla abierta.`, 'risk'));
    submit.textContent = `${tk.side === 'long' ? 'Abrir largo' : 'Abrir corto'} ${lev(tk.leverage)}`;
    submit.className = `wp-btn block ${tk.side === 'long' ? 'long' : 'short'}`;
    submit.disabled = !q.ok;
  }
  submit.addEventListener('click', () => {
    const r = openPosition({ indexId: ix.id, side: tk.side, margin: tk.margin, leverage: tk.leverage });
    toast(r.ok ? `${tk.side === 'long' ? 'Largo' : 'Corto'} abierto en ${ix.symbol} por ${usdg(r.position.notional)}` : r.error, r.ok ? 'good' : 'bad');
  });
  refresh();

  return card({
    title: 'Operar', note: value === null ? 'Sin valor' : `Marca ${auto(value)}`,
    body: el('div', { class: 'wp-grid', style: { gap: '13px' } }, [
      sideSeg,
      el('div', { class: 'wp-field' }, [
        el('label', { text: `Margen (disponible ${usdg(state.wallet.balance)})` }),
        el('div', { class: 'wp-input-unit' }, [marginInput, el('span', { class: 'wp-unit', text: VENUE.settle })]),
        quick,
      ]),
      el('div', { class: 'wp-field' }, [
        el('label', {}, [el('span', { text: 'Apalancamiento ' }), levLabel]),
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

/* ============================ crear un indice ============================ */

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
    if (draft.legs.length >= VENUE.maxLegs) return toast(`Un indice lleva como maximo ${VENUE.maxLegs} activos.`, 'bad');
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
    class: 'wp-input num', maxlength: '12', placeholder: 'MICESTO', value: draft.symbol,
    on: { input: () => { draft.symbol = symbolInput.value = symbolInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); renderPreview(); } },
  });
  const nameInput = el('input', {
    class: 'wp-input', maxlength: '48', placeholder: 'Mi cesto de metales', value: draft.name,
    on: { input: () => { draft.name = nameInput.value; renderPreview(); } },
  });
  const noteInput = el('input', {
    class: 'wp-input', maxlength: '120', placeholder: 'Que idea expresa este cesto (opcional)', value: draft.note,
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
        el('button', { class: 'wp-leg-x', type: 'button', text: '×', title: `Quitar ${a.short}`, on: { click: () => removeLeg(l.id) } }),
      ]);
    }) : [note(`Elige entre ${VENUE.minLegs} y ${VENUE.maxLegs} activos de la lista de abajo. Puedes mezclar acciones, metales, cripto y ETFs en el mismo cesto.`)]));
    const tt = total();
    totalLine.className = `wp-hint ${Math.abs(tt - 100) > 0.01 ? 'wp-error' : ''}`;
    totalLine.textContent = `${draft.legs.length} de ${VENUE.maxLegs} activos · los pesos suman ${num(tt, 1)} %` +
      (Math.abs(tt - 100) > 0.01 ? ' y tienen que sumar 100 %' : '');
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
    }) : [el('span', { class: 'wp-hint', text: 'Nada coincide con esa busqueda en esta clase.' })]));
  }

  function renderPreview() {
    const check = validateBasket(draft);
    const legs = draft.legs.map(l => ({ ...l, asset: getAsset(l.id) })).filter(l => l.asset);
    const kids = [];

    if (legs.length >= 2 && Math.abs(total() - 100) < 0.01) {
      // Retroproyeccion: que habria hecho este cesto, con estos pesos, si se
      // hubiera listado hace treinta dias. Lo dice el simulador, no el mercado.
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
            el('span', { class: 'wp-hint', text: 'en 30 dias, desde base 100' }),
          ]),
        ]),
        el('div', { class: 'wp-chart sm' }, [
          (() => {
            const c = el('canvas');
            requestAnimationFrame(() => sparkline(c, rows, indexColor(legs)));
            return c;
          })(),
        ]),
        note('Esto es una <strong>retroproyeccion del simulador</strong>: lo que habrian hecho estos pesos si el cesto existiera desde hace treinta dias. No es un historial del indice, porque el indice todavia no existe.'),
      );
    } else {
      kids.push(emptyState({ title: 'Aun no hay cesto que dibujar', text: `Anade al menos ${VENUE.minLegs} activos y deja los pesos sumando 100 %.` }));
    }

    if (!check.ok && draft.legs.length) {
      kids.push(el('ul', { class: 'wp-errors' }, check.errors.map(e => el('li', { text: e }))));
    }

    kids.push(el('button', {
      class: 'wp-btn block', type: 'button', text: 'Listar el indice', disabled: !check.ok,
      on: { click: () => {
        const r = listIndex(draft);
        if (!r.ok) return toast(r.error, 'bad');
        toast(`${r.index.symbol} listado`, 'good');
        draft = null;
        go(`#/i/${r.index.id}`);
      } },
    }));
    kids.push(note(`Al listarlo, el cesto congela el precio de cada pata como referencia y arranca en base ${VENUE.indexBase}. Desde ese momento te llevas el <strong>${Math.round(VENUE.creatorShare * 100)} %</strong> de las comisiones que pague cada operacion abierta sobre el.`));

    preview.replaceChildren(...kids);
  }

  const renderAll = () => { renderLegs(); renderPicker(); renderPreview(); };

  const tabBar = el('div', { class: 'wp-seg' }, ['stock', 'metal', 'crypto', 'etf'].map(id =>
    el('button', {
      type: 'button', text: CLASSES[id].plural, class: id === pickerTab ? 'is-on' : '',
      on: { click: (ev) => { pickerTab = id; [...tabBar.children].forEach(b => b.classList.remove('is-on')); ev.currentTarget.classList.add('is-on'); renderPicker(); } },
    })));
  const pickerSearch = el('input', {
    class: 'wp-input', placeholder: 'Filtrar dentro de esta clase', type: 'search',
    on: { input: () => { pickerQuery = pickerSearch.value; renderPicker(); } },
  });

  wrap.append(
    head('Crear indice', `Un cesto de peso fijo, de ${VENUE.minLegs} a ${VENUE.maxLegs} activos. Lo listas, cualquiera puede operarlo, y tu te quedas el ${Math.round(VENUE.creatorShare * 100)} % de las comisiones.`, null),
    el('div', { class: 'wp-split' }, [
      el('div', { class: 'wp-grid' }, [
        card({
          title: 'Identidad del indice',
          body: el('div', { class: 'wp-grid cols-2', style: { gap: '13px' } }, [
            el('div', { class: 'wp-field' }, [el('label', { text: 'Simbolo' }), symbolInput, el('span', { class: 'wp-hint', text: 'De 3 a 12 letras o numeros' })]),
            el('div', { class: 'wp-field' }, [el('label', { text: 'Nombre' }), nameInput]),
            el('div', { class: 'wp-field', style: { gridColumn: '1 / -1' } }, [el('label', { text: 'Descripcion' }), noteInput]),
          ]),
        }),
        card({
          title: 'El cesto',
          actions: el('button', { class: 'wp-btn sm quiet', type: 'button', text: 'Reparto igual', on: { click: () => { equalise(); renderAll(); } } }),
          body: el('div', { class: 'wp-grid', style: { gap: '10px' } }, [legsBox, totalLine]),
        }),
        card({
          title: 'Anadir activos',
          note: 'Acciones, metales, cripto y ETFs en el mismo cesto',
          body: el('div', { class: 'wp-grid', style: { gap: '11px' } }, [tabBar, pickerSearch, pickerBox]),
        }),
      ]),
      card({ title: 'Vista previa', body: preview }),
    ]),
  );
  renderAll();
  return wrap;
}

/* ============================ cartera ============================ */

export function portfolioView() {
  const t = Date.now();
  const acc = accountSummary(t);

  const history = state.history.slice(0, 40).map(h => {
    const ix = getIndex(h.indexId);
    const legs = ix ? indexLegs(ix) : [];
    return el('tr', {}, [
      el('td', { class: 'wide' }, [ix ? indexIdent(ix, legs) : el('span', { class: 'dim', text: 'Indice retirado' })]),
      el('td', {}, [el('span', { class: `wp-pill ${h.side === 'long' ? 'up' : 'down'}`, text: `${h.side === 'long' ? 'Largo' : 'Corto'} ${lev(h.leverage)}` })]),
      el('td', { class: 'num', text: auto(h.entry) }),
      el('td', { class: 'num', text: auto(h.exit) }),
      el('td', { class: 'num dim', text: usdg(h.feesTotal) }),
      el('td', { class: 'num dim', text: usdg(-h.fundingTotal, { sign: true }) }),
      el('td', { class: `num ${dir(h.pnl)}`, text: usdg(h.pnl, { sign: true }) }),
      el('td', {}, [el('span', { class: `wp-pill ${h.reason === 'liquidacion' ? 'down' : ''}`, text: h.reason === 'liquidacion' ? 'Liquidada' : 'Cerrada' })]),
      el('td', { class: 'dim', text: ago(h.closedAt) }),
    ]);
  });

  return frag([
    head('Cartera', 'Saldo, margen comprometido y resultado. El resultado abierto se recalcula del precio, no se guarda.', [
      primaryBtn('Ver el mercado', () => go('#/mercado'), 'ghost'),
    ]),
    el('div', { class: 'wp-grid cols-4' }, [
      stat('Patrimonio', usdg(acc.equity), { sub: 'Disponible + margen + abierto' }),
      stat('Disponible', usdg(acc.balance)),
      stat('Margen comprometido', usdg(acc.marginUsed), { sub: `${acc.open} posiciones` }),
      stat('Resultado abierto', usdg(acc.unrealised, { sign: true }), { cls: dir(acc.unrealised), sub: `Realizado ${usdg(acc.realised, { sign: true })}` }),
    ]),
    card({
      title: 'Posiciones abiertas', tight: true,
      note: 'La financiacion se devenga con el tiempo y ya esta descontada del resultado',
      body: positionsTable(t) || emptyState({
        title: 'Sin posiciones abiertas',
        text: 'Abre una desde la ficha de cualquier indice.',
        action: primaryBtn('Ir al mercado', () => go('#/mercado'), 'ghost'),
      }),
    }),
    card({
      title: 'Historial', tight: true, note: history.length ? `${state.history.length} operaciones cerradas` : null,
      body: history.length
        ? table(['Indice', 'Lado', 'Entrada', 'Salida', 'Comisiones', 'Financiacion', 'Resultado', 'Cierre', 'Cuando'], history)
        : emptyState({ title: 'Historial vacio', text: 'Aqui apareceran las posiciones que cierres o que se liquiden.' }),
    }),
  ]);
}

/* ============================ mis indices ============================ */

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
          class: 'wp-btn sm', type: 'button', text: 'Cobrar', disabled: due <= 0,
          on: { click: () => { const r = claimFees(ix.id); toast(r.ok ? `Cobradas ${usdg(r.claimed)}` : r.error, r.ok ? 'good' : 'bad'); } },
        }),
        el('button', {
          class: 'wp-btn sm ghost', type: 'button', text: 'Retirar',
          on: { click: () => { const r = delistIndex(ix.id); toast(r.ok ? 'Indice retirado' : r.error, r.ok ? '' : 'bad'); } },
        }),
      ])]),
    ]);
  });

  return frag([
    head('Mis indices', `Lo que has listado tu. De cada comision que paga una operacion sobre uno de tus indices, el ${Math.round(VENUE.creatorShare * 100)} % se acumula aqui hasta que lo cobras.`, [
      primaryBtn('Crear indice', () => go('#/crear')),
    ]),
    el('div', { class: 'wp-grid cols-3' }, [
      stat('Indices listados', String(mine.length)),
      stat('Comisiones generadas', usdg(totalEarned), { sub: `${Math.round(VENUE.creatorShare * 100)} % de cada operacion` }),
      stat('Pendiente de cobro', usdg(totalPending), { cls: totalPending > 0 ? 'up' : '' }),
    ]),
    card({
      title: 'Tus indices', tight: true,
      body: rows.length
        ? table(['Indice', 'Valor', '24 h', 'Interes abierto', 'Generado', 'Pendiente', 'Listado', ''], rows)
        : emptyState({
            title: 'Todavia no has listado ningun indice',
            text: `Agrupa de ${VENUE.minLegs} a ${VENUE.maxLegs} activos, ponle simbolo y listalo. Desde ese momento cobras parte de lo que se opere sobre el.`,
            action: primaryBtn('Crear mi primer indice', () => go('#/crear')),
          }),
    }),
    card({
      title: 'Como se reparte una comision',
      body: kv([
        { k: 'Comision por operacion', v: pct(VENUE.takerFee * 100, { sign: false, d: 3 }) + ' del nocional' },
        { k: 'Se cobra', v: 'Al abrir y al cerrar' },
        { k: 'Al creador del indice', v: pct(VENUE.creatorShare * 100, { sign: false, d: 0 }) },
        { k: 'Retiene el protocolo', v: pct((1 - VENUE.creatorShare) * 100, { sign: false, d: 0 }) },
        { k: 'En una liquidacion', v: 'No hay comision de cierre', line: true },
      ]),
    }),
  ]);
}

/* ============================ ajustes de la cuenta ============================ */

export function confirmReset() {
  const acc = accountSummary();
  const ok = window.confirm(
    `Reiniciar la cuenta borra tus posiciones, tu historial y los indices que has listado, ` +
    `y devuelve el saldo a ${VENUE.openingBalance} ${VENUE.settle}.\n\n` +
    `Ahora mismo tienes ${acc.open} posiciones abiertas y ${usdg(acc.equity)} de patrimonio.\n\n¿Seguir?`);
  if (!ok) return;
  resetAll();
  toast('Cuenta reiniciada');
  go('#/');
}
