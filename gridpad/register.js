/* The register, drawn from data.js.
 *
 * The one thing this page is careful about: the badge on each row says what
 * was actually checked — that the capacity and the coordinates are as the
 * named body published them — and links there. It is not a claim that anybody
 * verified, endorsed or has any opinion about a coin. Borrowing somebody
 * else's verification mark for your own tokens is the oldest trick there is,
 * and the point of this register is to be the opposite of that.
 */
const CLASSES = ["Hydro", "Wind", "Solar", "Geothermal"];
const TINT = { Hydro: "var(--hydro)", Wind: "var(--wind)",
               Solar: "var(--solar)", Geothermal: "var(--geo)" };

const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* "United States of America" is a column-width problem, not a country. */
const SHORT = { "United States of America": "United States", "United Kingdom": "UK",
                "Russian Federation": "Russia", "Korea, Republic of": "South Korea" };
const place = p => SHORT[p.l] || p.l;

const mw = n => n >= 1000
  ? `${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} <small>GW</small>`
  : `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} <small>MW</small>`;

const coords = g =>
  `${Math.abs(g[0]).toFixed(4)}° ${g[0] >= 0 ? "N" : "S"}, ` +
  `${Math.abs(g[1]).toFixed(4)}° ${g[1] >= 0 ? "E" : "W"}`;

/* The host of the URL is what a reader recognises — eia.gov, gov.uk — where the
 * source field is often a department's full legal name. */
function publisher(p) {
  try {
    const h = new URL(p.url).hostname.replace(/^www\d?\./, "");
    return h.length <= 26 ? h : p.src;
  } catch (_) { return p.src; }
}

const TICK = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M3.2 8.4 6.4 11.6 12.8 4.8" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const OUT = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
  <path d="M4 2h6v6M10 2 3 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

function row(p) {
  const title = `Capacity and coordinates as published by ${p.src}. Opens the source.`;
  return `<tr>
    <td><span class="tk"><span class="dot" style="background:${TINT[p.c]}"></span>${esc(p.t)}</span></td>
    <td class="where"><b>${esc(p.n)}</b>${esc(place(p))}
      <div class="coords">${coords(p.g)}</div></td>
    <td class="hide-s cap">${mw(p.mw)}${p.y ? `<div class="coords">since ${p.y}</div>` : ""}</td>
    <td class="hide-s op ${p.o ? "" : "none"}">${esc(p.o || "not recorded")}</td>
    <td><a class="src" href="${esc(p.url)}" target="_blank" rel="noopener nofollow"
           title="${esc(title)}">${TICK}<span>Source</span>
      <span class="who">${esc(publisher(p))}</span>${OUT}</a></td>
  </tr>`;
}

let filter = "All";

function draw() {
  const rows = PLANTS.filter(p => filter === "All" || p.c === filter);
  document.getElementById("rows").innerHTML = rows.map(row).join("");
  document.querySelectorAll(".tab").forEach(b =>
    b.classList.toggle("on", b.dataset.c === filter));
}

function boot() {
  const total = PLANTS.reduce((a, p) => a + p.mw, 0);
  document.getElementById("facts").innerHTML = `
    <div><dt>Stations</dt><dd>${PLANTS.length}<small>seven per class</small></dd></div>
    <div><dt>Countries</dt><dd>${new Set(PLANTS.map(p => p.l)).size}<small>on five continents</small></dd></div>
    <div><dt>Installed</dt><dd>${(total / 1000).toFixed(1)}<small>gigawatts, as published</small></dd></div>
    <div><dt>Sourced</dt><dd>${PLANTS.filter(p => p.url).length}/${PLANTS.length}<small>carry a public source</small></dd></div>`;

  document.getElementById("tabs").innerHTML = ["All", ...CLASSES].map(c =>
    `<button class="tab" type="button" data-c="${c}">${c}${
      c === "All" ? "" : ` <span style="opacity:.6">${PLANTS.filter(p => p.c === c).length}</span>`}</button>`).join("");
  document.getElementById("tabs").addEventListener("click", e => {
    const b = e.target.closest(".tab");
    if (b) { filter = b.dataset.c; draw(); }
  });

  document.getElementById("attrib").innerHTML =
    `Every figure on this page comes from the ${esc(ATTRIBUTION)}. ` +
    `The mark on each row means the capacity and the coordinates are as that source published ` +
    `them — nothing on this page is an endorsement by anyone, and no launchpad, exchange or ` +
    `operator has verified, approved or has any opinion about a coin launched here.`;

  draw();
}
document.addEventListener("DOMContentLoaded", boot);
