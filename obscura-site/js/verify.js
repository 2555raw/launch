// Verify page: checks a receipt from the link (#obx1_…) or pasted by hand.
import { verify, decodeReceipt, RECEIPT_PREFIX, secondsLeft } from "./obscura.js";
import { verifyFunds, CHAINS, explorerTx, explorerAddress } from "./proof.js";
import { checkAnchor } from "./anchor.js";

const $ = (id) => document.getElementById(id);
const ICONS = {
  pass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  fail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 7v6M12 17h.01"/></svg>',
  get tick() { return this.pass; },
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 12h10"/></svg>',
  time: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/></svg>',
};
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// link: optional { href, text } shown after the detail, opening in a new tab.
function row(state, title, detail, link) {
  const li = document.createElement("li");
  li.className = "check " + state;
  const icon = document.createElement("span");
  icon.className = "check-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = ICONS[state];
  const body = document.createElement("div");
  const b = document.createElement("b");
  b.textContent = title;
  const p = document.createElement("span");
  p.textContent = detail;
  if (link?.href) {
    const a = document.createElement("a");
    a.href = link.href; a.target = "_blank"; a.rel = "noopener";
    a.textContent = link.text;
    p.append(" ", a);
  }
  body.append(b, p);
  li.append(icon, body);
  return li;
}

let runId = 0;

async function run(text, expected) {
  const id = ++runId;
  try { await check(text, expected, () => id !== runId); }
  catch {
    if (id !== runId) return;
    $("v-checks").replaceChildren(row("fail", "This proof could not be checked", "Part of the link is damaged. Ask the sender for it again."));
    $("v-claim").className = "claim fail";
    $("v-claim").textContent = "Not valid";
    $("v-note").textContent = "";
  }
}

// stale() turns true once a newer check has started; this one then stops writing.
async function check(text, expected, stale) {
  $("v-empty").hidden = true;
  $("v-intro").hidden = true;
  $("v-out").hidden = false;
  const checks = $("v-checks");
  checks.replaceChildren(row("info", "Checking…", "Recomputing the seal in your browser."));
  $("v-claim").className = "claim";
  $("v-claim").textContent = "";
  $("v-note").textContent = "";

  let r;
  try { r = decodeReceipt(text); } catch {
    checks.replaceChildren(row("fail", "This is not a valid receipt", "It may have been cut off when it was copied. Ask for the link again."));
    $("v-claim").className = "claim fail";
    $("v-claim").textContent = "Not valid";
    return;
  }

  const amount = `${r.asset.amount} ${r.asset.symbol}`;
  const sealOk = await verify(r, expected || null);
  if (stale()) return;
  const list = [sealOk
    // Green is earned by a wallet-backed proof; a typed amount only gets a neutral tick.
    ? row(r.proof ? "pass" : "tick", "The seal matches", expected ? "The receipt opens exactly the seal code you expected." : "Nothing in the receipt was changed.")
    : row("fail", "The seal does not match", expected ? "This receipt is not the bond with that seal code." : "The receipt was edited or damaged.")];

  // Expiry is sealed in, so it is only trusted once the seal matches.
  const left = sealOk ? secondsLeft(r.asset) : null;
  const until = r.asset.expires ? new Date(r.asset.expires * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
  if (left === 0) {
    list.push(row("fail", "This proof has expired", `It was valid until ${until}. Ask the sender for a new one.`));
    checks.replaceChildren(...list);
    $("v-claim").className = "claim fail";
    $("v-claim").textContent = "Expired";
    $("v-note").textContent = "";
    return;
  }
  if (left) list.push(row("time", `Valid until ${until}`, "The sender set this date when sealing it. It cannot be extended."));

  let verdict = sealOk ? "declared" : "fail";
  // The anchor check runs alongside the wallet check; both only read the chain.
  const anchoring = sealOk && r.anchor ? checkAnchor(r) : null;
  if (sealOk && r.proof) {
    checks.replaceChildren(...list, row("info", "Checking the wallet…", "Reading the balance from the blockchain."));
    const f = await verifyFunds(r);
    if (stale()) return;
    const chain = CHAINS[r.proof.chainId]?.name || `chain ${r.proof.chainId}`;
    list.push(f.signed
      ? row("pass", `Signed by wallet ${short(r.proof.address)}`, "The owner of that address signed this exact bond and amount.", { href: explorerAddress(r.proof.chainId, r.proof.address), text: "See the address" })
      : row("fail", "The wallet signature is not valid", "Someone other than the address owner made this proof, or it was edited."));
    if (f.signed) {
      if (f.onchain === "pass") list.push(row("pass", `Holds at least ${amount} on ${chain}`, f.heldAt === "block" ? `Confirmed on the blockchain at block ${Number(r.proof.block).toLocaleString("en-US")}.` : "Confirmed with the current balance (the node does not keep the older block)."));
      else if (f.onchain === "fail" && !f.heldAt) list.push(row("fail", "The bond does not match what was signed", f.detail || "The asset in the bond is not the one the wallet signed for."));
      else if (f.onchain === "fail") list.push(row("fail", `Does not hold ${amount} on ${chain}`, f.heldAt === "latest" ? "The current balance is lower. The funds may have moved since the proof was made." : "The balance at that block was lower than claimed."));
      else list.push(row("warn", "Balance not checked", f.detail || "The blockchain could not be reached. Try again later."));
    }
    verdict = f.signed && f.onchain === "pass" ? (f.testnet ? "testnet" : "proven") : f.signed && (f.onchain === "unreachable" || f.onchain === "unsupported") ? "signed" : "fail";
    if (f.testnet && f.signed) list.push(row("warn", "Test network", "Sepolia coins are free and have no value. This proof shows the tool works, not real funds."));
  } else if (sealOk) {
    // Put the caveat first: the seal only says the receipt was not edited.
    list.unshift(row("warn", "Not backed by a wallet", "The sender typed this amount. Nobody has checked that they hold it."));
  }

  if (anchoring) {
    checks.replaceChildren(...list, row("info", "Checking the anchor…", "Looking up the transaction on the blockchain."));
    const a = await anchoring;
    if (stale()) return;
    const where = CHAINS[a.chainId]?.name || "the chain";
    const tx = a.chainId && a.tx ? { href: explorerTx(a.chainId, a.tx), text: "See the transaction" } : null;
    if (a.state === "pass") {
      const when = a.time ? new Date(a.time * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
      list.push(row("pass", `Anchored on ${where}${when ? ` on ${when}` : ""}`, `The seal code is in block ${a.block.toLocaleString("en-US")}, sent by ${short(a.from)}. It existed from then on and cannot be backdated.`, tx));
    } else if (a.state === "pending") list.push(row("warn", "Anchor not in a block yet", a.detail, tx));
    else if (a.state === "unreachable") list.push(row("warn", "Anchor not checked", a.detail, tx));
    else { list.push(row("fail", "The anchor does not match", a.detail, tx)); verdict = "fail"; }
  }
  checks.replaceChildren(...list);

  const claim = $("v-claim");
  claim.className = "claim " + (verdict === "proven" ? "pass" : verdict === "fail" ? "fail" : "warn");
  claim.textContent = {
    proven: `Proven: at least ${amount}`,
    testnet: `Testnet only: ${amount} in test coins`,
    signed: `Signed for ${amount}, balance not checked yet`,
    declared: `Not proven: the sender says ${amount}`,
    fail: "Not valid",
  }[verdict];
  $("v-note").textContent = verdict === "fail" ? ""
    : r.proof ? "You learn this one bond and the address that signed it. Nothing about the sender's other bonds."
    : "You learn this one bond and nothing else about the sender.";
}

$("verify-form").addEventListener("submit", (e) => {
  e.preventDefault();
  run($("v-receipt").value.trim(), $("v-commit").value.trim());
});

// A proof link carries the receipt after the #. Pasting a second link into the
// same tab only changes the hash, so check again when it does.
function fromLink() {
  let text = location.hash.slice(1);
  try { text = decodeURIComponent(text); } catch { /* keep it as it came */ }
  if (!text.startsWith(RECEIPT_PREFIX)) return;
  $("v-receipt").value = text;
  $("v-commit").value = "";
  run(text, "");
}
addEventListener("hashchange", fromLink);
fromLink();
