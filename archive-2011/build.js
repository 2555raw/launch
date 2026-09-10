/* Bundles the four source files into one self-contained page.

   Run it with `node build.js`; it writes dist/index.html, a single file with the
   stylesheet and every script inlined, no other assets. Open it straight from
   disk, drop it on any host, or paste its contents into a page of your own. */

const fs = require('fs');
const path = require('path');

const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8').trimEnd();

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

html = html.replace(/[ \t]*<link rel="stylesheet" href="([^"]+)">/g,
  (_, f) => '<style>\n' + read(f) + '\n</style>');

html = html.replace(/[ \t]*<script src="([^"]+)"><\/script>/g,
  (_, f) => '<script>\n' + read(f) + '\n</script>');

fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(dir, 'dist', 'index.html'), html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`dist/index.html written — ${kb} kB, no external files`);
