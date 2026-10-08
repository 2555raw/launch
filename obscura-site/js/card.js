// A proof as a picture: a 1200 x 630 PNG for X, Telegram or a chat, with the
// claim in large type and a QR code of the proof link. Drawn on a canvas in
// the browser; nothing is uploaded.
import qrcode from "../assets/vendor/qrcode.mjs";
import { MARK_LINES, MARK_FILL } from "./mark.js";
import { toast, track } from "./site.js";

const W = 1200, H = 630;

function dots(ctx) {
  // the hero's rings, quieter
  const cx = W * 0.78, cy = H * 0.5;
  for (let y = 6; y < H; y += 12) {
    for (let x = 6; x < W; x += 12) {
      const r = Math.hypot(x - cx, y - cy);
      const a = Math.atan2(y - cy, x - cx);
      const v = (0.5 + 0.5 * Math.sin((r * (1 + 0.05 * Math.cos(8 * a))) / 11)) ** 2 * Math.max(0, 1 - r / 760);
      if (v < 0.08) continue;
      ctx.fillStyle = `rgba(214, 222, 236, ${0.05 + v * 0.22})`;
      const s = 1 + 2 * v;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
}

function fit(ctx, text, max, size, weight = 600) {
  let s = size;
  do { ctx.font = `${weight} ${s}px "Host Grotesk", system-ui, sans-serif`; s -= 2; } while (ctx.measureText(text).width > max && s > 28);
}

// claim: "At least 2.5 ETH"; sub: who signed and where; status: { text, tone: "ok" | "warn" | "plain" }
export async function drawCard({ claim, sub, status, link }) {
  try { await Promise.all([document.fonts.load('600 80px "Host Grotesk"'), document.fonts.load('400 20px "JetBrains Mono"')]); } catch { /* system fonts */ }
  const canvas = document.createElement("canvas");
  canvas.width = W * 2; canvas.height = H * 2;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);
  ctx.fillStyle = "#090b10"; ctx.fillRect(0, 0, W, H);
  dots(ctx);

  // brand
  ctx.save(); ctx.translate(64, 56); ctx.scale(0.4, 0.4);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 6.4; ctx.lineCap = "round";
  ctx.stroke(new Path2D(MARK_LINES)); ctx.fillStyle = "#fff"; ctx.fill(new Path2D(MARK_FILL));
  ctx.restore();
  ctx.fillStyle = "#fff"; ctx.font = '600 26px "Host Grotesk", system-ui, sans-serif'; ctx.textBaseline = "middle";
  ctx.fillText("Obscura", 112, 76);

  // status chip
  const tone = { ok: ["#4fd18e", "rgba(79, 209, 142, .14)"], warn: ["#f2b552", "rgba(242, 181, 82, .12)"], plain: ["#c9cfda", "rgba(255, 255, 255, .06)"] }[status.tone || "plain"];
  ctx.font = '500 18px "JetBrains Mono", ui-monospace, monospace';
  const cw = ctx.measureText(status.text.toUpperCase()).width + 44;
  ctx.fillStyle = tone[1]; ctx.beginPath(); ctx.roundRect(64, 170, cw, 40, 20); ctx.fill();
  ctx.fillStyle = tone[0]; ctx.beginPath(); ctx.arc(84, 190, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillText(status.text.toUpperCase(), 98, 191);

  // the claim
  ctx.fillStyle = "#fff"; fit(ctx, claim, 640, 84);
  ctx.textBaseline = "alphabetic";
  ctx.fillText(claim, 62, 318);
  ctx.fillStyle = "#aab3c2"; ctx.font = '400 26px "Host Grotesk", system-ui, sans-serif';
  const words = sub.split(" "); let line = "", y = 372;
  for (const w of words) {
    if (ctx.measureText(line + w).width > 640) { ctx.fillText(line.trim(), 64, y); line = ""; y += 36; }
    line += w + " ";
  }
  ctx.fillText(line.trim(), 64, y);

  // footer
  ctx.fillStyle = "#6f798b"; ctx.font = '400 18px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText(`Scan or open the link: ${new URL(link).host}/verify`, 64, 566);

  // QR code on a white tile
  try {
    const qr = qrcode(0, "L"); qr.addData(link); qr.make();
    const n = qr.getModuleCount(), tile = 340, pad = 22, cell = (tile - pad * 2) / n, x0 = W - 64 - tile, y0 = (H - tile) / 2;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(x0, y0, tile, tile, 24); ctx.fill();
    ctx.fillStyle = "#0b0e14";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(x0 + pad + c * cell, y0 + pad + r * cell, cell + 0.4, cell + 0.4);
  } catch { /* link too long for a QR: the card still reads */ }

  return new Promise((done) => canvas.toBlob(done, "image/png"));
}

// Share the card where the device can (phones), or save it as a file.
export async function saveCard(opts, filename = "obscura-proof.png") {
  const blob = await drawCard(opts);
  track("card");
  if (!blob) return toast("This browser could not draw the image");
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ files: [file], title: "Obscura proof", text: opts.link }); return; } catch (err) { if (err?.name === "AbortError") return; }
  }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Image saved. Post it with the link so people can check it.");
}
