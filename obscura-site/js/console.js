// Console: cloak, vault, transfer and receive. State is one array in localStorage.
import { cloak, seal, receive, encodeReceipt, verify } from "./obscura.js";
import { toast, copy } from "./site.js";
import { connection, openWallets } from "./wallet.js";

const STORE = "obscura.vault.v1";
const $ = (id) => document.getElementById(id);

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; }
}
function save(bonds) {
  try { localStorage.setItem(STORE, JSON.stringify(bonds)); } catch { toast("This browser blocked storage: export a backup now"); }
}
let vault = load();

function addBond(receipt) {
  vault.unshift({ ...receipt, status: "live" });
  save(vault);
  renderVault();
}

function label(b) {
  return `${b.asset.amount} ${b.asset.symbol}`;
}

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
}

// ---------- tabs ----------
const tabs = [...document.querySelectorAll(".tab")];
function show(name) {
  for (const t of tabs) t.setAttribute("aria-selected", String(t.dataset.tab === name));
  for (const p of document.querySelectorAll(".panel")) p.classList.toggle("active", p.id === "panel-" + name);
  history.replaceState(null, "", "#" + name);
}
tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab)));
const start = location.hash.slice(1);
if (tabs.some((t) => t.dataset.tab === start)) show(start);

// ---------- cloak ----------
$("cloak-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const r = await cloak({ amount: $("c-amount").value, symbol: $("c-symbol").value, chain: $("c-chain").value, note: $("c-note").value });
    addBond(r);
    $("c-commit").textContent = "0x" + r.commitment;
    $("c-receipt").value = encodeReceipt(r);
    $("cloak-empty").hidden = true;
    $("cloak-out").hidden = false;
    toast("Bond cloaked and saved to the vault");
  } catch (err) {
    toast(err.message);
  }
});

// ---------- vault ----------
async function anchor(b) {
  const conn = connection();
  if (!conn) {
    toast("Connect a wallet to anchor this commitment");
    return openWallets();
  }
  try {
    const hash = await conn.provider.request({
      method: "eth_sendTransaction",
      params: [{ from: conn.address, to: conn.address, value: "0x0", data: "0x" + b.commitment }],
    });
    b.anchor = hash;
    save(vault);
    renderVault();
    toast("Anchored: " + hash.slice(0, 12) + "…");
  } catch (err) {
    toast(err?.code === 4001 ? "Transaction was declined in the wallet" : (err?.message || "The wallet did not send the transaction"));
  }
}

function renderVault() {
  const list = $("vault-list");
  list.replaceChildren();
  $("vault-count").textContent = vault.length;
  if (!vault.length) {
    list.append(el("div", { class: "empty" }, "Your vault is empty. Cloak a bond or receive one."));
  }
  for (const b of vault) {
    const badge = el("span", { class: "badge " + b.status }, b.status === "sent" ? "Sent" : "Live");
    const meta = el("span", { class: "badge" }, b.asset.chain);
    const actions = el("div", { class: "actions", style: "margin-top:4px" },
      el("button", { class: "btn btn-dark btn-sm", type: "button", onclick: () => copy(encodeReceipt(b), "Receipt copied") }, "Copy receipt"),
      el("button", { class: "btn btn-light btn-sm", type: "button", onclick: () => copy("0x" + b.commitment, "Commitment copied") }, "Copy commitment"),
      el("button", { class: "btn btn-light btn-sm", type: "button", onclick: () => { $("t-bond").value = b.commitment; show("transfer"); } }, "Transfer"),
      el("button", { class: "btn btn-light btn-sm", type: "button", onclick: () => anchor(b) }, b.anchor ? "Anchored" : "Anchor with wallet"),
      el("button", {
        class: "btn btn-ghost btn-sm", type: "button", onclick: () => {
          if (!confirm(`Remove ${label(b)}? Without a backup this bond can never be opened again.`)) return;
          vault = vault.filter((x) => x !== b);
          save(vault);
          renderVault();
        },
      }, "Remove"),
    );
    const extra = [];
    if (b.asset.note) extra.push(el("span", { class: "hint" }, "Note: " + b.asset.note));
    if (b.prev) extra.push(el("span", { class: "bond-hash" }, "Re-cloaked from 0x" + b.prev.slice(0, 16) + "…"));
    if (b.anchor) extra.push(el("span", { class: "bond-hash" }, "Anchor tx " + b.anchor));
    list.append(el("div", { class: "bond" },
      el("div", { class: "bond-top" }, el("span", { class: "bond-amt" }, label(b)), el("span", { style: "display:flex;gap:6px" }, meta, badge)),
      el("span", { class: "bond-hash" }, "0x" + b.commitment),
      ...extra,
      actions,
    ));
  }

  const sel = $("t-bond");
  const keep = sel.value;
  sel.replaceChildren(...vault.filter((b) => b.status === "live").map((b) =>
    el("option", { value: b.commitment }, `${label(b)} · 0x${b.commitment.slice(0, 10)}…`)));
  if (!sel.options.length) sel.append(el("option", { value: "" }, "No live bonds in the vault"));
  if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
}

$("v-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ app: "obscura", v: 1, exported: new Date().toISOString(), bonds: vault }, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `obscura-vault-${Date.now()}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});

$("v-import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const bonds = Array.isArray(data) ? data : data.bonds;
    let added = 0;
    for (const b of bonds || []) {
      if (vault.some((x) => x.commitment === b.commitment)) continue;
      if (!(await verify(b))) continue;
      vault.push({ ...b, status: b.status === "sent" ? "sent" : "live" });
      added++;
    }
    save(vault);
    renderVault();
    toast(`Imported ${added} bond${added === 1 ? "" : "s"}`);
  } catch {
    toast("That file is not an Obscura backup");
  }
});

// ---------- transfer ----------
let lastPkg = "";
$("transfer-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = vault.find((x) => x.commitment === $("t-bond").value);
  if (!b) return toast("Pick a live bond first");
  if ($("t-pass").value !== $("t-pass2").value) return toast("Passphrases do not match");
  try {
    lastPkg = await seal(b, $("t-pass").value);
    b.status = "sent";
    save(vault);
    renderVault();
    $("t-pkg").value = lastPkg;
    $("t-empty").hidden = true;
    $("t-out").hidden = false;
    $("t-pass").value = $("t-pass2").value = "";
    toast("Package sealed");
  } catch (err) {
    toast(err.message);
  }
});

$("t-download").addEventListener("click", () => {
  if (!lastPkg) return;
  const a = el("a", { href: URL.createObjectURL(new Blob([lastPkg], { type: "text/plain" })), download: `bond-${Date.now()}.obx` });
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- receive ----------
$("r-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) $("r-pkg").value = (await file.text()).trim();
});

$("receive-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  if (btn) btn.disabled = true;
  try {
    const r = await receive($("r-pkg").value, $("r-pass").value);
    addBond(r);
    $("r-asset").textContent = `${label(r)} on ${r.asset.chain}`;
    $("r-commit").textContent = "0x" + r.commitment;
    $("r-prev").textContent = "0x" + r.prev;
    $("r-empty").hidden = true;
    $("r-out").hidden = false;
    $("r-pass").value = "";
    toast("Bond received and re-cloaked");
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

renderVault();
