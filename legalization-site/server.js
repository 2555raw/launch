// Minimal static server for the Legalization? project.
// Railway (and most hosts) inject PORT; 8080 matches the service settings.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  let file = url === "/" ? "index.html" : decodeURIComponent(url).replace(/^\/+/, "");
  const full = path.join(ROOT, file);

  if (!full.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(full, (err, body) => {
    if (err) {
      // Single page project: anything unknown falls back to the page itself.
      fs.readFile(path.join(ROOT, "index.html"), (e2, home) => {
        if (e2) {
          res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
        } else {
          res.writeHead(200, { "Content-Type": TYPES[".html"] }).end(home);
        }
      });
      return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(full)] || "application/octet-stream",
      "Cache-Control": "public, max-age=300"
    }).end(body);
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log("Legalization? listening on " + PORT);
});
