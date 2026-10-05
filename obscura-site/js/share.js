// Share a proof as a link and a QR code.
//
// The receipt travels after the # of the link. Browsers never send that part
// to a server, so opening the link verifies the bond on the reader's device.
import qrcode from "../assets/vendor/qrcode.mjs";
import { encodeReceipt } from "./obscura.js";
import { copy, toast } from "./site.js";

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
  copyBtn.addEventListener("click", () => copy(link, "Link copied. Anyone who opens it can check this bond"));
  row.append(input, copyBtn);

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
