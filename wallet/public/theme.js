/* Day or night, chosen rather than inherited.
 *
 * Until now the colour came entirely from the browser: a dark system meant a
 * dark Ward, with no way to disagree. That is a reasonable default and it is
 * still the default — but it is the only thing most people notice changing on
 * its own, and "why did it go dark?" is a fair question with no answer in the
 * interface.
 *
 * Three states, not two. Light and dark are a deliberate choice and stick;
 * before either is made there is no choice stored at all and the system is
 * followed, including when the system changes at sunset. Clicking cycles
 * between light and dark, which is what the button is for; the third state is
 * where everyone starts rather than somewhere to click back to. */

window.WARD_THEME = (function () {
  const KEY = 'ward.v1.theme';
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  const stored = () => {
    try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : ''; }
    catch { return ''; }
  };
  /* What is actually on screen, which is not the same as what was chosen. */
  const effective = () => stored() || (media && media.matches ? 'dark' : 'light');

  function apply() {
    const s = stored();
    const root = document.documentElement;
    if (s) root.setAttribute('data-theme', s);
    else root.removeAttribute('data-theme');
    /* The browser paints its own chrome — form controls, scrollbars, the bar
       behind a phone's status icons — from this and not from our tokens. */
    root.style.colorScheme = effective();
    paint();
  }

  function set(v) {
    try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch {}
    apply();
  }

  const toggle = () => set(effective() === 'dark' ? 'light' : 'dark');

  /* A moon offers the night; a sun offers the day. The button shows what you
     would be switching to, not what you are in. */
  const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.3A8.6 8.6 0 1 1 9.7 3.5a7 7 0 0 0 10.8 10.8z"/></svg>';
  const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/>' +
    '<path d="M12 2.6v2.2M12 19.2v2.2M4.5 4.5l1.6 1.6M17.9 17.9l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.5 19.5l1.6-1.6M17.9 6.1l1.6-1.6"/></svg>';

  function paint() {
    const dark = effective() === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.innerHTML = dark ? SUN : MOON;
      b.setAttribute('aria-pressed', String(dark));
      const label = (window.WARD_THEME_LABEL && window.WARD_THEME_LABEL(dark)) ||
        (dark ? 'Switch to day' : 'Switch to night');
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
    });
  }

  function start() {
    apply();
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-theme-toggle]');
      if (b) { e.preventDefault(); toggle(); }
    });
    /* With nothing chosen, sunset on the device should still reach the page. */
    if (media && media.addEventListener) media.addEventListener('change', () => { if (!stored()) apply(); });
  }

  /* Run before first paint where possible, so a chosen light theme never
     flashes the system's dark one on the way in. */
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  return { set, toggle, stored, effective, apply, paint };
})();
