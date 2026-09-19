/* Builds the one-file preview of the game.

   Takes the app as it is - the page, the stylesheet, the engine, the
   renderer, every module - and inlines it into a single HTML file, with the
   server stood in for by standalone.js and three.js pulled from a CDN. The
   result opens anywhere and plays a race every five minutes with a field of
   bots; it says on the page what it is.

   node preview/build-app.js  ->  preview/dist/marble-royale.html */

const fs = require('fs');
const path = require('path');
const pub = path.join(__dirname, '..', 'public');
const read = (f) => fs.readFileSync(path.join(pub, f), 'utf8');

let html = read('index.html');
/* the publish skeleton supplies doctype, html, head and body */
html = html.replace(/^<!doctype html>\s*<html[^>]*>\s*<head>/i, '').replace(/<\/head>\s*<body([^>]*)>/i, '<div$1 id="bodyattrs" hidden></div>').replace(/<\/body>\s*<\/html>\s*$/i, '');
html = html.replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
html = html.replace(/<link rel="icon"[^>]*>\s*/i, '');
html = html.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + read('styles.css') + '\n</style>');

/* three from jsdelivr: the CDN the page may load scripts from */
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, () => '<script type="importmap">' + JSON.stringify({ imports: { three: CDN + 'build/three.module.min.js' } }) + '</script>');
html = html.replace(/\.\/vendor\/three\/postprocessing\//g, CDN + 'examples/jsm/postprocessing/').replace(/\.\/vendor\/three\/RoomEnvironment\.js/g, CDN + 'examples/jsm/environments/RoomEnvironment.js');

/* every classic script inlined, standalone.js slotted in before app.js */
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const body = read(src).replace(/<\/script>/g, '<\\/script>');
  const pre = src === 'js/app.js' ? '<script>\n' + read('js/standalone.js').replace(/<\/script>/g, '<\\/script>') + '\n</script>\n' : '';
  return pre + '<script>\n' + body + '\n</script>';
});

/* the body's data attributes go on a script that sets them, since the
   skeleton owns the body tag */
html = html.replace('<div data-screen="home" data-phase="lobby" id="bodyattrs" hidden></div>', '<script>document.body.dataset.screen="home";document.body.dataset.phase="lobby";</script>');

/* a line on the page saying what this build is */
html = html.replace('<div class="kicker"><i class="live"></i>LIVE ON ROBINHOOD CHAIN · A RACE EVERY 5 MINUTES</div>',
  '<div class="kicker"><i class="live"></i>PREVIEW BUILD · BOTS IN THE FIELD · A RACE EVERY 5 MINUTES</div>');

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
const out = path.join(__dirname, 'dist', 'marble-royale.html');
fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(process.cwd(), out) + ' (' + Math.round(html.length / 1024) + ' KB)');
