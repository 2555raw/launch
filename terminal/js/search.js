/* Global search. Tolerant on purpose: ticker, legal name, trade name, a brand
   that is not listed on its own, accents, and typos. It never invents a match:
   everything it returns exists in the registry. */

import { ASSETS, BRANDS, getAsset } from './registry.js';

const norm = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Levenshtein, capped: past 2 edits we do not care how far apart they are. */
function editDistance(a, b, cap = 2) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

const HAYSTACK = [
  ...ASSETS.map(a => ({
    kind: 'asset', asset: a, id: a.id,
    terms: [a.ticker, a.id, a.name, a.short, a.sector, ...(a.aliases || [])].map(norm),
  })),
  ...BRANDS.map(b => ({
    kind: 'brand', brand: b, id: b.parent,
    terms: [b.name, ...(b.aliases || [])].map(norm),
  })),
];

function score(entry, q) {
  let best = 0;
  for (const t of entry.terms) {
    if (!t) continue;
    if (t === q) best = Math.max(best, 100);
    else if (t.startsWith(q)) best = Math.max(best, 84 - (t.length - q.length) * 0.3);
    else if (t.includes(q)) best = Math.max(best, 62);
    else if (q.length >= 4 && editDistance(t, q) <= (q.length > 6 ? 2 : 1)) best = Math.max(best, 48);
    else {
      const words = t.split(' ');
      if (words.some(w => w.startsWith(q))) best = Math.max(best, 56);
    }
  }
  return best;
}

export function search(query, limit = 9) {
  const q = norm(query);
  if (!q) return [];
  const hits = [];
  for (const entry of HAYSTACK) {
    const s = score(entry, q);
    if (s > 0) hits.push({ entry, s });
  }
  hits.sort((a, b) => b.s - a.s);

  const seen = new Set();
  const out = [];
  for (const { entry } of hits) {
    const key = entry.kind + ':' + (entry.kind === 'brand' ? entry.brand.name : entry.asset.id);
    if (seen.has(key)) continue;
    seen.add(key);
    if (entry.kind === 'asset') {
      out.push({ kind: 'asset', asset: entry.asset });
    } else {
      const parent = getAsset(entry.brand.parent);
      if (parent) out.push({ kind: 'brand', brand: entry.brand, asset: parent });
    }
    if (out.length >= limit) break;
  }
  return out;
}
