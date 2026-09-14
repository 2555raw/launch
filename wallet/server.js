/* Sirve Calma como sitio estático.
 *
 * Una wallet es una página que maneja claves privadas, así que el servidor no
 * es solo un `readFile`: las cabeceras de abajo son parte de la seguridad del
 * producto. La más importante es la CSP — script-src 'self' significa que
 * ningún script ajeno puede ejecutarse en esta página aunque alguien logre
 * inyectar una etiqueta, que es justo como se roban las claves. Por eso ethers
 * va vendorizado en public/vendor y no en una CDN. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'public');
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/* connect-src tiene que dejar pasar https: porque el usuario puede apuntar a
   cualquier nodo RPC desde Ajustes; localhost va incluido para quien corre su
   propio nodo en la misma máquina. Todo lo demás queda cerrado. */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src https: http://localhost:* http://127.0.0.1:*",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'"
].join('; ');

const SECURITY = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin'
};

http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end();
    return;
  }

  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403, SECURITY).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, body) => {
    if (err) {
      /* Una ruta desconocida devuelve la app: los enlaces de cobro viven en el
         hash, pero así un /pay escrito a mano tampoco rompe nada. */
      fs.readFile(path.join(ROOT, 'index.html'), (e2, home) => {
        if (e2) { res.writeHead(404, SECURITY).end('404'); return; }
        res.writeHead(404, Object.assign({}, SECURITY, {
          'content-type': TYPES['.html'], 'cache-control': 'no-store'
        }));
        res.end(home);
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, Object.assign({}, SECURITY, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      /* El HTML nunca se cachea para que un despliegue llegue de inmediato;
         ethers está congelado en una versión y puede cachearse a gusto. */
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=86400'
    }));
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}).listen(PORT, () => console.log(`Calma escuchando en :${PORT}`));
