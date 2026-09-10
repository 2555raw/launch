/* Builds dist/warp.html: the whole application in one file, openable by
   double-clicking it with no server.

   Why a build at all, in a project whose point is that there is no build step:
   native ES modules are fetched over HTTP, and a page opened from the
   filesystem has no HTTP. So the source stays modular and this script inlines
   it, rather than the source being flattened by hand and drifting.

   What it does not do: minify, transpile or rename anything. Each module keeps
   its own scope inside a wrapper, so the file in dist behaves exactly like the
   source and a stack trace still points at the function you wrote. */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/* Dependency order is not required by the loader (it resolves lazily), but
   listing the modules explicitly keeps the bundle deterministic and makes an
   accidentally orphaned file obvious. */
const MODULES = [
  'js/format.js', 'js/config.js', 'js/registry.js', 'js/marks.js', 'js/logos.js',
  'js/market.js', 'js/store.js', 'js/engine.js', 'js/chart.js', 'js/search.js',
  'js/ui/components.js', 'js/terms.js', 'js/views.js', 'js/app.js',
];
const ENTRY = 'js/app.js';

const resolve = (from, spec) => normalize(join(dirname(from), spec)).split('\\').join('/');

/** Rewrites one module into a wrapper: imports become lookups, exports become
 *  one assignment at the end. Nothing else in the body is touched. */
function wrap(id, src) {
  let body = src;

  // import { a, b as c } from './x.js';  ->  const { a, b: c } = __req('x/y.js');
  body = body.replace(/import\s*\{([\s\S]*?)\}\s*from\s*'([^']+)';/g, (_, names, spec) => {
    const bound = names.split(',').map(n => n.trim()).filter(Boolean)
      .map(n => n.replace(/\s+as\s+/, ': '));
    return `const { ${bound.join(', ')} } = __req(${JSON.stringify(resolve(id, spec))});`;
  });

  // Collect what the module exports, then drop the keyword.
  const exported = [];
  body = body.replace(/^export\s+(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  if (/^export\b/m.test(body)) {
    throw new Error(`${id}: an export form this build does not handle. Only "export const|let|var|function|class NAME" and "import { ... } from '...'" are supported.`);
  }

  return `__def(${JSON.stringify(id)}, function (exports, __req) {\n${body}\n`
    + `Object.assign(exports, { ${exported.join(', ')} });\n});`;
}

/* A module registry small enough to read in one sitting: define lazily,
   evaluate once on first request. There are no cycles in this project, so
   depth-first evaluation is all it needs to be. */
const LOADER = `const __mods = Object.create(null);
function __def(id, fn) { __mods[id] = { fn, exports: null }; }
function __req(id) {
  const m = __mods[id];
  if (!m) throw new Error('module not bundled: ' + id);
  if (!m.exports) { m.exports = {}; m.fn(m.exports, __req); }
  return m.exports;
}`;

const [html, css, ...sources] = await Promise.all([
  readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(root, 'styles.css'), 'utf8'),
  ...MODULES.map(m => readFile(join(root, m), 'utf8')),
]);

/* A module that is imported but not listed would only fail at runtime, in the
   browser, as "module not bundled" — which is exactly what happened the first
   time two modules were added. So the graph is checked here instead. */
const listed = new Set(MODULES);
const missing = new Set();
sources.forEach((src, i) => {
  for (const m of src.matchAll(/import\s*\{[\s\S]*?\}\s*from\s*'([^']+)';/g)) {
    const dep = resolve(MODULES[i], m[1]);
    if (!listed.has(dep)) missing.add(`${dep} (imported by ${MODULES[i]})`);
  }
});
if (missing.size) throw new Error(`build.mjs: MODULES is missing:\n  ${[...missing].join('\n  ')}`);

const bundle = [LOADER, ...MODULES.map((id, i) => wrap(id, sources[i])), `__req(${JSON.stringify(ENTRY)});`].join('\n\n');

/* A closing script tag inside a string literal would end the script element
   early, so it is split. Nothing else about the source is rewritten. */
const safe = (s) => s.split('</script').join('<\\/script');

let out = html;
const linkTag = '<link rel="stylesheet" href="styles.css">';
const scriptTag = '<script type="module" src="js/app.js"></script>';
for (const tag of [linkTag, scriptTag]) {
  if (!out.includes(tag)) throw new Error(`index.html no longer contains ${tag}; build.mjs needs updating.`);
}
out = out.replace(linkTag, `<style>\n${css}\n</style>`);
out = out.replace(scriptTag, `<script>\n${safe(bundle)}\n</script>`);

// One line saying what this file is, for whoever opens it in an editor.
out = out.replace('<!doctype html>',
  `<!doctype html>\n<!-- Warp, built into a single file by build.mjs. Edit the source in warp-app/, not this. -->`);

/* The same page as an Artifact fragment. An Artifact supplies its own doctype,
   html, head and body, so what it wants is the content and nothing else. Both
   files come from this one assembly, so the hosted page and the downloadable
   one cannot drift apart. */
const between = (open, close) => out.slice(out.indexOf(open) + open.length, out.indexOf(close));
const fragment = between('<head>', '</head>')
  // The host writes these itself, and a favicon is passed as a publish argument.
  .replace(/^\s*<meta charset[^>]*>$/m, '')
  .replace(/^\s*<meta name="viewport"[^>]*>$/m, '')
  .replace(/^\s*<meta name="description"[^>]*>$/m, '')
  .replace(/^\s*<meta name="color-scheme"[^>]*>$/m, '')
  .replace(/^\s*<link rel="icon"[^>]*>$/m, '')
  .replace(/\n{3,}/g, '\n\n')
  + between('<body>', '</body>');

await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist', 'warp.html'), out);
await writeFile(join(root, 'dist', 'warp.artifact.html'), fragment.trim() + '\n');
console.log(`dist/warp.html           ${(out.length / 1024).toFixed(0)} KB  ${MODULES.length} modules inlined`);
console.log(`dist/warp.artifact.html  ${(fragment.length / 1024).toFixed(0)} KB  same page, no document wrapper`);
