/* The logo system.
   Rule: always the entity's own official logo, resolved at runtime from its
   official domain. Nothing is drawn, approximated or generated, and no copies
   are stored in the repository, so the same asset shows the same mark on every
   screen. When a provider returns nothing, the fallback is a neutral monogram,
   never another company's mark and never an emoji. */

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
  if (config.logoFallback) out.push(fill(config.logoFallback, domain));
  return out.filter(u => !failed.has(u));
}

function monogram(name) {
  const words = String(name || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
  return ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase() || '?';
}

/** Returns an element that shows the official logo, or a monogram if none resolves.
 *  Every screen builds its logo through this function, and only through it. */
export function logoEl(entity, size = 40) {
  const el = document.createElement('span');
  el.className = 'tk-logo pad';
  el.style.width = el.style.height = size + 'px';
  el.style.fontSize = Math.round(size * 0.34) + 'px';
  el.title = entity?.name || '';

  const sources = logoSources(entity?.domain);
  if (!sources.length) { el.textContent = monogram(entity?.short || entity?.name); return el; }

  const img = document.createElement('img');
  img.alt = `Logo de ${entity?.name || ''}`;
  img.loading = 'lazy';
  let i = 0;
  const tryNext = () => {
    if (i >= sources.length) {           // every source exhausted: neutral monogram
      img.remove();
      el.textContent = monogram(entity?.short || entity?.name);
      return;
    }
    img.src = sources[i++];
  };
  img.addEventListener('error', () => { failed.add(img.src); tryNext(); });
  el.appendChild(img);
  tryNext();
  return el;
}
