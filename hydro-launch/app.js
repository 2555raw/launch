/* Runtime de Hydro. Sin backend: el mercado se simula en el navegador y los
 * lanzamientos se guardan en localStorage. data.js define WATER y BASE_LEVEL.
 */

const KEY = "hydro.v1";
const TICK = 5000;          // ms entre refrescos del mercado
const FEE = 0.03;           // comisión del creador que va a la bóveda
const CURVE_TARGET = 4.2;   // ETH simulados para graduar la curva

/* ---------------- acceso al catálogo ---------------- */

function byTicker(t) { return WATER.find(w => w.t === t); }
function mk(t) { return S.market[t]; }

/* ---------------- estado ---------------- */

let S = loadState();

function loadState() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
  const base = {
    tick: 0,
    launches: [],
    market: {},
    started: Date.now(),
  };
  const s = Object.assign(base, saved || {});
  for (const w of WATER) {
    const m = s.market[w.t];
    if (!m || !Array.isArray(m.h) || typeof m.p !== "number") {
      s.market[w.t] = { p: w.p, l: BASE_LEVEL[w.t] ?? .5, h: seedHistory(w.p) };
    }
  }
  s.launches = (s.launches || []).filter(l => l && l.symbol && byTicker(l.pair));
  return s;
}

function seedFlat(p) {
  const out = [];
  for (let i = 0; i < 18; i++) out.push(p * (1 + (Math.random() - 0.5) * 0.004));
  out.push(p);
  return out;
}

function seedHistory(p) {
  const out = [];
  let v = p * (0.93 + Math.random() * 0.1);
  for (let i = 0; i < 28; i++) { v *= 1 + (Math.random() - 0.48) * 0.018; out.push(v); }
  out.push(p);
  return out;
}

function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} }

/* ---------------- mercado ---------------- */

function stepMarket() {
  S.tick++;
  for (const w of WATER) {
    const m = mk(w.t);
    // el nivel deriva despacio y tira del precio: menos agua, spot más caro
    const drift = (Math.random() - 0.5) * 0.012 + (0.5 - m.l) * 0.0006;
    m.l = clamp(m.l + drift, 0.02, 1);
    const scarcity = 1 + (0.5 - m.l) * 0.02;
    m.p = Math.max(0.01, m.p * (1 + (Math.random() - 0.495) * 0.01) * scarcity);
    m.h.push(m.p);
    if (m.h.length > 60) m.h.shift();
  }
  for (const l of S.launches) repriceLaunch(l);
  save();
}

function repriceLaunch(l) {
  const m = mk(l.pair);
  if (!m) return;
  const ratio = m.p / l.spot0;
  l.prev = l.price;
  // el token hereda el spot de su fuente, amplificado por la curva ya recorrida
  l.price = l.price0 * Math.pow(ratio, l.beta) * (1 + l.raised / CURVE_TARGET * 0.65);
  l.h = l.h || [];
  l.h.push(l.price);
  if (l.h.length > 60) l.h.shift();
}

function marketCapEth(l) { return l.price * l.supply; }

/* ---------------- lanzamientos ---------------- */

/* Precio de apertura: la cap. inicial ronda el 40% del objetivo de curva, y sube
 * cuanto menos llena esté la fuente — el agua escasa abre más cara. */
function openPrice(supply, level) {
  return (CURVE_TARGET * 0.4 / Math.max(supply, 1)) * (1 + (1 - level) * 0.5);
}

function createLaunch({ name, symbol, pair, supply, beta, creatorFee }) {
  const w = byTicker(pair), m = mk(pair);
  if (!w || !m) return null;
  const price0 = openPrice(supply, m.l);
  const l = {
    id: `${symbol}-${Date.now().toString(36)}`,
    name, symbol, pair, supply, beta, creatorFee,
    spot0: m.p,
    level0: m.l,
    price0, price: price0, prev: price0,
    raised: 0, vault: 0, trades: 0,
    by: fakeAddr(), contract: fakeAddr(),
    at: Date.now(),
    h: seedFlat(price0),
  };
  S.launches.unshift(l);
  save();
  return l;
}

function trade(id, dir, sizeEth) {
  const l = S.launches.find(x => x.id === id);
  if (!l) return null;
  const fee = sizeEth * FEE;
  l.vault += fee;
  l.raised = clamp(l.raised + dir * (sizeEth - fee), 0, CURVE_TARGET);
  l.trades++;
  repriceLaunch(l);
  save();
  return l;
}

const stageOf = l => l.raised >= CURVE_TARGET
  ? { label: "Graduado · pool abierta", cls: "ok" }
  : { label: `Curva · ${Math.round(l.raised / CURVE_TARGET * 100)}%`, cls: "" };

function fakeAddr() {
  const hex = "0123456789abcdefABCDEF";
  let s = "0x";
  for (let i = 0; i < 40; i++) s += hex[Math.floor(Math.random() * hex.length)];
  return s;
}
const shortAddr = a => `${a.slice(0, 6)}…${a.slice(-4)}`;

/* ---------------- formato ---------------- */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function usd(v) {
  const d = v >= 1000 ? 2 : v >= 1 ? 2 : 4;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function eth(v) { return `${v.toFixed(v >= 1 ? 3 : 4)} ETH`; }
function pct(v) { return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`; }
function level(v) { return `${Math.round(v * 100)}%`; }

function ago(ts) {
  const s = Math.max(1, (Date.now() - ts) / 1000);
  if (s < 60) return `hace ${Math.floor(s)}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
  return `hace ${Math.floor(s / 86400)}d`;
}

function change7d(h) {
  if (!h || h.length < 2) return 0;
  const a = h[Math.max(0, h.length - 14)], b = h[h.length - 1];
  return (b - a) / a;
}

function spark(h, color) {
  const pts = (h || []).slice(-24);
  if (pts.length < 2) return `<svg class="spark" viewBox="0 0 78 26"></svg>`;
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${(i / (pts.length - 1) * 76 + 1).toFixed(1)} ${(24 - (p - lo) / span * 21).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 78 26" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

const CLASS_TINT = { "Embalse": "#4f46e5", "Acuífero": "#0e9f9f", "Glaciar": "#3b82f6", "Desalación": "#7c5cff" };

function dropGlyph(t, size = 22) {
  const w = byTicker(t);
  const c = CLASS_TINT[w ? w.c : "Embalse"] || "#4f46e5";
  const lvl = mk(t) ? mk(t).l : .5;
  const y = 21 - lvl * 13;
  const uid = `c${t}`;
  return `<svg width="${size}" height="${size * 1.12}" viewBox="0 0 20 22" aria-hidden="true">
    <defs><clipPath id="${uid}"><path d="M10 1C10 1 3 9.4 3 14a7 7 0 0 0 14 0C17 9.4 10 1 10 1Z"/></clipPath></defs>
    <path d="M10 1C10 1 3 9.4 3 14a7 7 0 0 0 14 0C17 9.4 10 1 10 1Z" fill="none" stroke="${c}" stroke-width="1.3"/>
    <rect x="0" y="${y.toFixed(1)}" width="20" height="22" fill="${c}" opacity=".85" clip-path="url(#${uid})"/>
  </svg>`;
}

let toastTimer;
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 2600);
}

const qs = k => new URLSearchParams(location.search).get(k);

/* ---------------- ticker ---------------- */

function renderTape() {
  const host = document.getElementById("tape");
  if (!host) return;
  const row = WATER.map(w => {
    const m = mk(w.t), ch = change7d(m.h);
    return `<span class="tape-item">${dropGlyph(w.t, 13)}<span class="tk">${w.t}</span>
      <span class="px">${usd(m.p)}</span>
      <span class="${ch >= 0 ? "up" : "down"}">${pct(ch)}</span></span>`;
  }).join("");
  host.innerHTML = `<div class="tape-track">${row}${row}</div>`;
}

/* ---------------- tablas compartidas ---------------- */

function boardRows(list, opts = {}) {
  return list.map((w, i) => {
    const m = mk(w.t), ch = change7d(m.h);
    const lc = m.l < .3 ? "low" : m.l < .55 ? "mid" : "";
    return `<tr>
      <td class="idx">${String(i + 1).padStart(2, "0")}</td>
      <td>
        <div class="asset">
          <span class="glyph">${dropGlyph(w.t)}</span>
          <span><b>${esc(w.n)}</b><small>${w.t} · ${esc(w.c)}</small></span>
        </div>
      </td>
      <td class="hide-s mono">${esc(w.v)}</td>
      <td class="hide-xs"><span class="pill">${esc(w.a)}</span></td>
      <td class="hide-s">
        <div class="level ${lc}"><div class="bar"><i style="width:${(m.l * 100).toFixed(0)}%"></i></div><span>llenado ${level(m.l)}</span></div>
      </td>
      <td class="num spot"><b>${usd(m.p)}</b><small class="sub">${esc(w.u)}</small></td>
      <td class="num hide-xs">${spark(m.h, ch >= 0 ? "#12a150" : "#e5484d")}<span class="${ch >= 0 ? "up" : "down"}" style="font-size:12.5px">${pct(ch)}</span></td>
      ${opts.action ? `<td class="num nowrap"><a class="btn alt sm" href="launch.html?pair=${w.t}">Parear</a></td>` : ""}
    </tr>`;
  }).join("");
}

/* ---------------- páginas ---------------- */

const PAGES = {

  markets() {
    const refresh = () => {
      const list = [...WATER].sort((a, b) => mk(b.t).p - mk(a.t).p).slice(0, 10);
      document.getElementById("board").innerHTML = boardRows(list, { action: true });
      const levels = WATER.reduce((s, w) => s + mk(w.t).l, 0) / WATER.length;
      setText("stat-sources", WATER.length);
      setText("stat-classes", CLASSES.length);
      setText("stat-level", level(levels));
      setText("stat-launches", S.launches.length);
      renderTape();
    };
    refresh();
    setInterval(() => { stepMarket(); refresh(); }, TICK);
  },

  launches() {
    const refresh = () => {
      const host = document.getElementById("launch-rows");
      const foot = document.getElementById("launch-count");
      if (!S.launches.length) {
        host.innerHTML = `<tr><td colspan="8"><p class="empty">Todavía no hay ningún token pareado desde este navegador.<br>
          <a href="launch.html" style="color:var(--accent)">Parea una fuente de agua</a> para abrir el primero.</p></td></tr>`;
      } else {
        host.innerHTML = S.launches.map((l, i) => {
          const w = byTicker(l.pair), st = stageOf(l);
          return `<tr>
            <td class="idx">${String(i + 1).padStart(2, "0")}</td>
            <td><div class="asset"><span class="glyph">${dropGlyph(l.pair)}</span>
              <span><b><a href="token.html?id=${encodeURIComponent(l.id)}">${esc(l.name)}</a></b><small>$${esc(l.symbol)}</small></span></div></td>
            <td><b style="font-size:14px">${esc(w.n)}</b><small class="sub">${w.t} · ${esc(w.v)}</small></td>
            <td class="hide-s mono" style="font-size:12.5px;color:var(--ink-2)">${ago(l.at)}</td>
            <td class="hide-xs mono" style="font-size:12.5px;color:var(--ink-2)">${shortAddr(l.by)}</td>
            <td class="hide-xs mono" style="font-size:12.5px;color:var(--ink-2)">${shortAddr(l.contract)}</td>
            <td><span class="pill ${st.cls}"><span class="dot"></span>${st.label}</span></td>
            <td class="num mono">${eth(marketCapEth(l))}</td>
          </tr>`;
        }).join("");
      }
      foot.textContent = `${S.launches.length} ${S.launches.length === 1 ? "lanzamiento" : "lanzamientos"}`;
      setText("l-count", S.launches.length);
      setText("l-paired", new Set(S.launches.map(l => l.pair)).size);
      setText("l-graduated", S.launches.filter(l => l.raised >= CURVE_TARGET).length);
      setText("l-latest", S.launches.length ? ago(S.launches[0].at) : "—");
      renderTape();
    };
    refresh();
    setInterval(() => { stepMarket(); refresh(); }, TICK);
  },

  sources() {
    let filter = "Todas", sort = "destacadas", q = "";
    const rows = () => {
      let list = WATER.filter(w => filter === "Todas" || w.c === filter);
      if (q) {
        const n = q.toLowerCase();
        list = list.filter(w => (w.n + w.t + w.v + w.c).toLowerCase().includes(n));
      }
      if (sort === "precio") list.sort((a, b) => mk(b.t).p - mk(a.t).p);
      else if (sort === "llenado") list.sort((a, b) => mk(a.t).l - mk(b.t).l);
      else if (sort === "nombre") list.sort((a, b) => a.n.localeCompare(b.n));
      document.getElementById("source-rows").innerHTML = list.length
        ? boardRows(list, { action: true })
        : `<tr><td colspan="8"><p class="empty">Ninguna fuente coincide con la búsqueda.</p></td></tr>`;
      setText("source-count", `${list.length} de ${WATER.length} fuentes`);
    };
    document.querySelectorAll("[data-class]").forEach(btn => btn.addEventListener("click", () => {
      document.querySelectorAll("[data-class]").forEach(b => b.classList.toggle("on", b === btn));
      filter = btn.dataset.class; rows();
    }));
    document.getElementById("search").addEventListener("input", e => { q = e.target.value; rows(); });
    document.getElementById("sort").addEventListener("change", e => { sort = e.target.value; rows(); });
    rows();
    setInterval(() => { stepMarket(); rows(); renderTape(); }, TICK);
  },

  launch() {
    const form = document.getElementById("pair-form");
    const sel = form.pair;
    sel.innerHTML = CLASSES.map(c => `<optgroup label="${c}">` +
      WATER.filter(w => w.c === c).map(w => `<option value="${w.t}">${esc(w.n)} — ${w.t} · ${esc(w.v)}</option>`).join("") +
      `</optgroup>`).join("");
    const pre = qs("pair");
    if (pre && byTicker(pre)) sel.value = pre;

    const refresh = () => {
      const w = byTicker(sel.value), m = mk(sel.value);
      const supply = Math.max(1000, +form.supply.value || 0);
      const beta = +form.beta.value;
      const price0 = openPrice(supply, m.l);
      setText("beta-out", `${beta.toFixed(1)}×`);
      document.getElementById("pair-summary").innerHTML = `
        <div class="line"><span>fuente</span><b>${esc(w.n)} · ${w.t}</b></div>
        <div class="line"><span>registro</span><b>${esc(w.v)}</b></div>
        <div class="line"><span>ensayo</span><b>${esc(w.a)}</b></div>
        <div class="line"><span>spot heredado</span><b>${usd(m.p)} ${esc(w.u)}</b></div>
        <div class="line"><span>llenado actual</span><b>${level(m.l)}</b></div>
        <div class="line"><span>precio de apertura</span><b>${price0.toExponential(3)} ETH</b></div>
        <div class="line"><span>cap. de apertura</span><b>${eth(price0 * supply)}</b></div>
        <div class="line"><span>comisión del creador</span><b>${(FEE * 100).toFixed(0)}% → bóveda</b></div>
        <div class="line"><span>gradúa en</span><b>${CURVE_TARGET} ETH de curva</b></div>`;
      document.getElementById("preview-glyph").innerHTML = dropGlyph(w.t, 44);
    };
    form.addEventListener("input", refresh);
    refresh();
    setInterval(() => { stepMarket(); refresh(); }, TICK);

    form.addEventListener("submit", e => {
      e.preventDefault();
      const symbol = form.symbol.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      if (!symbol) return toast("El ticker necesita al menos una letra");
      if (S.launches.some(l => l.symbol === symbol)) return toast(`$${symbol} ya está lanzado`);
      const l = createLaunch({
        name: form.name.value.trim() || symbol,
        symbol,
        pair: sel.value,
        supply: Math.max(1000, +form.supply.value || 1000),
        beta: +(+form.beta.value).toFixed(1),
        creatorFee: FEE,
      });
      location.href = `token.html?id=${encodeURIComponent(l.id)}&new=1`;
    });
  },

  token() {
    const id = qs("id");
    const l = S.launches.find(x => x.id === id);
    const host = document.getElementById("token-view");
    if (!l) {
      host.innerHTML = `<p class="empty">Ese token no existe en este navegador.
        <a href="launches.html" style="color:var(--accent)">Ver los lanzamientos</a>.</p>`;
      return;
    }
    if (qs("new")) toast(`$${l.symbol} pareado con ${byTicker(l.pair).n}`);

    const refresh = () => {
      const w = byTicker(l.pair), m = mk(l.pair), st = stageOf(l);
      const ch = l.prev ? (l.price - l.prev) / l.prev : 0;
      document.title = `$${l.symbol} — Hydro`;
      host.innerHTML = `
        <div class="detail-head">
          <span class="glyph">${dropGlyph(l.pair, 30)}</span>
          <div>
            <h1>${esc(l.name)}</h1>
            <span class="sub">$${esc(l.symbol)} · pareado con ${esc(w.n)} (${w.t}) en ${esc(w.v)}</span>
          </div>
          <span class="pill ${st.cls}" style="margin-left:auto"><span class="dot"></span>${st.label}</span>
        </div>
        <div class="detail-grid" style="margin-top:26px">
          <div class="panel">
            <div class="panel-head">
              <div><h3>${l.price.toFixed(8)} ETH <span class="${ch >= 0 ? "up" : "down"}" style="font-size:14px">${pct(ch)}</span></h3></div>
              <span class="label">precio · en vivo</span>
            </div>
            <div style="padding:18px">${bigChart(l.h)}</div>
            <div class="panel-foot">
              <span>El precio hereda el spot de ${w.t} amplificado ${l.beta}× y sube con la curva.</span>
              <span class="mono">spot ${usd(m.p)}</span>
            </div>
          </div>
          <div style="display:grid;gap:16px">
            <div class="panel">
              <div class="panel-head"><h3>Operar</h3><span class="label">simulado</span></div>
              <div style="padding:18px;display:grid;gap:10px">
                <div style="display:flex;gap:8px">
                  <button class="btn accent" data-buy="0.1" style="flex:1">Comprar 0,1</button>
                  <button class="btn alt" data-sell="0.1" style="flex:1">Vender 0,1</button>
                </div>
                <div style="display:flex;gap:8px">
                  <button class="btn alt sm" data-buy="0.5" style="flex:1">+0,5 ETH</button>
                  <button class="btn alt sm" data-buy="1" style="flex:1">+1 ETH</button>
                </div>
              </div>
              <div class="panel-foot"><span>Cada operación paga ${(FEE * 100).toFixed(0)}% a la bóveda.</span></div>
            </div>
            <div class="panel summary">
              <div class="line"><span>cap. de mercado</span><b>${eth(marketCapEth(l))}</b></div>
              <div class="line"><span>curva</span><b>${l.raised.toFixed(3)} / ${CURVE_TARGET} ETH</b></div>
              <div class="line"><span>bóveda</span><b>${eth(l.vault)}</b></div>
              <div class="line"><span>supply</span><b>${l.supply.toLocaleString("es")}</b></div>
              <div class="line"><span>operaciones</span><b>${l.trades}</b></div>
              <div class="line"><span>llenado de la fuente</span><b>${level(m.l)} (apertura ${level(l.level0)})</b></div>
              <div class="line"><span>creador</span><b>${shortAddr(l.by)}</b></div>
              <div class="line"><span>contrato</span><b>${shortAddr(l.contract)}</b></div>
              <div class="line"><span>lanzado</span><b>${ago(l.at)}</b></div>
            </div>
          </div>
        </div>`;
      host.querySelectorAll("[data-buy],[data-sell]").forEach(b => b.addEventListener("click", () => {
        const buy = b.dataset.buy;
        trade(l.id, buy ? 1 : -1, +(buy || b.dataset.sell));
        refresh();
        toast(buy ? `Compra de ${buy} ETH en $${l.symbol}` : `Venta en $${l.symbol}`);
      }));
    };
    refresh();
    setInterval(() => { stepMarket(); refresh(); }, TICK);
  },
};

function bigChart(h) {
  const pts = (h || []).slice(-60);
  if (pts.length < 2) return `<p class="empty">Sin histórico todavía.</p>`;
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const xy = i => [(i / (pts.length - 1)) * 760 + 10, 220 - ((pts[i] - lo) / span) * 190];
  const line = pts.map((_, i) => { const [x, y] = xy(i); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");
  const area = `${line} L770 230 L10 230 Z`;
  return `<svg class="chart" viewBox="0 0 780 240" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4f46e5" stop-opacity=".18"/><stop offset="1" stop-color="#4f46e5" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#g)"/>
    <path d="${line}" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

/* ---------------- arranque ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  renderTape();
  const reset = document.getElementById("reset");
  if (reset) reset.addEventListener("click", () => {
    localStorage.removeItem(KEY);
    location.reload();
  });
  const page = PAGES[document.body.dataset.page];
  if (page) page();
});
