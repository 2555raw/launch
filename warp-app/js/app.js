/* El armazon: enrutado, buscador, reloj y el latido que liquida.

   Una pantalla se pinta entera al entrar y se repinta cuando cambia el estado o
   cuando avanza el precio. El repintado se salta si el usuario tiene el foco en
   un campo, para no borrarle lo que esta escribiendo, y nunca toca la pantalla
   de crear indice, que es un formulario largo. */

import { VENUE } from './config.js';
import { state, onChange } from './store.js';
import { liquidationSweep, accountSummary } from './engine.js';
import { feed } from './market.js';
import { search } from './search.js';
import { usdg, dir, clock } from './format.js';
import { markStack, markEl } from './logos.js';
import { indexLegs } from './engine.js';
import { el, toast } from './ui/components.js';
import {
  panelView, marketView, createView, portfolioView, creatorView,
  assetsView, assetView, indexView, notFound, confirmReset,
} from './views.js';

const view = document.getElementById('view');
const nav = document.getElementById('nav');
const input = document.getElementById('q');
const results = document.getElementById('results');
const combobox = input.closest('.wp-search');

/* ---------------- enrutado ---------------- */

function parseHash() {
  const raw = (location.hash || '#/').slice(1);
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');
  if (!parts.length) return { route: 'panel', params };
  if (parts[0] === 'i') return { route: 'indice', id: parts[1], params };
  if (parts[0] === 'a') return { route: 'activo', id: parts[1], params };
  return { route: parts[0], id: parts[1], params };
}

const PAGES = {
  panel: () => panelView(),
  mercado: () => marketView(),
  crear: (r) => createView(r.params.get('seed')),
  cartera: () => portfolioView(),
  creador: () => creatorView(),
  activos: () => assetsView(),
  indice: (r) => indexView(r.id),
  activo: (r) => assetView(r.id),
};

/* Titulo de pestana: dice donde estas sin tener que mirar la barra lateral. */
const TITLES = {
  panel: 'Panel', mercado: 'Mercado', crear: 'Crear indice',
  cartera: 'Cartera', creador: 'Mis indices', activos: 'Activos',
};

let current = parseHash();

function render() {
  const r = current;
  const build = PAGES[r.route];
  view.replaceChildren(build ? build(r) : notFound('Esa direccion no existe en Warp.'));
  document.title = `${TITLES[r.route] || 'Warp'} · Warp`;
  [...nav.querySelectorAll('a')].forEach(a => {
    const active = a.dataset.route === r.route
      || (r.route === 'indice' && a.dataset.route === 'mercado')
      || (r.route === 'activo' && a.dataset.route === 'activos');
    a.classList.toggle('is-active', active);
    a.setAttribute('aria-current', active ? 'page' : 'false');
  });
  paintSide();
}

function navigate() {
  const next = parseHash();
  const same = next.route === current.route && next.id === current.id;
  current = next;
  render();
  if (!same) { window.scrollTo({ top: 0 }); closeResults(); }
}
window.addEventListener('hashchange', navigate);

/* ---------------- barra lateral ---------------- */

const sideEquity = document.getElementById('sideEquity');
const navOpen = document.getElementById('navOpen');

function paintSide() {
  const acc = accountSummary();
  sideEquity.replaceChildren(
    el('dt', { text: `Patrimonio (${VENUE.settle})` }),
    el('dd', { text: usdg(acc.equity).replace(' ' + VENUE.settle, '') }),
    el('div', { class: 'wp-equity-row' }, [
      el('span', { text: 'Disponible' }),
      el('span', { class: 'num', text: usdg(acc.balance).replace(' ' + VENUE.settle, '') }),
    ]),
    el('div', { class: 'wp-equity-row' }, [
      el('span', { text: 'Abierto' }),
      el('span', { class: `num ${dir(acc.unrealised)}`, text: usdg(acc.unrealised, { sign: true }).replace(' ' + VENUE.settle, '') }),
    ]),
  );
  navOpen.hidden = !state.positions.length;
  navOpen.textContent = String(state.positions.length);
}

document.getElementById('resetBtn').addEventListener('click', confirmReset);

/* El simbolo de X todavia no tiene destino. En lugar de un enlace que no lleva
   a ninguna parte, lo dice. */
document.getElementById('xBtn').addEventListener('click', () => {
  toast('El perfil de X aun no esta enlazado.');
});

/* ---------------- buscador ---------------- */

let hits = [];
let cursor = -1;

function closeResults() {
  results.hidden = true;
  combobox.setAttribute('aria-expanded', 'false');
  cursor = -1;
}

function openHit(hit) {
  input.value = '';
  closeResults();
  location.hash = hit.kind === 'index' ? `#/i/${hit.index.id}` : `#/a/${hit.asset.id}`;
}

function paintResults() {
  results.replaceChildren();
  if (!hits.length) {
    results.append(el('div', { class: 'wp-res-empty', text: 'Nada coincide. Prueba con el simbolo, el nombre o el metal ("niquel", "XAU").' }));
  } else {
    hits.forEach((hit, i) => {
      const mark = hit.kind === 'index'
        ? markStack(indexLegs(hit.index).map(l => l.asset), 22)
        : markEl(hit.asset, 26);
      results.append(el('button', {
        class: `wp-res ${i === cursor ? 'is-on' : ''}`, type: 'button', role: 'option',
        on: { click: () => openHit(hit) },
      }, [
        mark,
        el('span', {}, [
          el('span', { class: 'wp-res-label', text: hit.label }),
          el('br'),
          el('span', { class: 'wp-res-sub', text: hit.sub }),
        ]),
        el('span', { class: 'wp-res-sym num', text: hit.kind === 'index' ? hit.index.symbol : hit.asset.symbol }),
      ]));
    });
  }
  results.hidden = false;
  combobox.setAttribute('aria-expanded', 'true');
}

input.addEventListener('input', () => {
  const q = input.value.trim();
  if (!q) return closeResults();
  hits = search(q);
  cursor = hits.length ? 0 : -1;
  paintResults();
});
input.addEventListener('focus', () => { if (input.value.trim()) paintResults(); });
input.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { input.value = ''; closeResults(); input.blur(); return; }
  if (!hits.length || results.hidden) return;
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    cursor = (cursor + (ev.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
    paintResults();
  } else if (ev.key === 'Enter' && cursor >= 0) {
    ev.preventDefault();
    openHit(hits[cursor]);
  }
});
document.addEventListener('click', (ev) => { if (!combobox.contains(ev.target)) closeResults(); });
document.addEventListener('keydown', (ev) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if (ev.key === '/' && !typing) { ev.preventDefault(); input.focus(); }
});

/* ---------------- el latido ---------------- */

const clockEl = document.getElementById('clock');
const stamp = document.getElementById('stamp');

/** Se repinta la pantalla salvo que el usuario este escribiendo en ella, y
 *  nunca la de crear indice: un formulario a medias no se toca. */
function canRepaint() {
  if (current.route === 'crear') return false;
  const a = document.activeElement;
  return !(a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}

function tick() {
  clockEl.textContent = clock();
  stamp.textContent = `${feed.label}${feed.isSimulated ? ' · precio simulado' : ''} · ${clock()}`;
  // Una posicion sin margen se liquida por la regla, no porque alguien mire.
  const killed = liquidationSweep();
  if (killed) toast(`${killed} ${killed === 1 ? 'posicion liquidada' : 'posiciones liquidadas'} por falta de margen`, 'bad');
  if (canRepaint()) render(); else paintSide();
}

onChange(() => { if (canRepaint()) render(); else paintSide(); });

navigate();
tick();
setInterval(tick, 5000);
