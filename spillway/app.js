/* Spillway's pages. Everything a token does (minting, the curve, the vault)
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

const CLASS_TINT = { Reservoir: "#0e7490", Aquifer: "#0f9d76", Glacier: "#3b9fd4", Desalination: "#0b6b7d" };

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

/* ---------------- network chrome ---------------- */

function renderNetwork() {
  const host = $("network");
  if (!host) return;
  const info = Chain.chainInfo();
  const net = Chain.offline
    ? `<span class="pill bad"><span class="dot"></span>No node</span>`
    : `<span class="pill ${Chain.launcher ? "ok" : "warn"}"><span class="dot"></span>${esc(info.name)}</span>`;
  if (Chain.demo) {
    host.innerHTML = `${net}<span class="pill"><span class="dot"></span>${shortAddr(Chain.account)}</span>`;
    return;
  }
  if (Chain.account) {
    host.innerHTML = `${net}<button class="btn alt sm" type="button" id="connect">${shortAddr(Chain.account)}</button>`;
  } else {
    host.innerHTML = `${net}<button class="btn sm" type="button" id="connect">Connect wallet</button>`;
  }
  $("connect").addEventListener("click", async () => {
    if (Chain.account) {
      const link = Chain.explorerLink("address", Chain.account);
      if (link) window.open(link, "_blank", "noopener");
      return;
    }
    try {
      await Chain.connect();
      renderNetwork();
      renderBanners();
      const page = PAGES[document.body.dataset.page || window.SPILLWAY_PAGE];
      if (page) page();
      toast(`Connected ${shortAddr(Chain.account)} on ${Chain.chainInfo().name}`);
    } catch (e) { toast(errText(e)); }
  });
}

/* Two strips above every page: where the chain is, and which launcher we read.
 * The launcher is not a service someone runs for you: if the chain you are on
 * has none, you deploy one and the site remembers it. */
function renderBanners() {
  const host = $("launcher-banner");
  if (!host) return;
  host.innerHTML = Chain.demo ? chainStrip() : chainStrip() + launcherStrip();

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

function chainStrip() {
  if (Chain.demo) {
    return `<div class="note strip">
      <span><b>Running an Ethereum node inside this page.</b> The launcher and every token here are the
      same compiled bytecode executing on a real EVM in your browser. Transactions are journalled
      locally and replayed on each load. Nothing leaves this browser${Chain.hasWallet() ? "" : ", and no wallet is needed"}.</span>
      <span style="display:flex;gap:8px;align-items:center">
        ${Chain.launcher ? `<span class="mono" style="font-size:12px;color:#5b55a8">launcher ${shortAddr(Chain.launcher)}</span>` : ""}
        <button class="btn alt sm" type="button" id="reset-demo">Reset chain</button>
        ${Chain.hasWallet() ? `<button class="btn alt sm" type="button" id="leave-demo">Use my wallet</button>` : ""}
      </span>
    </div>`;
  }
  if (Chain.offline || !Chain.hasWallet()) {
    const why = Chain.offline
      ? "No Ethereum node is reachable from this browser"
      : "No wallet is installed in this browser";
    return `<div class="note strip">
      <span>${why}, so nothing on a public chain can be read or written here. Run one in the page
      instead: a real EVM, the real contract, no network and no wallet.</span>
      <button class="btn accent sm" type="button" id="start-demo">Run a chain in this page</button>
    </div>`;
  }
  return "";
}

function launcherStrip() {
  if (Chain.offline && !Chain.demo) return "";
  if (Chain.launcher) {
    const link = Chain.explorerLink("address", Chain.launcher);
    return `<div class="note strip">
      <span>Launcher on ${esc(Chain.chainInfo().name)}:
        ${link ? `<a href="${link}" target="_blank" rel="noopener"><code>${shortAddr(Chain.launcher)}</code></a>` : `<code>${shortAddr(Chain.launcher)}</code>`}
      </span>
      <button class="btn alt sm" type="button" id="set-launcher">Use another</button>
    </div>`;
  }
  return `<div class="note strip">
    <span>No launcher on ${esc(Chain.chainInfo().name)} yet. Deploy one from your wallet: it is a
    single transaction, and you own it.</span>
    <span style="display:flex;gap:8px">
      <button class="btn accent sm" type="button" id="deploy-launcher">Deploy launcher</button>
      <button class="btn alt sm" type="button" id="set-launcher">I have an address</button>
    </span>
  </div>`;
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
          <span class="glyph">${dropGlyph(w.t)}</span>
          <span><b>${esc(w.n)}</b><small>${w.t} · ${esc(w.c)}</small></span>
        </div>
      </td>
      <td class="hide-s mono">${esc(w.v)}</td>
      <td class="hide-xs"><span class="pill">${esc(w.a)}</span></td>
      <td class="hide-s">
        <div class="level ${lc}"><div class="bar"><i style="width:${(fill * 100).toFixed(0)}%"></i></div><span>${level(fill)} full</span></div>
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
      <td><div class="asset"><span class="glyph">${dropGlyph(p.source)}</span>
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
  },

  launch() {
    const form = $("pair-form");
    if (form.dataset.wired !== "1") {
      form.dataset.wired = "1";
      form.source.innerHTML = CLASSES.map(c => `<optgroup label="${c}">` +
        WATER.filter(w => w.c === c).map(w => `<option value="${w.t}">${esc(w.n)}, ${w.t} · ${esc(w.v)}</option>`).join("") +
        `</optgroup>`).join("");
      const pre = qs("source");
      if (pre && byTicker(pre)) form.source.value = pre;
      form.addEventListener("input", summary);
      form.addEventListener("submit", submit);
    }
    summary();

    function summary() {
      const w = byTicker(form.source.value);
      const supply = BigInt(Math.max(1000, Math.floor(+form.supply.value || 0))) * 10n ** 18n;
      let firstBuy = 0n;
      try { firstBuy = ethers.parseEther(form.firstBuy.value || "0"); } catch (_) {}
      const opening = (CURVE.VIRTUAL_ETH * 10n ** 18n) / supply;
      const fee = (firstBuy * CURVE.FEE_BPS) / 10000n;
      const net = firstBuy - fee;
      const k = CURVE.VIRTUAL_ETH * supply;
      const out = net > 0n ? supply - k / (CURVE.VIRTUAL_ETH + net) : 0n;
      $("preview-glyph").innerHTML = dropGlyph(form.source.value, 26);
      $("pair-summary").innerHTML = `
        <div class="line"><span>source</span><b>${esc(w.n)} · ${w.t}</b></div>
        <div class="line"><span>venue</span><b>${esc(w.v)}</b></div>
        <div class="line"><span>assay</span><b>${esc(w.a)}</b></div>
        <div class="line"><span>reference spot</span><b>${usd(w.p)} ${esc(w.u)}</b></div>
        <div class="line"><span>network</span><b>${esc(Chain.chainInfo().name)}</b></div>
        <div class="line"><span>opening price</span><b>${Number(ethers.formatEther(opening)).toExponential(3)} ${Chain.chainInfo().ticker}</b></div>
        <div class="line"><span>first buy</span><b>${firstBuy > 0n ? `${eth(firstBuy)} → ${tokens(out)} $${esc(form.symbol.value.toUpperCase() || "TOKEN")}` : "none"}</b></div>
        <div class="line"><span>trade fee</span><b>${Number(CURVE.FEE_BPS) / 100}% → your vault</b></div>
        <div class="line"><span>graduates at</span><b>${eth(CURVE.TARGET, 1)} raised</b></div>`;
    }

    async function submit(e) {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      try {
        if (!Chain.account) await Chain.connect();
        if (!Chain.launcher) return toast("Deploy a launcher on this network first.");
        const symbol = form.symbol.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
        if (!symbol) return toast("The ticker needs at least one letter.");
        const supply = BigInt(Math.max(1000, Math.floor(+form.supply.value || 0))) * 10n ** 18n;
        let firstBuy = 0n;
        try { firstBuy = ethers.parseEther(form.firstBuy.value || "0"); } catch (_) {}

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
        btn.textContent = "Launch the pairing";
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
      document.title = `$${meta.symbol} on Spillway`;

      host.innerHTML = `
        <div class="detail-head">
          <span class="glyph">${dropGlyph(p.source, 30)}</span>
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
    window.SPILLWAY_PAGE = key;
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
  wireSound();
  const banner = $("launcher-banner");
  if (banner && (DemoChain.isOn() || (!Chain.hasWallet() && !DemoChain.optedOut()))) {
    banner.innerHTML = `<div class="note strip"><span id="boot-msg">Starting an Ethereum node in this page…</span></div>`;
  }
  await Chain.init(msg => setText("boot-msg", msg));
  renderNetwork();
  renderBanners();
  wireRouter();
  const page = PAGES[document.body.dataset.page || window.SPILLWAY_PAGE];
  if (page) {
    try { page(); } catch (e) { console.error(e); toast(errText(e)); }
  }
});
