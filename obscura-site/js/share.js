// Share a proof as a link and a QR code.
//
// The receipt travels after the # of the link. Browsers never send that part
// to a server, so opening the link verifies the bond on the reader's device.
import qrcode from "../assets/vendor/qrcode.mjs";
import { encodeReceipt } from "./obscura.js";
import { copy, toast, track } from "./site.js";
import { saveCard } from "./card.js";
import { CHAINS } from "./proof.js";

export function proofLink(receipt) {
  const url = new URL("verify.html", location.href);
  url.search = "";
  url.hash = encodeReceipt(receipt);
  return url.href;
}

function qrSvg(text) {
  // Level L keeps long links scannable; the code is shown large on screen.
  const qr = qrcode(0, "L");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// What the picture of a proof says, before anyone has checked it.
export function cardFor(receipt, link) {
  const a = receipt.asset, p = receipt.proof;
  const claim = p?.type === "usd-v1" ? `At least $${Number(a.amount).toLocaleString("en-US")}`
    : p?.type === "nft-v1" ? (p.tokenId ? `${a.symbol} #${p.tokenId}` : `${a.amount} ${a.symbol} NFT${a.amount === "1" ? "" : "s"}`)
    : `At least ${a.amount} ${a.symbol}`;
  const where = p?.type === "sol-v1" ? "Solana" : CHAINS[p?.chainId]?.name || a.chain;
  const sub = p ? `Signed by wallet ${short(p.address)} on ${where}. Open the link to check it on the blockchain.` : "Typed by the sender and sealed. Not checked against a wallet.";
  return { claim, sub, link, status: p ? { text: "Wallet-signed proof", tone: "plain" } : { text: "Self-declared", tone: "warn" } };
}

export function renderShare(container, receipt) {
  const link = proofLink(receipt);
  container.replaceChildren();

  const row = document.createElement("div");
  row.className = "share-link";
  const input = document.createElement("input");
  input.className = "input mono";
  input.readOnly = true;
  input.value = link;
  input.setAttribute("aria-label", "Proof link");
  input.addEventListener("focus", () => input.select());
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "btn btn-dark btn-sm";
  copyBtn.textContent = "Copy link";
  copyBtn.addEventListener("click", () => { track("share_link"); copy(link, "Link copied. Anyone who opens it can check this bond"); });
  const imgBtn = document.createElement("button");
  imgBtn.type = "button";
  imgBtn.className = "btn btn-light btn-sm";
  imgBtn.textContent = "Save as image";
  imgBtn.addEventListener("click", async () => {
    imgBtn.setAttribute("aria-busy", "true");
    try { await saveCard(cardFor(receipt, link)); } finally { imgBtn.removeAttribute("aria-busy"); }
  });
  row.append(input, copyBtn, imgBtn);

  if (navigator.share) {
    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "btn btn-light btn-sm";
    shareBtn.textContent = "Share…";
    shareBtn.addEventListener("click", () => navigator.share({ title: "Obscura proof", url: link }).catch(() => {}));
    row.append(shareBtn);
  }

  const qr = document.createElement("figure");
  qr.className = "qr";
  try {
    qr.innerHTML = qrSvg(link);
    qr.querySelector("svg").setAttribute("role", "img");
    qr.querySelector("svg").setAttribute("aria-label", "QR code of the proof link");
  } catch {
    qr.textContent = "This proof is too long for a QR code. Share the link instead.";
  }
  const cap = document.createElement("figcaption");
  cap.textContent = "Scan with a phone camera to open the proof.";
  qr.append(cap);

  const warn = document.createElement("p");
  warn.className = "hint";
  warn.textContent = "Whoever has this link can see this one bond. Send it only to the person who needs to check it.";

  container.append(row, qr, warn);
  return link;
}

export function openShareDialog(receipt, label) {
  const dlg = document.getElementById("share-dialog");
  if (!dlg) return toast("Sharing is not available on this page");
  document.getElementById("share-sub").textContent = `${label}. They open the link and their browser checks it.`;
  renderShare(document.getElementById("share-body"), receipt);
  if (!dlg.dataset.wired) {
    dlg.dataset.wired = "1";
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
  }
  dlg.showModal();
}
