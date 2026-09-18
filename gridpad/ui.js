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

/* ---------------- small things every page uses ---------------- */
function toast(msg, ms = 3600) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add("on"));
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("on"), ms);
}

/* A revert is four opaque bytes unless somebody decodes it. Every custom error
 * this site can provoke lives in one of these two surfaces. */
function errText(e) {
  const data = e?.data || e?.info?.error?.data || e?.error?.data;
  if (typeof data === "string" && data.length >= 10) {
    for (const abi of [PONS.FACTORY_ABI, PONS.CURVE_ABI]) {
      try {
        const d = new ethers.Interface(abi).parseError(data);
        if (d) return `Refused: ${d.name}`;
      } catch (_) {}
    }
  }
  if (e?.code === "ACTION_REJECTED" || /user rejected/i.test(e?.message || "")) return "You cancelled it.";
  return e?.shortMessage || e?.reason || e?.message || String(e);
}

const short = a => `${a.slice(0, 6)}…${a.slice(-4)}`;
const eth = w => `${Number(ethers.formatEther(w)).toLocaleString("en-US", { maximumFractionDigits: 4 })} ETH`;
const qs = k => new URLSearchParams(location.search).get(k);
const byTicker = t => PLANTS.find(p => p.t === t);

/* The sentence that goes on chain, built from a register row. */
function sentenceFor(p) {
  return {
    place: `${p.n}, ${place(p)}`,
    note: `${p.c}, ${p.mw.toLocaleString("en-US")} MW, at ${coords(p.g)}.`,
  };
}

/* ---------------- the wallet in the bar ---------------- */
function drawConnect() {
  const b = $("connect");
  if (!b) return;
  if (Chain.account) { b.textContent = short(Chain.account); b.classList.remove("dark"); b.classList.add("ghost"); }
  else if (!Chain.hasWallet()) { b.textContent = "No wallet"; b.disabled = true; }
  else b.textContent = "Connect wallet";
}

function wireConnect() {
  const b = $("connect");
  if (!b) return;
  b.addEventListener("click", async () => {
    if (Chain.account) return;
    try { await Chain.connect(); drawConnect(); render(); }
    catch (e) { toast(errText(e)); }
  });
}

/* Anything with data-switch really moves the wallet, adding the network first
 * if it has never seen it. */
function wireSwitches() {
  document.querySelectorAll("[data-switch]").forEach(b => {
    b.addEventListener("click", async () => {
      try { await Chain.switchTo(Number(b.dataset.switch)); location.reload(); }
      catch (e) { toast(errText(e)); }
    });
  });
}

function wrongNetworkNote() {
  if (!Chain.hasWallet()) {
    return `<div class="blocked"><b>No wallet in this browser.</b>
      The register reads fine without one; launching needs a wallet on Robinhood Chain.</div>`;
  }
  if (!Chain.canLaunch()) {
    const away = Chain.walletChainInfo();
    return `<div class="blocked"><b>Coins launch on Robinhood Chain, not on ${esc(away.name)}.</b>
      Whether this browser can reach a node has nothing to do with it — a wallet on
      ${esc(away.name)} cannot open a pairing on Robinhood Chain either way.
      <div class="acts"><button class="btn dark sm" type="button" data-switch="4663">Move my wallet</button>
      <button class="btn ghost sm" type="button" data-switch="46630">Testnet</button></div></div>`;
  }
  return "";
}

/* ---------------- page: the register ---------------- */
const state = { q: "", cls: "Any", sort: "mw" };

function drawRegister() {
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

const PAGES = {};

PAGES.register = function register() {
  const total = PLANTS.reduce((a, p) => a + p.mw, 0);
  $("stats").innerHTML = `
    <div><dt>Stations in the register</dt><dd>${PLANTS.length}</dd><p class="note">Seven of each class</p></div>
    <div><dt>Countries</dt><dd>${new Set(PLANTS.map(p => p.l)).size}</dd><p class="note">On five continents</p></div>
    <div><dt>Installed capacity</dt><dd>${(total / 1000).toFixed(1)} <small>GW</small></dd>
      <p class="note">As published by their operators</p></div>
    <div><dt>Rows carrying a source</dt><dd>${PLANTS.filter(p => p.url).length} <small>of ${PLANTS.length}</small></dd>
      <p class="note">Linked, so you can check it</p></div>`;
  document.querySelectorAll(".stats .note").forEach(n => {
    n.style.color = "rgba(234,241,238,.45)"; n.style.fontSize = "11.5px"; n.style.margin = "0";
  });
  $("note").innerHTML = attributionLine();
  $("q").addEventListener("input", e => { state.q = e.target.value; drawRegister(); });
  $("f-class").addEventListener("change", e => { state.cls = e.target.value; drawRegister(); });
  $("f-sort").addEventListener("change", e => { state.sort = e.target.value; drawRegister(); });
  drawRegister();
};

function attributionLine() {
  return `Every figure here comes from the ${esc(ATTRIBUTION)}. The mark on a row means the capacity `
    + `and the coordinates are as that source published them, and links there. It is not an `
    + `endorsement: no exchange, launchpad, operator or public body has verified, approved or has `
    + `any opinion about a coin launched through this site.`;
}

/* ---------------- page: launch ---------------- */
PAGES.launch = function launchPage() {
  const form = $("form");
  let cls = "Hydro";
  let terms = null, termsFor = null;

  /* Pons' terms, read once per account and shared by the fee line, the preview
   * and the button rather than fetched three times. */
  function loadTerms() {
    const key = `${Chain.chainId}:${Chain.account || ""}`;
    if (termsFor === key || !Chain.viaPons()) return;
    termsFor = key;
    PONS.terms(Chain.provider, Chain.chainId, Chain.account)
      .then(t => { terms = t; render(); })
      .catch(e => console.warn("pons: terms unreadable", e.shortMessage || e.message));
  }

  function options() {
    const rows = PLANTS.filter(p => p.c === cls).sort((a, b) => b.mw - a.mw);
    $("f-source").innerHTML = rows.map(p =>
      `<option value="${p.t}">${esc(p.n)} — ${esc(place(p))}, ${p.mw.toLocaleString("en-US")} MW</option>`).join("");
  }

  $("f-classes").innerHTML = CLASSES.map(c =>
    `<button class="tab" type="button" data-c="${c}">${c}</button>`).join("");
  $("f-classes").addEventListener("click", e => {
    const b = e.target.closest(".tab");
    if (!b) return;
    cls = b.dataset.c; options(); paint();
  });

  /* Arriving from a Pair button in the register. */
  const wanted = qs("source") && byTicker(qs("source"));
  if (wanted) cls = wanted.c;
  options();
  if (wanted) $("f-source").value = wanted.t;
  document.querySelectorAll("#f-classes .tab").forEach(b => b.classList.toggle("on", b.dataset.c === cls));

  const picked = () => byTicker($("f-source").value) || PLANTS[0];

  function paint() {
    document.querySelectorAll("#f-classes .tab").forEach(b => b.classList.toggle("on", b.dataset.c === cls));
    const p = picked();
    const s = sentenceFor(p);

    $("f-picked").innerHTML = `${mark(p.c)}<span><b>${esc(p.n)}</b>
      <span class="pair">${esc(p.t)} · ${esc(s.note)}</span></span>
      <a class="src" href="${esc(p.url)}" target="_blank" rel="noopener nofollow">${TICK}Source</a>`;

    const sym = ($("f-symbol").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    const name = $("f-name").value.trim();
    const fee = terms ? `${ethers.formatEther(terms.launchFee)} ETH` : "reading…";
    const supply = terms ? Number(ethers.formatEther(terms.config.supply)).toLocaleString("en-US") : "reading…";
    const grad = terms ? `${Number(ethers.formatEther(terms.config.graduationThreshold)).toLocaleString("en-US")} ETH`
                       : "reading…";
    const trade = terms ? `${(terms.config.curveFeeBps / 100).toFixed(2)}%` : "reading…";

    $("preview").innerHTML = `
      <div class="pv-head">${mark(p.c)}<span>
        <b>${esc(name || "Your coin")}</b><span class="mono">${esc(sym || "TICKER")}</span></span></div>
      <p class="pv-lede">${esc(s.place)} — ${esc(s.note)} The ticker goes into the token itself,
      where anyone can read the pairing back.</p>
      <div class="pv-grid">
        <div><span>Launch fee</span><b>${esc(fee)}</b></div>
        <div><span>Trade fee</span><b>${esc(trade)}</b></div>
        <div><span>Supply</span><b>${esc(supply)}</b></div>
        <div><span>Graduates at</span><b>${esc(grad)}</b></div>
      </div>
      <ol class="pv-steps">
        <li><span>1</span>Sign the launch in your wallet</li>
        <li><span>2</span>Pons mints the supply into a curve</li>
        <li><span>3</span>${Number($("f-firstbuy").value) > 0
            ? `Your ${esc($("f-firstbuy").value)} ETH fills on that curve`
            : "Take an opening position, or leave the curve flat"}</li>
        <li><span>4</span>It graduates into a locked Uniswap V4 pool</li>
      </ol>
      <p class="hint" style="margin-top:14px">Supply, fees and the threshold are Pons' and are read
      off the factory, not set here.</p>`;
  }

  function renderWallet() {
    const host = $("f-wallet");
    const blocked = wrongNetworkNote();
    host.innerHTML = blocked + (Chain.account
      ? `<div class="wallet on"><span class="w-art">✦</span><span>
           <b>${short(Chain.account)}</b>
           <small>Connected on ${esc(Chain.walletChainInfo().name)}${
             Chain.canLaunch() ? ". Launching through Pons V2." : "."}</small></span></div>`
      : Chain.hasWallet()
        ? `<button class="wallet" type="button" id="w-connect"><span class="w-art">✦</span><span>
             <b>Browser wallet</b><small>Connect it to sign the launch.</small></span></button>`
        : "");
    $("w-connect")?.addEventListener("click", async () => {
      try { await Chain.connect(); drawConnect(); render(); } catch (e) { toast(errText(e)); }
    });
    wireSwitches();

    const btn = $("f-submit");
    const stuck = !Chain.hasWallet() || !Chain.canLaunch();
    btn.disabled = stuck;
    btn.textContent = !Chain.hasWallet() ? "No wallet in this browser"
      : !Chain.canLaunch() ? "Switch to Robinhood Chain"
      : "Launch";
    $("f-cost").textContent = terms
      ? `Launch fee ${ethers.formatEther(terms.launchFee)} ETH, plus gas.`
      : Chain.viaPons() ? "Reading the launch fee…" : "Plus gas.";
    loadTerms();
  }

  window.render = () => { paint(); renderWallet(); };

  ["f-source", "f-name", "f-symbol", "f-firstbuy"].forEach(id =>
    $(id).addEventListener("input", paint));
  $("f-source").addEventListener("change", paint);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("f-submit");
    try {
      if (!Chain.account) await Chain.connect();
      if (!Chain.canLaunch()) return toast(`Your wallet is on ${Chain.walletChainInfo().name}.`);
      const symbol = ($("f-symbol").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      if (!symbol) return toast("The ticker needs at least one letter or number.");
      const p = picked();
      const s = sentenceFor(p);
      const first = $("f-firstbuy").value ? ethers.parseEther($("f-firstbuy").value) : 0n;

      btn.disabled = true;
      btn.textContent = "Confirm in your wallet…";
      const { token } = await Chain.launch({
        name: $("f-name").value.trim() || p.n, symbol,
        source: p.t, place: s.place, note: s.note, firstBuyWei: first,
      });
      location.href = `token.html?addr=${token}&new=1`;
    } catch (err) {
      btn.disabled = false;
      renderWallet();
      toast(errText(err));
    }
  });

  $("note").innerHTML = attributionLine();
  render();
};

/* ---------------- page: launches ---------------- */
PAGES.launches = function launchesPage() {
  const host = $("rows");
  $("note").innerHTML = attributionLine();

  const stage = p => p.graduated ? "Graduated"
    : p.raised >= p.target ? "Ready" : "On the curve";

  function drawRows(list, metas) {
    host.innerHTML = list.map((p, i) => {
      const m = metas[i] || {};
      const st = byTicker(p.source);
      const pct = p.target > 0n ? Number((p.raised * 100n) / p.target) : 0;
      return `<tr>
        <td><span class="who">${st ? mark(st.c) : ""}<span>
          <b><a href="token.html?addr=${esc(p.token)}">${esc(m.name || "Coin")}</a></b>
          <span class="pair">${esc(m.symbol || p.source)}</span></span></span></td>
        <td class="hide-s">${st ? `<b style="font-size:13px">${esc(st.n)}</b>
          <div class="pair">${esc(place(st))} · ${st.mw.toLocaleString("en-US")} MW</div>`
          : `<span style="color:var(--ink-3)">${esc(p.source || "—")}</span>`}</td>
        <td class="hide-l pair">${p.launchedAt ? new Date(p.launchedAt * 1000).toLocaleDateString() : "—"}</td>
        <td class="hide-l"><a class="src" href="${esc(Chain.explorerLink("token", p.token) || "#")}"
          target="_blank" rel="noopener">${esc(short(p.token))}${OUT}</a></td>
        <td class="r num">${eth(p.raised)}<div class="pair" style="text-align:right">${pct}% of target</div></td>
        <td class="r"><span class="chip">${stage(p)}</span></td>
      </tr>`;
    }).join("");
  }

  /* A scan that finds nothing has to look at the whole window before it can say
   * so, so the table says what it is doing rather than holding one word. */
  function scanning() {
    host.innerHTML = `<tr><td colspan="6" class="empty">Reading the chain…</td></tr>`;
    const t = setTimeout(() => {
      host.innerHTML = `<tr><td colspan="6" class="empty">Nothing paired yet in the last few
        thousand blocks. Still looking further back…</td></tr>`;
    }, 3000);
    return () => clearTimeout(t);
  }

  async function load() {
    if (Chain.offline) {
      host.innerHTML = `<tr><td colspan="6" class="empty">No node reachable from this browser.</td></tr>`;
      return;
    }
    const done = scanning();
    const list = await Chain.pairings(60, rows => {
      if (rows.length) { done(); drawRows(rows, rows.map(() => ({}))); }
    });
    done();
    if (!list.length) {
      host.innerHTML = `<tr><td colspan="6" class="empty">
        Nothing paired on ${esc(Chain.chainInfo().name)} yet.
        <a href="launch.html" style="color:var(--ok)">Be the first</a>.</td></tr>`;
    } else {
      const metas = await Promise.all(list.map(p => Chain.tokenMeta(p.token).catch(() => ({}))));
      drawRows(list, metas);
    }
    $("stats").innerHTML = `
      <div><dt>Coins launched</dt><dd>${list.length}</dd><p class="note">On ${esc(Chain.chainInfo().name)}</p></div>
      <div><dt>Stations paired</dt><dd>${new Set(list.map(p => p.source)).size}
        <small>of ${PLANTS.length}</small></dd><p class="note">Each one only once is not enforced</p></div>
      <div><dt>Graduated</dt><dd>${list.filter(p => p.graduated).length}</dd>
        <p class="note">Into a locked Uniswap V4 pool</p></div>
      <div><dt>Latest</dt><dd>${list.length ? new Date(list[0].launchedAt * 1000).toLocaleDateString() : "Nothing yet"}</dd>
        <p class="note">Newest first</p></div>`;
    document.querySelectorAll(".stats .note").forEach(n => {
      n.style.color = "rgba(234,241,238,.45)"; n.style.fontSize = "11.5px"; n.style.margin = "0";
    });
  }

  load();
  /* Somebody else launching while this page is open lands in the table without
     a reload. */
  Chain.watchLaunches(n => {
    toast(n === 1 ? "A coin was just launched." : `${n} coins were just launched.`);
    load();
  });
};

/* ---------------- page: one coin ---------------- */
PAGES.token = function tokenPage() {
  const host = $("token-view");
  const addr = qs("addr");
  if (!addr || !ethers.isAddress(addr)) {
    host.innerHTML = `<p class="empty">No token address in the link.
      <a href="launches.html" style="color:var(--ok)">See the launches</a>.</p>`;
    return;
  }
  if (qs("new")) toast("Launched. The pairing is on chain.", 5200);
  host.innerHTML = `<p class="empty">Reading the chain…</p>`;

  async function load() {
    try {
      const [p, meta] = await Promise.all([Chain.pairing(addr), Chain.tokenMeta(addr)]);
      const st = byTicker(meta.source);
      const pct = p.target > 0n ? Number((p.raised * 100n) / p.target) : 0;
      const held = Chain.account ? await Chain.balanceOf(addr, Chain.account).catch(() => 0n) : 0n;

      host.innerHTML = `
        <div class="tok-head">${st ? mark(st.c) : ""}
          <div><h1>${esc(meta.name || "Coin")}</h1>
            <span class="pair">${esc(meta.symbol || "")} · paired to ${esc(st ? st.n : meta.source || "—")}</span></div></div>

        ${st ? `<div class="sheet" style="padding:16px 18px;display:flex;gap:14px;align-items:center">
          <span><b style="font-size:14px">${esc(st.n)}</b>
            <div class="pair">${esc(place(st))} · ${st.c} · ${st.mw.toLocaleString("en-US")} MW · ${coords(st.g)}</div></span>
          <a class="src" style="margin-left:auto" href="${esc(st.url)}" target="_blank"
             rel="noopener nofollow">${TICK}Source <span class="host">${esc(host2(st))}</span>${OUT}</a>
        </div>` : ""}

        <div class="tok-grid">
          <div><span>Raised</span><b>${eth(p.raised)}</b></div>
          <div><span>Toward graduation</span><b>${pct}%</b></div>
          <div><span>Contract</span><b class="mono" style="font-size:13px">${short(addr)}</b></div>
          <div><span>Your balance</span><b>${Number(ethers.formatEther(held)).toLocaleString("en-US",
            { maximumFractionDigits: 0 })}</b></div>
        </div>

        <div class="trade">
          <div class="sheet"><p class="f-label">Buy</p>
            <label class="field">ETH in
              <input id="buy-amt" class="mono" type="number" min="0" step="any" value="0.05"></label>
            <button class="btn dark" type="button" id="buy-btn">Buy</button></div>
          <div class="sheet"><p class="f-label">Sell</p>
            <label class="field">Tokens in
              <input id="sell-amt" class="mono" type="number" min="0" step="any" value="0"></label>
            <button class="btn ghost" type="button" id="sell-btn">Sell</button></div>
        </div>

        <h2 style="font-size:17px;margin:26px 0 8px">What the contract says</h2>
        <pre class="readout">${esc(meta.description || "—")}</pre>
        <p class="note">${attributionLine()}</p>`;

      const run = async (btn, fn) => {
        btn.disabled = true;
        const was = btn.textContent;
        btn.textContent = "Confirm in your wallet…";
        try { await fn(); toast("Done."); load(); }
        catch (e) { toast(errText(e)); }
        finally { btn.disabled = false; btn.textContent = was; }
      };
      $("buy-btn").addEventListener("click", () => run($("buy-btn"), async () => {
        if (!Chain.account) await Chain.connect();
        await Chain.buy(addr, ethers.parseEther($("buy-amt").value || "0"));
      }));
      $("sell-btn").addEventListener("click", () => run($("sell-btn"), async () => {
        if (!Chain.account) await Chain.connect();
        await Chain.sell(addr, ethers.parseEther($("sell-amt").value || "0"));
      }));
    } catch (e) {
      host.innerHTML = `<p class="empty">${esc(errText(e))}</p>`;
    }
  }
  load();
};

/* the register page calls this `host`; the token page needed the name too */
const host2 = host;

/* ---------------- page: docs ---------------- */
PAGES.docs = function docsPage() {
  const sample = byTicker("GC") || PLANTS[0];
  const s = sentenceFor(sample);
  $("sample").textContent = PONS.describe(sample.t, s.place, s.note);
  $("note").innerHTML = attributionLine();

  /* Reading Pons out loud. Everything here comes off the chain the visitor's
   * wallet is on: when a launch is refused, this is what says why. */
  $("pons-check")?.addEventListener("click", async e => {
    const btn = e.currentTarget, out = $("pons-readout");
    const say = lines => { out.hidden = false; out.textContent = lines.join("\n"); };
    btn.disabled = true;
    const was = btn.textContent; btn.textContent = "Reading…";
    try {
      const id = Number(Chain.chainId);
      if (!PONS.has(id)) {
        return say([`Pons is not on ${Chain.chainInfo().name} (chain ${id}).`,
                    `It is on Robinhood Chain, 4663.`]);
      }
      const f = PONS.factory(Chain.provider, id);
      const who = Chain.account;
      const lines = [`factory        ${PONS.address(id)}`,
                     `network        ${Chain.chainInfo().name} (${id})`];
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
      } else lines.push("canLaunch(you) — connect a wallet to ask");
      try {
        const c = await PONS.pickConfig(f);
        lines.push(`config #${c.id}      supply ${ethers.formatEther(c.supply)}, `
          + `graduates at ${ethers.formatEther(c.graduationThreshold)} ETH, fee ${c.curveFeeBps} bps`);
      } catch (err) { lines.push(`config         — ${err.shortMessage || err.message}`); }
      lines.push("", "the description a launch would write:", PONS.describe(sample.t, s.place, s.note));
      say(lines);
    } catch (err) { say([`failed: ${errText(err)}`]); }
    finally { btn.disabled = false; btn.textContent = was; }
  });

  /* Creator fees sit in two places and only one of them pays out. */
  let fees = null;
  $("fee-check")?.addEventListener("click", async e => {
    const btn = e.currentTarget, out = $("fee-readout"), acts = $("fee-acts");
    const say = lines => { out.hidden = false; out.textContent = lines.join("\n"); };
    const token = ($("fee-token").value || "").trim();
    acts.hidden = true;
    if (!ethers.isAddress(token)) return say(["Paste the token's contract address first."]);
    if (!Chain.viaPons()) return say([`Fees are read on Robinhood Chain, not ${Chain.chainInfo().name}.`]);
    btn.disabled = true;
    const was = btn.textContent; btn.textContent = "Reading…";
    try {
      const f = await Chain.fees(ethers.getAddress(token));
      fees = f;
      say([
        `token          ${f.token}`,
        `curve          ${f.curve}`,
        `escrow         ${f.escrow}`,
        ``,
        `fee recipient  ${f.recipient}`,
        `creator tax    ${f.creatorTaxBps} bps${f.creatorTaxBps === 0 ? "  (none set at launch)" : ""}`,
        `buyback        ${f.buybackEnabled
          ? "on — part of the creator share buys back and locks tokens" : "off"}`,
        ``,
        `on the curve   ${eth(f.unswept)}   (needs a sweep before it can be claimed)`,
        `in escrow      ${eth(f.claimable)}`,
        Chain.account ? `your balance   ${eth(f.yours)}` : `your balance   — connect a wallet`,
        ``,
        f.yours > 0n ? "You can claim now."
          : f.unswept > 0n ? (f.canSweep ? "Nothing to claim yet. Sweep the curve first."
            : "Fees are waiting on the curve, but only the deployer or Pons' operator can sweep.")
          : "Nothing owed at the moment.",
      ]);
      acts.hidden = !(f.yours > 0n || (f.unswept > 0n && f.canSweep));
      $("fee-claim").disabled = !(f.yours > 0n);
      $("fee-sweep").disabled = !(f.unswept > 0n && f.canSweep);
    } catch (err) { fees = null; say([`failed: ${errText(err)}`]); }
    finally { btn.disabled = false; btn.textContent = was; }
  });

  const act = (id, fn, done) => $(id)?.addEventListener("click", async e => {
    const btn = e.currentTarget; btn.disabled = true;
    const was = btn.textContent; btn.textContent = "Confirm in your wallet…";
    try { await fn(); toast(done); } catch (err) { toast(errText(err)); }
    finally { btn.disabled = false; btn.textContent = was; }
  });
  /* With buybacks on the sweep swaps part of the creator share for tokens and
     refuses a zero floor rather than taking any price it is given. */
  act("fee-sweep", () => Chain.sweep(fees.token, fees.buybackEnabled ? 1n : 0n),
      "Swept. Check again to see it in the escrow.");
  act("fee-claim", () => Chain.claimFees(), "Claimed.");
};

/* ---------------- boot ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  drawCa();
  wireCopy();
  wireConnect();
  wireSwitches();
  const page = document.body.dataset.page;

  /* The register needs nothing from the chain, so it draws before any of this
     and stays drawn if the chain never answers. */
  if (page === "register") { PAGES.register(); }

  try { await Chain.init(); } catch (e) { console.warn("chain init", e); }
  drawCa(); drawConnect();

  const fn = PAGES[page];
  if (fn && page !== "register") {
    try { fn(); } catch (e) { console.error(e); toast(errText(e)); }
  }
});
