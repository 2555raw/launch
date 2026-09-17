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

function errText(e) {
  const raw = e?.info?.error?.message || e?.shortMessage || e?.reason || e?.message || String(e);
  if (/user rejected|denied transaction/i.test(raw)) return "Transaction rejected in the wallet.";
  return raw.replace(/^execution reverted:?\s*/i, "Reverted: ").slice(0, 160);
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

/* ---------------- network chrome ---------------- */

function renderNetwork() {
  const host = $("network");
  if (!host) return;
  const info = Chain.chainInfo();
  const cls = Chain.offline ? "bad" : Chain.launcher ? "ok" : "warn";
  const name = Chain.offline ? "No node" : info.name;

  const account = Chain.demo
    ? `<span class="pill"><span class="dot"></span>${shortAddr(Chain.account)}</span>`
    : Chain.account
      ? `<button class="btn alt sm" type="button" id="connect">${shortAddr(Chain.account)}</button>`
      : `<button class="btn sm" type="button" id="connect">Connect wallet</button>`;

  const side = $("side-chain");
  if (side) {
    side.innerHTML = `<b><span class="dot" style="background:${Chain.offline ? "#e0705f" : Chain.launcher ? "#63c49c" : "#e8a33d"}"></span>${esc(name)}</b>` +
      (Chain.demo ? "<span>a real EVM inside this page</span>"
                  : Chain.launcher ? `<span class="mono">${shortAddr(Chain.launcher)}</span>`
                                   : "<span>no launcher here yet</span>");
  }
  host.innerHTML = `
    <button class="pill ${cls} as-btn" type="button" id="chain-btn" aria-expanded="false"
            aria-haspopup="true" title="Where this page reads and writes">
      <span class="dot"></span><span class="net-name">${esc(name)}</span>
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3.2 5 7 9 3.2"
        fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
    </button>
    ${account}
    <div class="chain-menu" id="chain-menu" hidden>${chainMenu()}</div>`;

  const btn = $("chain-btn");
  const menu = $("chain-menu");
  let closing = null;
  const close = () => {
    if (menu.hidden) return;
    menu.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    clearTimeout(closing);
    closing = setTimeout(() => { menu.hidden = true; }, 220);
  };
  const open = () => {
    clearTimeout(closing);
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add("open"));
    btn.setAttribute("aria-expanded", "true");
  };
  btn.addEventListener("click", e => {
    e.stopPropagation();
    menu.hidden || !menu.classList.contains("open") ? open() : close();
  });
  document.addEventListener("click", e => { if (!menu.contains(e.target) && e.target !== btn) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  wireChainActions();

  const connect = $("connect");
  if (connect) connect.addEventListener("click", async () => {
    if (Chain.account) {
      const link = Chain.explorerLink("address", Chain.account);
      if (link) window.open(link, "_blank", "noopener");
      return;
    }
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
  if (Chain.demo) {
    rows.push(`<p>An Ethereum node is running <b>inside this page</b>. The launcher and every token here
      are the same compiled bytecode executing on a real EVM in your browser. Transactions are
      journalled locally and replayed on each load, and nothing leaves this browser.</p>`);
  } else if (Chain.offline) {
    rows.push(`<p>No Ethereum node is reachable from this browser, so nothing on a public chain can be
      read or written here. You can run one in the page instead: a real EVM, the real contract, no
      network and no wallet.</p>`);
    rows.push(`<button class="btn accent sm" type="button" id="start-demo">Run a chain in this page</button>`);
  } else if (!Chain.hasWallet()) {
    rows.push(`<p>No wallet is installed in this browser. You can run a chain in the page instead.</p>`);
    rows.push(`<button class="btn accent sm" type="button" id="start-demo">Run a chain in this page</button>`);
  }

  if (!Chain.offline || Chain.demo) {
    if (Chain.launcher) {
      const link = Chain.explorerLink("address", Chain.launcher);
      rows.push(`<div class="chain-row"><span>Launcher</span>${link
        ? `<a class="mono" href="${link}" target="_blank" rel="noopener">${shortAddr(Chain.launcher)}</a>`
        : `<span class="mono">${shortAddr(Chain.launcher)}</span>`}</div>`);
    } else if (!Chain.demo) {
      rows.push(`<p>No launcher on ${esc(Chain.chainInfo().name)} yet. Deploy one from your wallet: it is
        a single transaction, and you own it.</p>`);
    }
  }

  const acts = [];
  if (Chain.demo) {
    acts.push(`<button class="btn alt sm" type="button" id="reset-demo">Reset chain</button>`);
    if (Chain.hasWallet()) acts.push(`<button class="btn alt sm" type="button" id="leave-demo">Use my wallet</button>`);
  } else if (!Chain.offline) {
    if (!Chain.launcher) acts.push(`<button class="btn accent sm" type="button" id="deploy-launcher">Deploy launcher</button>`);
    acts.push(`<button class="btn alt sm" type="button" id="set-launcher">${Chain.launcher ? "Use another" : "I have an address"}</button>`);
  }
  if (acts.length) rows.push(`<div class="chain-acts">${acts.join("")}</div>`);
  return rows.join("");
}

/* Nothing is pushed above the page any more. */
function renderBanners() {
  const host = $("launcher-banner");
  if (host) host.innerHTML = "";
}

function wireChainActions() {
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };

  on("start-demo", async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await Chain.useDemo(msg => { btn.textContent = msg; });
      await Chain.openDemoWorld(msg => { btn.textContent = msg; });
      location.reload();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Run a chain in this page";
      toast(errText(err));
    }
  });

  on("reset-demo", () => {
    DemoChain.reset();
    location.reload();
  });

  on("leave-demo", () => {
    DemoChain.disable();
    location.reload();
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
      <td class="hide-s"><span class="where"><b>${esc(w.l || "")}</b><small class="mono">${esc(w.v)}</small></span></td>
      <td class="hide-xs"><span class="pill">${esc(w.a)}</span></td>
      <td class="hide-s">
        <div class="level ${lc}"><div class="bar"><i style="width:0" data-fill="${(fill * 100).toFixed(0)}%"></i></div><span>${level(fill)} full</span></div>
      </td>
      <td class="num spot"><b>${usd(w.p)}</b><small class="sub">${esc(w.u)}</small></td>
      ${withAction ? `<td class="num nowrap"><a class="btn alt sm" href="launch.html?source=${w.t}">Pair</a></td>` : ""}
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
        <div class="gauge" style="--w:${(fill * 100).toFixed(0)}%"><i style="width:0" data-fill="${(fill * 100).toFixed(0)}%"></i></div>
        <div class="site-cta">
          <a class="btn sm" href="launch.html?source=${esc(w.t)}">Pair ${esc(w.t)}</a>
          <a class="btn alt sm" href="sources.html">See the register</a>
        </div>
      </div>
    </article>`;
  }).join("");

  /* How many coins are actually paired to each of them, read from the chain. */
  if (!Chain.offline && Chain.launcher) {
    Chain.pairings(200).then(list => {
      const tally = {};
      for (const p of list) tally[p.source] = (tally[p.source] || 0) + 1;
      for (const el of document.querySelectorAll("[data-paired]")) {
        const n = tally[el.dataset.paired] || 0;
        el.firstChild.textContent = String(n);
      }
    }).catch(e => console.warn("pairing tally", e));
  }

  const shown = FEATURED.filter(t => sourceArt(t)).length;
  const photos = typeof PHOTOS !== "undefined" ? Object.keys(PHOTOS).length : 0;
  setText("sites-note", photos
    ? `Six of the 32 entries in the register. ${photos} of them carry a photograph; the rest are rendered from the site's class and its own fill figure.`
    : `Six of the 32 entries in the register. Photographs of these places belong to the people who took them, so each plate is rendered instead, from that site's class and its published fill: a reservoir at ${level(BASE_LEVEL.MEAD ?? 0.3)} is drawn down to ${level(BASE_LEVEL.MEAD ?? 0.3)}. Drop a photograph in media/sources and it takes the plate's place.`);
  return shown;
}

const PAGES = {

  markets() {
    const list = [...WATER].sort((a, b) => b.p - a.p).slice(0, 10);
    $("board").innerHTML = sourceRows(list);
    const avg = WATER.reduce((s, w) => s + (BASE_LEVEL[w.t] ?? 0.5), 0) / WATER.length;
    countUp($("stat-sources"), WATER.length);
    countUp($("stat-classes"), CLASSES.length);
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
    if (!Chain.launcher) {
      host.innerHTML = emptyRow(8, "No launcher on this network yet. Deploy one above to open the first pairing.");
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
    if (!Chain.launcher) {
      host.innerHTML = emptyRow(8, "No launcher on this network yet. Deploy one above to open the first pairing.");
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
    let filter = "All", sort = "featured", q = "";
    const rows = () => {
      let list = WATER.filter(w => filter === "All" || w.c === filter);
      if (q) {
        const n = q.toLowerCase();
        list = list.filter(w => (w.n + w.t + w.v + w.c).toLowerCase().includes(n));
      }
      if (sort === "spot") list = [...list].sort((a, b) => b.p - a.p);
      else if (sort === "fill") list = [...list].sort((a, b) => (BASE_LEVEL[a.t] ?? .5) - (BASE_LEVEL[b.t] ?? .5));
      else if (sort === "name") list = [...list].sort((a, b) => a.n.localeCompare(b.n));
      $("source-rows").innerHTML = list.length ? sourceRows(list) : emptyRow(7, "No source matches that search.");
      setText("source-count", `${list.length} of ${WATER.length} sources`);
    };
    document.querySelectorAll("[data-class]").forEach(btn => btn.addEventListener("click", () => {
      document.querySelectorAll("[data-class]").forEach(b => b.classList.toggle("on", b === btn));
      filter = btn.dataset.class; rows();
    }));
    $("search").addEventListener("input", e => { q = e.target.value; rows(); });
    $("sort").addEventListener("change", e => { sort = e.target.value; rows(); });
    rows();
    renderTape();
    renderCredits();
  },

  launch() {
    const form = $("pair-form");
    const info = () => Chain.chainInfo();

    if (form.dataset.wired !== "1") {
      form.dataset.wired = "1";

      /* The networks this build knows how to read. The one in use is the one
       * the page actually booted on: picking another tells you how to get
       * there, it cannot move your wallet for you. */
      $("f-chains").innerHTML = [1337, 8453, 84532, 31337].map(id => {
        const c = CHAINS[id];
        const on = Chain.chainId === id;
        return `<button class="chip${on ? " on" : ""}" type="button" data-chain="${id}" aria-pressed="${on}">
          <span class="dot"></span>${esc(c.name)}${c.test ? `<small>test</small>` : ""}
        </button>`;
      }).join("");
      $("f-chains").addEventListener("click", e => {
        const b = e.target.closest("[data-chain]");
        if (!b) return;
        const id = Number(b.dataset.chain);
        if (id === Chain.chainId) return;
        toast(id === 1337
          ? "Open the chain menu at the top and run a chain in this page."
          : `Switch your wallet to ${CHAINS[id].name}, then reload. Hydropad reads whichever chain your wallet is on.`);
      });

      /* Four classes of water, and each one behaves differently enough that it
       * is worth choosing before the source. */
      $("f-classes").innerHTML = CLASSES.map((c, i) => `
        <button class="pad${i === 0 ? " on" : ""}" type="button" data-class="${esc(c)}" aria-pressed="${i === 0}">
          <b>${esc(c)}</b>
          <span>${esc(CLASS_BLURB[c])}</span>
          <small>${WATER.filter(w => w.c === c).length} sources</small>
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
      pickClass(pre && byTicker(pre) ? byTicker(pre).c : CLASSES[0], false, pre);
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
      form.source.innerHTML = WATER.filter(w => w.c === cls)
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
      if (!btn.disabled) btn.textContent = `Launch on ${info().name}`;
    }

    /* Whatever can actually sign here, named. */
    function renderWallets() {
      const host = $("f-wallets");
      const note = $("f-walletnote");
      const rows = [];
      if (Chain.demo) {
        rows.push(`<div class="wallet on"><span class="w-art"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7L12.5 19.5"/></svg></span>
          <span><b>This page's own chain</b><small>A real EVM in the browser, signing with
          ${shortAddr(Chain.account)}. No wallet needed.</small></span></div>`);
        note.textContent = "Ready to launch.";
      } else if (Chain.account) {
        rows.push(`<div class="wallet on"><span class="w-art"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><circle cx="17" cy="15" r="1.3" fill="currentColor" stroke="none"/></svg></span>
          <span><b>${shortAddr(Chain.account)}</b><small>Connected on ${esc(info().name)}.</small></span></div>`);
        note.textContent = "Ready to launch.";
      } else if (Chain.hasWallet()) {
        rows.push(`<button class="wallet" type="button" id="w-connect"><span class="w-art"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><circle cx="17" cy="15" r="1.3" fill="currentColor" stroke="none"/></svg></span>
          <span><b>Browser wallet</b><small>Connect it to sign the launch.</small></span></button>`);
        note.textContent = "Connect a wallet to launch.";
      } else {
        rows.push(`<button class="wallet" type="button" id="start-demo"><span class="w-art"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7L12.5 19.5"/></svg></span>
          <span><b>Run a chain in this page</b><small>No wallet in this browser. Hydropad can run the
          real contract on a real EVM here instead.</small></span></button>`);
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
        if (!Chain.launcher) return toast("No launcher on this network yet. Deploy one from the chain menu.");
        const symbol = form.symbol.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
        if (!symbol) return toast("The symbol needs at least one letter.");
        const { supply, firstBuy } = figures();

        btn.disabled = true;
        btn.textContent = "Confirm in your wallet…";
        const { token } = await Chain.launch({
          name: form.name.value.trim() || symbol,
          symbol,
          source: form.source.value,
          supply,
          firstBuyWei: firstBuy,
        });
        await navigate(`token.html?addr=${token}&new=1`);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = `Launch on ${info().name}`;
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
    if (!Chain.launcher) {
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

/* Photographs carry their attribution, listed under the register. */
function renderCredits() {
  const host = $("credits");
  if (!host) return;
  const credits = typeof PHOTO_CREDITS !== "undefined" ? PHOTO_CREDITS : {};
  const entries = Object.entries(credits);
  if (!entries.length) { host.innerHTML = ""; return; }
  host.innerHTML = `<h4>Photographs</h4><ul>` + entries.map(([t, credit]) => {
    const w = byTicker(t);
    return `<li><b>${esc(w ? w.n : t)}</b> — ${esc(credit)}</li>`;
  }).join("") + `</ul>`;
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
    document.querySelectorAll(".nav-links a").forEach(a => {
      a.classList.toggle("on", pageFor(new URL(a.getAttribute("href"), location.href).pathname) === key);
    });
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
  /* Booting an EVM takes a few seconds. Say so out of the way, not in a box
   * across the top of the page. */
  let boot = null;
  if (DemoChain.isOn() || (!Chain.hasWallet() && !DemoChain.optedOut())) {
    boot = document.createElement("div");
    boot.className = "booting";
    boot.innerHTML = `<span class="spin"></span><span id="boot-msg">Starting an Ethereum node in this page…</span>`;
    document.body.appendChild(boot);
  }
  await Chain.init(msg => setText("boot-msg", msg));
  if (boot) boot.remove();
  renderNetwork();
  renderBanners();
  wireRouter();
  render();

  /* Pairings that land after the first paint (the in-page chain opens its seeds
   * behind the page) redraw whatever is on screen. */
  let pending = null;
  window.addEventListener("hydropad:chain", () => {
    clearTimeout(pending);
    pending = setTimeout(render, 120);
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
