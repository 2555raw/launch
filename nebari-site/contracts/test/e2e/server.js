// Serves the test copy of the site and proxies /rpc to the local chain (same origin, no CORS).
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(os.tmpdir(), 'nebari-e2e-site');  // written by deploy-local.js
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer((req, res) => {
  if (req.url.startsWith('/rpc')) {
    let body = ''; req.on('data', (c) => body += c); req.on('end', () => {
      const up = http.request({ host: '127.0.0.1', port: 8545, method: 'POST', path: '/', headers: { 'content-type': 'application/json' } }, (r) => { res.writeHead(r.statusCode, { 'content-type': 'application/json' }); r.pipe(res); });
      up.on('error', (e) => { res.writeHead(502); res.end(String(e)); }); up.end(body);
    }); return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  fs.readFile(f, (err, data) => { if (err) { res.writeHead(404); return res.end('nf'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(data); });
}).listen(8767, '127.0.0.1', () => console.log('e2e site on 8767'));
