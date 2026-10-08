// Serves the HeldAt site as static files. Railway sets PORT.
//
// No dependencies. Supports HTTP Range requests, which Safari needs before it
// will play the films, and keeps every request inside this folder.
import http from "node:http";
import { createReadStream, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
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

// ---------- short proof links ----------
// /p/<id>#<key>. The browser encrypts the receipt with a key that stays after
// the # (never sent here) and posts only the ciphertext, which is all we keep:
// one small file per link in DATA_DIR/links, or memory when there is no volume.
const LINKS = process.env.DATA_DIR ? join(process.env.DATA_DIR, "links") : null;
const memLinks = new Map();
if (LINKS) {
  try { mkdirSync(LINKS, { recursive: true }); console.log(`Short links kept in ${LINKS}`); }
  catch (err) { console.log(`Short links in memory only: ${err.code || err.message}`); }
}
const LINK_ID = /^[A-Za-z0-9]{8}$/;
const LINK_CT = /^[A-Za-z0-9_-]{40,16000}$/;
const DAY = 86400;
function newLinkId() {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  while (id.length < 8) for (const b of randomBytes(12)) if (b < 248 && id.length < 8) id += A[b % 62]; // no modulo bias
  return id;
}
function putLink(id, rec) {
  if (memLinks.size + 1 > 200_000) throw new Error("full");
  if (LINKS) { try { writeFileSync(join(LINKS, id + ".json"), JSON.stringify(rec), { flag: "wx" }); return; } catch (err) { if (err.code === "EEXIST") throw err; } }
  if (memLinks.has(id)) throw Object.assign(new Error("exists"), { code: "EEXIST" });
  memLinks.set(id, rec);
}
function getLink(id) {
  let rec = memLinks.get(id);
  if (!rec && LINKS) { try { rec = JSON.parse(readFileSync(join(LINKS, id + ".json"), "utf8")); } catch { rec = null; } }
  if (rec && rec.until < Date.now() / 1000) { dropLink(id); return null; }
  return rec;
}
function dropLink(id) {
  memLinks.delete(id);
  if (LINKS) try { unlinkSync(join(LINKS, id + ".json")); } catch { /* already gone */ }
}
// Once a day, forget links whose proof has expired.
setInterval(() => {
  const now = Date.now() / 1000;
  for (const [id, rec] of memLinks) if (rec.until < now) memLinks.delete(id);
  if (LINKS) try { for (const f of readdirSync(LINKS)) if (f.endsWith(".json")) getLink(f.slice(0, -5)); } catch { /* no folder */ }
}, DAY * 1000).unref();
// At most 60 new links an hour from one address.
const linkHits = new Map();
function linkAllowed(req) {
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
  const now = Date.now(), recent = (linkHits.get(ip) || []).filter((t) => now - t < 3600_000);
  if (recent.length >= 60) { linkHits.set(ip, recent); return false; }
  recent.push(now); linkHits.set(ip, recent);
  if (linkHits.size > 50_000) linkHits.clear();
  return true;
}
function json(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": buf.length, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(buf);
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
  if (rel === "/api/link" && req.method === "POST") {
    if (!linkAllowed(req)) return json(res, 429, { error: "Too many links from this address. Try again later." });
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 20_000) { json(res, 413, { error: "Too large" }); req.destroy(); } });
    req.on("end", () => {
      if (res.writableEnded) return;
      let ct, expires;
      try { ({ ct, expires } = JSON.parse(body)); } catch { return json(res, 400, { error: "Bad request" }); }
      if (typeof ct !== "string" || !LINK_CT.test(ct)) return json(res, 400, { error: "Bad request" });
      const now = Math.floor(Date.now() / 1000);
      // Kept until the proof expires (a day of grace), and never more than 400 days.
      let until = now + 365 * DAY;
      if (Number.isSafeInteger(expires) && expires > now) until = expires + DAY;
      until = Math.min(until, now + 400 * DAY);
      for (let tries = 0; tries < 5; tries++) {
        const id = newLinkId();
        try { putLink(id, { ct, until, made: now }); return json(res, 201, { id }); }
        catch (err) { if (err.code !== "EEXIST") return json(res, 503, { error: "Short links are not available right now" }); }
      }
      return json(res, 503, { error: "Short links are not available right now" });
    });
    return;
  }
  if (rel.startsWith("/api/link/") && (req.method === "GET" || req.method === "HEAD")) {
    const id = rel.slice(10);
    const rec = LINK_ID.test(id) ? getLink(id) : null;
    return rec ? json(res, 200, { ct: rec.ct }) : json(res, 404, { error: "Not found" });
  }
  // /p/<id>#<key> → /verify.html?s=<id>#<key>. The browser carries the #key over
  // the redirect by itself; it never reaches this server.
  if (rel.startsWith("/p/")) {
    const id = rel.slice(3).replace(/\/$/, "");
    if (!LINK_ID.test(id)) return notFound(res);
    res.writeHead(302, { location: `/verify.html?s=${id}`, "cache-control": "no-store", "referrer-policy": "no-referrer" });
    return res.end();
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
