/* The mark system.
   Rule: always the entity's real mark, never one drawn, generated or
   approximated.

   Three tiers, in this order:

   1. The full-colour logo resolved at runtime from the entity's own official
      domain. This is the entity's current mark, so when it loads it wins.
   2. The official mark embedded in js/marks.js, from published CC0 icon sets.
      This is what shows the instant the page opens, and what stays where tier 1
      cannot reach: a page opened from the filesystem with no connection, or a
      host that blocks external images.
   3. The asset's own official symbol on its brand colour, for the assets no set
      carries. Fourteen companies and funds have no logo published under a
      licence that allows embedding — in several cases because the owner had it
      removed from the sets that used to carry it — so what stands in is the
      ticker they actually trade under. That is a real identifier, not a drawing:
      never another entity's logo, and never an emoji.

   A metal skips all three: it is not a company and has no logo. Its mark is its
   official chemical symbol in the real colour of the metal, which is the
   notation the industry itself uses. Tier 3 is the same treatment applied to
   the same kind of fact, so the two read as one system rather than as a mark
   and a failure.

   Tier 2 paints first and tier 1 replaces it only if what arrives is big enough
   to be an improvement, so the slot is never blank and never gets worse.

   Every screen builds a mark by calling markEl(), and only that function. That
   is why an asset cannot show one mark in the search box and another in a
   basket. */

import { config } from './config.js';
import { MARKS } from './marks.js';

const failed = new Set();

function fill(template, domain) {
  return template
    .replace('{domain}', encodeURIComponent(domain))
    .replace('{logoToken}', encodeURIComponent(config.logoToken || ''));
}

export function logoSources(domain) {
  if (!domain) return [];
  const out = [];
  if (config.logoTemplate && (config.logoToken || !config.logoTemplate.includes('{logoToken}'))) {
    out.push(fill(config.logoTemplate, domain));
  }
  for (const tpl of config.logoFallbacks || []) out.push(fill(tpl, domain));
  return out.filter(u => !failed.has(u));
}

export function rgba(hex, a) {
  const m = String(hex || '#888').replace('#', '');
  const n = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(136,136,136,${a})`;
  return `rgba(${r},${g},${b},${a})`;
}

/** Relative luminance, to pick legible ink over a brand colour instead of
 *  assuming white always works. */
export function luminance(hex) {
  const m = String(hex || '#888').replace('#', '');
  const n = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const ch = [0, 2, 4].map(i => {
    const v = (parseInt(n.slice(i, i + 2), 16) || 0) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export const inkOn = (hex) => (luminance(hex) > 0.55 ? '#111418' : '#FFFFFF');

/** Symbol text sized to fit its tile: two characters can be large, five have to
 *  give way. Without this a five-letter ticker would either overflow or force
 *  every mark down to the size the longest one needs. */
function symbolType(text, size) {
  const n = Math.max(text.length, 1);
  const scale = n <= 2 ? 0.42 : n === 3 ? 0.32 : n === 4 ? 0.26 : 0.21;
  return Math.max(7, Math.round(size * scale));
}

/** A tile in the asset's own brand colour carrying its official symbol. The
 *  same construction serves a metal's chemical symbol and a company's ticker. */
function symbolTile(el, asset, text, size) {
  el.classList.add('is-symbol');
  el.style.background = asset.color;
  el.style.color = inkOn(asset.color);
  el.style.fontSize = symbolType(text, size) + 'px';
  el.append(Object.assign(document.createElement('span'), {
    className: 'wp-mark-txt', textContent: text,
  }));
  return el;
}

/** Below this many pixels, a fetched image is a favicon rather than a logo and
 *  replacing a clean embedded mark with it would be a downgrade. */
const MIN_USEFUL = 32;

/** Builds the embedded official mark as inline SVG, or null if there is none.
 *  A monochrome set is drawn in the entity's own brand colour; a colour set is
 *  left exactly as published. */
function embeddedMark(asset) {
  const m = MARKS[asset?.id];
  if (!m) return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', m.box);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('wp-mark-svg');
  if (m.tint) svg.setAttribute('fill', m.tint);
  else if (m.mono) svg.setAttribute('color', asset.color);   // the set draws with currentColor
  svg.innerHTML = m.body;
  return svg;
}

/** What the interface can say about where an asset's mark came from. */
export function markProvenance(asset) {
  if (asset?.class === 'metal') {
    return { kind: 'element', text: `Official chemical symbol, ${asset.element}, in the real colour of the metal` };
  }
  const m = MARKS[asset?.id];
  if (m) {
    const who = m.brand
      ? `Official mark of ${m.brand}, a brand of ${asset.short}`
      : 'Official mark';
    return {
      kind: 'embedded', set: m.set, brand: m.brand, licence: m.licence,
      text: `${who}, embedded from ${m.set} (${m.licence}), and resolved at runtime from ${asset.domain} when that loads`,
    };
  }
  return {
    kind: 'symbol',
    text: `No logo for ${asset?.short} is published under a licence that allows embedding, so its official ticker `
        + `${asset?.symbol} stands in${asset?.domain ? `; the real logo still resolves at runtime from ${asset.domain}` : ''}`,
  };
}

/** The asset's mark. Returns an element ready to insert. */
export function markEl(asset, size = 36) {
  const el = document.createElement('span');
  el.className = 'wp-mark';
  el.style.width = el.style.height = size + 'px';
  el.style.setProperty('--brand', asset?.color || '#8A94A6');
  el.title = asset?.name || '';

  // A metal carries its chemical symbol in its own colour, which is its real
  // notation, so none of the logo tiers apply.
  if (asset?.class === 'metal') {
    el.classList.add('is-element');
    return symbolTile(el, asset, asset.element || asset.symbol, size);
  }

  // Tier 2 first, because it needs nothing and is ready on this frame.
  const embedded = embeddedMark(asset);
  if (embedded) {
    el.classList.add('is-svg');
    el.style.padding = Math.max(1, Math.round(size * 0.11)) + 'px';
    el.append(embedded);
  } else {
    symbolTile(el, asset, asset.symbol || '?', size);
  }

  // Tier 1 on top, if it arrives and is worth the swap.
  const sources = logoSources(asset?.domain);
  if (!sources.length) return el;

  const img = document.createElement('img');
  img.className = 'wp-mark-img';
  img.alt = `${asset?.name || ''} logo`;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.hidden = true;
  let i = 0;
  const tryNext = () => {
    if (i >= sources.length) { img.remove(); return; }   // what is already painted stays
    img.src = sources[i++];
  };
  img.addEventListener('load', () => {
    // A 16-pixel favicon is not an upgrade over an embedded vector mark.
    const floor = embedded ? MIN_USEFUL : 8;
    if (img.naturalWidth < floor) { failed.add(img.src); return tryNext(); }
    img.hidden = false;
    el.classList.remove('is-symbol', 'is-svg');
    el.style.padding = '0';
    el.style.background = '#fff';
    el.querySelector('.wp-mark-txt')?.remove();
    el.querySelector('.wp-mark-svg')?.remove();
  });
  img.addEventListener('error', () => { failed.add(img.src); tryNext(); });
  el.append(img);
  tryNext();
  return el;
}

/** Overlapping stack of marks: how a basket reads at a glance. */
export function markStack(assets, size = 28) {
  const el = document.createElement('span');
  el.className = 'wp-stack';
  (assets || []).forEach((a, i) => {
    const m = markEl(a, size);
    m.style.zIndex = String(20 - i);
    m.style.marginLeft = i ? `-${Math.round(size * 0.24)}px` : '0';
    el.appendChild(m);
  });
  return el;
}
