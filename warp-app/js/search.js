/* The search box. It tolerates typos, accents and the trade name, because
   someone searching "nickel" or "aluminium" should not have to remember that
   the symbol is XNI or XAL. It never invents a match: if nothing looks close,
   it says so. */

import { tradableAssets, CLASSES } from './registry.js';
import { state } from './store.js';

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Bounded edit distance: all that matters is whether it differs by a letter
 *  or two, not how far apart any two strings are. */
function close(a, b, max = 1) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

function scoreAsset(asset, q) {
  const sym = fold(asset.symbol), name = fold(asset.name), short = fold(asset.short);
  const el = fold(asset.element || '');
  if (sym === q || el === q) return 100;
  if (short === q || name === q) return 96;
  if (sym.startsWith(q)) return 88;
  if (short.startsWith(q) || name.startsWith(q)) return 80;
  for (const a of asset.aliases || []) {
    const fa = fold(a);
    if (fa === q) return 90;
    if (fa.startsWith(q)) return 74;
    if (fa.includes(q)) return 58;
  }
  if (short.includes(q) || name.includes(q)) return 52;
  if (fold(asset.sector).includes(q)) return 34;
  if (q.length >= 4 && (close(sym, q) <= 1 || close(short.slice(0, q.length), q) <= 1)) return 30;
  return 0;
}

function scoreIndex(ix, q) {
  const sym = fold(ix.symbol), name = fold(ix.name);
  if (sym === q) return 100;
  if (sym.startsWith(q) || name.startsWith(q)) return 84;
  if (sym.includes(q) || name.includes(q) || fold(ix.note).includes(q)) return 50;
  if (ix.legs.some(l => fold(l.id) === q)) return 44;
  return 0;
}

/** Searches listed indices and the asset universe, in that order of interest:
 *  in a market of indices, what you trade is the index. */
export function search(query, limit = 9) {
  const q = fold(query).trim();
  if (q.length < 1) return [];
  const out = [];
  for (const ix of state.indices) {
    const s = scoreIndex(ix, q);
    if (s) out.push({ kind: 'index', score: s + 6, index: ix, label: ix.name, sub: `Index · ${ix.legs.length} assets` });
  }
  for (const a of tradableAssets()) {
    const s = scoreAsset(a, q);
    if (s) out.push({ kind: 'asset', score: s, asset: a, label: a.name, sub: `${CLASSES[a.class]?.label || ''} · ${a.sector}` });
  }
  return out.sort((x, y) => y.score - x.score || x.label.localeCompare(y.label, 'en')).slice(0, limit);
}
