#!/usr/bin/env node
/* ===========================================================================
   translate.js — builds <lang>/index.html and <lang>/docs.html from the
   English pages and the dictionaries i18n/<lang>.index.json, i18n/<lang>.docs.json.
   Only English ships today; this is the seam for a second language.

   The English page is the structure; the dictionary is a list of exact
   source strings and their Spanish. Longest keys are applied first so a
   phrase inside a longer phrase never gets translated twice. Anything the
   dictionary does not cover is reported, by text node, at the end — an
   untranslated line is a build warning you can see, not a surprise.

     node scripts/translate.js --lang zh            build zh/
     node scripts/translate.js --lang zh --check    report only
   =========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const LANG = process.argv[process.argv.indexOf('--lang') + 1];
if (!LANG || LANG.startsWith('--')) { console.error('usage: translate.js --lang <code> [--check]'); process.exit(2); }

/* local assets live one level up from es/ */
const LOCAL = ['styles.css', 'docs.css', 'app.js', 'docs.js', 'config.js', 'gate.js', 'wallet.js', 'map.svg', 'og.png'];
function repath(html) {
  html = html.replace(/(href|src)="(data\/|rolls\/|fonts\/)/g, '$1="../$2');
  for (const f of LOCAL) html = html.replace(new RegExp('(href|src)="' + f.replace('.', '\\.') + '"', 'g'), '$1="../' + f + '"');
  /* canonical + hreflang for the Spanish page */
  html = html.replace(/<link rel="canonical" href="https:\/\/renta\.example\/([^"]*)">/, (m, p) => '<link rel="canonical" href="https://renta.example/' + LANG + '/' + p + '">');
  html = html.replace(/<meta property="og:url" content="https:\/\/renta\.example\/([^"]*)">/, (m, p) => '<meta property="og:url" content="https://renta.example/' + LANG + '/' + p + '">');
  html = html.replace(/<meta property="og:locale" content="[^"]*">\n?/, '');
  html = html.replace('<meta property="og:type" content="website">', '<meta property="og:type" content="website">');
  /* the language switch points back */
  
  return html;
}

function apply(html, dict, file) {
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
  let used = 0;
  for (const k of keys) {
    if (!html.includes(k)) { console.error('  · not found in ' + file + ': ' + JSON.stringify(k.slice(0, 70))); continue; }
    html = html.split(k).join(dict[k]); used++;
  }
  return { html, used, total: keys.length };
}

/* text nodes that still read as English */
function leftovers(html, skipData) {
  let body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<pre[\s\S]*?<\/pre>/g, '');
  /* data regions are filled by render-static.js after this runs; at build
     time they still hold the English figures and are not this script's job */
  if (skipData) body = body.replace(/<!-- data:([a-z-]+) -->[\s\S]*?<!-- \/data:\1 -->/g, '');
  body = body.replace(/<!--[\s\S]*?-->/g, '');
  const texts = body.split(/<[^>]+>/).map(t => t.replace(/\s+/g, ' ').trim()).filter(t => t.length > 2);
  const en = /\b(the|and|of|with|your|you|is|are|for|from|what|how|this|that|not|it|by|on|at|to|an)\b/i;   /* English function words */
  const ok = /^(RENTA|vRENTA|EURG|Docs|X|EN|ES|N|km|USDG|ERC-4626|SHA-256|CSV|B\.V\.|KvK|CET)$/;
  return [...new Set(texts.filter(t => en.test(t) && !ok.test(t)))];
}

let warnings = 0;
for (const page of ['index', 'docs']) {
  if (CHECK) {
    /* check the built, rendered page: everything on it should be Spanish */
    const built = fs.readFileSync(path.join(root, LANG, page + '.html'), 'utf8');
    const left = leftovers(built, false);
    console.error(LANG + '/' + page + '.html: ' + (left.length ? left.length + ' text nodes still look English:' : 'nothing reads as English'));
    left.forEach(t => console.error('    ? ' + t.slice(0, 110)));
    warnings += left.length;
    continue;
  }
  const src = fs.readFileSync(path.join(root, page + '.html'), 'utf8');
  const dict = JSON.parse(fs.readFileSync(path.join(root, 'i18n', LANG + '.' + page + '.json'), 'utf8'));
  const r = apply(src, dict, page + '.html');
  const out = repath(r.html);
  const left = leftovers(out, true);
  console.error(page + '.html → ' + LANG + '/' + page + '.html: ' + r.used + '/' + r.total + ' entries applied' + (left.length ? ', ' + left.length + ' text nodes still look English:' : ''));
  left.forEach(t => console.error('    ? ' + t.slice(0, 110)));
  warnings += left.length;
  fs.writeFileSync(path.join(root, LANG, page + '.html'), out);
}
if (CHECK && warnings) process.exit(1);
