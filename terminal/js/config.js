/* Runtime configuration. The API key never lives in the repository: it is read
   from window.TRICKER_CONFIG (injected by the host) or from what the user saves
   in the browser. Without a key the app runs and reports every field as
   unavailable, which is the intended behaviour, not a failure. */

const KEY = 'tricker.terminal.config';

const DEFAULTS = {
  provider: 'fmp',            // 'fmp' | 'finnhub'
  apiKey: '',
  // Official logos are resolved from the entity's own domain at runtime. Nothing
  // is copied into the repository, so a logo is never stale or approximated.
  logoTemplate: 'https://img.logo.dev/{domain}?token={logoToken}&size=128&format=png&retries=0',
  logoToken: '',
  logoFallback: 'https://icons.duckduckgo.com/ip3/{domain}.ico',
  cacheMinutes: 5,
};

function read() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { saved = {}; }
  return { ...DEFAULTS, ...(window.TRICKER_CONFIG || {}), ...saved };
}

export const config = read();
export function saveConfig(patch) {
  const next = { ...read(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  Object.assign(config, next);
  return config;
}
export function hasProvider() { return Boolean(config.apiKey); }
