/* El sistema de marcas.
   Regla: siempre la marca real de la entidad, nunca una dibujada, generada o
   aproximada.

   Una empresa, un ETF o una cripto tienen logo propio: se resuelve en tiempo de
   ejecucion del dominio oficial que declara el registro, con un segundo
   resolutor de reserva. No hay copias en el repositorio.

   Un metal no tiene logo porque no es una empresa. Su marca es su simbolo
   quimico oficial, escrito en el color real del metal. Eso no es un dibujo: es
   la notacion que usa la propia industria.

   Si ningun resolutor responde, la reserva es el monograma de la entidad en su
   color de marca. Nunca el logo de otra, nunca un emoji.

   Todas las pantallas construyen la marca llamando a markEl(), y solo a esa
   funcion. Por eso un activo no puede aparecer con una marca en el buscador y
   otra en el cesto. */

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

/** Luminancia relativa, para elegir tinta legible sobre el color de marca en
 *  lugar de dar por hecho que el blanco siempre sirve. */
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

/** La marca del activo. Devuelve un elemento listo para insertar.

    El monograma se pinta desde el primer fotograma y el logo se carga encima:
    asi el hueco nunca esta en blanco mientras la red responde, y si no responde
    lo que queda ya esta puesto. */
export function markEl(asset, size = 36) {
  const el = document.createElement('span');
  el.className = 'wp-mark';
  el.style.width = el.style.height = size + 'px';
  el.style.setProperty('--brand', asset?.color || '#8A94A6');
  el.title = asset?.name || '';

  // El metal lleva su simbolo quimico en su propio color, que es su notacion real.
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
  img.alt = `Logo de ${asset?.name || ''}`;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.hidden = true;
  let i = 0;
  const tryNext = () => {
    if (i >= sources.length) { img.remove(); return; }   // se queda el monograma
    img.src = sources[i++];
  };
  img.addEventListener('load', () => {
    // Un icono de un pixel no es un logo: se descarta como si hubiera fallado.
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

/** Pila de marcas solapadas: como se lee un cesto de un vistazo. */
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
