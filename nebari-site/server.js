// Serves the site as static files. Railway (or any Node host) runs `npm start`.
// No dependencies: it is a plain http server with the right content types.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT) || 8080;
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain', '.ttf': 'font/ttf', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webp': 'image/webp',
};

http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root) || file.includes(path.sep + 'contracts' + path.sep + 'node_modules')) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': p.startsWith('/vendor/') ? 'public, max-age=31536000' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, () => console.log('Nebari on http://localhost:' + port));
