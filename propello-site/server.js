#!/usr/bin/env node
/* ===========================================================================
   Propello — the production server. The site is static files; this only hands
   them out. No dependencies, so the deploy is `node server.js`.

     PORT   the port to listen on (Railway sets it; 3000 otherwise)

   /health answers the platform's healthcheck with a plain 200, so a deploy
   is judged by whether the server is up rather than by whether the page it
   happens to probe exists.

   It serves index.html for a directory, answers a miss with 404.html and a
   real 404 status, and lets the browser cache anything with a hash-stable
   name (fonts, the map, the share card) for a year while keeping the pages
   themselves fresh.
   =========================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = process.env.PORT || 3000;
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.sol': 'text/plain; charset=utf-8'
};
const immutable = /\.(woff2|png|svg)$/;

function send(res, status, file) {
  const headers = { 'content-type': types[path.extname(file)] || 'application/octet-stream' };
  headers['cache-control'] = immutable.test(file) ? 'public, max-age=31536000' : 'public, max-age=300';
  headers['x-content-type-options'] = 'nosniff';
  res.writeHead(status, headers);
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { p = '/'; }

  /* the platform's healthcheck: a plain OK, no file behind it */
  if (p === '/health' || p === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    return res.end('ok');
  }

  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(root, p));

  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const miss = path.join(root, '404.html');
    if (fs.existsSync(miss)) return send(res, 404, miss);
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('not found');
  }
  send(res, 200, file);
}).listen(port, '0.0.0.0', () => console.log('Propello on :' + port));
