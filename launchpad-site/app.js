/* Tricker Launchpad — el cliente.
   Todo lo que se ve sale de la API del servidor (/api/launches, /api/quotes):
   aquí no hay cifras escritas a mano. La cartera entra firmando un mensaje
   (sin gas), y una aportación es un POST que el servidor valida y guarda. */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const TOKEN_KEY = 'tricker.launchpad.session';
  const THEME_KEY = 'tricker.launchpad.theme';

  const state = {
    now: Date.now(), skew: 0, launches: [], quotes: {}, quotesAt: null,
    phase: 'all', cat: 'all', q: '', sort: 'progress', open: null,
    session: null, mine: [], busy: false
  };

  /* ---------- formato ---------- */
  const usd = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usd2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
  const pct = (x, d = 0) => (x * 100).toFixed(d).replace('.', ',') + ' %';
  const price = (p) => '$' + (p < 1 ? p.toFixed(3) : p.toFixed(2)).replace('.', ',');
  const short = (a) => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
  const compact = (n) => n >= 1e9 ? (n / 1e9).toFixed(1).replace('.', ',') + ' B' : n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' M' : n >= 1e3 ? (n / 1e3).toFixed(0) + ' k' : String(n);
  const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function remaining(ms) {
    if (ms <= 0) return '0 min';
    const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d >= 2) return `${d} d ${h % 24} h`;
    if (h >= 1) return `${h} h ${String(m % 60).padStart(2, '0')} min`;
    return `${m} min`;
  }
  const now = () => Date.now() + state.skew;

  const PHASE = { live: 'En vivo', soon: 'Próximo', done: 'Cerrado' };
  const CAT = { burger: 'Burger', mex: 'Mexicana', cafe: 'Café', pizza: 'Pizza', chicken: 'Pollo', delivery: 'Delivery', casual: 'De mesa' };

  /* ---------- logos: el oficial desde el dominio, o un monograma ----------
     Misma regla que el Terminal: nunca un logo dibujado o aproximado. */
  const failed = new Set();
  function logoSources(domain) {
    const cfg = window.TRICKER_CONFIG || {};
    const out = [];
    if (cfg.logoToken) out.push(`https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(cfg.logoToken)}&size=128&format=png&retries=0`);
    out.push(`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${encodeURIComponent(domain)}&size=128`);
    out.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`);
    return out.filter((u) => !failed.has(u));
  }
  function monogram(name) {
    const w = String(name || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
    return ((w[0]?.[0] || '') + (w[1]?.[0] || '')).toUpperCase() || '?';
  }
  function logoEl(l, size = 38) {
    const el = document.createElement('span');
    el.className = 'lp-logo';
    el.style.width = el.style.height = size + 'px';
    el.style.fontSize = Math.round(size * 0.36) + 'px';
    el.title = l.name;
    const srcs = logoSources(l.domain);
    const mono = () => { el.classList.add('is-mono'); el.textContent = monogram(l.name); };
    if (!srcs.length) { mono(); return el; }
    const img = new Image();
    img.alt = `Logo de ${l.name}`;
    img.loading = 'lazy';
    let i = 0;
    const next = () => { if (i >= srcs.length) { img.remove(); mono(); return; } img.src = srcs[i++]; };
    img.addEventListener('error', () => { failed.add(img.src); next(); });
    img.addEventListener('load', () => { if (img.naturalWidth < 24) { failed.add(img.src); next(); } });
    el.appendChild(img);
    next();
    return el;
  }

  /* ---------- datos ---------- */
  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (opts.body) headers['content-type'] = 'application/json';
    if (state.session) headers.authorization = 'Bearer ' + state.session.token;
    const r = await fetch(path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(data.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
    return data;
  }

  async function loadLaunches() {
    const d = await api('/api/launches');
    state.skew = d.now - Date.now();
    state.launches = d.launches;
    render();
  }
  async function loadQuotes() {
    try {
      const d = await api('/api/quotes');
      state.quotes = d.quotes || {}; state.quotesAt = d.at;
      renderQuotes();
    } catch { /* la fila dirá que no hay dato */ }
  }
  async function loadMine() {
    if (!state.session) { state.mine = []; return; }
    try { state.mine = (await api('/api/me')).contributions; }
    catch (e) { if (e.status === 401) signOut(); }
  }

  /* ---------- la cartera ---------- */
  function restoreSession() {
    try {
      const s = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (s && s.expires > Date.now()) state.session = s;
    } catch { state.session = null; }
  }
  function signOut() {
    state.session = null; state.mine = [];
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    renderWallet(); renderRows();
  }
  async function connect() {
    const eth = window.ethereum;
    if (!eth) { toast('No hay wallet en este navegador. Instala MetaMask (o cualquier wallet EVM) y vuelve.'); return; }
    try {
      state.busy = true; renderWallet();
      const [address] = await eth.request({ method: 'eth_requestAccounts' });
      const { message } = await api('/api/auth/nonce', { method: 'POST', body: { address } });
      const signature = await eth.request({ method: 'personal_sign', params: [message, address] });
      const s = await api('/api/auth/verify', { method: 'POST', body: { address, signature } });
      state.session = s;
      try { localStorage.setItem(TOKEN_KEY, JSON.stringify(s)); } catch {}
      await loadMine();
      toast(`Dentro como ${short(s.address)}`);
    } catch (e) {
      toast(e.code === 4001 ? 'Firma cancelada.' : (e.message || 'No se pudo entrar.'));
    } finally {
      state.busy = false; renderWallet(); renderRows();
    }
  }
  if (window.ethereum?.on) {
    window.ethereum.on('accountsChanged', (acc) => {
      if (state.session && (!acc.length || acc[0].toLowerCase() !== state.session.address.toLowerCase())) signOut();
    });
  }

  async function contribute(l, amount, note) {
    try {
      state.busy = true;
      const d = await api(`/api/launches/${l.id}/contribute`, { method: 'POST', body: { amount } });
      const i = state.launches.findIndex((x) => x.id === l.id);
      if (i >= 0) state.launches[i] = d.launch;
      state.mine.unshift(d.contribution);
      toast(`Aportación de ${usd2.format(amount)} registrada en ${l.tick}.`);
      render();
    } catch (e) {
      note.textContent = e.message; note.hidden = false;
    } finally { state.busy = false; }
  }

  /* ---------- aviso corto ---------- */
  let toastTimer;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'lp-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-on'), 4200);
  }

  /* ---------- vistas ---------- */
  function phaseChip(l) {
    const cls = l.phase + (l.outcome === 'ok' ? ' ok' : '');
    const txt = l.phase === 'done' ? (l.outcome === 'ok' ? 'Cerrado · objetivo' : 'Cerrado · sin mínimo') : PHASE[l.phase];
    return `<span class="lp-phase ${cls}"><i></i>${txt}</span>`;
  }
  function barCls(l) { return l.phase === 'done' ? (l.outcome === 'ok' ? 'done' : 'failed') : l.phase; }
  function closeText(l) {
    const t = now();
    if (l.phase === 'soon') return `abre en ${remaining(l.openAt - t)}`;
    if (l.phase === 'live') return `cierra en ${remaining(l.closeAt - t)}`;
    return `cerró ${dateFmt.format(l.closeAt)}${l.closedEarly ? ' · tope' : ''}`;
  }
  function quoteHtml(l) {
    if (!l.parent) return '<span class="lp-quote none">Sin cotización</span>';
    const q = state.quotes[l.parent];
    if (!q) return `<span class="lp-quote none">${esc(l.parent)} · dato no disponible</span>`;
    const up = (q.change ?? 0) >= 0;
    const ch = q.change == null ? '' : `<em class="${up ? 'up' : 'down'}">${up ? '+' : ''}${q.change.toFixed(2).replace('.', ',')} %</em>`;
    return `<span class="lp-quote"><b>${esc(l.parent)}</b> ${price(q.price)} ${ch}</span>`;
  }

  function renderTape() {
    const track = $('#tape');
    if (!track) return;
    const items = state.launches.filter((l) => l.phase !== 'done').map((l) => {
      const q = l.parent && state.quotes[l.parent];
      const quote = q ? ` <span class="v">${esc(l.parent)} ${price(q.price)}</span>` : '';
      return `<span class="lp-tape-item"><span class="t">${esc(l.tick)}</span><span class="v">/${esc(l.parent)}</span>${l.phase === 'live' ? `<span class="live">${pct(l.progress)}</span>` : `<span class="v">${closeText(l)}</span>`}${quote}</span>`;
    }).join('');
    track.innerHTML = items + items; // dos copias: la animación recorre la mitad
  }

  function renderStats() {
    const el = $('#stats');
    if (!el) return;
    const live = state.launches.filter((l) => l.phase === 'live');
    const raised = state.launches.reduce((s, l) => s + l.raised, 0);
    const backers = state.launches.reduce((s, l) => s + l.backers, 0);
    const demo = state.launches.some((l) => l.demo);
    el.innerHTML = [
      ['En vivo', String(live.length)],
      ['Recaudado en total', usd.format(raised)],
      ['Aportaciones', num.format(backers)],
      ['Pareados a bolsa', `${new Set(state.launches.map((l) => l.parent).filter(Boolean)).size} tickers`]
    ].map(([k, v]) => `<div class="lp-stat"><small>${k}</small><b>${v}</b></div>`).join('');
    $('#live-count').textContent = String(live.length);
    $('#demo-note')?.toggleAttribute('hidden', !demo);
  }

  function renderFeature() {
    const el = $('#feature');
    if (!el) return;
    const live = state.launches.filter((l) => l.phase === 'live').sort((a, b) => b.progress - a.progress || a.closeAt - b.closeAt);
    const l = live[0] || state.launches.filter((l) => l.phase === 'soon').sort((a, b) => a.openAt - b.openAt)[0];
    if (!l) { el.innerHTML = '<p class="lp-empty">No hay lanzamientos abiertos ni programados.</p>'; return; }
    el.innerHTML = '';
    const top = document.createElement('div'); top.className = 'lp-feature-top';
    top.appendChild(logoEl(l, 52));
    top.insertAdjacentHTML('beforeend', `<div class="lp-id"><h3>${esc(l.name)}</h3><small>${esc(l.pair)} · ${esc(l.chain)} · ${esc(CAT[l.cat] || l.cat)}</small></div>${phaseChip(l)}`);
    el.appendChild(top);
    el.insertAdjacentHTML('beforeend', `
      <div class="lp-feature-grid">
        <div><small>Precio</small><b>${price(l.price)}</b></div>
        <div><small>Objetivo</small><b>${usd.format(l.goal)}</b></div>
        <div><small>Matriz</small><b class="lp-feature-quote">${quoteHtml(l)}</b></div>
        <div><small>${l.phase === 'live' ? 'Cierra en' : 'Abre en'}</small><b data-countdown="${l.id}">${closeText(l).replace(/^(cierra|abre) en /, '')}</b></div>
      </div>
      <div class="lp-feature-bar">
        <div class="lp-bar ${barCls(l)}"><i style="width:${l.progress * 100}%"></i></div>
        <div class="lp-feature-bar-meta"><span><b>${usd.format(l.raised)}</b> recaudados</span><span>${pct(l.progress, 1)} · ${num.format(l.backers)} carteras</span></div>
      </div>
      <a class="lp-btn lp-btn-primary" href="#mesa" data-open="${l.id}">${l.phase === 'live' ? 'Aportar ahora' : 'Ver la ficha'}</a>`);
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    let rows = state.launches.filter((l) =>
      (state.phase === 'all' || l.phase === state.phase) &&
      (state.cat === 'all' || l.cat === state.cat) &&
      (!q || [l.name, l.tick, l.parent, l.parentName, l.pair].some((s) => String(s || '').toLowerCase().includes(q))));
    const t = now();
    const order = { live: 0, soon: 1, done: 2 };
    const cmp = {
      progress: (a, b) => order[a.phase] - order[b.phase] || b.progress - a.progress,
      raised: (a, b) => b.raised - a.raised,
      time: (a, b) => order[a.phase] - order[b.phase] || (a.phase === 'soon' ? a.openAt - b.openAt : a.phase === 'live' ? a.closeAt - b.closeAt : b.closeAt - a.closeAt),
      fdv: (a, b) => b.fdv - a.fdv,
      name: (a, b) => a.name.localeCompare(b.name, 'es')
    }[state.sort] || (() => 0);
    return rows.sort(cmp);
  }

  function renderRows() {
    const host = $('#rows');
    if (!host) return;
    const rows = filtered();
    $('#empty').hidden = rows.length > 0;
    host.innerHTML = '';
    for (const l of rows) {
      const row = document.createElement('div');
      row.className = 'lp-row' + (state.open === l.id ? ' is-open' : '');
      row.dataset.id = l.id;
      const main = document.createElement('div'); main.className = 'lp-row-main';
      main.appendChild(logoEl(l, 38));
      main.insertAdjacentHTML('beforeend', `<div class="lp-row-name"><b>${esc(l.tick)}</b><small>${esc(l.name)} · ${esc(CAT[l.cat] || l.cat)}${l.demo ? ' · demo' : ''}</small></div>`);
      row.appendChild(main);
      row.insertAdjacentHTML('beforeend', `
        <span class="lp-mono lp-pair" data-l="Par"><b>${esc(l.pair)}</b><small>${quoteHtml(l)}</small></span>
        <span data-l="Fase">${phaseChip(l)}</span>
        <span class="lp-mono" data-l="Precio">${price(l.price)}</span>
        <div class="lp-row-prog" data-l="Progreso"><div class="lp-bar ${barCls(l)}"><i style="width:${l.progress * 100}%"></i></div><small>${pct(l.progress, 1)} de ${usd.format(l.goal)}</small></div>
        <span class="lp-mono" data-l="Recaudado">${usd.format(l.raised)}</span>
        <span class="lp-mono" data-l="Cierre" data-countdown-row="${l.id}">${closeText(l)}</span>
        <span class="lp-row-act"><button type="button" data-open="${l.id}">${state.open === l.id ? 'Cerrar' : (l.phase === 'live' ? 'Aportar' : 'Ficha')}</button></span>`);
      host.appendChild(row);
      if (state.open === l.id) host.appendChild(detail(l));
    }
  }

  function detail(l) {
    const d = document.createElement('div');
    d.className = 'lp-detail';
    const mine = state.mine.filter((c) => c.launch === l.id).reduce((s, c) => s + c.amount, 0);
    const left = Math.max(0, Math.round((l.walletCap - mine) * 100) / 100);
    const room = Math.max(0, Math.round((l.goal - l.raised) * 100) / 100);
    d.innerHTML = `
      <div><small>Matriz</small><b>${esc(l.parentName || '—')}</b></div>
      <div><small>Cadena</small><b>${esc(l.chain)}</b></div>
      <div><small>Emisión</small><b>${compact(l.supply)} ${esc(l.tick)}</b></div>
      <div><small>Valoración (FDV)</small><b>${usd.format(l.fdv)}</b></div>
      <div><small>Mínimo</small><b>${usd.format(l.min)}</b></div>
      <div><small>Tope por cartera</small><b>${usd.format(l.walletCap)}</b></div>
      <div><small>Abre</small><b>${dateFmt.format(l.openAt)}</b></div>
      <div><small>Cierra</small><b>${dateFmt.format(l.closeAt)}</b></div>
      <p>${esc(l.blurb)}</p>`;
    const form = document.createElement('form');
    form.className = 'lp-contrib';
    if (l.phase !== 'live') {
      form.innerHTML = `<p class="lp-contrib-note">${l.phase === 'soon' ? 'La ventana aún no ha abierto.' : 'La ventana está cerrada.'}${mine ? ` Tienes ${usd2.format(mine)} en este lanzamiento.` : ''}</p>`;
    } else if (!state.session) {
      form.innerHTML = `<p class="lp-contrib-note">Para aportar, entra con tu wallet.</p><button type="button" class="lp-btn lp-btn-primary lp-btn-sm" data-connect>Conectar wallet</button>`;
    } else {
      form.innerHTML = `
        <label>Aportación (USDC)<input class="lp-input" name="amount" type="number" min="1" max="${Math.min(left, room)}" step="1" value="${Math.min(100, left, room) || ''}" inputmode="decimal" required></label>
        <button type="submit" class="lp-btn lp-btn-primary lp-btn-sm" ${left <= 0 || room <= 0 ? 'disabled' : ''}>Aportar como ${short(state.session.address)}</button>
        <p class="lp-contrib-note">Recibes ${esc(l.tick)} a ${price(l.price)}. Te quedan ${usd2.format(left)} de tope en este lanzamiento${mine ? ` (ya tienes ${usd2.format(mine)})` : ''}. Quedan ${usd.format(room)} hasta el objetivo.</p>
        <p class="lp-contrib-err" hidden></p>`;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (state.busy) return;
        const amount = Number(new FormData(form).get('amount'));
        const err = $('.lp-contrib-err', form);
        err.hidden = true;
        if (!(amount > 0)) { err.textContent = 'Pon una cantidad.'; err.hidden = false; return; }
        contribute(l, amount, err);
      });
    }
    d.appendChild(form);
    return d;
  }

  function renderCalendar() {
    const soon = state.launches.filter((l) => l.phase === 'soon').sort((a, b) => a.openAt - b.openAt).slice(0, 8);
    const done = state.launches.filter((l) => l.phase === 'done').sort((a, b) => b.closeAt - a.closeAt).slice(0, 8);
    const fill = (host, list, when) => {
      if (!host) return;
      host.innerHTML = '';
      if (!list.length) { host.innerHTML = '<li class="lp-empty">Nada por aquí.</li>'; return; }
      for (const l of list) {
        const li = document.createElement('li');
        li.appendChild(logoEl(l, 30));
        li.insertAdjacentHTML('beforeend', `<span class="n"><b>${esc(l.tick)}</b><small>${esc(l.name)} · ${esc(l.pair)}</small></span><span class="d">${when(l)}</span>`);
        host.appendChild(li);
      }
    };
    fill($('#cal-soon'), soon, (l) => `${dateFmt.format(l.openAt)}<br>${closeText(l)}`);
    fill($('#cal-done'), done, (l) => `${dateFmt.format(l.closeAt)}<br>${l.outcome === 'ok' ? usd.format(l.raised) + ' · objetivo' : usd.format(l.raised) + ' · devuelto'}`);
  }

  function renderCalc() {
    const sel = $('#calc-launch');
    if (!sel) return;
    const keep = sel.value;
    sel.innerHTML = state.launches.filter((l) => l.phase !== 'done').map((l) => `<option value="${l.id}">${esc(l.tick)} — ${esc(l.name)} (${esc(l.pair)})</option>`).join('');
    if (keep && state.launches.some((l) => l.id === keep && l.phase !== 'done')) sel.value = keep;
    calc();
  }
  function calc() {
    const l = state.launches.find((x) => x.id === $('#calc-launch')?.value);
    const amt = Number($('#calc-amount')?.value) || 0;
    if (!l) return;
    const tokens = amt / l.price;
    $('#calc-price').textContent = price(l.price);
    $('#calc-tokens').textContent = `${num.format(Math.floor(tokens))} ${l.tick}`;
    $('#calc-share').textContent = pct(tokens / l.supply, 4);
    $('#calc-goal').textContent = pct(amt / l.goal, 2);
    $('#calc-cap').textContent = amt > l.walletCap ? `Supera el tope de ${usd.format(l.walletCap)} por cartera` : `Dentro del tope de ${usd.format(l.walletCap)}`;
  }

  function renderQuotes() {
    renderTape();
    $$('.lp-pair small').forEach((s) => { const id = s.closest('.lp-row')?.dataset.id; const l = state.launches.find((x) => x.id === id); if (l) s.innerHTML = quoteHtml(l); });
    const fq = $('.lp-feature-quote'); const fl = fq && state.launches.find((l) => l.name === $('#feature h3')?.textContent);
    if (fq && fl) fq.innerHTML = quoteHtml(fl);
    const at = $('#quotes-at');
    if (at) at.textContent = state.quotesAt ? `Cotizaciones de ${dateFmt.format(state.quotesAt)}, con retraso de mercado.` : 'Cotizaciones no disponibles ahora mismo.';
  }

  function renderWallet() {
    const b = $('#wallet');
    if (!b) return;
    b.disabled = state.busy;
    if (state.session) { b.textContent = short(state.session.address); b.title = 'Salir'; b.classList.add('is-in'); }
    else { b.textContent = state.busy ? 'Firmando…' : 'Conectar wallet'; b.title = ''; b.classList.remove('is-in'); }
  }

  function render() {
    renderStats(); renderTape(); renderFeature(); renderRows(); renderCalendar(); renderCalc(); renderWallet();
  }

  /* ---------- reloj: los contadores bajan cada segundo, las fases se recalculan en el servidor ---------- */
  setInterval(() => {
    const t = now();
    let flip = false;
    for (const l of state.launches) {
      if ((l.phase === 'soon' && t >= l.openAt) || (l.phase === 'live' && t >= l.closeAt)) flip = true;
    }
    if (flip) { loadLaunches().catch(() => {}); return; }
    $$('[data-countdown-row]').forEach((el) => { const l = state.launches.find((x) => x.id === el.dataset.countdownRow); if (l) el.textContent = closeText(l); });
    $$('[data-countdown]').forEach((el) => { const l = state.launches.find((x) => x.id === el.dataset.countdown); if (l) el.textContent = closeText(l).replace(/^(cierra|abre) en /, ''); });
  }, 1000);
  setInterval(() => loadLaunches().catch(() => {}), 30 * 1000);
  setInterval(loadQuotes, 60 * 1000);

  /* ---------- eventos ---------- */
  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) {
      const id = open.dataset.open;
      state.open = state.open === id && open.tagName === 'BUTTON' ? null : id;
      renderRows();
      if (open.tagName === 'A') setTimeout(() => $(`.lp-row[data-id="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
      return;
    }
    if (e.target.closest('[data-connect]')) { connect(); return; }
    const seg = e.target.closest('.lp-seg button');
    if (seg) {
      $$('button', seg.parentElement).forEach((b) => b.classList.toggle('is-on', b === seg));
      if (seg.dataset.phase) state.phase = seg.dataset.phase;
      if (seg.dataset.cat) state.cat = seg.dataset.cat;
      renderRows();
    }
  });
  $('#q')?.addEventListener('input', (e) => { state.q = e.target.value; renderRows(); });
  $('#sort')?.addEventListener('change', (e) => { state.sort = e.target.value; renderRows(); });
  $('#calc-launch')?.addEventListener('change', calc);
  $('#calc-amount')?.addEventListener('input', calc);
  $('#wallet')?.addEventListener('click', () => { if (state.session) { if (confirm('¿Salir de esta cartera?')) signOut(); } else connect(); });

  /* ---------- tema, menú, aparición, año ---------- */
  const root = document.documentElement;
  const themeBtn = $('#theme');
  function applyTheme(t) { root.dataset.theme = t; if (themeBtn) themeBtn.textContent = t === 'light' ? '☾' : '☀'; try { localStorage.setItem(THEME_KEY, t); } catch {} }
  let saved = null; try { saved = localStorage.getItem(THEME_KEY); } catch {}
  applyTheme(saved || 'dark');
  themeBtn?.addEventListener('click', () => applyTheme(root.dataset.theme === 'light' ? 'dark' : 'light'));

  const burger = $('#burger'), links = $('#navlinks');
  burger?.addEventListener('click', () => { const open = links.classList.toggle('is-open'); burger.setAttribute('aria-expanded', String(open)); });
  links?.addEventListener('click', (e) => { if (e.target.tagName === 'A') { links.classList.remove('is-open'); burger?.setAttribute('aria-expanded', 'false'); } });

  const risers = $$('.lp-rise');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (risers.length && !still && 'IntersectionObserver' in window) {
    $('.lp-root')?.classList.add('lp-js');
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    risers.forEach((el) => io.observe(el));
  }
  const year = $('#year'); if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- arranque ---------- */
  restoreSession();
  renderWallet();
  loadLaunches().then(loadMine).then(renderRows).catch(() => {
    $('#rows').innerHTML = ''; $('#empty').hidden = false;
    $('#empty').textContent = 'No se pudo hablar con el servidor. Arráncalo con `npm start` y recarga.';
    $('#feature').innerHTML = '<p class="lp-empty">Servidor no disponible.</p>';
  });
  loadQuotes();
})();
