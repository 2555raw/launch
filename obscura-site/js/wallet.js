// Wallet connection for EVM browser wallets.
//
// Installed wallets announce themselves through EIP-6963; older ones are found
// through their injected flags. A wallet that is not installed opens its own
// download page, or on a phone, opens this page inside the wallet's browser.

import { toast, track } from "./site.js";

export const WALLETS = [
  { id: "metamask", name: "MetaMask", rdns: ["io.metamask"], flag: (e) => e.isMetaMask && !e.isRabby && !e.isBraveWallet && !e.isPhantom && !e.isTrust && !e.isTrustWallet && !e.isOkxWallet && !e.isRainbow && !e.isCoinbaseWallet,
    install: "https://metamask.io/download/", deeplink: (u) => `https://metamask.app.link/dapp/${u.replace(/^https?:\/\//, "")}` },
  { id: "phantom", name: "Phantom", rdns: ["app.phantom"], flag: (e) => e.isPhantom, legacy: () => window.phantom?.ethereum,
    install: "https://phantom.com/download", deeplink: (u) => `https://phantom.app/ul/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(location.origin)}` },
  { id: "coinbase", name: "Coinbase Wallet", rdns: ["com.coinbase.wallet"], flag: (e) => e.isCoinbaseWallet, legacy: () => window.coinbaseWalletExtension,
    install: "https://www.coinbase.com/wallet/downloads", deeplink: (u) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(u)}` },
  { id: "rabby", name: "Rabby", rdns: ["io.rabby"], flag: (e) => e.isRabby,
    install: "https://rabby.io/" },
  { id: "trust", name: "Trust Wallet", rdns: ["com.trustwallet.app"], flag: (e) => e.isTrust || e.isTrustWallet, legacy: () => window.trustwallet,
    install: "https://trustwallet.com/download", deeplink: (u) => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(u)}` },
  { id: "okx", name: "OKX Wallet", rdns: ["com.okex.wallet"], flag: (e) => e.isOkxWallet || e.isOKExWallet, legacy: () => window.okxwallet,
    install: "https://www.okx.com/web3", deeplink: (u) => `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(u)}` },
  { id: "rainbow", name: "Rainbow", rdns: ["me.rainbow"], flag: (e) => e.isRainbow,
    install: "https://rainbow.me/download" },
  { id: "brave", name: "Brave Wallet", rdns: ["com.brave.wallet"], flag: (e) => e.isBraveWallet,
    install: "https://brave.com/wallet/" },
].map((w) => ({ ...w, icon: `assets/wallets/${w.id}.svg` }));

const STORE = "obscura.wallet";
const announced = new Map(); // rdns -> { info, provider }
const listeners = new Set();
let current = null;          // { wallet, provider, address }

const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function providerFor(w) {
  for (const r of w.rdns) if (announced.has(r)) return announced.get(r).provider;
  if (w.legacy?.()) return w.legacy();
  const eth = window.ethereum;
  if (!eth) return null;
  // A provider that already announced itself under another name is that wallet,
  // whatever flags it copies from MetaMask.
  const claimed = new Set([...announced.values()].map((a) => a.provider));
  const pick = (p) => !claimed.has(p) && w.flag(p);
  if (Array.isArray(eth.providers)) return eth.providers.find(pick) || null;
  return pick(eth) ? eth : null;
}

// Wallets that announced themselves but are not in our list still get a row,
// with the name and icon they supply.
function extraWallets() {
  const known = new Set(WALLETS.flatMap((w) => w.rdns));
  return [...announced.values()].filter(({ info }) => !known.has(info.rdns)).map(({ info, provider }) => ({
    id: info.rdns, name: info.name, rdns: [info.rdns], icon: info.icon, flag: () => false, extra: provider,
  }));
}
const allWallets = () => [...WALLETS, ...extraWallets()];
const findWallet = (id) => allWallets().find((w) => w.id === id || w.rdns.includes(id));

export function connection() { return current; }

// Resolves with the connection, or null if the picker is closed without one.
const closedListeners = new Set();
function emitClosed() { closedListeners.forEach((fn) => fn()); closedListeners.clear(); }
export function waitForConnection() {
  if (current) return Promise.resolve(current);
  return new Promise((resolve) => {
    const off = onWalletChange((c) => { if (c) { off(); closedListeners.delete(cancel); resolve(c); } });
    const cancel = () => { off(); resolve(null); };
    closedListeners.add(cancel);
  });
}
export function onWalletChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { renderButtons(); renderList(); listeners.forEach((fn) => fn(current)); }

// Follow account and network changes once per provider, however it connected.
const watched = new WeakSet();
function watch(provider) {
  if (watched.has(provider) || !provider.on) return;
  watched.add(provider);
  provider.on("accountsChanged", (accs) => {
    if (current?.provider !== provider) return;
    if (!accs?.length) disconnect(); else if (accs[0] !== current.address) { current.address = accs[0]; emit(); }
  });
  provider.on("chainChanged", () => { if (current?.provider === provider) emit(); });
}

export async function connect(id) {
  const w = findWallet(id);
  if (!w) return;
  const provider = w.extra || providerFor(w);
  if (!provider) {
    if (mobile && w.deeplink) location.href = w.deeplink(location.href);
    else {
      // A real link rather than window.open, which embedded viewers block.
      const a = document.createElement("a");
      a.href = w.install; a.target = "_blank"; a.rel = "noopener";
      a.click();
    }
    return;
  }
  try {
    const [address] = await provider.request({ method: "eth_requestAccounts" });
    if (!address) throw new Error("No account was shared");
    current = { wallet: w, provider, address };
    try { localStorage.setItem(STORE, w.rdns[0]); } catch { /* not remembered */ }
    watch(provider);
    emit();
    dialog()?.close();
    toast(`${w.name} connected · ${short(address)}`);
    track("wallet");
  } catch (err) {
    toast(err?.code === 4001 ? "Connection request was declined in the wallet" : (err?.message || "The wallet did not connect"));
  }
}

export function disconnect() {
  const p = current?.provider;
  current = null;
  try { localStorage.removeItem(STORE); } catch { /* nothing stored */ }
  p?.request?.({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }).catch(() => {});
  emit();
}

// Restore a previous session without a prompt: eth_accounts only answers if
// the wallet already trusts this site.
async function restore() {
  let rdns;
  try { rdns = localStorage.getItem(STORE); } catch { return; }
  if (!rdns) return;
  const w = findWallet(rdns);
  const provider = w && (w.extra || providerFor(w));
  if (!provider) return;
  try {
    const [address] = await provider.request({ method: "eth_accounts" });
    if (address) { current = { wallet: w, provider, address }; watch(provider); emit(); }
  } catch { /* stay disconnected */ }
}

// ---------- UI ----------
function dialog() { return document.getElementById("wallet-dialog"); }

function buildDialog() {
  const dlg = document.createElement("dialog");
  dlg.id = "wallet-dialog";
  dlg.setAttribute("aria-labelledby", "wallet-title");
  dlg.innerHTML = `
    <div class="sheet-card">
      <button class="icon-btn dialog-close" type="button" aria-label="Close" data-close>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <div class="sheet-head">
        <h2 id="wallet-title">Connect a wallet</h2>
        <p>Signs proofs so the other side can check your balance, and anchors seal codes onchain. Obscura never asks for your keys or a token approval.</p>
      </div>
      <div class="sheet-body"><div id="wallet-connected"></div><ul class="wallet-list" id="wallet-list"></ul></div>
    </div>`;
  dlg.addEventListener("close", () => { if (!current) emitClosed(); });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
    const item = e.target.closest("[data-connect]");
    if (item) connect(item.dataset.connect);
    if (e.target.closest("[data-disconnect]")) disconnect();
  });
  document.body.append(dlg);
  renderList();
  return dlg;
}

export function openWallets() {
  const dlg = dialog() || buildDialog();
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  renderList();
  if (!dlg.open) dlg.showModal();
}

function stateFor(w) {
  if (w.extra || providerFor(w)) return { text: "Detected", cls: "ready", sub: "Installed in this browser" };
  if (mobile && w.deeplink) return { text: "Open app", cls: "", sub: "Opens this page in the wallet" };
  return { text: "Install", cls: "", sub: "Get the extension or app" };
}

function renderList() {
  const list = document.getElementById("wallet-list");
  if (!list) return;
  const rows = allWallets().map((w) => {
    const s = stateFor(w);
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.className = "wallet-item"; b.type = "button"; b.dataset.connect = w.id;
    const img = document.createElement("img"); img.src = w.icon; img.alt = ""; img.width = img.height = 40;
    const txt = document.createElement("span");
    const name = document.createElement("b"); name.textContent = w.name;
    const sub = document.createElement("small"); sub.textContent = s.sub;
    txt.append(name, sub);
    const st = document.createElement("span"); st.className = "state " + s.cls; st.textContent = s.text;
    b.append(img, txt, st); li.append(b);
    return li;
  });
  // detected wallets first
  rows.sort((a, b) => (b.querySelector(".ready") ? 1 : 0) - (a.querySelector(".ready") ? 1 : 0));
  list.replaceChildren(...rows);

  const box = document.getElementById("wallet-connected");
  box.replaceChildren();
  if (current) {
    box.className = "wallet-connected";
    const row = document.createElement("div"); row.className = "row";
    const img = document.createElement("img"); img.src = current.wallet.icon; img.alt = "";
    const t = document.createElement("div");
    const n = document.createElement("b"); n.textContent = current.wallet.name;
    const a = document.createElement("div"); a.className = "addr"; a.textContent = short(current.address);
    t.append(n, a); row.append(img, t);
    const off = document.createElement("button"); off.className = "btn btn-light btn-sm"; off.type = "button"; off.dataset.disconnect = ""; off.textContent = "Disconnect";
    box.append(row, off);
  } else {
    box.className = "";
  }
}

function renderButtons() {
  for (const btn of document.querySelectorAll("[data-wallet-open]")) {
    // The side rail's button is an icon: it shows the wallet's logo once connected.
    if ("compact" in btn.dataset) {
      if (!btn.dataset.icon) btn.dataset.icon = btn.innerHTML;
      if (current) {
        const img = document.createElement("img"); img.src = current.wallet.icon; img.alt = "";
        btn.replaceChildren(img);
        btn.dataset.label = short(current.address);
        btn.setAttribute("aria-label", `${current.wallet.name} connected, ${current.address}. Manage wallet`);
      } else {
        btn.innerHTML = btn.dataset.icon;
        btn.dataset.label = "Connect wallet";
        btn.setAttribute("aria-label", "Connect wallet");
      }
      continue;
    }
    btn.replaceChildren();
    if (current) {
      const img = document.createElement("img"); img.src = current.wallet.icon; img.alt = "";
      const s = document.createElement("span"); s.className = "mono"; s.textContent = short(current.address);
      btn.append(img, s);
      btn.setAttribute("aria-label", `${current.wallet.name} connected, ${current.address}. Manage wallet`);
    } else {
      btn.textContent = btn.dataset.label || "Connect wallet";
      btn.removeAttribute("aria-label");
    }
  }
}

function renderTiles() {
  for (const tile of document.querySelectorAll("[data-wallet]")) {
    const w = findWallet(tile.dataset.wallet);
    const tag = tile.querySelector(".tag");
    if (w && tag) tag.textContent = providerFor(w) ? "Detected" : "";
  }
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-wallet-open]")) openWallets();
  const tile = e.target.closest("[data-wallet]");
  if (tile) connect(tile.dataset.wallet);
});

// Listen for wallets announcing themselves (EIP-6963), then ask them to.
// Registered last: an extension may answer synchronously.
window.addEventListener("eip6963:announceProvider", (e) => {
  const { info, provider } = e.detail || {};
  if (!info?.rdns || !provider) return;
  announced.set(info.rdns, { info, provider });
  renderList();
  renderTiles();
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

renderButtons();
renderTiles();
// Give extensions a beat to announce before restoring.
setTimeout(() => { renderTiles(); restore(); }, 300);
