// Console: cloak, vault, transfer and receive. State is one array in localStorage.
import { cloak, seal, receive, encodeReceipt, verify, sealBackup, openBackup, BACKUP_PREFIX, secondsLeft } from "./obscura.js";
import { toast, copy } from "./site.js";
import { connection, openWallets, onWalletChange } from "./wallet.js";
import { readBalance, signFunds, floorAmount, parseUnits, formatUnits } from "./proof.js";
import { renderShare, openShareDialog } from "./share.js";

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

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// "Expires in 23 h", "Expired", or nothing for bonds without an expiry.
export function expiryLabel(asset) {
  const left = secondsLeft(asset);
  if (left === null) return null;
  if (left === 0) return { text: "Expired", cls: "expired" };
  const h = left / 3600;
  const text = h < 1 ? `Expires in ${Math.max(1, Math.round(left / 60))} min` : h < 48 ? `Expires in ${Math.round(h)} h` : `Expires in ${Math.round(h / 24)} days`;
  return { text, cls: "" };
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
// Wallet-backed mode: the balance comes from the wallet and the wallet signs.
let funds = null; // { address, provider, chainId, block, wei, chain }

function setFundsMode(f) {
  funds = f;
  const on = !!f;
  $("f-clear").hidden = !on;
  $("f-read").textContent = on ? "Read again" : "Read balance from wallet";
  $("c-amount-label").textContent = on ? "Prove at least" : "Amount";
  $("c-amount-hint").hidden = !on;
  $("c-symbol").readOnly = on;
  $("c-chain").disabled = on;
  $("c-submit").textContent = on ? "Seal and sign with wallet" : "Cloak bond";
  $("funds").classList.toggle("on", on);
  if (!on) {
    $("f-text").textContent = "Reads your real balance and asks your wallet to sign. Whoever checks your proof can confirm it on the blockchain. Without it, the amount is only your word.";
    return;
  }
  const held = formatUnits(f.wei, f.chain.decimals, 4);
  $("f-text").textContent = `${short(f.address)} holds ${held} ${f.chain.symbol} on ${f.chain.name} (block ${f.block.toLocaleString("en-US")}).`;
  $("c-amount").value = floorAmount(f.wei, f.chain.decimals);
  $("c-amount-hint").textContent = `Up to ${held} ${f.chain.symbol}. You can prove less than you hold.`;
  $("c-symbol").value = f.chain.symbol;
  const sel = $("c-chain");
  if (![...sel.options].some((o) => o.value === f.chain.key)) sel.append(el("option", { value: f.chain.key }, f.chain.key));
  sel.value = f.chain.key;
}

async function readFromWallet() {
  let conn = connection();
  if (!conn) {
    openWallets();
    conn = await new Promise((resolve) => {
      const off = onWalletChange((c) => { if (c) { off(); resolve(c); } });
    });
  }
  const btn = $("f-read");
  btn.setAttribute("aria-busy", "true");
  try {
    const r = await readBalance(conn.provider, conn.address);
    if (r.wei === 0n) toast(`This wallet holds no ${r.chain.symbol} on ${r.chain.name}. Switch network in the wallet and read again.`);
    setFundsMode({ ...r, address: conn.address, provider: conn.provider });
  } catch (err) {
    toast(err?.message || "The wallet did not return a balance");
  } finally {
    btn.removeAttribute("aria-busy");
  }
}

$("f-read").addEventListener("click", readFromWallet);
$("f-clear").addEventListener("click", () => setFundsMode(null));

function showResult(r) {
  $("c-commit").textContent = "0x" + r.commitment;
  $("c-receipt").value = encodeReceipt(r);
  const exp = expiryLabel(r.asset);
  $("c-backing").replaceChildren(r.proof
    ? el("span", { class: "badge live" }, "Backed by wallet " + short(r.proof.address))
    : el("span", { class: "badge" }, "Self-declared: the amount is not checked against a wallet"),
    ...(exp ? [" ", el("span", { class: "badge " + exp.cls }, exp.text)] : []));
  renderShare($("c-share"), r);
  $("cloak-empty").hidden = true;
  $("cloak-out").hidden = false;
}

$("cloak-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("c-submit");
  btn.setAttribute("aria-busy", "true");
  try {
    const ttl = Number($("c-expiry").value);
    const asset = { amount: $("c-amount").value, symbol: $("c-symbol").value, chain: $("c-chain").value, note: $("c-note").value };
    if (ttl) asset.expires = Math.floor(Date.now() / 1000) + ttl;
    if (funds && parseUnits(asset.amount, funds.chain.decimals) > funds.wei) {
      throw new Error(`You can prove at most ${formatUnits(funds.wei, funds.chain.decimals, 4)} ${funds.chain.symbol}`);
    }
    const r = await cloak(asset);
    if (funds) {
      toast("Confirm the signature in your wallet. It costs nothing and sends no transaction.");
      try {
        r.proof = await signFunds(funds.provider, { receipt: r, address: funds.address, chainId: funds.chainId, block: funds.block });
      } catch (err) {
        throw new Error(err?.code === 4001 ? "The signature was declined, so nothing was saved" : (err?.message || "The wallet did not sign"));
      }
    }
    addBond(r);
    showResult(r);
    toast(r.proof ? "Bond sealed and signed. Share the link to prove it." : "Bond cloaked and saved to the vault");
  } catch (err) {
    toast(err.message);
  } finally {
    btn.removeAttribute("aria-busy");
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
    const backed = el("span", { class: "badge" + (b.proof ? " live" : "") }, b.proof ? "Wallet-backed" : "Self-declared");
    const exp = expiryLabel(b.asset);
    const expBadge = exp ? [el("span", { class: "badge " + exp.cls }, exp.text)] : [];
    const actions = el("div", { class: "actions", style: "margin-top:4px" },
      el("button", { class: "btn btn-dark btn-sm", type: "button", onclick: () => openShareDialog(b, label(b)) }, "Share proof"),
      el("button", { class: "btn btn-light btn-sm", type: "button", onclick: () => copy(encodeReceipt(b), "Receipt copied") }, "Copy receipt"),
      el("button", { class: "btn btn-light btn-sm", type: "button", onclick: () => { $("t-bond").value = b.commitment; show("transfer"); } }, "Transfer"),
      el("button", { class: "btn btn-light btn-sm", type: "button", onclick: () => anchor(b) }, b.anchor ? "Anchored" : "Anchor with wallet"),
      el("button", {
        class: "btn btn-ghost btn-sm", type: "button", onclick: (e) => {
          // Two steps instead of confirm(): the first press asks, the second removes.
          const btn = e.currentTarget;
          if (btn.dataset.armed !== "1") {
            btn.dataset.armed = "1";
            btn.textContent = "Press again to remove for good";
            setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ""; btn.textContent = "Remove"; } }, 4000);
            return toast(`Without a backup, ${label(b)} can never be opened again`);
          }
          vault = vault.filter((x) => x !== b);
          save(vault);
          renderVault();
          toast(`${label(b)} removed from this browser`);
        },
      }, "Remove"),
    );
    const extra = [];
    if (b.asset.note) extra.push(el("span", { class: "hint" }, "Note: " + b.asset.note));
    if (b.proof) extra.push(el("span", { class: "bond-meta" }, "Signed by ", el("span", { class: "mono" }, b.proof.address), ` at block ${Number(b.proof.block).toLocaleString("en-US")}`));
    if (b.prev) extra.push(el("span", { class: "bond-meta" }, "Re-cloaked from ", el("span", { class: "mono" }, "0x" + b.prev.slice(0, 16) + "…")));
    if (b.anchor) extra.push(el("span", { class: "bond-meta" }, "Anchor transaction ", el("span", { class: "mono" }, b.anchor)));
    list.append(el("div", { class: "bond" },
      el("div", { class: "bond-top" }, el("span", { class: "bond-amt" }, label(b)), el("span", { style: "display:flex;gap:6px;flex-wrap:wrap" }, backed, ...expBadge, meta, badge)),
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
  renderBackupState();
}

// ---------- backup ----------
const BACKUP_STORE = "obscura.backup";
function backedUp() {
  try { return new Set(JSON.parse(localStorage.getItem(BACKUP_STORE))?.commitments || []); } catch { return new Set(); }
}
function markBackedUp() {
  try { localStorage.setItem(BACKUP_STORE, JSON.stringify({ at: new Date().toISOString(), commitments: vault.map((b) => b.commitment) })); } catch { /* reminder stays */ }
  renderBackupState();
}
function renderBackupState() {
  const done = backedUp();
  const missing = vault.filter((b) => b.status === "live" && !done.has(b.commitment)).length;
  $("backup-banner").hidden = missing === 0;
  $("backup-count").textContent = missing === 1 ? "1 bond is not backed up." : `${missing} bonds are not backed up.`;
  let at = null;
  try { at = JSON.parse(localStorage.getItem(BACKUP_STORE))?.at; } catch { /* never */ }
  $("b-status").textContent = at ? `Last backup ${new Date(at).toLocaleString()}.${missing ? ` ${missing} newer bond${missing === 1 ? "" : "s"} not in it.` : " Everything is in it."}` : "No backup yet.";
}

$("backup-now").addEventListener("click", () => {
  show("vault");
  $("backup").scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => $("b-pass").focus(), 400);
});

$("backup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!vault.length) return toast("The vault is empty: nothing to back up yet");
  if ($("b-pass").value !== $("b-pass2").value) return toast("Passphrases do not match");
  try {
    const text = await sealBackup(vault, $("b-pass").value);
    if (e.submitter?.name === "copy") {
      await copy(text, "Encrypted backup copied. Paste it somewhere safe");
    } else {
      const a = el("a", { href: URL.createObjectURL(new Blob([text], { type: "text/plain" })), download: `obscura-backup-${new Date().toISOString().slice(0, 10)}.obxbak` });
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Encrypted backup downloaded");
    }
    $("b-pass").value = $("b-pass2").value = "";
    markBackedUp();
  } catch (err) {
    toast(err.message);
  }
});

$("r-file2").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) $("r-text").value = (await file.text()).trim();
});

$("restore-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("r-text").value.trim();
  if (!text) return toast("Choose a backup file or paste the backup text");
  try {
    let bonds;
    if (text.startsWith(BACKUP_PREFIX)) {
      bonds = await openBackup(text, $("r-pass2").value);
    } else {
      // Older, unencrypted backups.
      const data = JSON.parse(text);
      bonds = Array.isArray(data) ? data : data.bonds;
    }
    let added = 0;
    for (const b of bonds || []) {
      if (vault.some((x) => x.commitment === b.commitment)) continue;
      if (!(await verify(b))) continue;
      vault.push({ ...b, status: b.status === "sent" ? "sent" : "live" });
      added++;
    }
    save(vault);
    renderVault();
    $("r-text").value = $("r-pass2").value = "";
    toast(`Restored ${added} bond${added === 1 ? "" : "s"}`);
  } catch (err) {
    toast(err instanceof SyntaxError ? "That is not an Obscura backup" : err.message);
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
