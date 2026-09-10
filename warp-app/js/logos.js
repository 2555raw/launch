/* The mark system.
   Rule: always the entity's real mark, never one drawn, generated or
   approximated.

   A company, an ETF or a coin has a logo of its own: it is resolved at runtime
   from the official domain the registry declares, with fallback resolvers
   behind it. Nothing is copied into the repository.

   A metal has no logo because it is not a company. Its mark is its official
   chemical symbol, written in the real colour of the metal. That is not a
   drawing: it is the notation the industry itself uses.

   If no resolver answers, what is left is the entity's monogram in its brand
   colour. Never another entity's logo, never an emoji.

   Every screen builds a mark by calling markEl(), and only that function. That
   is why an asset cannot show one mark in the search box and another in a
   basket. */

import { config } from './config.js';

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

function monogram(asset) {
  const words = String(asset?.short || asset?.name || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
  return ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase() || '?';
}

/** The asset's mark. Returns an element ready to insert.

    The monogram paints on the first frame and the logo loads over it: the slot
    is never blank while the network answers, and if it never answers what is
    left is already in place. */
export function markEl(asset, size = 36) {
  const el = document.createElement('span');
  el.className = 'wp-mark';
  el.style.width = el.style.height = size + 'px';
  el.style.setProperty('--brand', asset?.color || '#8A94A6');
  el.title = asset?.name || '';

  // A metal carries its chemical symbol in its own colour, which is its real notation.
  if (asset?.class === 'metal') {
    el.classList.add('is-element');
    el.style.background = asset.color;
    el.style.color = inkOn(asset.color);
    el.style.fontSize = Math.round(size * 0.42) + 'px';
    el.append(Object.assign(document.createElement('span'), {
      className: 'wp-mark-txt', textContent: asset.element || asset.symbol,
    }));
    return el;
  }

  el.classList.add('is-monogram');
  el.style.background = rgba(asset?.color, 0.12);
  el.style.color = asset?.color || '#5A6473';
  el.style.fontSize = Math.round(size * 0.36) + 'px';
  const label = Object.assign(document.createElement('span'), {
    className: 'wp-mark-txt', textContent: monogram(asset),
  });
  el.append(label);

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
    if (i >= sources.length) { img.remove(); return; }   // the monogram stays
    img.src = sources[i++];
  };
  img.addEventListener('load', () => {
    // A one-pixel icon is not a logo: it is discarded as though it had failed.
    if (img.naturalWidth < 8) { failed.add(img.src); return tryNext(); }
    img.hidden = false;
    el.classList.remove('is-monogram');
    el.style.background = '#fff';
    label.hidden = true;
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
