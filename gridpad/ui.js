/* The register, as a table you can sort and search.
 *
 * One rule this page keeps: the green mark on a row says the capacity and the
 * coordinates are as the named body published them, and links there. It is not
 * a claim that anyone verified, endorsed or has any opinion about a coin.
 * Wearing somebody else's verification mark is the oldest trick there is, and
 * a register whose whole point is being checkable cannot also do that.
 */
const CLASSES = ["Hydro", "Wind", "Solar", "Geothermal"];
const TINT = { Hydro: "var(--hydro)", Wind: "var(--wind)", Solar: "var(--solar)", Geothermal: "var(--geo)" };
const WASH = { Hydro: "#e8f1fa", Wind: "#e5f5ef", Solar: "#fbf2dd", Geothermal: "#fbeee8" };

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Column widths are a real constraint and "United States of America" is not a
 * country so much as a paragraph. */
const SHORT = { "United States of America": "United States", "United Kingdom": "UK",
                "Russian Federation": "Russia", "Korea, Republic of": "South Korea",
                "Iran (Islamic Republic of)": "Iran", "Viet Nam": "Vietnam" };
const place = p => SHORT[p.l] || p.l;

const mw = n => n >= 1000
  ? `${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} <small>GW</small>`
  : `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} <small>MW</small>`;

const coords = g => `${Math.abs(g[0]).toFixed(3)}° ${g[0] >= 0 ? "N" : "S"}, `
                  + `${Math.abs(g[1]).toFixed(3)}° ${g[1] >= 0 ? "E" : "W"}`;

/* A reader recognises eia.gov; the source field is often a ministry's full
 * legal name, which tells them nothing they can act on. */
function host(p) {
  try {
    const h = new URL(p.url).hostname.replace(/^www\d?\./, "");
    return h.length <= 24 ? h : p.src;
  } catch (_) { return p.src; }
}

/* No logos exist for power stations, so each class draws its own: water over a
 * wall, three blades, a disc with rays, ground with heat coming off it. */
function mark(c) {
  const s = { stroke: TINT[c], "stroke-width": 1.7, fill: "none",
              "stroke-linecap": "round", "stroke-linejoin": "round" };
  const a = Object.entries(s).map(([k, v]) => `${k}="${v}"`).join(" ");
  const art = {
    Hydro: `<path d="M4 6v12" ${a}/><path d="M4 9h9a5 5 0 0 1 0 0" ${a}/>
            <path d="M4.5 12c3 0 3 3 6 3s3-3 6-3 3 3 6 3" ${a}/>`,
    Wind: `<circle cx="12" cy="12" r="1.6" ${a}/><path d="M12 10.4V4m1.4 3.5L18.6 15M10.6 13 5.4 15"
            ${a}/><path d="M12 13.6V21" ${a}/>`,
    Solar: `<circle cx="12" cy="12" r="3.9" ${a}/><path d="M12 3.4v2M12 18.6v2M3.4 12h2M18.6 12h2
            M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" ${a}/>`,
    Geothermal: `<path d="M3 19h18" ${a}/><path d="M8 15c0-2 2-2.4 2-4.4S8 8 8 6m4 9c0-2.4 2.4-2.8
            2.4-5.2S12 6 12 4m4 11c0-2 2-2.4 2-4.4" ${a}/>`,
  }[c];
  return `<span class="mark" style="background:${WASH[c]}">
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">${art}</svg></span>`;
}

const OUT = `<svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
  <path d="M4 2h6v6M10 2 3 9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
const TICK = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M3.2 8.4 6.4 11.6 12.8 4.8" stroke="currentColor" stroke-width="2.2"
        stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const BIGGEST = Math.max(...PLANTS.map(p => p.mw));

function row(p) {
  /* The rail is the same idea as a price range on a vaults table: a number you
     can compare down a column without reading any of them. */
  const at = Math.max(2, Math.min(98, (p.mw / BIGGEST) * 100));
  return `<tr>
    <td><span class="who">${mark(p.c)}<span>
      <b>${esc(p.n)}</b>
      <span class="pair">${esc(p.t)} · ${esc(place(p))}</span>
    </span></span></td>
    <td class="hide-s"><span class="chip"><span class="dot" style="background:${TINT[p.c]}"></span>${p.c}</span></td>
    <td class="r num">${mw(p.mw)}${p.y ? `<div class="pair" style="text-align:right">since ${p.y}</div>` : ""}</td>
    <td class="hide-l"><span class="rail"><span class="end">0</span>
      <span class="track"><i style="left:${at}%;background:${TINT[p.c]}"></i></span>
      <span class="end">${(BIGGEST / 1000).toFixed(1)} GW</span></span></td>
    <td class="hide-l" style="font-size:12.5px;color:var(--ink-2)">${
      p.o ? esc(p.o) : '<span style="color:var(--ink-3)">not recorded</span>'}</td>
    <td><a class="src" href="${esc(p.url)}" target="_blank" rel="noopener nofollow"
      title="Capacity and coordinates as published by ${esc(p.src)}. Opens the source.">
      ${TICK}Source <span class="host">${esc(host(p))}</span>${OUT}</a></td>
    <td class="r"><a class="btn ghost sm" href="launch.html?source=${esc(p.t)}">Pair</a></td>
  </tr>`;
}

/* ---------------- the address in the bar ----------------
 *
 * One published address, the same for every visitor, and empty until there is
 * a token. Clicking it copies the whole thing: an address in a header is there
 * to be taken, not read, and an elided one is useless to paste anywhere.
 */
const SITE_CA = {
  address: "",
  explorer: "https://robinhoodchain.blockscout.com",
};

function drawCa() {
  const host = $("ca");
  if (!host) return;
  const a = SITE_CA.address;
  if (!a) {
    host.classList.add("waiting");
    host.innerHTML = `<span class="tag">CA</span><span class="addr" style="color:var(--ink-3)">pending</span>`;
    return;
  }
  const short = `${a.slice(0, 6)}…${a.slice(-4)}`;
  host.innerHTML = `<span class="tag">CA</span><span class="addr">${esc(short)}</span>
    <button type="button" data-copy="${esc(a)}" title="Copy ${esc(a)}">
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor"
           stroke-width="1.4"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/>
        <path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1"/></svg>
      <span class="sr">Copy the contract address</span></button>`;
}

function wireCopy() {
  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const text = btn.getAttribute("data-copy");
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      /* No clipboard permission, or an insecure origin: select it instead, so
         it can still be copied by hand rather than read off the screen. */
      const f = document.createElement("textarea");
      f.value = text; f.style.position = "fixed"; f.style.opacity = "0";
      document.body.appendChild(f); f.select();
      try { document.execCommand("copy"); } catch (__) {}
      f.remove();
    }
    const pill = btn.closest(".ca");
    const label = pill && pill.querySelector(".addr");
    if (label && !label.dataset.was) {
      label.dataset.was = label.textContent;
      label.textContent = "Copied";
      pill.classList.add("done");
      setTimeout(() => {
        label.textContent = label.dataset.was;
        delete label.dataset.was;
        pill.classList.remove("done");
      }, 1200);
    }
  });
}

const state = { q: "", cls: "Any", sort: "mw" };

function draw() {
  const q = state.q.trim().toLowerCase();
  let rows = PLANTS.filter(p =>
    (state.cls === "Any" || p.c === state.cls) &&
    (!q || `${p.n} ${p.l} ${p.t} ${p.o || ""}`.toLowerCase().includes(q)));

  rows.sort(state.sort === "mw" ? (a, b) => b.mw - a.mw
    : state.sort === "y" ? (a, b) => (b.y || 0) - (a.y || 0)
    : (a, b) => String(a[state.sort]).localeCompare(String(b[state.sort])));

  $("rows").innerHTML = rows.length ? rows.map(row).join("")
    : `<tr><td colspan="7" class="empty">Nothing in the register matches that.</td></tr>`;
  $("count").textContent = rows.length === PLANTS.length
    ? `${PLANTS.length} stations · capacity as published, not measured here`
    : `${rows.length} of ${PLANTS.length} stations`;
}

function boot() {
  const total = PLANTS.reduce((a, p) => a + p.mw, 0);
  $("stats").innerHTML = `
    <div><dt>Stations in the register</dt><dd>${PLANTS.length}</dd>
      <p class="note" style="margin:0">Seven of each class</p></div>
    <div><dt>Countries</dt><dd>${new Set(PLANTS.map(p => p.l)).size}</dd>
      <p class="note" style="margin:0">On five continents</p></div>
    <div><dt>Installed capacity</dt><dd>${(total / 1000).toFixed(1)} <small>GW</small></dd>
      <p class="note" style="margin:0">As published by their operators</p></div>
    <div><dt>Rows carrying a source</dt><dd>${PLANTS.filter(p => p.url).length} <small>of ${PLANTS.length}</small></dd>
      <p class="note" style="margin:0">Linked, so you can check it</p></div>`;
  /* .note is grey and small on the page; inside the dark band it needs the
     band's own muted colour instead. */
  document.querySelectorAll(".stats .note").forEach(n => {
    n.style.color = "rgba(234,241,238,.45)"; n.style.fontSize = "11.5px";
  });

  $("note").innerHTML =
    `Every figure here comes from the ${esc(ATTRIBUTION)}. The mark on a row means the capacity `
    + `and the coordinates are as that source published them, and links there. It is not an `
    + `endorsement: no exchange, launchpad or operator has verified, approved or has any opinion `
    + `about a coin launched through this site.`;

  drawCa();
  wireCopy();
  $("q").addEventListener("input", e => { state.q = e.target.value; draw(); });
  $("f-class").addEventListener("change", e => { state.cls = e.target.value; draw(); });
  $("f-sort").addEventListener("change", e => { state.sort = e.target.value; draw(); });
  draw();
}
document.addEventListener("DOMContentLoaded", boot);
