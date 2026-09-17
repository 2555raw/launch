/* Hydropad's pages. Everything a token does (minting, the curve, the vault)
 * happens in the launcher contract; chain.js is the only thing that talks to it.
 * The water register in data.js is reference data that labels a pairing, not a
 * price feed: a token's price comes from its curve.
 */

/* ---------------- formatting ---------------- */

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byTicker = t => WATER.find(w => w.t === t);
const qs = k => new URLSearchParams(location.search).get(k);
const $ = id => document.getElementById(id);

function usd(v) {
  const d = v >= 1000 ? 2 : v >= 1 ? 2 : 4;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function eth(wei, digits) {
  const n = Number(ethers.formatEther(wei ?? 0n));
  if (n === 0) return "0 " + Chain.chainInfo().ticker;
  const d = digits ?? (n >= 1 ? 3 : n >= 0.001 ? 4 : 6);
  return `${n.toFixed(d)} ${Chain.chainInfo().ticker}`;
}

function tokens(wei) {
  const n = Number(ethers.formatEther(wei ?? 0n));
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}k`;
  return n.toFixed(2);
}

const level = v => `${Math.round(v * 100)}%`;
const shortAddr = a => `${a.slice(0, 6)}…${a.slice(-4)}`;

function ago(ts) {
  const s = Math.max(1, Date.now() / 1000 - ts);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function curvePct(raised) {
  return Math.min(100, Number((raised * 10000n) / CURVE.TARGET) / 100);
}

function stageOf(p) {
  return p.graduated
    ? { label: "Graduated", cls: "ok" }
    : { label: `Curve · ${curvePct(p.raised).toFixed(0)}%`, cls: "" };
}

let toastTimer;
function toast(msg, ms = 3400) {
  let el = $("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), ms);
}

/* A contract that reverts with a custom error says so in four bytes, and a
 * wallet passes those through as opaque data. "Reverted:" with nothing after
 * it is the useless end of that: the chain said exactly what was wrong and the
 * page threw the answer away. These are the ABIs whose errors can reach a
 * visitor, so the name — and any arguments — can be read back out. */
function revertName(e) {
  const data = e?.data ?? e?.info?.error?.data?.data ?? e?.info?.error?.data
    ?? e?.error?.data?.originalError?.data ?? e?.error?.data;
  const hex = typeof data === "string" ? data : data?.data;
  if (typeof hex !== "string" || !/^0x[0-9a-fA-F]{8}/.test(hex)) return null;

  const abis = [];
  if (typeof PONS !== "undefined") abis.push(PONS.FACTORY_ABI, PONS.CURVE_ABI);
  if (typeof HYDROPAD !== "undefined") abis.push(HYDROPAD.Hydropad.abi, HYDROPAD.HydropadToken.abi);
  for (const abi of abis) {
    try {
      const parsed = new ethers.Interface(abi).parseError(hex);
      if (!parsed) continue;
      const args = parsed.args.length ? ` (${parsed.args.map(a => String(a)).join(", ")})` : "";
      return `${parsed.name}${args}`;
    } catch (_) { /* not from this one */ }
  }
  /* Nothing recognised it, but the selector is still more than nothing. */
  return `unrecognised revert ${hex.slice(0, 10)}`;
}

function errText(e) {
  const raw = e?.info?.error?.message || e?.shortMessage || e?.reason || e?.message || String(e);
  if (/user rejected|denied transaction/i.test(raw)) return "Transaction rejected in the wallet.";
  const named = revertName(e);
  if (named) return `Reverted: ${named}`.slice(0, 200);
  return raw.replace(/^execution reverted:?\s*/i, "Reverted: ").slice(0, 200);
}

const CLASS_BLURB = {
  Reservoir: "Rain and snowmelt held behind a wall. The level moves with the season and with what the operator releases.",
  Aquifer: "Water in the pore space of rock. It refills over centuries, so the static level mostly moves one way.",
  Glacier: "Ice as a stock, measured by mass balance: what falls on top against what leaves at the margins.",
  Desalination: "Seawater pushed through membranes. Availability is an engineering figure, not a hydrological one.",
};

const CLASS_TINT = { Reservoir: "#0e7490", Aquifer: "#0f9d76", Glacier: "#3b9fd4", Desalination: "#0b6b7d" };

/* A source shows its photograph when one has been added, and the drawn glyph
 * when it has not. The glyph stays behind the image so a file that fails to
 * decode leaves the row looking deliberate rather than broken. */
/* What to show for a reserve, in order of how real it is: a photograph of that
 * place if one has been given, then a file dropped in media/sources/, then the
 * plate cut from the project's own photography, then the level glyph.
 *
 * The first of those cannot be fetched from the machine that builds this site:
 * every image host it would need is blocked there. It can be fetched by the
 * browser reading this page, which is why a photograph can be added here as a
 * link and kept in this browser until it is put in the repository. */
/* What the register is filtered to. It lives out here so a chain event
 * redrawing the page does not throw away what someone typed. */
const REGISTER = { filter: "All", sort: "featured", q: "" };

const PHOTO_KEY = "hydropad.photos";

function ownPhotos() {
  try { return JSON.parse(localStorage.getItem(PHOTO_KEY) || "{}"); } catch (_) { return {}; }
}

function setOwnPhotos(map) {
  try { localStorage.setItem(PHOTO_KEY, JSON.stringify(map)); } catch (_) {}
}

let OWN = typeof localStorage !== "undefined" ? ownPhotos() : {};

function sourceArt(t) {
  if (OWN[t]) return OWN[t];
  const photo = typeof PHOTOS !== "undefined" ? PHOTOS[t] : null;
  if (photo) return photo;
  return typeof PLATES !== "undefined" ? PLATES[t] || null : null;
}

/* Paste a list of "TICKER https://…" lines and the register uses them. They
 * stay in this browser; the button prints what to paste into photos.js to make
 * them part of the build. */
function wirePhotoDesk() {
  /* Say how many of the register's entries actually have a photograph, rather
   * than a number in the markup that goes stale the next time one is added. */
  const count = $("photo-count");
  if (count) {
    const n = Object.keys(typeof PHOTOS !== "undefined" ? PHOTOS : {}).length;
    const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
                   "Eleven", "Twelve"];
    count.textContent = words[n] || String(n);
  }

  const box = $("photo-desk");
  if (!box || box.dataset.wired === "1") return;
  box.dataset.wired = "1";
  const field = $("photo-input");
  const say = msg => setText("photo-said", msg);

  field.value = Object.entries(OWN).map(([t, u]) => `${t} ${u}`).join("\n");

  $("photo-save").addEventListener("click", () => {
    const map = {};
    let bad = 0;
    for (const line of field.value.split(/\n+/)) {
      const m = line.trim().match(/^([A-Za-z0-9]{1,12})[\s,:]+(\S+)$/);
      if (!m) { if (line.trim()) bad++; continue; }
      const t = m[1].toUpperCase();
      if (!byTicker(t)) { bad++; continue; }
      map[t] = m[2];
    }
    OWN = map;
    setOwnPhotos(map);
    render();
    say(`${Object.keys(map).length} in place${bad ? `, ${bad} line${bad === 1 ? "" : "s"} ignored` : ""}.`);
  });

  $("photo-clear").addEventListener("click", () => {
    OWN = {};
    setOwnPhotos({});
    field.value = "";
    render();
    say("Cleared. Back to the plates.");
  });

  $("photo-export").addEventListener("click", async () => {
    const body = "const PHOTOS = " + JSON.stringify(OWN, null, 2) + ";\n";
    try { await navigator.clipboard.writeText(body); say("Copied. Paste it over photos.js."); }
    catch (_) { field.value = body; say("Copy it from the box and paste it over photos.js."); }
  });
}

function sourceMark(t, size = 22) {
  const photo = sourceArt(t);
  if (!photo) return dropGlyph(t, size);
  const w = byTicker(t);
  return `<img class="photo" src="${esc(photo)}" alt="${esc(w ? w.n : t)}" loading="lazy" decoding="async"
    onload="this.classList.add('ready')"
    onerror="this.replaceWith(document.createRange().createContextualFragment(dropGlyph('${esc(t)}', ${size})))">`;
}

function dropGlyph(t, size = 22) {
  const w = byTicker(t);
  const c = CLASS_TINT[w ? w.c : "Reservoir"] || "#0e7490";
  const lvl = w ? (BASE_LEVEL[t] ?? 0.5) : 0.5;
  const uid = `c${t}-${Math.round(size)}`;
  return `<svg width="${size}" height="${size * 1.12}" viewBox="0 0 20 22" aria-hidden="true">
    <defs><clipPath id="${uid}"><path d="M10 1C10 1 3 9.4 3 14a7 7 0 0 0 14 0C17 9.4 10 1 10 1Z"/></clipPath></defs>
    <path d="M10 1C10 1 3 9.4 3 14a7 7 0 0 0 14 0C17 9.4 10 1 10 1Z" fill="none" stroke="${c}" stroke-width="1.3"/>
    <rect x="0" y="${(21 - lvl * 13).toFixed(1)}" width="20" height="22" fill="${c}" opacity=".85" clip-path="url(#${uid})"/>
  </svg>`;
}

/* ---------------- the pages menu on a small screen ---------------- */

/* The bar cannot hold five links on a phone, so below 900px they live in a
 * sheet under it. It closes on a link, on Escape, on a click outside and on
 * the way back up to a wide window, so it can never be left open and hidden. */
function wireMenu() {
  const btn = document.getElementById("burger");
  const links = document.getElementById("side");
  if (!btn || !links || btn.dataset.wired === "1") return;
  btn.dataset.wired = "1";

  const nav = links.querySelector(".side-nav");
  if (nav) [...nav.children].forEach((a, i) => a.style.setProperty("--i", String(i)));

  const set = open => {
    document.body.classList.toggle("menu-open", open);
    btn.setAttribute("aria-expanded", String(open));
  };
  const isOpen = () => document.body.classList.contains("menu-open");

  btn.addEventListener("click", e => { e.stopPropagation(); set(!isOpen()); });
  links.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && isOpen()) { set(false); btn.focus(); } });
  document.addEventListener("click", e => {
    if (isOpen() && !links.contains(e.target) && e.target !== btn) set(false);
  });
  const wide = window.matchMedia("(min-width: 901px)");
  wide.addEventListener("change", e => { if (e.matches) set(false); });
}

/* Where a reserve is, written so it can be checked. The link opens the place in
 * satellite view, which is the quickest way for anyone to see whether the
 * register is telling the truth about it. */
function coordText(g) {
  const [lat, lon] = g;
  return `${Math.abs(lat).toFixed(4)}\u00b0 ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}\u00b0 ${lon >= 0 ? "E" : "W"}`;
}

function mapLink(g, zoom = "3000m") {
  return `https://www.google.com/maps/@${g[0]},${g[1]},${zoom}/data=!3m1!1e3`;
}

function coordTag(w, cls = "coords") {
  if (!w || !w.g) return "";
  /* A reservoir or a glacier is a thing you can point at. An aquifer is water
   * in the rock under a whole basin, so its coordinate is a point over it and
   * what you see from above is the land being irrigated from it. Say so, rather
   * than let the link look like a broken pin. */
  const why = w.c === "Aquifer"
    ? `${w.n} lies under this ground — satellite view shows the land drawing on it, not the water`
    : `Open ${w.n} in satellite view`;
  return `<a class="${cls}" href="${mapLink(w.g)}" target="_blank" rel="noopener"
    title="${esc(why)}">${esc(coordText(w.g))}
    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2h5.5v5.5M10 2 2 10"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></a>`;
}

/* One reserve, in the space the sidebar was wasting. A photograph of a real
 * place, its fill, and where it is — the thing behind the ticker, in the one
 * piece of chrome that is on every page. It works through the register rather
 * than sticking on one, so a visit shows more of it than the front page has
 * room for. */
let sideTimer = null;

function sideCard(w) {
  const pct = Math.round((BASE_LEVEL[w.t] ?? .5) * 100);
  return `
    <span class="sf-art">
      <img src="${esc(PHOTOS[w.t])}" alt="${esc(w.n)}" loading="lazy" decoding="async">
    </span>
    <span class="sf-body">
      <b>${esc(w.n)}</b>
      <small>${esc(w.t)} · ${esc(w.c)}</small>
      <span class="sf-bar"><i style="width:${pct}%"></i></span>
      <small class="sf-fig"><span>${pct}% full</span><span>${esc(w.l || "")}</span></small>
    </span>`;
}

function renderSideFeature() {
  const host = $("side-feature");
  if (!host) return;
  clearInterval(sideTimer);

  const pool = WATER.filter(w => PAIRABLE(w) && PHOTOS[w.t]);
  if (!pool.length) { host.innerHTML = ""; return; }

  /* Shuffled, so two loads running at the same pace do not show the same
   * reserve at the same moment, and every one of them comes up once before
   * any comes up twice. */
  const order = pool.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let at = 0;

  host.innerHTML = `<a class="sf-card" href="sources.html" aria-live="polite"></a>`;
  const card = host.firstElementChild;

  const show = w => {
    card.innerHTML = sideCard(w);
    card.href = `sources.html?source=${encodeURIComponent(w.t)}`;
    card.setAttribute("aria-label", `${w.n} in the register`);
  };
  show(order[at]);

  /* A photograph that swaps under you while you are reading it is worse than
   * one that never moves, so it holds still for anyone who asked for less
   * motion, and stops entirely while the tab is in the background. */
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  sideTimer = setInterval(() => {
    if (document.hidden) return;
    at = (at + 1) % order.length;
    const next = order[at];
    /* Hold the next photograph until it has actually loaded, so the fade is
     * never onto an empty frame. */
    const pre = new Image();
    pre.onload = pre.onerror = () => {
      card.classList.add("is-out");
      setTimeout(() => { show(next); card.classList.remove("is-out"); }, 260);
    };
    pre.src = PHOTOS[next.t];
  }, 7000);
}

/* What has actually been launched, in the sidebar, on every page. The tables
 * are the record; this is the pulse — three coins, newest first, so a visit
 * that never reaches Launches still sees the thing working.
 *
 * One read per page load, reused rather than scanned twice: on a Pons chain a
 * listing is a walk over the chain's logs and is not free. */
let sidePairings = null;

function renderSideLaunches(rows) {
  const host = $("side-launches");
  if (!host) return;

  if (!rows) {
    host.innerHTML = `<p class="sl-head">Latest launches</p><p class="sl-empty">Reading the chain…</p>`;
    return;
  }
  if (!rows.length) {
    host.innerHTML = `<p class="sl-head">Latest launches</p>
      <a class="sl-empty sl-cta" href="launch.html">Nothing paired yet. Be the first →</a>`;
    return;
  }

  const items = rows.slice(0, 3).map(p => {
    const w = byTicker(p.source);
    /* A photograph where there is one, and the source's own glyph where there
     * is not — tinted by its class and filled to its level — rather than a
     * grey square standing in for a place. */
    const art = w && PHOTOS[w.t]
      ? `<img src="${esc(PHOTOS[w.t])}" alt="" loading="lazy" decoding="async">`
      : dropGlyph(p.source, 26);
    /* A pairing carries no supply, so market cap would need another read per
     * row. What it does carry is what the curve has taken in, which is the
     * figure worth three lines of sidebar anyway. */
    const raised = eth(p.raised || 0n, 2);
    return `<a class="sl-row" href="token.html?addr=${esc(p.token)}">
      <span class="sl-art">${art}</span>
      <span class="sl-who"><b>${esc(p.symbol || shortAddr(p.token))}</b>
        <small>${esc(w ? w.n : p.source)}</small></span>
      <span class="sl-fig">${esc(raised)}</span>
    </a>`;
  }).join("");

  host.innerHTML = `<p class="sl-head">Latest launches</p>${items}
    <a class="sl-all" href="launches.html">All launches →</a>`;
}

async function loadSideLaunches() {
  if (!$("side-launches")) return;
  renderSideLaunches(null);
  try {
    sidePairings = await Chain.pairings(6);
    /* The symbol is on the token, not on the pairing. */
    await Promise.all(sidePairings.slice(0, 3).map(async p => {
      try { p.symbol = (await Chain.tokenMeta(p.token)).symbol; } catch (_) {}
    }));
    renderSideLaunches(sidePairings);
  } catch (e) {
    console.warn("sidebar launches", e.shortMessage || e.message);
    renderSideLaunches([]);
  }
}

/* ---------------- the address of the last coin launched ---------------- */

/* A launch hands back an address and then the page moves on, and the address
 * is the one thing nobody can reconstruct: it is what gets pasted into a
 * wallet, an explorer, a group chat. So it stays in the header, one click from
 * the clipboard, until the next launch replaces it. Kept per chain, because an
 * address from the testnet means nothing on mainnet. */
const CA_KEY = id => `hydropad.lastca.${id}`;

function rememberLaunch(chainId, token, symbol) {
  try {
    localStorage.setItem(CA_KEY(chainId), JSON.stringify({ token, symbol, at: Date.now() }));
  } catch (_) {}
  renderLastCa();
}

function lastLaunch() {
  if (!Chain.chainId) return null;
  try {
    const raw = localStorage.getItem(CA_KEY(Chain.chainId));
    const v = raw ? JSON.parse(raw) : null;
    return v && v.token ? v : null;
  } catch (_) { return null; }
}

function renderLastCa() {
  const host = $("last-ca");
  if (!host) return;
  const last = lastLaunch();
  host.hidden = false;

  /* Before the first launch the slot stays, saying what it is waiting for:
   * somewhere to put the address is worth more than an empty header, and a
   * visitor who has never launched still learns where it will appear. */
  if (!last) {
    host.classList.add("waiting");
    host.innerHTML = `<span class="ca-tag">CA</span><span class="ca-addr mono">pending</span>`;
    return;
  }

  const explorer = Chain.chainInfo().explorer;
  host.classList.remove("waiting");
  host.innerHTML = `
    <span class="ca-tag">CA</span>
    <a class="ca-addr mono" href="token.html?addr=${esc(last.token)}"
       title="${esc(last.token)}">${shortAddr(last.token)}</a>
    <button class="ca-copy" type="button" data-copy="${esc(last.token)}" title="Copy the address">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1"/></svg>
      <span class="sr">Copy the contract address</span>
    </button>
    ${explorer ? `<a class="ca-out" href="${esc(explorer)}/address/${esc(last.token)}" target="_blank"
       rel="noopener" title="Open in the explorer">↗</a>` : ""}`;
}

/* One listener for the page, so it survives every redraw of the slot. */
function wireCopy() {
  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const text = btn.getAttribute("data-copy");
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      /* No clipboard permission, or an insecure origin: select it instead so
       * the address can still be copied by hand rather than read off screen. */
      const f = document.createElement("textarea");
      f.value = text; f.style.position = "fixed"; f.style.opacity = "0";
      document.body.appendChild(f); f.select();
      try { document.execCommand("copy"); } catch (__) {}
      f.remove();
    }
    btn.classList.add("done");
    setTimeout(() => btn.classList.remove("done"), 1200);
    toast(`Copied ${text}`);
  });
}

/* ---------------- network chrome ---------------- */

function renderNetwork() {
  const host = $("network");
  if (!host) return;
  const info = Chain.chainInfo();
  const cls = Chain.offline ? "bad" : Chain.ready() ? "ok" : "warn";
  const name = Chain.offline ? "No node" : info.name;

  /* A coloured dot beside a chain name means nothing to somebody who has not
   * been told what the colours are. Say it in words instead: what the pill is,
   * and what this particular state of it means. */
  const hint = Chain.offline
    ? "This browser cannot reach any Ethereum node. Click to run a chain inside this page instead."
      : Chain.ready()
        ? `Hydropad is on ${info.name}, and this page reads and writes there. Click to change network.`
        : `Your wallet is on ${info.name}, and Hydropad is not there yet. Click to move to Robinhood Chain.`;
  /* "not here" named the problem and left it there. When there is a network
   * that does work, the pill carries the way onto it instead. */
  const stranded = cls === "warn" && Chain.hasWallet();
  const suffix = cls === "warn" && !stranded ? `<span class="net-off">not here</span>` : "";
  const fix = stranded
    ? `<button class="net-fix" type="button" data-switch="4663" title="Move this wallet to Robinhood Chain, where Hydropad runs">
         Switch to Robinhood
         <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8M6.4 2.4 10 6l-3.6 3.6"
           fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
       </button>`
    : "";

  /* One line on purpose: broken across several, the markup leaves whitespace
   * text nodes inside the button, and the label stops being the first thing
   * in it. */
  const purse = `<svg class="w-glyph" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="14" rx="3"/><path d="M2.5 10h19"/><circle cx="17" cy="15" r="1.4" fill="currentColor" stroke="none"/></svg>`;

  const found = Chain.walletList();
  const account = Chain.account
      ? `<button class="btn alt sm w-btn" type="button" id="connect">${purse}${shortAddr(Chain.account)}</button>`
      : `<button class="btn sm w-btn" type="button" id="connect">${purse}Connect wallet</button>`;

  /* One wallet: connect straight to it. Several: ask which, because whichever
   * loaded last owns window.ethereum and that is rarely the one somebody
   * meant. */
  const picker = (!Chain.account && found.length > 1)
    ? `<div class="wallet-menu" id="wallet-menu" hidden>
        <p class="wm-head">Connect with</p>
        ${found.map(w => `<button class="wm-row" type="button" data-wallet="${esc(w.info.rdns)}">
            ${w.info.icon ? `<img src="${esc(w.info.icon)}" alt="" width="18" height="18">`
                          : `<span class="wm-dot"></span>`}
            <span>${esc(w.info.name)}</span>
          </button>`).join("")}
      </div>`
    : "";

  const side = $("side-chain");
  if (side) {
    /* Being on a network Hydropad is not on is a state with an answer, so the
     * line carries the answer rather than only the complaint: one tap moves
     * the wallet, and the dot goes green by itself once it lands. */
    const stranded = !Chain.offline && !Chain.ready() && Chain.hasWallet();
    const dot = Chain.offline ? "#e0705f" : Chain.ready() ? "#63c49c" : "#e8a33d";
    side.innerHTML = `<b><span class="dot" style="background:${dot}"></span>${esc(name)}</b>` +
      (Chain.offline ? "<span>nothing reachable from this browser</span>"
                  : Chain.viaPons() ? "<span>launching through Pons V2</span>"
                  : Chain.launcher ? `<span class="mono">${shortAddr(Chain.launcher)}</span>`
                  : stranded ? `<button class="side-switch" type="button" data-switch="4663">
                        Move to Robinhood Chain
                        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8M6.4 2.4 10 6l-3.6 3.6"
                          fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </button>`
                                   : "<span>Hydropad is not on this network</span>");
  }
  /* The pill opens a menu only when the menu has something in it. On a network
   * that works there is nothing to choose, so it is a badge: no chevron, no
   * dropdown, just where you are. */
  const menu = chainMenu();
  const inner = `<span class="dot"></span><span class="net-lbl">Network</span>` +
    `<span class="net-name">${esc(name)}</span>${suffix}`;
  host.innerHTML = (menu
    ? `<button class="pill ${cls} as-btn" type="button" id="chain-btn" aria-expanded="false"
              aria-haspopup="true" title="${esc(hint)}">
        ${inner}
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3.2 5 7 9 3.2"
          fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>`
    : `<span class="pill ${cls}" title="${esc(hint)}">${inner}</span>`) +
    `${fix}${account}${picker}` +
    (menu ? `<div class="chain-menu" id="chain-menu" hidden>${menu}</div>` : "");

  const btn = $("chain-btn");
  const menuEl = $("chain-menu");
  let closing = null;
  if (btn && menuEl) {
    const close = () => {
      if (menuEl.hidden) return;
      menuEl.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      clearTimeout(closing);
      closing = setTimeout(() => { menuEl.hidden = true; }, 220);
    };
    const open = () => {
      clearTimeout(closing);
      menuEl.hidden = false;
      requestAnimationFrame(() => menuEl.classList.add("open"));
      btn.setAttribute("aria-expanded", "true");
    };
    btn.addEventListener("click", e => {
      e.stopPropagation();
      menuEl.hidden || !menuEl.classList.contains("open") ? open() : close();
    });
    document.addEventListener("click", e => { if (!menuEl.contains(e.target) && e.target !== btn) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  }
  wireChainActions();

  /* Picking one of several wallets, then connecting with that one. */
  const wm = $("wallet-menu");
  if (wm) {
    wm.querySelectorAll("[data-wallet]").forEach(b => b.addEventListener("click", async () => {
      wm.hidden = true;
      try { await Chain.connect(b.dataset.wallet); renderNetwork(); render(); }
      catch (e) { toast(errText(e)); }
    }));
    document.addEventListener("click", e => {
      if (!wm.contains(e.target) && e.target.closest("#connect") === null) wm.hidden = true;
    });
  }

  const connect = $("connect");
  if (connect) connect.addEventListener("click", async e => {
    if (Chain.account) {
      const link = Chain.explorerLink("address", Chain.account);
      if (link) window.open(link, "_blank", "noopener");
      return;
    }
    if (wm) { e.stopPropagation(); wm.hidden = !wm.hidden; return; }
    try {
      await Chain.connect();
      renderNetwork();
      render();
      toast(`Connected ${shortAddr(Chain.account)} on ${Chain.chainInfo().name}`);
    } catch (e) { toast(errText(e)); }
  });
}

/* This used to be a paragraph across the top of every page. It is worth saying
 * once, not on every load, so it lives under the pill that says where the page
 * is reading and writing. */
function chainMenu() {
  const rows = [];
  const here = esc(Chain.chainInfo().name);

  if (Chain.offline) {
    rows.push(`<p>This browser cannot reach a node, so there is nothing to read from ${here}.
      Check the connection, or open a wallet on Robinhood Chain.</p>`);
  } else if (!Chain.hasWallet()) {
    rows.push(`<p>There is no wallet in this browser. The register and the docs read fine without
      one; launching and trading need a wallet on <b>Robinhood Chain</b>.</p>`);
    rows.push(`<p class="chain-fine">MetaMask, Phantom, Rabby — anything that speaks EIP-1193.</p>`);
  } else if (!Chain.ready()) {
    rows.push(`<p><b>Hydropad runs on Robinhood Chain.</b> Your wallet is on ${here}, so there is
      nothing here to read and nothing to launch against.</p>`);
    rows.push(`<div class="chain-acts">
      <button class="btn accent sm" type="button" data-switch="4663">Move to Robinhood Chain</button>
    </div>`);
  }

  if (Chain.launcher) {
    const link = Chain.explorerLink("address", Chain.launcher);
    rows.push(`<div class="chain-row"><span>Launcher</span>${link
      ? `<a class="mono" href="${link}" target="_blank" rel="noopener">${shortAddr(Chain.launcher)}</a>`
      : `<span class="mono">${shortAddr(Chain.launcher)}</span>`}</div>`);
  }
  return rows.join("");
}

/* Nothing is pushed above the page any more. */
function renderBanners() {
  const host = $("launcher-banner");
  if (host) host.innerHTML = "";
}

function wireChainActions() {
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };

  /* Anything carrying data-switch really moves the wallet, adding the network
   * first if the wallet has never seen it. */
  document.querySelectorAll("[data-switch]").forEach(b => {
    if (b.dataset.wired === "1") return;
    b.dataset.wired = "1";
    b.addEventListener("click", async () => {
      const was = b.textContent;
      b.disabled = true;
      b.textContent = "Check your wallet…";
      try { await Chain.switchTo(Number(b.dataset.switch)); }
      catch (e) { toast(errText(e)); }
      finally { b.disabled = false; b.textContent = was; }
    });
  });




  on("deploy-launcher", async e => {
    const btn = e.currentTarget;
    try {
      if (!Chain.account) await Chain.connect();
      btn.disabled = true;
      btn.textContent = "Deploying…";
      const addr = await Chain.deployLauncher();
      toast(`Launcher deployed at ${shortAddr(addr)}`);
      location.reload();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Deploy launcher";
      toast(errText(err));
    }
  });

  /* Reading Pons out loud. Everything here comes off the chain the visitor's
   * wallet is on: when a launch is refused, this is what says why, instead of
   * a guess from a machine that cannot reach the chain at all. */
  on("pons-check", async e => {
    const btn = e.currentTarget;
    const out = $("pons-readout");
    const say = lines => { out.hidden = false; out.textContent = lines.join("\n"); };
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = "Reading…";
    try {
      const id = Number(Chain.chainId);
      if (!PONS.has(id)) {
        say([`Pons is not on ${Chain.chainInfo().name} (chain ${id}).`,
             `It is on Robinhood Chain, 4663. Switch there and check again.`]);
        return;
      }
      const at = PONS.address(id);
      const f = PONS.factory(Chain.provider, id);
      const who = Chain.account;
      const lines = [`factory        ${at}`, `network        ${Chain.chainInfo().name} (${id})`];

      const read = async (label, fn) => {
        try { lines.push(`${label}${await fn()}`); }
        catch (err) { lines.push(`${label}— ${err.shortMessage || err.message}`); }
      };

      await read("launchFee      ", async () => `${ethers.formatEther(await f.launchFee())} ETH`);
      await read("publicGate     ", async () => (await f.launchEnabled()) ? "open" : "closed");
      await read("configs        ", async () => String(await f.launchConfigCount()));
      if (who) {
        await read("canLaunch(you) ", async () => (await f.canLaunch(who)) ? "yes" : "no");
        lines.push(`you            ${who}`);
      } else {
        lines.push("canLaunch(you) — connect a wallet to ask");
      }
      try {
        const c = await PONS.pickConfig(f);
        lines.push(`config #${c.id}      supply ${ethers.formatEther(c.supply)}, graduates at ${ethers.formatEther(c.graduationThreshold)} ETH, fee ${c.curveFeeBps} bps`);
      } catch (err) {
        lines.push(`config         — ${err.shortMessage || err.message}`);
      }
      const w = byTicker("MEAD");
      lines.push("", "description that would go on chain:", PONS.describe("MEAD", w ? w.n : "Lake Mead"));
      say(lines);
    } catch (err) {
      say([`failed: ${errText(err)}`]);
    } finally {
      btn.disabled = false;
      btn.textContent = was;
    }
  });

  on("set-launcher", () => {
    const addr = prompt("Launcher address on this network:", Chain.launcher || "");
    if (addr === null) return;
    if (addr.trim() === "") { Chain.forgetLauncher(); location.reload(); return; }
    if (!ethers.isAddress(addr.trim())) return toast("That is not an address.");
    Chain.rememberLauncher(addr.trim());
    location.reload();
  });
}

/* ---------------- the register ---------------- */

function sourceRows(list, withAction = true) {
  return list.map((w, i) => {
    const fill = BASE_LEVEL[w.t] ?? 0.5;
    const lc = fill < 0.3 ? "low" : fill < 0.55 ? "mid" : "";
    return `<tr>
      <td class="idx">${String(i + 1).padStart(2, "0")}</td>
      <td>
        <div class="asset">
          <span class="glyph">${sourceMark(w.t)}</span>
          <span><b>${esc(w.n)}</b><small>${w.t} · ${esc(w.c)}</small></span>
        </div>
      </td>
      <td class="hide-s"><span class="where"><b>${esc(w.l || "")}</b>${w.g
        ? coordTag(w) : `<small class="mono">${esc(w.v)}</small>`}</span></td>
      <td class="hide-xs"><span class="pill">${esc(w.a)}</span></td>
      <td class="hide-s">
        <div class="level ${lc}"><div class="bar"><i style="width:0" data-fill="${(fill * 100).toFixed(0)}%"></i></div><span>${level(fill)} full</span></div>
      </td>
      <td class="num spot"><b>${usd(w.p)}</b><small class="sub">${esc(w.u)}</small></td>
      ${withAction ? `<td class="num nowrap">${PAIRABLE(w)
        ? `<a class="btn alt sm" href="launch.html?source=${w.t}">Pair</a>`
        : `<span class="no-pair" title="A coin is paired to a named body of water. This entry is a category, or a plant that makes water rather than a place that holds it.">—</span>`}</td>` : ""}
    </tr>`;
  }).join("");
}

/* ---------------- launches table ---------------- */

async function launchRows(limit) {
  const list = await Chain.pairings(limit);
  if (!list.length) return { list, html: "", metas: [] };
  const metas = await Promise.all(list.map(p => Chain.tokenMeta(p.token).catch(() => null)));
  const html = list.map((p, i) => {
    const m = metas[i] || { name: "Token", symbol: "?", totalSupply: 0n };
    const w = byTicker(p.source);
    const st = stageOf(p);
    const price = p.tokenReserve > 0n ? (p.ethReserve * 10n ** 18n) / p.tokenReserve : 0n;
    const cap = (price * m.totalSupply) / 10n ** 18n;
    const link = Chain.explorerLink("address", p.token);
    return `<tr>
      <td class="idx">${String(i + 1).padStart(2, "0")}</td>
      <td><div class="asset"><span class="glyph">${sourceMark(p.source)}</span>
        <span><b><a href="token.html?addr=${p.token}">${esc(m.name)}</a></b><small>$${esc(m.symbol)}</small></span></div></td>
      <td><b style="font-size:14px">${esc(w ? w.n : p.source)}</b><small class="sub">${esc(p.source)}${w ? " · " + esc(w.v) : ""}</small></td>
      <td class="hide-s mono" style="font-size:12.5px;color:var(--ink-2)">${ago(p.launchedAt)}</td>
      <td class="hide-xs mono" style="font-size:12.5px;color:var(--ink-2)">${shortAddr(p.creator)}</td>
      <td class="hide-xs mono" style="font-size:12.5px;color:var(--ink-2)">${
        link ? `<a href="${link}" target="_blank" rel="noopener">${shortAddr(p.token)}</a>` : shortAddr(p.token)}</td>
      <td><span class="pill ${st.cls}"><span class="dot"></span>${st.label}</span></td>
      <td class="num mono">${eth(cap)}</td>
    </tr>`;
  }).join("");
  return { list, html, metas };
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}"><p class="empty">${msg}</p></td></tr>`;
}


/* ---------------- the curve, drawn from the contract's own constants ---------------- */

/* With k = virtualEth · supply, buying moves the reserves so that
 * price(raised) = (V + raised)^2 / (V · supply). The chart is that line, with
 * every live pairing placed on it. */
function curvePrice(raisedWei, supplyWei) {
  const V = Number(ethers.formatEther(CURVE.VIRTUAL_ETH));
  const r = Number(ethers.formatEther(raisedWei));
  const s = Number(ethers.formatEther(supplyWei));
  return ((V + r) ** 2) / (V * s);
}

function renderCurve(pairings, metas) {
  const host = $("curve-chart");
  if (!host) return;
  const W = 720, H = 260, padL = 56, padR = 18, padT = 16, padB = 34;
  const target = Number(ethers.formatEther(CURVE.TARGET));
  const supply = metas.find(Boolean)?.totalSupply || ethers.parseEther("1000000000");

  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const r = (target * i) / 60;
    pts.push([r, curvePrice(ethers.parseEther(r.toFixed(6)), supply)]);
  }
  const maxY = pts[pts.length - 1][1] * 1.08;
  const x = r => padL + (r / target) * (W - padL - padR);
  const y = p => H - padB - (p / maxY) * (H - padT - padB);

  const line = pts.map(([r, p], i) => `${i ? "L" : "M"}${x(r).toFixed(1)} ${y(p).toFixed(1)}`).join(" ");
  const area = `${line} L${x(target).toFixed(1)} ${H - padB} L${padL} ${H - padB} Z`;

  const gridY = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const py = padT + f * (H - padT - padB);
    const val = (maxY * (1 - f));
    return `<line class="grid-line" x1="${padL}" y1="${py}" x2="${W - padR}" y2="${py}"/>
            <text class="tick" x="${padL - 8}" y="${py + 3}" text-anchor="end">${val.toExponential(1)}</text>`;
  }).join("");

  const gridX = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const px = padL + f * (W - padL - padR);
    return `<text class="tick" x="${px}" y="${H - padB + 18}" text-anchor="middle">${(target * f).toFixed(1)}</text>`;
  }).join("");

  const marks = pairings.map((p, i) => {
    const m = metas[i];
    if (!m) return "";
    const r = Number(ethers.formatEther(p.raised));
    const price = curvePrice(p.raised, m.totalSupply);
    const cx = x(Math.min(r, target)), cy = y(Math.min(price, maxY));
    return `<g>
      <circle class="mark" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5.5" fill="#0e7490" fill-opacity=".92" stroke="#fff" stroke-width="2">
        <title>$${esc(m.symbol)} · ${eth(p.raised)} raised</title>
      </circle>
      <text class="mark-label" x="${(cx + 9).toFixed(1)}" y="${(cy - 8).toFixed(1)}">$${esc(m.symbol)}</text>
    </g>`;
  }).join("");

  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Price along the bonding curve">
    <defs><linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0e7490" stop-opacity=".16"/><stop offset="1" stop-color="#0e7490" stop-opacity="0"/>
    </linearGradient></defs>
    ${gridY}${gridX}
    <path d="${area}" fill="url(#curveFill)"/>
    <path d="${line}" fill="none" stroke="#0e7490" stroke-width="2.4" stroke-linejoin="round"/>
    <line class="axis" x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}"/>
    <line class="axis" x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}"/>
    <text class="tick" x="${W - padR}" y="${H - 6}" text-anchor="end">ETH raised</text>
    ${marks}
  </svg>`;
  setText("curve-foot", `${pairings.length} on the curve · graduation at ${eth(CURVE.TARGET, 1)}`);
}

/* ---------------- what the launcher has been doing ---------------- */

async function renderFeed(pairings, metas) {
  const host = $("feed");
  if (!host) return;
  const symbols = {};
  pairings.forEach((p, i) => { if (metas[i]) symbols[p.token.toLowerCase()] = metas[i].symbol; });

  const c = Chain.contract();
  const head = await Chain.provider.getBlockNumber();
  const logs = await c.queryFilter(c.filters.Traded(), Math.max(0, head - 50000), head);
  const rows = logs.slice(-12).reverse();

  if (!rows.length) {
    host.innerHTML = `<li style="color:var(--ink-3)">No trades yet. The first buy shows up here.</li>`;
    setText("feed-foot", "waiting on the first trade");
    return;
  }

  host.innerHTML = rows.map(l => {
    const sym = symbols[l.args.token.toLowerCase()] || "?";
    const buy = l.args.isBuy;
    return `<li>
      <span class="side ${buy ? "buy" : "sell"}">${buy ? "buy" : "sell"}</span>
      <span class="sym">$${esc(sym)}</span>
      <span class="amt">${eth(l.args.ethAmount)}</span>
      <span class="when">#${l.blockNumber}</span>
    </li>`;
  }).join("");
  setText("feed-foot", `${logs.length} trade${logs.length === 1 ? "" : "s"} on this launcher`);
}

/* Numbers that arrive rather than appear. */
function countUp(el, to, suffix = "") {
  if (!el) return;
  const from = 0, dur = 900, t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * eased) + suffix;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- pages ---------------- */

/* ---------------- the sites, down the front page ---------------- */

function renderSites() {
  const host = $("sites");
  if (!host || typeof FEATURED === "undefined") return;
  host.innerHTML = FEATURED.map(t => {
    const w = byTicker(t);
    if (!w) return "";
    const art = sourceArt(t);
    const fill = BASE_LEVEL[t] ?? 0.5;
    const note = (typeof SITE_NOTES !== "undefined" && SITE_NOTES[t]) || "";
    const shot = art
      ? `<img src="${esc(art)}" alt="${esc(w.n)}, rendered from its published figures" loading="lazy" decoding="async"
           onload="this.classList.add('ready')">`
      : `<div class="empty">${esc(w.n)}</div>`;
    return `<article class="site">
      <figure class="site-shot">
        ${shot}
        <span class="tick">${esc(w.t)}</span>
        <figcaption>${esc(w.c)} · ${esc(w.l || w.v)}</figcaption>
      </figure>
      <div class="site-text">
        <p class="eyebrow">${esc(w.c)} · ${esc(w.l || "")}</p>
        <h3>${esc(w.n)}</h3>
        <p>${esc(note)}</p>
        <dl class="site-facts">
          <div><dt>Availability</dt><dd>${level(fill)}<small>of capacity</small></dd></div>
          <div><dt>Assay</dt><dd>${esc(w.a)}<small>as published</small></dd></div>
          <div><dt>Spot</dt><dd>${usd(w.p)}<small>${esc(w.u)}</small></dd></div>
          <div><dt>Paired</dt><dd data-paired="${esc(w.t)}">—<small>coins on this reserve</small></dd></div>
        </dl>
        ${w.g ? `<div class="whereis"><span>Go and look</span>${coordTag(w, "coords big")}</div>` : ""}
        <div class="gauge" style="--w:${(fill * 100).toFixed(0)}%"><i style="width:0" data-fill="${(fill * 100).toFixed(0)}%"></i></div>
        <div class="site-cta">
          ${PAIRABLE(w) ? `<a class="btn sm" href="launch.html?source=${esc(w.t)}">Pair ${esc(w.t)}</a>` : ""}
          <a class="btn alt sm" href="sources.html">See the register</a>
        </div>
      </div>
    </article>`;
  }).join("");

  /* How many coins are actually paired to each of them, read from the chain. */
  if (!Chain.offline && Chain.ready()) {
    Chain.pairings(200).then(list => {
      const tally = {};
      for (const p of list) tally[p.source] = (tally[p.source] || 0) + 1;
      for (const el of document.querySelectorAll("[data-paired]")) {
        const n = tally[el.dataset.paired] || 0;
        el.firstChild.textContent = String(n);
      }
    }).catch(e => console.warn("pairing tally", e));
  }

  const shown = FEATURED.filter(t => typeof PHOTOS !== "undefined" && (OWN[t] || PHOTOS[t])).length;
  const total = FEATURED.length;
  setText("sites-note", shown === total
    ? `Six of the ${WATER.length} entries in the register, each one a place you can go and look at. Every one of these carries a photograph of it.`
    : shown
      ? `Six of the ${WATER.length} entries in the register, each one a place you can go and look at. ${shown} of the six carry a photograph of that place; the ${total - shown === 1 ? "one that does not is cut" : `other ${total - shown} are cut`} from Hydropad's own photography until one arrives.`
      : `Six of the ${WATER.length} entries in the register, each one a place you can go and look at. None carries a photograph of it yet: these plates are cut from Hydropad's own photography. Drop one in media/sources and it takes over.`);

  return shown;
}

const PAGES = {

  markets() {
    const list = [...WATER].sort((a, b) => b.p - a.p).slice(0, 10);
    $("board").innerHTML = sourceRows(list);
    const avg = WATER.reduce((s, w) => s + (BASE_LEVEL[w.t] ?? 0.5), 0) / WATER.length;
    /* Two numbers, not one. The register holds 32 entries and a coin can be
     * paired to 26 of them: the generic ones are categories rather than places,
     * and a desalination plant makes water rather than holding it. Saying only
     * the larger number is how a page ends up advertising something the launch
     * form will not do. */
    const pairable = WATER.filter(PAIRABLE);
    const classes = CLASSES.filter(c => pairable.some(w => w.c === c));
    countUp($("stat-sources"), WATER.length);
    countUp($("stat-classes"), CLASSES.length);
    setText("stat-pairable", `${pairable.length} pairable`);
    setText("stat-classes-pairable", `${classes.length} pairable`);
    countUp($("stat-level"), Math.round(avg * 100), "%");
    setText("stat-chain", Chain.chainInfo().name);
    setText("recent-foot", `Read from the launcher contract on ${Chain.chainInfo().name}.`);
    renderTape();
    renderSites();

    const host = $("recent");
    if (!host) return;
    if (Chain.offline) {
      host.innerHTML = emptyRow(8, "No node reachable from this browser.");
      setText("stat-launches", "...");
      return;
    }
    if (!Chain.ready()) {
      host.innerHTML = emptyRow(8, `${Chain.viaPons()
        ? `Nothing paired to water has been launched on ${esc(Chain.chainInfo().name)} yet. Pons carries every launch on this chain, and none of them are Hydropad's so far.`
        : `Nothing has been launched on ${esc(Chain.chainInfo().name)} yet.`} <a href="launch.html" style="color:var(--accent)">Be the first to pair a source</a>.`);
      setText("stat-launches", "0");
      return;
    }
    host.innerHTML = emptyRow(8, "Reading the chain…");
    launchRows(8).then(async ({ list, html, metas }) => {
      host.innerHTML = html || emptyRow(8, `Nothing launched on ${esc(Chain.chainInfo().name)} yet. <a href="launch.html" style="color:var(--accent)">Pair a source</a>.`);
      setText("stat-launches", `${list.length} live`);
      renderCurve(list, metas);
      await renderFeed(list, metas).catch(e => console.warn("feed", e));
    }).catch(e => { host.innerHTML = emptyRow(8, esc(errText(e))); });
  },

  launches() {
    const host = $("launch-rows");
    renderTape();
    if (Chain.offline) {
      host.innerHTML = emptyRow(8, "No node reachable from this browser.");
      return;
    }
    if (!Chain.ready()) {
      host.innerHTML = emptyRow(8, `${Chain.viaPons()
        ? `Nothing paired to water has been launched on ${esc(Chain.chainInfo().name)} yet. Pons carries every launch on this chain, and none of them are Hydropad's so far.`
        : `Nothing has been launched on ${esc(Chain.chainInfo().name)} yet.`} <a href="launch.html" style="color:var(--accent)">Be the first to pair a source</a>.`);
      return;
    }
    host.innerHTML = emptyRow(8, "Reading the chain…");
    launchRows(100).then(({ list, html }) => {
      host.innerHTML = html || emptyRow(8, `Nothing launched on ${esc(Chain.chainInfo().name)} yet. <a href="launch.html" style="color:var(--accent)">Pair a source</a>.`);
      setText("launch-count", `${list.length} ${list.length === 1 ? "launch" : "launches"}`);
      setText("l-count", list.length);
      setText("l-paired", new Set(list.map(p => p.source)).size);
      setText("l-graduated", list.filter(p => p.graduated).length);
      setText("l-latest", list.length ? ago(list[0].launchedAt) : "...");
    }).catch(e => { host.innerHTML = emptyRow(8, esc(errText(e))); });
  },

  sources() {
    wirePhotoDesk();
    /* Kept outside this function: the page is re-rendered whenever the chain
     * says something, and a filter someone typed should survive that. */
    let filter = REGISTER.filter, sort = REGISTER.sort, q = REGISTER.q;
    const rows = () => {
      let list = WATER.filter(w => filter === "All" || w.c === filter);
      if (q) {
        const n = q.toLowerCase();
        list = list.filter(w => (w.n + w.t + w.v + w.c).toLowerCase().includes(n));
      }
      if (sort === "spot") list = [...list].sort((a, b) => b.p - a.p);
      else if (sort === "fill") list = [...list].sort((a, b) => (BASE_LEVEL[a.t] ?? .5) - (BASE_LEVEL[b.t] ?? .5));
      else if (sort === "name") list = [...list].sort((a, b) => a.n.localeCompare(b.n));
      const host = $("source-rows");
      host.innerHTML = list.length ? sourceRows(list) : emptyRow(7, "No source matches that search.");
      /* dealt out one after another, so a filter reads as the table changing
       * rather than as a new table appearing */
      [...host.children].forEach((tr, i) => {
        tr.style.setProperty("--i", String(Math.min(i, 18)));
        tr.classList.add("dealt");
      });
      setText("source-count", `${list.length} of ${WATER.length} sources`);
    };
    /* and the chip that is lit has to agree with it */
    document.querySelectorAll("[data-class]").forEach(b => b.classList.toggle("on", b.dataset.class === filter));
    const searchBox = $("search");
    if (searchBox && searchBox.value !== q) searchBox.value = q;
    const sortBox = $("sort");
    if (sortBox && sortBox.value !== sort) sortBox.value = sort;

    document.querySelectorAll("[data-class]").forEach(btn => btn.addEventListener("click", () => {
      document.querySelectorAll("[data-class]").forEach(b => b.classList.toggle("on", b === btn));
      filter = REGISTER.filter = btn.dataset.class; rows();
    }));
    $("search").addEventListener("input", e => { q = REGISTER.q = e.target.value; rows(); });
    $("sort").addEventListener("change", e => { sort = REGISTER.sort = e.target.value; rows(); });
    rows();
    renderTape();
  },

  launch() {
    const form = $("pair-form");
    const info = () => Chain.chainInfo();

    /* Which launchpad this launch would go through. Pons' public gate can be
     * closed, and asking the chain is the only way to know, so it is resolved
     * in the background and the form repaints when the answer lands. */
    const route = { at: null, value: null };
    async function resolveRoute() {
      const key = `${Chain.chainId}|${Chain.account}`;
      if (route.at === key) return route.value;
      route.at = key;
      try { route.value = await Chain.launchRoute(); }
      catch (_) { route.value = "own"; }
      renderWallets();
      return route.value;
    }

    if (form.dataset.wired !== "1") {
      form.dataset.wired = "1";

      /* There is no network to pick here any more: coins launch on Robinhood
       * Chain and nowhere else, so the form does not ask. Being on the wrong
       * one is said where it matters — the pill at the top, and the panel above
       * the button, which carries the switch. */

      /* Four classes of water, and each one behaves differently enough that it
       * is worth choosing before the source. */
      const classes = CLASSES.filter(c => WATER.some(w => w.c === c && PAIRABLE(w)));
      $("f-classes").innerHTML = classes.map((c, i) => `
        <button class="pad${i === 0 ? " on" : ""}" type="button" data-class="${esc(c)}" aria-pressed="${i === 0}">
          <b>${esc(c)}</b>
          <span>${esc(CLASS_BLURB[c])}</span>
          <small>${WATER.filter(w => w.c === c && PAIRABLE(w)).length} sources</small>
        </button>`).join("");
      $("f-classes").addEventListener("click", e => {
        const b = e.target.closest("[data-class]");
        if (!b) return;
        pickClass(b.dataset.class);
      });

      form.addEventListener("input", paint);
      form.addEventListener("change", paint);
      form.addEventListener("submit", submit);
      form.source.addEventListener("change", () => {
        const w = byTicker(form.source.value);
        if (w) pickClass(w.c, true);
      });

      const pre = qs("source");
      const preW = pre && byTicker(pre);
      pickClass(preW && PAIRABLE(preW) ? preW.c : classes[0], false, preW && PAIRABLE(preW) ? pre : null);
    }

    renderWallets();
    paint();

    function pickClass(cls, keepSource = false, preferred = null) {
      for (const b of $("f-classes").querySelectorAll("[data-class]")) {
        const on = b.dataset.class === cls;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      }
      const before = form.source.value;
      form.source.innerHTML = WATER.filter(w => w.c === cls && PAIRABLE(w))
        .map(w => `<option value="${w.t}">${esc(w.n)} · ${w.t} · ${esc(w.v)}</option>`).join("");
      if (preferred && byTicker(preferred) && byTicker(preferred).c === cls) form.source.value = preferred;
      else if (keepSource && [...form.source.options].some(o => o.value === before)) form.source.value = before;
      paint();
    }

    function figures() {
      const supply = BigInt(Math.max(1000, Math.floor(+form.supply.value || 0))) * 10n ** 18n;
      let firstBuy = 0n;
      try { firstBuy = ethers.parseEther(form.firstBuy.value || "0"); } catch (_) {}
      const opening = (CURVE.VIRTUAL_ETH * 10n ** 18n) / supply;
      const fee = (firstBuy * CURVE.FEE_BPS) / 10000n;
      const net = firstBuy - fee;
      const out = net > 0n ? supply - (CURVE.VIRTUAL_ETH * supply) / (CURVE.VIRTUAL_ETH + net) : 0n;
      return { supply, firstBuy, opening, out };
    }

    /* The coin as it will exist, redrawn on every keystroke: the plate of the
     * source it is bound to, and the four numbers the contract will enforce. */
    function paint() {
      const w = byTicker(form.source.value) || WATER[0];
      const sym = (form.symbol.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      const name = form.name.value.trim();
      const { firstBuy, opening, out } = figures();
      const fill = BASE_LEVEL[w.t] ?? 0.5;

      $("f-logo").innerHTML = `
        <span class="lp-logo-art">${sourceMark(w.t, 34)}</span>
        <span class="lp-logo-text"><b>The source is the logo</b>
          <small>Every pairing carries ${esc(w.n)}'s own plate, rendered from its class and its
          ${level(fill)} fill. Nothing to upload.</small></span>`;

      $("f-preview").innerHTML = `
        <div class="pv">
          <div class="pv-head">
            <span class="pv-art">${sourceMark(w.t, 30)}</span>
            <span class="pv-id">
              <b>${esc(name || "Your coin")}</b>
              <small class="mono">${esc(sym || "SYMBOL")}</small>
            </span>
          </div>
          <p class="pv-lede">Bound to ${esc(w.n)}, ${esc(w.v)}'s ${esc(w.a)} at ${level(fill)} of capacity.
          The ticker goes into the token itself, where anyone can read it back.</p>
          <div class="pv-chips">
            <span class="pill"><span class="dot"></span>${esc(info().name)}</span>
            <span class="pill">${esc(w.c)}</span>
            <span class="pill mono">${esc(w.t)}</span>
          </div>
          <div class="pv-boxes">
            <div><span>Launch fee</span><b>None</b></div>
            <div><span>Trade fee</span><b>3% to your vault</b></div>
            <div><span>Opening price</span><b>${Number(ethers.formatEther(opening)).toExponential(2)} ${esc(info().ticker)}</b></div>
            <div><span>Graduates at</span><b>${eth(CURVE.TARGET, 1)} raised</b></div>
          </div>
          <ol class="pv-steps">
            <li><span>1</span>Sign the launch transaction</li>
            <li><span>2</span>The launcher mints the supply and opens the curve</li>
            <li><span>3</span>${firstBuy > 0n
                ? `Your ${eth(firstBuy)} fills on that curve: about ${tokens(out)} ${esc(sym || "tokens")}`
                : "Take the first position, or leave the curve flat"}</li>
            <li><span>4</span>Done, and listed on Markets</li>
          </ol>
          <p class="pv-foot">No owner, no admin key, no pause. The only privileged call in the contract
          is withdrawing your own vault.</p>
        </div>`;

      const btn = $("f-submit");
      if (!btn.disabled) btn.textContent = Chain.launcher || route.value === "pons"
        ? `Launch on ${info().name}`
        : `Open Hydropad on ${info().name}`;
      if (btn.disabled && !Chain.offline && !Chain.canLaunch()) {
        btn.textContent = "Switch to Robinhood Chain to launch";
      }
    }

    /* Whatever can actually sign here, named. */
    function renderWallets() {
      const host = $("f-wallets");
      const note = $("f-walletnote");
      const rows = [];
      const btn = $("f-submit");
      /* Nobody has opened a launcher on this network yet. That is not a wall:
       * the launcher is a plain contract and anyone can put it there, so the
       * first launch carries it. Say so before the form is filled in, so the
       * second wallet prompt is not a surprise. */
      /* Hydropad launches on Robinhood Chain and nowhere else. Reading works on
       * any network; opening a pairing does not. */
      const wrongChain = !Chain.offline && !Chain.canLaunch();
      /* Only our own launcher has a "somebody has to open it" state, and only
       * when this launch is actually taking that route. */
      /* On a chain Pons is not on, our own launcher is the only route and that
       * is knowable without a wallet. On a Pons chain it takes asking the
       * factory, which needs an address to ask about. */
      const viaOwn = !Chain.viaPons() || route.value === "own";
      const first = !wrongChain && !Chain.offline && viaOwn
        && Chain.hasWallet() && !Chain.launcher;
      if (Chain.account) resolveRoute();
      const stuck = !Chain.offline && !Chain.hasWallet();

      const warn = $("f-blocked");
      if (warn) warn.remove();
      if (wrongChain) {
        const el = document.createElement("div");
        el.id = "f-blocked";
        el.className = "lp-blocked";
        el.innerHTML = `<b>Coins are launched on Robinhood Chain, not on ${esc(info().name)}.</b>
          <span>Your wallet is on ${esc(info().name)}. Hydropad opens pairings on Robinhood Chain,
          the Arbitrum layer 2 that settles to Ethereum and pays gas in ETH. Move your wallet over
          and the form works as it is.</span>
          <span class="lp-blocked-acts">
            <button class="btn accent sm" type="button" data-switch="4663">Robinhood Chain</button>
            <button class="btn alt sm" type="button" data-switch="46630">Testnet</button>
          </span>`;
        host.parentNode.insertBefore(el, host);
      } else if (first) {
        const el = document.createElement("div");
        el.id = "f-blocked";
        el.className = "lp-blocked";
        el.innerHTML = `<b>You would be the first to launch on ${esc(info().name)}.</b>
          <span>No launcher contract has been opened on this network yet, so your launch opens one
          first and pairs against it. Two transactions, one after the other, both from your wallet.
          Everything launched on ${esc(info().name)} after that reads from the same contract.</span>`;
        host.parentNode.insertBefore(el, host);
      }
      /* What the launch itself costs, read off Pons rather than guessed. Our own
       * launcher charges nothing, so on that route it is gas alone. */
      const cost = $("f-cost");
      if (cost) {
        if (route.value === "pons") {
          cost.textContent = "Reading the launch fee…";
          PONS.terms(Chain.provider, Chain.chainId, Chain.account)
            .then(t => { cost.textContent = `Launch fee ${ethers.formatEther(t.launchFee)} ETH, plus gas.`; })
            .catch(() => { cost.textContent = "Plus gas."; });
        } else {
          cost.textContent = "Launch fee none, plus gas.";
        }
      }
      if (btn) {
        btn.disabled = stuck || wrongChain;
        btn.textContent = wrongChain ? "Switch to Robinhood Chain to launch"
          : stuck ? "No wallet in this browser"
          : first ? `Open Hydropad on ${info().name}`
          : `Launch on ${info().name}`;
        /* Nothing of ours is being opened on the Pons route, so the button
         * should not offer to. */
        if (route.value === "pons" && !btn.disabled) btn.textContent = `Launch on ${info().name}`;
      }
      if (Chain.account) {
        const through = route.value === "pons"
          ? "Launching through Pons V2."
          : route.value === "own" && Chain.viaPons()
            ? "Pons has its public gate closed, so this goes through Hydropad's own launcher."
            : route.value === "own" ? "Launching through Hydropad's own launcher." : "";
        rows.push(`<div class="wallet on"><span class="w-art"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><circle cx="17" cy="15" r="1.3" fill="currentColor" stroke="none"/></svg></span>
          <span><b>${shortAddr(Chain.account)}</b><small>Connected on ${esc(info().name)}. ${esc(through)}</small></span></div>`);
        note.textContent = "Ready to launch.";
      } else if (Chain.hasWallet()) {
        rows.push(`<button class="wallet" type="button" id="w-connect"><span class="w-art"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><circle cx="17" cy="15" r="1.3" fill="currentColor" stroke="none"/></svg></span>
          <span><b>Browser wallet</b><small>Connect it to sign the launch.</small></span></button>`);
        note.textContent = "Connect a wallet to launch.";
      } else {
        rows.push(`<div class="wallet"><span class="w-art"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><circle cx="17" cy="15" r="1.3" fill="currentColor" stroke="none"/></svg></span>
          <span><b>No wallet in this browser</b><small>Launching needs one, on Robinhood Chain.
          MetaMask, Phantom, Rabby — anything that speaks EIP-1193.</small></span></div>`);
        note.textContent = "No wallet found in this browser.";
      }
      host.innerHTML = rows.join("");
      wireChainActions();
      const wc = $("w-connect");
      if (wc) wc.addEventListener("click", async () => {
        try { await Chain.connect(); renderNetwork(); render(); } catch (e) { toast(errText(e)); }
      });
    }

    async function submit(e) {
      e.preventDefault();
      const btn = $("f-submit");
      try {
        if (!Chain.account) await Chain.connect();
        if (!Chain.canLaunch()) {
          return toast(`Hydropad launches on Robinhood Chain. Your wallet is on ${info().name}.`);
        }
        const symbol = form.symbol.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
        if (!symbol) return toast("The symbol needs at least one letter.");
        const { supply, firstBuy } = figures();

        btn.disabled = true;
        /* First launch on this network: the launcher goes up in its own
         * transaction, then the pairing runs against it. */
        if (!Chain.ready()) {
          btn.textContent = "Confirm the launcher in your wallet…";
          const addr = await Chain.deployLauncher();
          toast(`Launcher opened at ${shortAddr(addr)} on ${info().name}`);
        }
        btn.textContent = "Confirm in your wallet…";
        const w = byTicker(form.source.value);
        const { token } = await Chain.launch({
          name: form.name.value.trim() || symbol,
          symbol,
          source: form.source.value,
          supply,
          firstBuyWei: firstBuy,
          /* Only Pons uses these: its token has no source() of ours, so the
           * pairing is written into the description a person actually reads. */
          place: w ? (w.l ? `${w.n}, ${w.l}` : w.n) : null,
          note: w && w.g ? `At ${coordText(w.g)}.` : null,
        });
        rememberLaunch(Chain.chainId, token, symbol);
        await navigate(`token.html?addr=${token}&new=1`);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = Chain.launcher ? `Launch on ${info().name}` : `Open Hydropad on ${info().name}`;
        toast(errText(err));
      }
    }
  },

  token() {
    const addr = qs("addr");
    const host = $("token-view");
    if (!addr || !ethers.isAddress(addr)) {
      host.innerHTML = `<p class="empty">No token address in the link. <a href="launches.html" style="color:var(--accent)">See the launches</a>.</p>`;
      return;
    }
    if (Chain.offline) {
      host.innerHTML = `<p class="empty">No node reachable from this browser, so this token cannot be read.</p>`;
      return;
    }
    if (!Chain.ready()) {
      host.innerHTML = `<p class="empty">No launcher known on ${esc(Chain.chainInfo().name)}. Set its address above to read this token.</p>`;
      return;
    }
    host.innerHTML = `<p class="empty">Reading the chain…</p>`;
    if (qs("new")) toast("Pairing launched.", 5000);
    refresh();

    async function refresh() {
      try {
        const [p, meta] = await Promise.all([Chain.pairing(addr), Chain.tokenMeta(addr)]);
        if (p.token === ethers.ZeroAddress) {
          host.innerHTML = `<p class="empty">This launcher does not know that token.</p>`;
          return;
        }
        const [price, trades, balance] = await Promise.all([
          Chain.price(addr),
          Chain.trades(addr).catch(() => []),
          Chain.account ? Chain.balanceOf(addr, Chain.account).catch(() => 0n) : Promise.resolve(0n),
        ]);
        render(p, meta, price, trades, balance);
      } catch (e) {
        host.innerHTML = `<p class="empty">${esc(errText(e))}</p>`;
      }
    }

    function render(p, meta, price, trades, balance) {
      const w = byTicker(p.source);
      const st = stageOf(p);
      const cap = (price * meta.totalSupply) / 10n ** 18n;
      const isCreator = Chain.account && Chain.account.toLowerCase() === p.creator.toLowerCase();
      const tokenLink = Chain.explorerLink("address", p.token);
      document.title = `$${meta.symbol} on Hydropad`;

      host.innerHTML = `
        <div class="detail-head">
          <span class="glyph">${sourceMark(p.source, 30)}</span>
          <div>
            <h1>${esc(meta.name)}</h1>
            <span class="sub">$${esc(meta.symbol)} · paired with ${esc(w ? w.n : p.source)} (${esc(p.source)})${w ? " · " + esc(w.v) : ""}</span>
          </div>
          <span class="pill ${st.cls}" style="margin-left:auto"><span class="dot"></span>${st.label}</span>
        </div>
        <div class="detail-grid" style="margin-top:26px">
          <div class="panel">
            <div class="panel-head">
              <h3>${Number(ethers.formatEther(price)).toExponential(4)} ${Chain.chainInfo().ticker}<span class="sub" style="display:inline;margin-left:8px">per $${esc(meta.symbol)}</span></h3>
              <span class="label">${trades.length} trade${trades.length === 1 ? "" : "s"} on chain</span>
            </div>
            <div style="padding:18px">${chart(trades)}</div>
            <div class="panel-foot">
              <span>Price is the curve's reserve ratio: it rises as the curve is bought out.</span>
              <span class="mono">${curvePct(p.raised).toFixed(1)}% of ${eth(CURVE.TARGET, 1)}</span>
            </div>
          </div>
          <div style="display:grid;gap:16px">
            <div class="panel">
              <div class="panel-head"><h3>Trade</h3><span class="label">${esc(Chain.chainInfo().name)}</span></div>
              <div style="padding:18px;display:grid;gap:12px">
                <label style="display:grid;gap:7px;font-size:13px;color:var(--ink-2);font-weight:500">Buy with
                  <input id="buy-amount" class="mono" type="number" min="0" step="0.01" value="0.05">
                </label>
                <button class="btn accent" id="buy-btn" type="button">Buy</button>
                <label style="display:grid;gap:7px;font-size:13px;color:var(--ink-2);font-weight:500">Sell $${esc(meta.symbol)}
                  <input id="sell-amount" class="mono" type="number" min="0" step="1" value="${balance > 0n ? Number(ethers.formatEther(balance / 2n)).toFixed(0) : 0}">
                </label>
                <button class="btn alt" id="sell-btn" type="button">Sell</button>
                <div class="sub" id="quote">...</div>
              </div>
              <div class="panel-foot"><span>Your balance</span><span class="mono">${tokens(balance)} $${esc(meta.symbol)}</span></div>
            </div>
            <div class="panel summary">
              <div class="line"><span>market cap</span><b>${eth(cap)}</b></div>
              <div class="line"><span>raised</span><b>${eth(p.raised)} / ${eth(CURVE.TARGET, 1)}</b></div>
              <div class="line"><span>vault</span><b>${eth(p.vault)}</b></div>
              <div class="line"><span>curve reserve</span><b>${tokens(p.tokenReserve)} $${esc(meta.symbol)}</b></div>
              <div class="line"><span>supply</span><b>${tokens(meta.totalSupply)}</b></div>
              <div class="line"><span>creator</span><b>${shortAddr(p.creator)}</b></div>
              <div class="line"><span>token</span><b>${tokenLink ? `<a href="${tokenLink}" target="_blank" rel="noopener">${shortAddr(p.token)}</a>` : shortAddr(p.token)}</b></div>
              <div class="line"><span>launched</span><b>${ago(p.launchedAt)}</b></div>
              ${isCreator ? `<button class="btn alt sm" id="claim-btn" type="button" ${p.vault === 0n ? "disabled" : ""}>Claim vault (${eth(p.vault)})</button>` : ""}
            </div>
          </div>
        </div>`;

      wire(p, meta);
    }

    function wire(p, meta) {
      const buyInput = $("buy-amount"), sellInput = $("sell-amount"), quote = $("quote");

      const showQuote = async () => {
        try {
          let text = "";
          const inEth = ethers.parseEther(buyInput.value || "0");
          if (inEth > 0n) {
            const out = await Chain.quoteBuy(addr, inEth);
            text = `${eth(inEth)} buys about ${tokens(out)} $${meta.symbol}`;
          }
          const amount = ethers.parseEther(String(Math.max(0, Math.floor(+sellInput.value || 0))));
          if (amount > 0n) {
            const back = await Chain.quoteSell(addr, amount);
            const net = back - (back * CURVE.FEE_BPS) / 10000n;
            text += `${text ? " · " : ""}${tokens(amount)} sells for about ${eth(net)}`;
          }
          quote.textContent = text || "...";
        } catch (e) { quote.textContent = errText(e); }
      };
      buyInput.addEventListener("input", showQuote);
      sellInput.addEventListener("input", showQuote);
      showQuote();

      $("buy-btn").addEventListener("click", () => run($("buy-btn"), async () => {
        const value = ethers.parseEther(buyInput.value || "0");
        if (value <= 0n) throw new Error("Enter an amount to buy.");
        const expected = await Chain.quoteBuy(addr, value);
        await Chain.buy(addr, value, (expected * 97n) / 100n);   // 3% slippage room
        toast(`Bought $${meta.symbol}`);
      }));

      $("sell-btn").addEventListener("click", () => run($("sell-btn"), async () => {
        const amount = ethers.parseEther(String(Math.max(0, Math.floor(+sellInput.value || 0))));
        if (amount <= 0n) throw new Error("Enter an amount to sell.");
        const back = await Chain.quoteSell(addr, amount);
        const net = back - (back * CURVE.FEE_BPS) / 10000n;
        await Chain.sell(addr, amount, (net * 97n) / 100n);
        toast(`Sold $${meta.symbol}`);
      }));

      const claim = $("claim-btn");
      if (claim) claim.addEventListener("click", () => run(claim, async () => {
        await Chain.claimVault(addr);
        toast("Vault claimed");
      }));
    }

    async function run(btn, fn) {
      const label = btn.textContent;
      try {
        if (!Chain.account) await Chain.connect();
        btn.disabled = true;
        btn.textContent = "Confirm in your wallet…";
        await fn();
        await refresh();
      } catch (e) {
        toast(errText(e));
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    }
  },
};

/* ---------------- chart of on-chain trades ---------------- */

function chart(trades) {
  const pts = trades
    .filter(t => t.tokens > 0n)
    .map(t => Number(ethers.formatEther(t.eth)) / Number(ethers.formatEther(t.tokens)));
  if (pts.length < 2) {
    return `<p class="empty">${pts.length ? "One trade so far. The chart draws from the second." : "No trades yet. The first buy sets the first point."}</p>`;
  }
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || lo || 1;
  const xy = i => [(i / (pts.length - 1)) * 760 + 10, 220 - ((pts[i] - lo) / span) * 190];
  const line = pts.map((_, i) => { const [x, y] = xy(i); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");
  return `<svg class="chart" viewBox="0 0 780 240" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0e7490" stop-opacity=".18"/><stop offset="1" stop-color="#0e7490" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${line} L770 230 L10 230 Z" fill="url(#g)"/>
    <path d="${line}" fill="none" stroke="#0e7490" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

/* ---------------- ticker ---------------- */

function renderTape() {
  const host = $("tape");
  if (!host) return;
  const row = WATER.map(w => `<span class="tape-item">${dropGlyph(w.t, 13)}<span class="tk">${w.t}</span>
    <span class="px">${usd(w.p)}</span><span class="tk">${level(BASE_LEVEL[w.t] ?? .5)} full</span></span>`).join("");
  host.innerHTML = `<div class="tape-track">${row}${row}</div>`;
}

function setText(id, v) { const el = $(id); if (el) el.textContent = v; }


/* ---------------- soft navigation ---------------- */

/* Every page here shares one script and, in the in-page chain, one EVM that
 * lives in memory. A full page load would throw that EVM away and have to
 * replay the journal, so internal links swap the page's main content instead of
 * reloading. A hard refresh still works: it just rebuilds the chain first. */
PAGES.docs = function docs() {
  /* The deploy controls live here rather than in the network menu: they are a
   * job for whoever runs the project, not something to put in front of a
   * visitor with no explanation. */
  wireChainActions();
};

const ROUTES = {
  "index.html": "markets",
  "launches.html": "launches",
  "sources.html": "sources",
  "launch.html": "launch",
  "token.html": "token",
  "docs.html": "docs",
};

function pageFor(pathname) {
  const file = pathname.split("/").pop() || "index.html";
  return ROUTES[file];
}

function wireRouter() {
  document.addEventListener("click", e => {
    const a = e.target.closest("a");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) return;
    const url = new URL(href, location.href);
    if (url.origin !== location.origin || !pageFor(url.pathname)) return;
    e.preventDefault();
    navigate(url.href);
  });
  window.addEventListener("popstate", () => swap(location.href, false));
}

async function navigate(href) {
  history.pushState({}, "", href);
  await swap(href, false);
  window.scrollTo(0, 0);
}

async function swap(href, replace) {
  const key = pageFor(new URL(href, location.href).pathname);
  if (!key) { location.href = href; return; }
  try {
    const res = await fetch(href, { credentials: "same-origin" });
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const main = doc.querySelector("main");
    if (!main) { location.href = href; return; }
    document.querySelector("main").replaceWith(main);
    document.title = doc.title;
    document.body.dataset.page = key;
    window.HYDROPAD_PAGE = key;
    Motion.syncScene(key);

    /* Everything outside <main> that differs page to page has to come across
     * too, or the page reads as one thing and says it is another: the crumb
     * said "launches" over the explore hero because it was never touched here,
     * and the sidebar kept its old highlight because this asked for .nav-links,
     * a class the markup stopped using. */
    renderLastCa();

    const crumb = document.querySelector(".crumb");
    const fresh = doc.querySelector(".crumb");
    if (crumb && fresh) crumb.innerHTML = fresh.innerHTML;

    document.querySelectorAll(".side-nav a").forEach(a => {
      a.classList.toggle("on", pageFor(new URL(a.getAttribute("href"), location.href).pathname) === key);
    });

    /* A share sheet reads whatever the head says at the moment it is asked. */
    for (const sel of ['meta[name="description"]', 'meta[property="og:title"]',
                       'meta[property="og:description"]', 'meta[property="og:url"]',
                       'link[rel="canonical"]']) {
      const here = document.head.querySelector(sel);
      const there = doc.head.querySelector(sel);
      if (here && there) here.setAttribute(here.hasAttribute("href") ? "href" : "content",
        there.getAttribute(there.hasAttribute("href") ? "href" : "content"));
    }
    renderBanners();
    const page = PAGES[key];
    if (page) page();
  } catch (e) {
    location.href = href;
  }
}

/* ---------------- boot ---------------- */

document.addEventListener("DOMContentLoaded", async () => {
  Motion.mount();
  wireMenu();
  await Chain.init();
  renderNetwork();
  renderLastCa();
  wireCopy();
  renderSideFeature();
  loadSideLaunches();
  renderBanners();
  wireRouter();
  render();

  /* Pairings that land after the first paint (the in-page chain opens its seeds
   * behind the page) redraw whatever is on screen. */
  let pending = null;
  /* The network pill, the sidebar line and the launch form all read the same
   * four facts. Redraw that chrome only when one of them actually changes, so
   * an open chain menu is not torn down by a pairing landing behind it. */
  const chromeSig = () => [Chain.chainId, Chain.launcher, Chain.account, Chain.offline].join("|");
  let chrome = chromeSig();
  window.addEventListener("hydropad:chain", () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      if (chromeSig() !== chrome) { chrome = chromeSig(); renderNetwork(); renderLastCa(); }
      render();
      loadSideLaunches();
    }, 120);
  });
});

function render() {
  const key = document.body.dataset.page || window.HYDROPAD_PAGE;
  /* The artifact wrapper strips body[data-page], so the ground under the
   * sections is switched on with a class as well. */
  document.body.classList.toggle("page-markets", key === "markets");
  const page = PAGES[key];
  if (!page) return;
  try { page(); } catch (e) { console.error(e); toast(errText(e)); }
}
