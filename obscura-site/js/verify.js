// Verify page: checks a receipt from the link (#obx1_…) or pasted by hand.
import { verify, decodeReceipt, RECEIPT_PREFIX } from "./obscura.js";
import { verifyFunds, CHAINS } from "./proof.js";

const $ = (id) => document.getElementById(id);
const ICONS = {
  pass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  fail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 7v6M12 17h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 12h10"/></svg>',
};
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function row(state, title, detail) {
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
  body.append(b, p);
  li.append(icon, body);
  return li;
}

async function run(text, expected) {
  $("v-empty").hidden = true;
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
  const list = [sealOk
    ? row("pass", "The seal matches", expected ? "The receipt opens exactly the seal code you expected." : "Nothing in the receipt was changed.")
    : row("fail", "The seal does not match", expected ? "This receipt is not the bond with that seal code." : "The receipt was edited or damaged.")];

  let verdict = sealOk ? "declared" : "fail";
  if (sealOk && r.proof) {
    checks.replaceChildren(...list, row("info", "Checking the wallet…", "Reading the balance from the blockchain."));
    const f = await verifyFunds(r);
    const chain = CHAINS[r.proof.chainId]?.name || `chain ${r.proof.chainId}`;
    list.push(f.signed
      ? row("pass", `Signed by wallet ${short(r.proof.address)}`, "The owner of that address signed this exact bond and amount.")
      : row("fail", "The wallet signature is not valid", "Someone other than the address owner made this proof, or it was edited."));
    if (f.signed) {
      if (f.onchain === "pass") list.push(row("pass", `Holds at least ${amount} on ${chain}`, f.heldAt === "block" ? `Confirmed on the blockchain at block ${Number(r.proof.block).toLocaleString("en-US")}.` : "Confirmed with the current balance (the node does not keep the older block)."));
      else if (f.onchain === "fail") list.push(row("fail", `Does not hold ${amount} on ${chain}`, f.heldAt === "latest" ? "The current balance is lower. The funds may have moved since the proof was made." : "The balance at that block was lower than claimed."));
      else list.push(row("warn", "Balance not checked", f.detail || "The blockchain could not be reached. Try again later."));
    }
    verdict = f.signed && f.onchain === "pass" ? "proven" : f.signed && f.onchain === "unreachable" ? "signed" : "fail";
  } else if (sealOk) {
    list.push(row("warn", "Not backed by a wallet", "The sender typed this amount. It is not checked against any wallet."));
  }
  checks.replaceChildren(...list);

  const claim = $("v-claim");
  claim.className = "claim " + (verdict === "proven" ? "pass" : verdict === "fail" ? "fail" : "warn");
  claim.textContent = {
    proven: `Proven: at least ${amount}`,
    signed: `Signed for ${amount}, balance not checked yet`,
    declared: `Declared: ${amount}`,
    fail: "Not valid",
  }[verdict];
  $("v-note").textContent = verdict === "fail" ? "" : "You learn this one bond and nothing else about the sender's wallet.";
}

$("verify-form").addEventListener("submit", (e) => {
  e.preventDefault();
  run($("v-receipt").value.trim(), $("v-commit").value.trim());
});

// A proof link carries the receipt after the #.
const fromLink = decodeURIComponent(location.hash.slice(1));
if (fromLink.startsWith(RECEIPT_PREFIX)) {
  $("v-receipt").value = fromLink;
  run(fromLink, "");
}
