/* Static file server. The site is four HTML pages and their assets; the one
 * network call it makes (the comparison) goes from the browser straight to
 * whatever endpoint the visitor named, never through here.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
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
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  if (!path.extname(rel)) rel += ".html";

  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }

  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end('<meta charset="utf-8"><p style="font:16px system-ui;padding:40px">Not found. <a href="/">Hydropad</a></p>');
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      "cache-control": path.extname(file) === ".html" ? "no-cache" : "public, max-age=300",
    });
    res.end(body);
  });
}).listen(PORT, () => console.log(`Manyways on :${PORT}`));
