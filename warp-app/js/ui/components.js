/* Piezas reutilizables. Todo lo que se repite en dos pantallas vive aqui una
   sola vez, para que una fila de indice o la ficha de un activo se vean igual
   en el panel, en el mercado y en el buscador. */

import { markEl, markStack, rgba } from '../logos.js';
import { CLASSES } from '../registry.js';
import { pct, dir, num } from '../format.js';
import { drawChart, sparkline, drawDonut } from '../chart.js';

/** Constructor de nodos. props especiales: class, text, html, on, style, data. */
export function el(tag, props = {}, kids = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style') Object.assign(node.style, v);
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else if (k in node && k !== 'list') node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const kid of [].concat(kids)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}
export const frag = (kids) => { const f = document.createDocumentFragment(); [].concat(kids).forEach(k => k && f.append(k)); return f; };

/** La pastilla del simbolo, tenida con el color de marca del activo. El simbolo
 *  y el color vienen del registro, nunca de la pantalla. */
export function symPill(asset) {
  return el('span', {
    class: 'wp-sym',
    text: asset.symbol,
    style: { background: rgba(asset.color, .12), color: asset.color },
  });
}

/** Identidad de un activo: su marca real, su nombre y su simbolo. */
export function assetIdent(asset, { size = 34, sub = null } = {}) {
  return el('span', { class: 'wp-ident' }, [
    markEl(asset, size),
    el('span', { class: 'wp-ident-text' }, [
      el('span', { class: 'wp-ident-name', text: asset.short }),
      el('span', { class: 'wp-ident-sub' }, [
        symPill(asset),
        el('span', { text: sub ?? (CLASSES[asset.class]?.label || asset.sector) }),
      ]),
    ]),
  ]);
}

/** Identidad de un indice: la pila de marcas de sus patas y su simbolo. */
export function indexIdent(ix, legs, { size = 28 } = {}) {
  return el('span', { class: 'wp-ident' }, [
    markStack(legs.map(l => l.asset), size),
    el('span', { class: 'wp-ident-text' }, [
      el('span', { class: 'wp-ident-name', text: ix.name }),
      el('span', { class: 'wp-ident-sub' }, [
        el('span', { class: 'wp-sym', text: ix.symbol, style: { background: 'var(--sunken-2)', color: 'var(--muted)' } }),
        el('span', { text: `${legs.length} activos` }),
        ix.creator === 'yo' ? el('span', { class: 'wp-pill own', text: 'Tuyo' }) : null,
      ]),
    ]),
  ]);
}

export function changePill(v) {
  return el('span', { class: `wp-pill ${dir(v)}`, text: pct(v) });
}

export function stat(label, value, { sub = null, cls = '' } = {}) {
  return el('dl', { class: 'wp-stat' }, [
    el('dt', { text: label }),
    el('dd', { class: `num ${cls}`, text: value }),
    sub ? el('div', { class: 'wp-stat-sub', text: sub }) : null,
  ]);
}

export function kv(rows) {
  return el('dl', { class: 'wp-kv' }, rows.filter(Boolean).map(r =>
    el('div', { class: r.line ? 'wp-kv-line' : '' }, [
      el('dt', { text: r.k }),
      el('dd', { class: `num ${r.cls || ''}`, text: r.v }),
    ])));
}

export function card({ title, note, actions, body, tight = false }) {
  const head = (title || note || actions)
    ? el('div', { class: 'wp-card-head' }, [
        title ? el('h2', { text: title }) : null,
        note ? el('span', { class: 'wp-card-note', text: note }) : null,
        actions || null,
      ])
    : null;
  return el('section', { class: 'wp-card' }, [
    head,
    el('div', { class: `wp-card-body ${tight ? 'tight' : ''}` }, [body]),
  ]);
}

export function table(cols, rows) {
  if (!rows.length) return null;
  return el('div', { class: 'wp-scroll' }, [
    el('table', { class: 'wp-table' }, [
      el('thead', {}, [el('tr', {}, cols.map(c => el('th', { text: c })))]),
      el('tbody', {}, rows),
    ]),
  ]);
}

export function emptyState({ title, text, action }) {
  return el('div', { class: 'wp-empty' }, [
    el('strong', { text: title }),
    el('span', { text: text }),
    action || null,
  ]);
}

export function note(text, kind = '') {
  return el('div', { class: `wp-note ${kind}`, html: text });
}

/** Barra de pesos: cada pata ocupa su peso y lleva su color de marca. */
export function weightsBar(legs) {
  return el('div', { class: 'wp-weights', title: legs.map(l => `${l.asset.symbol} ${num(l.weight, 1)} %`).join(' · ') },
    legs.map(l => el('span', { style: { width: `${l.weight}%`, background: l.asset.color } })));
}

export function legend(legs, { onPick = null } = {}) {
  return el('div', { class: 'wp-legend' }, legs.map(l => {
    const row = el(onPick ? 'button' : 'div', {
      class: 'wp-legend-row',
      style: onPick ? { background: 'none', border: 0, cursor: 'pointer', padding: 0, font: 'inherit', textAlign: 'left' } : null,
      on: onPick ? { click: () => onPick(l) } : null,
    }, [
      el('span', { class: 'wp-legend-dot', style: { background: l.asset.color } }),
      el('span', { text: l.asset.short }),
      symPill(l.asset),
      el('span', { class: 'wp-legend-w num', text: num(l.weight, 1) + ' %' }),
    ]);
    return row;
  }));
}

export function donut(legs, size = 128) {
  const c = el('canvas', { class: 'wp-donut' });
  requestAnimationFrame(() => drawDonut(c, legs, size));
  return el('div', { class: 'wp-donut-wrap' }, [c, legend(legs)]);
}

/** Bloque de grafico con selector de rango. `load(range)` devuelve la serie. */
export function chartBlock({ load, color, baseline = null, suffix = '', ranges = null, initial = '1M', small = false }) {
  const opts = ranges || [
    { id: '1D', label: '1 D', hours: 24 },
    { id: '1S', label: '1 S', hours: 24 * 7 },
    { id: '1M', label: '1 M', hours: 24 * 30 },
    { id: '3M', label: '3 M', hours: 24 * 90 },
  ];
  const canvas = el('canvas');
  const tip = el('div', { class: 'wp-tip', hidden: true });
  const wrap = el('div', { class: `wp-chart ${small ? 'sm' : ''}` }, [canvas, tip]);
  const seg = el('div', { class: 'wp-ranges wp-seg' });
  let teardown = () => {};

  const paint = (opt) => {
    teardown();
    [...seg.children].forEach(b => b.classList.toggle('is-on', b.dataset.id === opt.id));
    requestAnimationFrame(() => { teardown = drawChart(canvas, load(opt.hours), { color, baseline, suffix }); });
  };
  opts.forEach(o => seg.append(el('button', { type: 'button', text: o.label, data: { id: o.id }, on: { click: () => paint(o) } })));
  const start = opts.find(o => o.id === initial) || opts[opts.length - 1];
  paint(start);
  return { wrap, ranges: seg, redraw: () => paint(opts.find(o => seg.querySelector('.is-on')?.dataset.id === o.id) || start) };
}

export function spark(rows, color) {
  const c = el('canvas', { class: 'wp-spark' });
  requestAnimationFrame(() => sparkline(c, rows, color));
  return c;
}

/* Avisos efimeros. Una accion que mueve saldo tiene que decir que ha ocurrido. */
let toastHost = null;
export function toast(message, kind = '') {
  if (!toastHost) { toastHost = el('div', { class: 'wp-toasts' }); document.body.append(toastHost); }
  const t = el('div', { class: `wp-toast ${kind}`, text: message });
  toastHost.append(t);
  setTimeout(() => t.remove(), 3400);
}

export const icon = (paths, size = 16) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  [].concat(paths).forEach(d => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.8');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
  });
  return svg;
};
