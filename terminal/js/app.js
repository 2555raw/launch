/* Router, pages and wiring.
   Rule followed everywhere below: a figure is shown only if the provider returned
   it. Anything else says "Datos no disponibles", and analysis is always labelled
   as interpretation, separate from the data it reads. */

import { ASSETS, BRANDS, TYPES, getAsset, byType } from './registry.js';
import { config, saveConfig, hasProvider } from './config.js';
import { provider, listProviders } from './providers/index.js';
import { search } from './search.js';
import { analyse } from './analysis.js';
import { drawChart } from './chart.js';
import { logoEl } from './logos.js';
import { el, panel, emptyState, assetHeader, metricGrid, assetTable, newsList, analysisPanel, note } from './ui/components.js';
import { price, pct, compact, count, ratio, num, dateTime, isNA, NA_TEXT, dirClass } from './format.js';

const view = document.getElementById('view');
const results = document.getElementById('results');
const input = document.getElementById('q');
let teardown = () => {};

/* ---------- helpers ---------- */
const show = (node) => { teardown(); teardown = () => {}; view.replaceChildren(node); window.scrollTo({ top: 0 }); };
const go = (hash) => { location.hash = hash; };

async function attempt(fn) {
  if (!hasProvider()) return { ok: false, error: new Error('sin proveedor') , missing: true };
  try { return { ok: true, value: await fn() }; }
  catch (error) { return { ok: false, error }; }
}

function providerNotice() {
  const btn = el('button', 'tk-btn tk-btn-primary', 'Configurar fuente de datos');
  btn.addEventListener('click', openSettings);
  return emptyState(
    'No hay ninguna fuente de datos configurada',
    'La plataforma no muestra cifras inventadas. En cuanto añadas la clave de tu proveedor, cotizaciones, fundamentales, histórico y noticias se rellenan solos.',
    btn
  );
}

function errorNote(error) {
  return note(`<div><b>El proveedor no ha devuelto este dato.</b><br>${error?.message || 'Error desconocido'}. Se muestra como no disponible en lugar de estimarlo.</div>`);
}

/* ---------- pages ---------- */

function pageDashboard() {
  const wrap = el('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:20px';

  const intro = el('div');
  intro.appendChild(el('h1', 'tk-h1', 'Panel de mercados'));
  intro.appendChild(el('p', 'tk-lead', 'Busca cualquier empresa, ETF, índice, criptomoneda, materia prima o divisa. Cada activo tiene su ficha con cotización, fundamentales, gráfico, competidores, noticias y un análisis estructurado.'));
  wrap.appendChild(intro);

  if (!hasProvider()) wrap.appendChild(providerNotice());

  const groups = [
    ['Acciones seguidas', 'stock'], ['ETFs', 'etf'], ['Índices', 'index'],
    ['Criptomonedas', 'crypto'], ['Materias primas', 'commodity'], ['Divisas', 'fx'],
  ];
  groups.forEach(([title, type]) => {
    const rows = byType(type);
    if (!rows.length) return;
    const p = panel(title, { label: `${rows.length} activos` });
    p.body.style.padding = '0';
    p.body.appendChild(assetTable(rows.slice(0, 8), { onPick: a => go(`#/asset/${encodeURIComponent(a.id)}`) }));
    if (rows.length > 8) {
      const more = el('div');
      more.style.cssText = 'padding:12px 16px;border-top:1px solid var(--line)';
      const a = el('a', null, `Ver los ${rows.length} →`);
      a.href = `#/markets/${type}`;
      a.style.cssText = 'font-size:13px;color:var(--accent)';
      more.appendChild(a);
      p.body.appendChild(more);
    }
    wrap.appendChild(p);
  });
  show(wrap);
}

function pageMarket(type) {
  const rows = byType(type);
  const wrap = el('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:16px';
  wrap.appendChild(el('h1', 'tk-h1', TYPES[type] ? `${TYPES[type]}s seguidas` : 'Mercado'));
  const p = panel(null);
  p.body.style.padding = '0';
  p.body.appendChild(assetTable(rows, { onPick: a => go(`#/asset/${encodeURIComponent(a.id)}`) }));
  wrap.appendChild(p);
  show(wrap);
}

function pageSectors() {
  const wrap = el('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:16px';
  wrap.appendChild(el('h1', 'tk-h1', 'Sectores'));
  const bySector = new Map();
  ASSETS.filter(a => a.type === 'stock').forEach(a => {
    if (!bySector.has(a.sector)) bySector.set(a.sector, []);
    bySector.get(a.sector).push(a);
  });
  const grid = el('div', 'tk-grid c2');
  [...bySector.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([sector, list]) => {
    const p = panel(sector, { label: `${list.length} empresas` });
    p.body.style.padding = '0';
    p.body.appendChild(assetTable(list, { onPick: a => go(`#/asset/${encodeURIComponent(a.id)}`) }));
    grid.appendChild(p);
  });
  wrap.appendChild(grid);
  show(wrap);
}

const RANGES = [['1D', 2], ['1S', 7], ['1M', 31], ['3M', 92], ['6M', 183], ['1A', 365], ['5A', 1826], ['MAX', 7300]];

async function pageAsset(id) {
  const asset = getAsset(id);
  if (!asset) { show(emptyState('Activo no encontrado', 'Ese identificador no está en el registro.')); return; }

  const wrap = el('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:16px';
  const headPanel = panel(null, { body: assetHeader(asset, null) });
  wrap.appendChild(headPanel);
  if (!hasProvider()) wrap.appendChild(providerNotice());
  show(wrap);

  const [q, prof, fun] = await Promise.all([attempt(() => provider().quote(asset)), attempt(() => provider().profile(asset)), attempt(() => provider().fundamentals(asset))]);
  const quote = q.ok ? q.value : null;
  headPanel.body.replaceChildren(assetHeader(asset, quote));
  if (!q.ok && !q.missing) headPanel.body.appendChild(errorNote(q.error));

  // ---- chart ----
  const chartPanel = panel('Gráfico', { label: 'Precio de cierre' });
  const ranges = el('div', 'tk-ranges');
  chartPanel.querySelector('.tk-panel-head').appendChild(ranges);
  const cw = el('div', 'tk-chart-wrap');
  const canvas = el('canvas', 'tk-chart');
  const tip = el('div', 'tk-tip');
  cw.append(canvas, tip);
  chartPanel.body.appendChild(cw);
  wrap.appendChild(chartPanel);

  let current = '1M';
  async function loadRange(label, days) {
    ranges.querySelectorAll('.tk-range').forEach(r => r.classList.toggle('is-on', r.textContent === label));
    current = label;
    const h = await attempt(() => provider().history(asset, days));
    teardown();
    teardown = drawChart(canvas, h.ok ? h.value : [], { currency: asset.currency });
  }
  RANGES.forEach(([label, days]) => {
    const r = el('div', 'tk-range' + (label === current ? ' is-on' : ''), label);
    r.addEventListener('click', () => loadRange(label, days));
    ranges.appendChild(r);
  });

  // ---- market data ----
  const md = panel('Datos de mercado', { label: quote?.at ? `Actualizado ${dateTime(quote.at)}` : 'Sin actualizar' });
  md.body.appendChild(metricGrid([
    ['Precio', quote ? price(quote.price, asset.currency) : NA_TEXT],
    ['Variación diaria', quote ? pct(quote.changePct) : NA_TEXT],
    ['Apertura', quote ? price(quote.open, asset.currency) : NA_TEXT],
    ['Cierre anterior', quote ? price(quote.prevClose, asset.currency) : NA_TEXT],
    ['Máximo del día', quote ? price(quote.dayHigh, asset.currency) : NA_TEXT],
    ['Mínimo del día', quote ? price(quote.dayLow, asset.currency) : NA_TEXT],
    ['Máximo 52 semanas', quote ? price(quote.yearHigh, asset.currency) : NA_TEXT],
    ['Mínimo 52 semanas', quote ? price(quote.yearLow, asset.currency) : NA_TEXT],
    ['Volumen', quote ? count(quote.volume) : NA_TEXT],
    ['Capitalización', quote ? compact(quote.marketCap, asset.currency) : NA_TEXT],
  ]));
  wrap.appendChild(md);

  // ---- fundamentals ----
  const f = fun.ok ? fun.value : null;
  const fp = panel('Fundamentales', { label: 'Últimos doce meses' });
  fp.body.appendChild(metricGrid([
    ['Ingresos', f ? compact(f.revenue, asset.currency) : NA_TEXT],
    ['EBITDA', f ? compact(f.ebitda, asset.currency) : NA_TEXT],
    ['EBIT', f ? compact(f.ebit, asset.currency) : NA_TEXT],
    ['Beneficio neto', f ? compact(f.netIncome, asset.currency) : NA_TEXT],
    ['BPA', f ? num(f.eps) : NA_TEXT],
    ['PER', f ? ratio(f.pe) : NA_TEXT],
    ['Precio / ventas', f ? ratio(f.ps) : NA_TEXT],
    ['Precio / valor contable', f ? ratio(f.pb) : NA_TEXT],
    ['ROE', f ? pct(f.roe, false) : NA_TEXT],
    ['ROIC', f ? pct(f.roic, false) : NA_TEXT],
    ['Margen bruto', f ? pct(f.grossMargin, false) : NA_TEXT],
    ['Margen operativo', f ? pct(f.operatingMargin, false) : NA_TEXT],
    ['Margen neto', f ? pct(f.netMargin, false) : NA_TEXT],
    ['Deuda', f ? compact(f.debt, asset.currency) : NA_TEXT],
    ['Caja', f ? compact(f.cash, asset.currency) : NA_TEXT],
    ['Flujo de caja libre', f ? compact(f.freeCashFlow, asset.currency) : NA_TEXT],
  ]));
  if (!fun.ok && !fun.missing) fp.body.appendChild(errorNote(fun.error));
  wrap.appendChild(fp);

  // ---- company ----
  const p = prof.ok ? prof.value : null;
  const cp = panel('La empresa');
  const desc = el('p', 'tk-lead', p && !isNA(p.description) ? p.description : NA_TEXT);
  cp.body.appendChild(desc);
  const info = el('div'); info.style.marginTop = '14px';
  info.appendChild(metricGrid([
    ['CEO', p && !isNA(p.ceo) ? p.ceo : NA_TEXT],
    ['País', p && !isNA(p.country) ? p.country : asset.country],
    ['Sector', p && !isNA(p.sector) ? p.sector : asset.sector],
    ['Industria', p && !isNA(p.industry) ? p.industry : asset.industry],
    ['Empleados', p ? count(p.employees) : NA_TEXT],
    ['Bolsa', asset.exchange],
  ]));
  cp.body.appendChild(info);
  wrap.appendChild(cp);

  // ---- analysis, clearly separated from the data ----
  const ap = panel('Análisis', { label: 'Interpretación, no asesoramiento' });
  ap.body.appendChild(note('<div><b>Esto es análisis, no un dato.</b> Cada afirmación se deriva de las cifras que ha devuelto el proveedor. Donde falta el dato, se dice; no se estima ni se predice.</div>'));
  const an = analyse({ asset, quote, fundamentals: f, profile: p });
  const anWrap = el('div'); anWrap.style.marginTop = '14px';
  anWrap.appendChild(analysisPanel(an));
  ap.body.appendChild(anWrap);
  wrap.appendChild(ap);

  // ---- peers and news ----
  const split = el('div', 'tk-split');
  const peersPanel = panel('Competidores');
  peersPanel.body.appendChild(el('p', 'tk-lead', 'Cargando…'));
  const newsPanel = panel('Noticias', { label: 'Fuente indicada en cada titular' });
  newsPanel.body.appendChild(el('p', 'tk-lead', 'Cargando…'));
  split.append(newsPanel, peersPanel);
  wrap.appendChild(split);

  attempt(() => provider().peers(asset)).then(res => {
    peersPanel.body.replaceChildren();
    const known = (res.ok ? res.value : []).map(t => getAsset(t)).filter(Boolean);
    if (!known.length) {
      peersPanel.body.appendChild(el('p', 'na', res.missing ? 'Requiere fuente de datos.' : 'El proveedor no ha devuelto competidores en el registro.'));
      return;
    }
    peersPanel.body.style.padding = '0';
    peersPanel.body.appendChild(assetTable(known.slice(0, 8), { onPick: a => go(`#/asset/${encodeURIComponent(a.id)}`) }));
  });

  attempt(() => provider().news(asset)).then(res => {
    newsPanel.body.replaceChildren();
    const items = res.ok ? res.value.filter(n => !isNA(n.title)) : [];
    if (!items.length) {
      newsPanel.body.appendChild(el('p', 'na', res.missing ? 'Requiere fuente de datos.' : 'El proveedor no ha devuelto noticias para este activo.'));
      return;
    }
    newsPanel.body.appendChild(newsList(items));
  });
}

async function pageCompare(idsRaw) {
  const ids = (idsRaw || 'NVDA,AMD,INTC').split(',').map(s => s.trim()).filter(Boolean);
  const assets = ids.map(getAsset).filter(Boolean);
  const wrap = el('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:16px';
  wrap.appendChild(el('h1', 'tk-h1', 'Comparador'));
  wrap.appendChild(el('p', 'tk-lead', 'Compara hasta cuatro activos lado a lado. Busca arriba y usa el botón de comparar en cada ficha, o edita la lista de tickers en la barra de direcciones.'));
  if (!hasProvider()) wrap.appendChild(providerNotice());

  const p = panel(assets.map(a => a.short).join(' · '));
  p.body.style.padding = '0';
  const tableWrap = el('div', 'tk-scroll');
  p.body.appendChild(tableWrap);
  wrap.appendChild(p);
  show(wrap);

  const data = await Promise.all(assets.map(async a => ({
    asset: a,
    quote: (await attempt(() => provider().quote(a))).value || null,
    fun: (await attempt(() => provider().fundamentals(a))).value || null,
  })));

  const ROWS = [
    ['Precio', d => d.quote ? price(d.quote.price, d.asset.currency) : NA_TEXT],
    ['Variación diaria', d => d.quote ? pct(d.quote.changePct) : NA_TEXT],
    ['Capitalización', d => d.quote ? compact(d.quote.marketCap, d.asset.currency) : NA_TEXT],
    ['Ingresos', d => d.fun ? compact(d.fun.revenue, d.asset.currency) : NA_TEXT],
    ['Crecimiento de ingresos', d => d.fun ? pct(d.fun.revenueGrowth) : NA_TEXT],
    ['Margen bruto', d => d.fun ? pct(d.fun.grossMargin, false) : NA_TEXT],
    ['Margen neto', d => d.fun ? pct(d.fun.netMargin, false) : NA_TEXT],
    ['PER', d => d.fun ? ratio(d.fun.pe) : NA_TEXT],
    ['BPA', d => d.fun ? num(d.fun.eps) : NA_TEXT],
    ['ROE', d => d.fun ? pct(d.fun.roe, false) : NA_TEXT],
    ['Deuda', d => d.fun ? compact(d.fun.debt, d.asset.currency) : NA_TEXT],
    ['Flujo de caja libre', d => d.fun ? compact(d.fun.freeCashFlow, d.asset.currency) : NA_TEXT],
  ];

  const t = el('table', 'tk-table');
  const thead = el('thead'); const hr = el('tr');
  hr.appendChild(el('th', null, 'Métrica'));
  data.forEach(d => {
    const th = el('th', 'r');
    const box = el('div');
    box.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:flex-end';
    box.appendChild(logoEl(d.asset, 22));
    box.appendChild(el('span', null, d.asset.short));
    th.appendChild(box);
    hr.appendChild(th);
  });
  thead.appendChild(hr); t.appendChild(thead);
  const tb = el('tbody');
  ROWS.forEach(([label, get]) => {
    const tr = el('tr');
    tr.style.cursor = 'default';
    tr.appendChild(el('td', null, label));
    data.forEach(d => {
      const v = get(d);
      tr.appendChild(el('td', 'r num' + (v === NA_TEXT ? ' na' : ''), v));
    });
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  tableWrap.replaceChildren(t);
}

function pageSimple(title, message) {
  const wrap = el('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:16px';
  wrap.appendChild(el('h1', 'tk-h1', title));
  wrap.appendChild(hasProvider()
    ? emptyState('Pendiente de conectar', message)
    : providerNotice());
  show(wrap);
}

/* ---------- search ---------- */
let picked = -1;
function renderResults(list) {
  results.replaceChildren();
  if (!list.length) {
    results.appendChild(el('div', 'tk-res-empty', 'Sin coincidencias en el registro'));
    results.hidden = false; return;
  }
  list.forEach((hit, i) => {
    const row = el('div', 'tk-res' + (i === picked ? ' is-on' : ''));
    row.setAttribute('role', 'option');
    const entity = hit.kind === 'brand' ? { ...hit.brand, short: hit.brand.name } : hit.asset;
    row.appendChild(logoEl(entity, 30));
    const nm = el('div', 'tk-res-name');
    nm.appendChild(el('b', null, hit.kind === 'brand' ? hit.brand.name : hit.asset.name));
    nm.appendChild(el('span', null, hit.kind === 'brand'
      ? `${hit.brand.note} · cotiza como ${hit.asset.ticker}`
      : `${hit.asset.ticker} · ${hit.asset.exchange} · ${TYPES[hit.asset.type]}`));
    row.appendChild(nm);
    row.appendChild(el('span', 'tk-res-tag', hit.asset.ticker));
    row.addEventListener('mousedown', (e) => { e.preventDefault(); pick(hit); });
    results.appendChild(row);
  });
  results.hidden = false;
}
function pick(hit) {
  input.value = '';
  results.hidden = true;
  go(`#/asset/${encodeURIComponent(hit.asset.id)}`);
}
input.addEventListener('input', () => { picked = -1; const l = search(input.value); l.length || input.value ? renderResults(l) : (results.hidden = true); });
input.addEventListener('focus', () => { if (input.value) renderResults(search(input.value)); });
input.addEventListener('blur', () => setTimeout(() => { results.hidden = true; }, 120));
input.addEventListener('keydown', (e) => {
  const list = search(input.value);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    picked = Math.min(Math.max(picked + (e.key === 'ArrowDown' ? 1 : -1), 0), list.length - 1);
    renderResults(list);
  } else if (e.key === 'Enter' && list.length) {
    pick(list[Math.max(picked, 0)]);
  } else if (e.key === 'Escape') { results.hidden = true; input.blur(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
});

/* ---------- settings ---------- */
const modal = document.getElementById('modal');
function openSettings() {
  const card = el('div', 'tk-modal-card');
  card.appendChild(el('h2', 'tk-h2', 'Fuente de datos'));
  const lead = el('p', 'tk-lead', 'La clave se guarda solo en este navegador. Sin ella la plataforma funciona, pero informa de cada campo como no disponible en lugar de inventarlo.');
  card.appendChild(lead);

  const fProv = el('div', 'tk-field');
  fProv.appendChild(el('label', null, 'Proveedor'));
  const sel = el('select');
  listProviders().forEach(p => {
    const o = el('option', null, p.label); o.value = p.id;
    if (p.id === config.provider) o.selected = true;
    sel.appendChild(o);
  });
  fProv.appendChild(sel);
  card.appendChild(fProv);

  const fKey = el('div', 'tk-field');
  fKey.appendChild(el('label', null, 'Clave de API'));
  const key = el('input'); key.type = 'password'; key.value = config.apiKey || ''; key.placeholder = 'Pega aquí tu clave';
  fKey.appendChild(key);
  card.appendChild(fKey);

  const fLogo = el('div', 'tk-field');
  fLogo.appendChild(el('label', null, 'Token del proveedor de logos (opcional)'));
  const lt = el('input'); lt.type = 'password'; lt.value = config.logoToken || ''; lt.placeholder = 'Sin token se usa el resolutor de reserva';
  fLogo.appendChild(lt);
  card.appendChild(fLogo);

  const row = el('div', 'tk-row-end');
  const cancel = el('button', 'tk-btn tk-btn-ghost', 'Cancelar');
  const save = el('button', 'tk-btn tk-btn-primary', 'Guardar');
  cancel.addEventListener('click', closeSettings);
  save.addEventListener('click', () => {
    saveConfig({ provider: sel.value, apiKey: key.value.trim(), logoToken: lt.value.trim() });
    closeSettings(); paintStatus(); route();
  });
  row.append(cancel, save);
  card.appendChild(row);

  modal.replaceChildren(card);
  modal.hidden = false;
}
function closeSettings() { modal.hidden = true; modal.replaceChildren(); }
modal.addEventListener('click', (e) => { if (e.target === modal) closeSettings(); });
document.getElementById('settingsBtn').addEventListener('click', openSettings);

/* ---------- chrome ---------- */
function paintStatus() {
  const s = document.getElementById('status');
  const dot = el('span', 'tk-dot ' + (hasProvider() ? 'ok' : 'off'));
  s.replaceChildren(dot, el('span', null, hasProvider() ? provider().label : 'Sin fuente de datos'));
  document.getElementById('stamp').textContent = hasProvider()
    ? `Proveedor: ${provider().label}`
    : 'Ningún dato de mercado cargado';
}
const SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.9 1.9M16.7 16.7l1.9 1.9M18.6 5.4l-1.9 1.9M7.3 16.7l-1.9 1.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const themeBtn = document.getElementById('theme');
function paintTheme() {
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  themeBtn.innerHTML = light ? MOON : SUN;
}
themeBtn.addEventListener('click', () => {
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  document.documentElement.setAttribute('data-theme', light ? 'dark' : 'light');
  try { localStorage.setItem('tricker.theme', light ? 'dark' : 'light'); } catch {}
  paintTheme();
});
try {
  const saved = localStorage.getItem('tricker.theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
} catch {}

/* ---------- routing ---------- */
function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [, head, a, b] = hash.split('/');
  document.querySelectorAll('#nav a').forEach(n => n.classList.toggle('is-active', n.getAttribute('href') === '#' + hash));

  if (head === 'asset' && a) return void pageAsset(decodeURIComponent(a));
  if (head === 'markets' && a) return pageMarket(a);
  if (head === 'sectors') return pageSectors();
  if (head === 'compare') return void pageCompare(new URLSearchParams(hash.split('?')[1] || '').get('ids'));
  if (head === 'news') return pageSimple('Noticias', 'El flujo global de noticias se alimenta del proveedor configurado. Abre cualquier ficha para ver las noticias del activo.');
  if (head === 'economy') return pageSimple('Indicadores económicos', 'Inflación, tipos, empleo y PIB llegan del proveedor configurado.');
  return pageDashboard();
}
window.addEventListener('hashchange', route);
paintStatus(); paintTheme(); route();
