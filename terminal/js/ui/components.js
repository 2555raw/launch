/* Reusable pieces. Every screen builds identity through logoEl, so an asset can
   never show one logo here and another one there. */

import { logoEl } from '../logos.js';
import { TYPES } from '../registry.js';
import { price, pct, compact, dirClass, isNA, NA_TEXT, dateTime, dateOnly } from '../format.js';

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
export function frag(...nodes) { const f = document.createDocumentFragment(); nodes.filter(Boolean).forEach(n => f.appendChild(n)); return f; }

export function panel(title, { actions = null, body = null, label = null } = {}) {
  const p = el('section', 'tk-panel');
  if (title) {
    const head = el('div', 'tk-panel-head');
    head.appendChild(el('h2', 'tk-h2', title));
    if (label) head.appendChild(el('span', 'tk-label', label));
    if (actions) head.appendChild(actions);
    p.appendChild(head);
  }
  const b = el('div', 'tk-panel-body');
  if (body) b.appendChild(body);
  p.appendChild(b);
  p.body = b;
  return p;
}

export function emptyState(title, message, action = null) {
  const e = el('div', 'tk-empty');
  e.appendChild(el('b', null, title));
  e.appendChild(el('div', null, message));
  if (action) { const wrap = el('div'); wrap.style.marginTop = '14px'; wrap.appendChild(action); e.appendChild(wrap); }
  return e;
}

export function assetHeader(asset, quote) {
  const head = el('div', 'tk-head');
  head.appendChild(logoEl(asset, 52));

  const id = el('div', 'tk-head-id');
  id.appendChild(el('h1', null, asset.name));
  const sub = el('div', 'tk-head-sub');
  sub.appendChild(el('span', 'tk-chip', asset.ticker));
  sub.appendChild(el('span', null, asset.exchange));
  sub.appendChild(el('span', null, '·'));
  sub.appendChild(el('span', null, TYPES[asset.type] || asset.type));
  if (asset.sector) { sub.appendChild(el('span', null, '·')); sub.appendChild(el('span', null, asset.sector)); }
  id.appendChild(sub);
  head.appendChild(id);

  const px = el('div', 'tk-head-px');
  px.appendChild(el('div', 'tk-px', quote ? price(quote.price, asset.currency) : NA_TEXT));
  const d = el('div', `tk-px-d ${quote ? dirClass(quote.changePct) : 'flat'}`);
  d.textContent = quote && !isNA(quote.changePct)
    ? `${pct(quote.changePct)} · ${price(quote.change, asset.currency)}`
    : NA_TEXT;
  px.appendChild(d);
  head.appendChild(px);
  return head;
}

/** entries: [label, value, hint?] — value already formatted, or NA_TEXT. */
export function metricGrid(entries) {
  const dl = el('dl', 'tk-metrics');
  entries.forEach(([label, value, hint]) => {
    const cell = el('div', 'tk-metric');
    cell.appendChild(el('dt', null, label));
    const dd = el('dd', value === NA_TEXT ? 'na' : null, value);
    if (hint) dd.appendChild(el('span', 'hint', hint));
    cell.appendChild(dd);
    dl.appendChild(dl.lastChild === undefined ? cell : cell);
  });
  return dl;
}

export function assetTable(rows, { onPick } = {}) {
  const wrap = el('div', 'tk-scroll');
  const t = el('table', 'tk-table');
  const thead = el('thead');
  const hr = el('tr');
  ['Activo', 'Ticker', 'Tipo', 'Sector', 'Mercado'].forEach((h, i) => {
    const th = el('th', i > 2 ? 'r' : null, h);
    hr.appendChild(th);
  });
  thead.appendChild(hr); t.appendChild(thead);

  const tb = el('tbody');
  rows.forEach(a => {
    const tr = el('tr');
    const first = el('td');
    const cell = el('div');
    cell.style.cssText = 'display:flex;align-items:center;gap:10px';
    cell.appendChild(logoEl(a, 26));
    const nm = el('div');
    nm.appendChild(el('div', null, a.short));
    const small = el('div', null, a.name);
    small.style.cssText = 'font-size:11.5px;color:var(--muted)';
    nm.appendChild(small);
    cell.appendChild(nm);
    first.appendChild(cell);
    tr.appendChild(first);
    tr.appendChild(el('td', 'num', a.ticker));
    tr.appendChild(el('td', null, TYPES[a.type] || a.type));
    tr.appendChild(el('td', 'r', a.sector));
    tr.appendChild(el('td', 'r', a.exchange));
    tr.addEventListener('click', () => onPick?.(a));
    tb.appendChild(tr);
  });
  t.appendChild(tb); wrap.appendChild(t);
  return wrap;
}

export function newsList(items) {
  const list = el('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:2px';
  items.forEach(it => {
    const a = el('a', 'tk-an-sec');
    a.href = it.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.style.cssText = 'display:block;text-decoration:none';
    a.appendChild(el('h3', null, it.title));
    const meta = el('p');
    meta.textContent = `${it.source || 'Fuente no indicada'} · ${it.at ? dateTime(it.at) : 'Fecha no disponible'}`;
    a.appendChild(meta);
    list.appendChild(a);
  });
  return list;
}

export function analysisPanel(analysis) {
  const wrap = el('div', 'tk-an');
  analysis.sections.forEach(sec => {
    const s = el('div', 'tk-an-sec');
    const h = el('h3', null, sec.title);
    if (sec.verdict) {
      const v = el('span', `tk-verdict ${sec.verdict.tone === 'good' ? 'good' : sec.verdict.tone === 'bad' ? 'bad' : sec.verdict.tone === 'warn' ? 'warn' : ''}`, sec.verdict.verdict);
      h.appendChild(v);
    }
    s.appendChild(h);

    if (sec.body) sec.body.forEach(t => s.appendChild(el('p', null, t)));
    if (sec.findings) {
      if (!sec.findings.length) s.appendChild(el('p', 'na', sec.empty || NA_TEXT));
      else sec.findings.forEach(fd => s.appendChild(el('p', null, fd.text)));
    }
    if (sec.list) {
      const ul = el('ul');
      sec.list.forEach(t => ul.appendChild(el('li', null, t)));
      s.appendChild(ul);
    }
    if (sec.scenarios) {
      const ul = el('ul');
      sec.scenarios.forEach(sc => {
        const li = el('li');
        li.appendChild(el('b', null, sc.name + ': '));
        li.appendChild(document.createTextNode(sc.text));
        ul.appendChild(li);
      });
      s.appendChild(ul);
      s.appendChild(el('p', null, 'Factores a vigilar: ' + sec.watch.join('; ') + '.'));
    }
    wrap.appendChild(s);
  });
  return wrap;
}

export function note(html) {
  const n = el('div', 'tk-note');
  n.innerHTML = html;
  return n;
}
