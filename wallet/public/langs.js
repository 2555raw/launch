/* The languages the site offers, and how one gets loaded.
 *
 * Twenty-one dictionaries is far more text than any one reader needs, and
 * shipping all of them would put around half a megabyte in front of everybody
 * so that one visitor in a hundred can read Hungarian. So only English travels
 * with the page: it is written into the markup as the source and the fallback.
 * Every other language is a small JSON file, fetched the moment it is picked.
 *
 * A fetch takes a moment, and a page that painted English first and corrected
 * itself afterwards would flicker on every visit. So a fetched dictionary is
 * kept in this browser: the next visit paints from that copy straight away,
 * synchronously, and the fetch that follows quietly replaces it if the wording
 * has changed since. Only the language in use is kept; picking another throws
 * the last one away rather than letting them pile up. */

window.WARD_LANGS = [
  { id: 'id',   short: 'ID', name: 'Bahasa Indonesia', html: 'id',      date: 'id-ID' },
  { id: 'cs',   short: 'CS', name: 'Čeština',          html: 'cs',      date: 'cs-CZ' },
  { id: 'de',   short: 'DE', name: 'Deutsch',          html: 'de',      date: 'de-DE' },
  { id: 'en',   short: 'EN', name: 'English',          html: 'en',      date: 'en-GB' },
  { id: 'es',   short: 'ES', name: 'Español',          html: 'es',      date: 'es-ES' },
  { id: 'fr',   short: 'FR', name: 'Français',         html: 'fr',      date: 'fr-FR' },
  { id: 'it',   short: 'IT', name: 'Italiano',         html: 'it',      date: 'it-IT' },
  { id: 'hu',   short: 'HU', name: 'Magyar',           html: 'hu',      date: 'hu-HU' },
  { id: 'nl',   short: 'NL', name: 'Nederlands',       html: 'nl',      date: 'nl-NL' },
  { id: 'pl',   short: 'PL', name: 'Polski',           html: 'pl',      date: 'pl-PL' },
  { id: 'pt',   short: 'PT', name: 'Português (Brasil)', html: 'pt-BR', date: 'pt-BR' },
  { id: 'ro',   short: 'RO', name: 'Română',           html: 'ro',      date: 'ro-RO' },
  { id: 'vi',   short: 'VI', name: 'Tiếng Việt',       html: 'vi',      date: 'vi-VN' },
  { id: 'tr',   short: 'TR', name: 'Türkçe',           html: 'tr',      date: 'tr-TR' },
  { id: 'ru',   short: 'RU', name: 'Русский',          html: 'ru',      date: 'ru-RU' },
  { id: 'uk',   short: 'UK', name: 'Українська',       html: 'uk',      date: 'uk-UA' },
  { id: 'ar',   short: 'AR', name: 'العربية',           html: 'ar',      date: 'ar',    rtl: true },
  { id: 'ko',   short: 'KO', name: '한국어',              html: 'ko',      date: 'ko-KR' },
  { id: 'ja',   short: 'JA', name: '日本語',              html: 'ja',      date: 'ja-JP' },
  { id: 'zh',   short: '简', name: '简体中文',            html: 'zh-Hans', date: 'zh-CN' },
  { id: 'zt',   short: '繁', name: '繁體中文',            html: 'zh-Hant', date: 'zh-TW' }
];

window.WARD_LANG = (function () {
  const LIST = window.WARD_LANGS;
  const PREFIX = 'ward.v1.dict.';
  const key = (scope, id) => PREFIX + scope + '.' + id;
  const url = (scope, id) => '/lang/' + (scope === 'app' ? 'app.' : '') + id + '.json';

  const find = id => LIST.find(l => l.id === id) || null;
  const ok = d => !!d && typeof d === 'object' && !Array.isArray(d) && Object.keys(d).length > 0;

  /* Synchronous, for the first paint. Returns null rather than throwing when
     storage is blocked, which is the normal state in a private window. */
  function cached(scope, id) {
    try {
      const d = JSON.parse(localStorage.getItem(key(scope, id)) || 'null');
      return ok(d) ? d : null;
    } catch { return null; }
  }

  function keep(scope, id, dict) {
    try {
      /* One language at a time. Whatever was cached for another is dead weight
         the moment a different one is chosen. */
      const stale = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(PREFIX + scope + '.') === 0 && k !== key(scope, id)) stale.push(k);
      }
      stale.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(key(scope, id), JSON.stringify(dict));
    } catch { /* full, or blocked: the fetch still works, it just repeats */ }
  }

  /* Resolves with the dictionary, or with null when there is nothing to load
     (English) and when the fetch fails (offline, or a file that is not there).
     It never rejects: a missing translation has to leave English standing, not
     take the page down with it. */
  function load(scope, id) {
    if (id === 'en' || !find(id)) return Promise.resolve(null);
    return fetch(url(scope, id), { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!ok(d)) return null; keep(scope, id, d); return d; })
      .catch(() => null);
  }

  return { list: LIST, find, cached, load };
})();
