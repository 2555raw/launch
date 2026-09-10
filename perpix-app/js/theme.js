/* The theme.

   Three modes, not two: light, dark, and following whatever the viewer's
   machine says. "System" is the default because it is the answer most people
   have already given somewhere else, and asking again is rude.

   The choice is written to data-px-theme on the root element, and deliberately
   not to data-theme: where this page is embedded, the host writes data-theme
   itself, and two writers on one attribute fight. So the stylesheet reads the
   host's attribute as a fallback and this module writes its own, which wins.

   Canvas does not participate in the cascade, so a theme change has to repaint
   the charts. That is what the listeners are for: a change of mode, a change of
   the system's preference, or the host changing its own attribute all end in
   the same redraw. */

const KEY = 'perpix.theme';
export const MODES = ['system', 'dark', 'light'];

const root = () => document.documentElement;
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export function mode() {
  try {
    const saved = localStorage.getItem(KEY);
    if (MODES.includes(saved)) return saved;
  } catch {}
  return 'system';
}

/** What is actually on screen, which is what an icon should show. */
export function resolved() {
  const m = mode();
  if (m !== 'system') return m;
  // Following the system means following the host too, when there is one that
  // has been told which theme to use.
  const host = root().getAttribute('data-theme');
  if (host === 'dark' || host === 'light') return host;
  return systemDark() ? 'dark' : 'light';
}

const listeners = new Set();
export function onThemeChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const announce = () => listeners.forEach(fn => { try { fn(resolved(), mode()); } catch {} });

export function apply() {
  const m = mode();
  if (m === 'system') root().removeAttribute('data-px-theme');
  else root().setAttribute('data-px-theme', m);
  announce();
}

export function setMode(next) {
  if (!MODES.includes(next)) return;
  try { localStorage.setItem(KEY, next); } catch {}
  apply();
}

/** system → dark → light → system. Every step changes something except the one
 *  that returns to a system already showing what you just chose, which is the
 *  price of fitting three states on one button. */
export function cycleMode() {
  setMode(MODES[(MODES.indexOf(mode()) + 1) % MODES.length]);
}

const ICONS = {
  // A filled sun, a crescent, and a half-filled disc for "whatever the machine says".
  light: '<circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"/></g>',
  dark: '<path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8Z" fill="currentColor"/>',
  system: '<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3.6a8.4 8.4 0 0 0 0 16.8Z" fill="currentColor"/>',
};
const LABEL = { light: 'Light', dark: 'Dark', system: 'System' };

/** Wires the button in the header and keeps it describing the real state. */
export function mountThemeButton(button) {
  const paint = () => {
    const m = mode(), r = resolved();
    const next = MODES[(MODES.indexOf(m) + 1) % MODES.length];
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[m]}</svg>`;
    const state = m === 'system' ? `System (${LABEL[r].toLowerCase()})` : LABEL[m];
    button.title = `Theme: ${state}. Switch to ${LABEL[next].toLowerCase()}.`;
    button.setAttribute('aria-label', button.title);
  };
  button.addEventListener('click', cycleMode);
  onThemeChange(paint);
  paint();

  // While following the system, the system can change under us; so can a host
  // that decides to restamp its own attribute.
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (mode() === 'system') announce();
  });
  new MutationObserver(() => { if (mode() === 'system') announce(); })
    .observe(root(), { attributes: true, attributeFilter: ['data-theme'] });
}

/* Applied at import time, before the first paint, so the page never flashes the
   wrong theme on its way to the right one. */
apply();
