/* Builds the AUREN WATCHES logo files.
 *
 * The symbol is drawn from geometry: a thin ring, one index at twelve, and the
 * two hands of a watch meeting at the pivot as a Λ — the A of AUREN read as a
 * dial. The wordmark is Montserrat set by hand and turned into outlines, so the
 * files render the same everywhere without the font installed.
 *
 * Output:
 *   public/brand/*.svg        symbol, horizontal and stacked lockups, in black,
 *                             white and champagne gold, plus favicon and avatar
 *   src/views/logo-data.json  the same outlines, used inline by the site
 */
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'brand');
const COLORS = { black: '#0B0B0C', white: '#F7F7F5', gold: '#C6A56B' };

const font = (w) => opentype.loadSync(require.resolve(`@fontsource/montserrat/files/montserrat-latin-${w}-normal.woff`));
const semibold = font(600);
const medium = font(500);

const r = (n) => Math.round(n * 100) / 100;

/* ---------- symbol, on a 100 × 100 grid ---------- */
function symbolPaths() {
  const c = 50;
  // ring as an annulus so it fills (not strokes) and scales cleanly
  const R = 47, t = 3.4, ri = R - t;
  const ring = `M${c - R} ${c}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z` +
    `M${c - ri} ${c}a${ri} ${ri} 0 1 1 ${2 * ri} 0a${ri} ${ri} 0 1 1 ${-2 * ri} 0Z`;

  // index at twelve
  const iw = 3.4, top = c - ri + 5, len = 11;
  const index = `M${r(c - iw / 2)} ${r(top)}h${iw}v${len}h${-iw}Z`;

  // two tapered hands from the pivot, mirrored about the vertical axis
  const hand = (deg) => {
    const a = (deg * Math.PI) / 180;
    const L = 33, base = 3, tip = 1.1;
    const ux = Math.sin(a), uy = -Math.cos(a);   // along the hand
    const nx = -uy, ny = ux;                       // across it
    const p = [
      [c + nx * base, c + ny * base],
      [c + ux * L + nx * tip, c + uy * L + ny * tip],
      [c + ux * L - nx * tip, c + uy * L - ny * tip],
      [c - nx * base, c - ny * base]
    ];
    return 'M' + p.map(([x, y]) => `${r(x)} ${r(y)}`).join('L') + 'Z';
  };
  const hands = [hand(142), hand(-142)];

  const pr = 4.6;
  const pivot = `M${c - pr} ${c}a${pr} ${pr} 0 1 0 ${2 * pr} 0a${pr} ${pr} 0 1 0 ${-2 * pr} 0Z`;
  return { ring, index, hands, pivot };
}

/* ---------- wordmark ---------- */
// Sets a line of capitals with tracking (in em) and returns its outline and width.
function setLine(f, text, size, tracking, x0 = 0, baseline = 0) {
  const scale = size / f.unitsPerEm;
  let x = x0, d = '';
  const glyphs = [...text].map((ch) => f.charToGlyph(ch));
  glyphs.forEach((g, i) => {
    d += g.getPath(x, baseline, size).toPathData(2);
    if (i < glyphs.length - 1) {
      x += g.advanceWidth * scale + f.getKerningValue(g, glyphs[i + 1]) * scale + tracking * size;
    } else {
      // the last glyph ends at its ink, not its advance, so lines centre truly
      const bb = g.getBoundingBox();
      x += bb.x2 * scale;
    }
  });
  const first = glyphs[0].getBoundingBox().x1 * scale;
  return { d, width: x - x0 - first, left: x0 + first };
}

// AUREN over WATCHES, with WATCHES tracked out to the exact width of AUREN.
function wordmark() {
  const capH = (f) => (f.tables.os2.sCapHeight || 700) / f.unitsPerEm;
  const size = 100 / capH(semibold);             // AUREN cap height = 100 units
  const top = setLine(semibold, 'AUREN', size, 0.30);
  const wSize = 30 / capH(medium);               // WATCHES cap height = 30 units
  // solve the tracking that makes WATCHES as wide as AUREN
  const plain = setLine(medium, 'WATCHES', wSize, 0);
  const tracking = (top.width - plain.width) / (6 * wSize);
  const gap = 46;
  const bottom = setLine(medium, 'WATCHES', wSize, tracking, top.left - plain.left, gap + 30);
  // shift both so ink starts at x = 0 and the cap line of AUREN is y = 0
  return {
    auren: shift(top.d, -top.left, 100),
    watches: shift(bottom.d, -top.left, 100),
    width: top.width,
    height: 100 + gap + 30
  };
}

// translate path data by dx, dy (opentype emits absolute M/L/Q/C/Z only)
function shift(d, dx, dy) {
  return d.replace(/([MLQCZ])([^MLQCZ]*)/g, (_, cmd, args) => {
    const nums = (args.match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi) || []).map(Number);
    return cmd + nums.map((n, i) => r(i % 2 ? n + dy : n + dx)).join(' ');
  });
}

const sym = symbolPaths();
const wm = wordmark();
/* One <path> per shape: the hands overlap each other and the pivot, and in a
   single path their opposite windings would punch holes where they cross. */
const parts = [sym.ring, sym.index, ...sym.hands, sym.pivot];
const symbol = (fill, extra = '') =>
  `<g fill="${fill}"${extra}>` + parts.map((d, i) => `<path${i ? '' : ' fill-rule="evenodd"'} d="${d}"/>`).join('') + '</g>';

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(w)} ${r(h)}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;

fs.mkdirSync(OUT, { recursive: true });
const write = (name, s) => { fs.writeFileSync(path.join(OUT, name), s); console.log('brand/' + name); };

for (const [name, col] of Object.entries(COLORS)) {
  write(`auren-symbol-${name}.svg`, svg(100, 100, symbol(col), 'AUREN'));

  // horizontal: symbol as tall as the whole wordmark block
  const s = wm.height / 100, gapH = 64;
  write(`auren-logo-horizontal-${name}.svg`, svg(100 * s + gapH + wm.width, wm.height,
    symbol(col, ` transform="scale(${r(s)})"`) +
    `<g fill="${col}" transform="translate(${r(100 * s + gapH)} 0)"><path d="${wm.auren}"/><path d="${wm.watches}"/></g>`,
    'AUREN WATCHES'));

  // stacked: symbol centred above the wordmark
  const ss = 2.1, gapV = 70, symW = 100 * ss;
  const W = Math.max(wm.width, symW);
  write(`auren-logo-stacked-${name}.svg`, svg(W, symW + gapV + wm.height,
    symbol(col, ` transform="translate(${r((W - symW) / 2)} 0) scale(${ss})"`) +
    `<g fill="${col}" transform="translate(${r((W - wm.width) / 2)} ${r(symW + gapV)})"><path d="${wm.auren}"/><path d="${wm.watches}"/></g>`,
    'AUREN WATCHES'));
}

// favicon and social avatar: porcelain symbol on obsidian, the index in gold
const tile = (rx) => svg(100, 100,
  `<rect width="100" height="100" rx="${rx}" fill="#0B0B0C"/>` +
  `<g transform="translate(18 18) scale(.64)">${symbol('#F7F7F5')}<path fill="#C6A56B" d="${sym.index}"/></g>`,
  'AUREN');
write('favicon.svg', tile(22));
write('auren-avatar.svg', tile(0));
fs.copyFileSync(path.join(OUT, 'favicon.svg'), path.join(ROOT, 'public', 'favicon.svg'));

fs.mkdirSync(path.join(ROOT, 'src', 'views'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src', 'views', 'logo-data.json'), JSON.stringify({
  symbol: { ring: sym.ring, index: sym.index, hands: sym.hands, pivot: sym.pivot },
  wordmark: { auren: wm.auren, watches: wm.watches, width: r(wm.width), height: wm.height }
}, null, 2) + '\n');
console.log('src/views/logo-data.json');
