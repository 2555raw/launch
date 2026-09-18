/* Static file server. The site is four HTML pages and their assets; the one
 * network call it makes (the comparison) goes from the browser straight to
 * whatever endpoint the visitor named, never through here.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

/* ------------------------------------------------------------------
   The hosted endpoint.

   Without this the chat has nowhere to send anything: the browser would
   need the visitor's own API key, which is fine for the person who built
   the site and useless for everyone else. So one key lives here, in the
   environment, and the browser never sees it.

   Set HANAMY_KEY, and HANAMY_UPSTREAM if the provider is not OpenAI.
   With neither set the site still works; the chat just asks the visitor
   for an endpoint, as before.

   Nothing that passes through here is written down: no request bodies,
   no answers, no per-visitor record. The rate limiter below keeps counts
   in memory and they die with the process. What the upstream provider
   does with a request once it leaves is its own business, which the
   documentation says plainly.
   ------------------------------------------------------------------ */
const UPSTREAM = (process.env.HANAMY_UPSTREAM || "https://api.openai.com/v1")
  .replace(/\/$/, "");
const UPSTREAM_KEY = process.env.HANAMY_KEY || "";
const MAX_BODY = 256 * 1024;          // one message and a file, not a library
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 25;                // per address, so one visitor cannot drain the key

const hits = new Map();
function overLimit(ip) {
  const now = Date.now();
  const seen = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  seen.push(now);
  hits.set(ip, seen);
  if (hits.size > 5000) {             // keep the map from growing without bound
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
  }
  return seen.length > PER_WINDOW;
}

function fail(res, code, message) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: { message: message } }));
}

async function proxy(req, res, rest) {
  if (!UPSTREAM_KEY)
    return fail(res, 503, "This deployment has no hosted key. Set an endpoint of your own " +
                          "with the Endpoint button, or set HANAMY_KEY on the server.");

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
             req.socket.remoteAddress || "unknown";
  if (overLimit(ip))
    return fail(res, 429, "That is a lot of questions in ten minutes. Wait a little, or use " +
                          "your own endpoint with the Endpoint button.");

  let body = "";
  if (req.method === "POST") {
    try {
      body = await new Promise((resolve, reject) => {
        let buf = "", size = 0, over = false;
        req.on("data", (c) => {
          if (over) return;
          size += c.length;
          if (size > MAX_BODY) {
            // Drain rather than destroy: killing the socket here reaches the
            // browser as a connection reset, and a reset tells nobody why.
            over = true;
            req.resume();
            reject(new Error("too large"));
            return;
          }
          buf += c;
        });
        req.on("end", () => { if (!over) resolve(buf); });
        req.on("error", reject);
      });
    } catch (e) {
      return fail(res, 413, "That message is larger than this endpoint accepts (256 KB).");
    }
  }

  let up;
  try {
    up = await fetch(UPSTREAM + rest, {
      method: req.method,
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + UPSTREAM_KEY
      },
      body: req.method === "POST" ? body : undefined
    });
  } catch (e) {
    return fail(res, 502, "The model endpoint did not answer.");
  }

  res.writeHead(up.status, {
    "content-type": up.headers.get("content-type") || "application/json",
    "cache-control": "no-store"
  });
  if (!up.body) { res.end(); return; }
  // straight through, so a streamed answer stays streamed
  const reader = up.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".sol": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  /* The photographs and the banners. Without these they go out as
   * application/octet-stream: a browser sniffs its way through that, but a
   * link-preview scraper does not, and the card comes back without its
   * image. */
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname.startsWith("/v1/")) {
    if (req.method !== "POST" && req.method !== "GET")
      return fail(res, 405, "Only GET and POST.");
    proxy(req, res, url.pathname.slice(3)).catch(() =>
      fail(res, 500, "Something went wrong forwarding that."));
    return;
  }
  if (url.pathname === "/hosted") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8",
                         "cache-control": "no-store" });
    res.end(JSON.stringify({ hosted: Boolean(UPSTREAM_KEY) }));
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  if (!path.extname(rel)) rel += ".html";

  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }

  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end('<meta charset="utf-8"><p style="font:16px system-ui;padding:40px">Not found. <a href="/">Hanamy</a></p>');
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      "cache-control": path.extname(file) === ".html" ? "no-cache" : "public, max-age=300",
    });
    res.end(body);
  });
}).listen(PORT, () => console.log(`Hanamy on :${PORT}`));
