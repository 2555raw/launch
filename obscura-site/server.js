// Serves the HeldAt site as static files. Railway sets PORT.
//
// No dependencies. Supports HTTP Range requests, which Safari needs before it
// will play the films, and keeps every request inside this folder.
import http from "node:http";
import { createReadStream, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = process.env.PORT || 8080;
const BUILD = (process.env.RAILWAY_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 12);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

// Development and tooling files are not part of the site.
const HIDDEN = /^\/(\.|tools\/|test\/|server\.js|package\.json|PRODUCT\.md|DESIGN\.md|README\.md)/;

// ---------- visit counts ----------
// Counts only: which page or action, per day. No cookies, no IP addresses, no
// user agents, nothing about receipts, amounts or addresses. Kept in memory and,
// when DATA_DIR points at a volume, saved there so a redeploy keeps them.
const EVENTS = new Set(["view:/", "view:/console.html", "view:/verify.html", "view:/terms.html",
  "seal", "seal_signed", "verify_proven", "verify_declared", "verify_failed", "anchor", "card", "share_link", "wallet", "install"]);
const STATS_FILE = process.env.DATA_DIR ? join(process.env.DATA_DIR, "stats.json") : null;
let stats = {};
try { if (STATS_FILE) stats = JSON.parse(readFileSync(STATS_FILE, "utf8")); } catch { stats = {}; }
let dirty = false;
function count(name) {
  const day = new Date().toISOString().slice(0, 10);
  const d = (stats[day] ||= {});
  d[name] = (d[name] || 0) + 1;
  dirty = true;
}
function saveStats() {
  if (!STATS_FILE || !dirty) return;
  try { writeFileSync(STATS_FILE, JSON.stringify(stats)); dirty = false; } catch { /* volume missing: counts stay in memory */ }
}
setInterval(saveStats, 60_000).unref();
process.on("SIGTERM", () => { saveStats(); process.exit(0); });

function lastDays(n) {
  const days = Object.keys(stats).sort().slice(-n);
  const totals = {};
  for (const d of days) for (const [k, v] of Object.entries(stats[d])) totals[k] = (totals[k] || 0) + v;
  return { days: Object.fromEntries(days.map((d) => [d, stats[d]])), totals };
}

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { rel = "/"; }
  if (rel === "/api/e" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 200) req.destroy(); });
    req.on("end", () => {
      try { const { e } = JSON.parse(body); if (EVENTS.has(e)) count(e); } catch { /* ignored */ }
      res.writeHead(204, { "cache-control": "no-store" });
      res.end();
    });
    return;
  }
  if (rel === "/api/stats") {
    // With STATS_KEY set, the numbers need ?key=…; without it they are public.
    const key = new URL(req.url, "http://x").searchParams.get("key");
    if (process.env.STATS_KEY && key !== process.env.STATS_KEY) return notFound(res);
    const body = JSON.stringify(lastDays(30));
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    return res.end(body);
  }
  if (rel === "/health") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    return res.end("ok");
  }
  // Normalise before any check, so /x/..%2fserver.js cannot slip past HIDDEN.
  rel = normalize(rel).replaceAll("\\", "/");
  if (!rel.startsWith("/")) rel = "/" + rel;
  if (rel.endsWith("/")) rel += "index.html";
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT) || HIDDEN.test(rel)) return notFound(res);

  let size;
  try {
    const st = statSync(file);
    if (!st.isFile()) return notFound(res);
    size = st.size;
  } catch {
    return notFound(res);
  }

  const ext = extname(file).toLowerCase();
  const headers = {
    "content-type": TYPES[ext] || "application/octet-stream",
    // Pages and the service worker are checked on every load; the rest may wait an hour.
    "cache-control": ext === ".html" || rel === "/sw.js" || ext === ".webmanifest" ? "no-cache" : "public, max-age=3600",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  };

  // The service worker names its cache after this release, so a deploy replaces it.
  if (rel === "/sw.js") {
    const buf = Buffer.from(readFileSync(file, "utf8").replaceAll("__BUILD__", BUILD));
    res.writeHead(200, { ...headers, "content-length": buf.length });
    return res.end(req.method === "HEAD" ? undefined : buf);
  }

  // Link previews need absolute URLs: fill in the address this request came to.
  if (ext === ".html") {
    const fwdProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const proto = fwdProto === "https" || fwdProto === "http" ? fwdProto : "http";
    const rawHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
    const host = /^[\w.:-]+$/.test(rawHost) ? rawHost : "localhost";
    const body = readFileSync(file, "utf8").replaceAll("__ORIGIN__", `${proto}://${host}`);
    const buf = Buffer.from(body);
    res.writeHead(200, { ...headers, "content-length": buf.length });
    return res.end(req.method === "HEAD" ? undefined : buf);
  }

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (range) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (!(start >= 0 && start <= end)) {
      res.writeHead(416, { "content-range": `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
    if (req.method === "HEAD") return res.end();
    return createReadStream(file, { start, end }).on("error", () => res.destroy()).pipe(res);
  }

  res.writeHead(200, { ...headers, "content-length": size });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).on("error", () => res.destroy()).pipe(res);
}).listen(PORT, () => console.log(`HeldAt on :${PORT}`));

function notFound(res) {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("404 — nothing here");
}
