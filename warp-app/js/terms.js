/* The terms gate, and the storage notice that follows it.

   Nobody reads terms, which is exactly why these are short and say the things
   that actually matter about this application: that the money is not money,
   that the prices are not prices, that the data never leaves the browser, and
   that the logos belong to other people. Everything in them is true; there is
   no clause here padding the length.

   Acceptance is stored with the version it accepted, so changing the terms
   asks again rather than assuming an old yes still covers a new text. */

import { VENUE } from './config.js';
import { el } from './ui/components.js';

export const TERMS_VERSION = 1;
const KEY = 'warp.terms';

/* The storage notice waits, on purpose. Stacking it on top of the terms would
   make two walls to get through before seeing anything, and a notice about what
   the application stores means more once it has actually stored something. */
const STORAGE_KEY = 'warp.storage.consent';
const STORAGE_DELAY = 30000;

export function acceptance() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw && raw.version === TERMS_VERSION ? raw : null;
  } catch { return null; }
}
export const hasAccepted = () => Boolean(acceptance());

function record() {
  const entry = { version: TERMS_VERSION, acceptedAt: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(entry)); } catch {}
  return entry;
}

/* The clauses. Kept as data so the same text serves the gate on entry and the
   copy reachable from the footer afterwards: one source, so they cannot drift. */
export const CLAUSES = [
  {
    title: 'This is a paper market',
    body: `Warp is for practice. Every price you see is produced by a simulator built into the page, `
        + `not by a market data provider, and no figure here describes the real market. The ${VENUE.settle} `
        + `balance is not money: it cannot be deposited, withdrawn or exchanged for anything. No order you `
        + `place reaches a real venue, and no asset is ever bought or sold.`,
  },
  {
    title: 'Nothing here is advice',
    body: `Nothing in Warp is investment advice, a recommendation, an offer or a solicitation. An index `
        + `performing one way in the simulator says nothing about the assets it names. Leverage in this `
        + `application will lose you simulated money quickly, which is the one lesson it can honestly teach.`,
  },
  {
    title: 'Your data stays in your browser',
    body: `Your balance, positions, history and the indices you list are stored in this browser's local `
        + `storage and nowhere else. Nothing is sent to a server, because there is no server. That also `
        + `means nothing is backed up: clearing the site's data, using a different browser, or pressing `
        + `Reset account erases it permanently.`,
  },
  {
    title: 'The logos belong to their owners',
    body: `Company, fund and coin names, symbols and logos are the trademarks of their respective owners. `
        + `They appear here only to identify which asset a row refers to. Warp is not affiliated with, `
        + `sponsored by, or endorsed by any of them, and none of them has reviewed this application.`,
  },
  {
    title: 'No warranty',
    body: `Warp is provided as it is, with no warranty of any kind. It may contain errors, it may change, `
        + `and it may stop working. Use it as a toy, which is what it is.`,
  },
];

const clauseList = () => el('div', { class: 'wp-terms-body' }, CLAUSES.map(c =>
  el('section', { class: 'wp-clause' }, [
    el('h3', { text: c.title }),
    el('p', { text: c.body }),
  ])));

const brandMark = () => el('span', { class: 'wp-terms-mark', html:
  `<svg viewBox="0 0 32 32" aria-hidden="true">
     <rect width="32" height="32" rx="8" fill="#1F58F5"/>
     <g stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M10 7v18M16 7v18M22 7v18"/></g>
     <path d="M6 16c4-4 6 4 10 0s6 4 10 0" stroke="#FFC72C" stroke-width="2.6" fill="none" stroke-linecap="round"/>
   </svg>` });

/** Blocks the application until the terms are accepted, then calls `start`.
 *  If they have already been accepted at this version, `start` runs at once. */
export function requireAcceptance(start) {
  if (hasAccepted()) return start();

  const box = el('input', { type: 'checkbox', id: 'termsAgree', class: 'wp-check' });
  const accept = el('button', { class: 'wp-btn', type: 'button', text: 'Accept and enter', disabled: true });
  const decline = el('button', { class: 'wp-btn ghost', type: 'button', text: 'Decline' });

  box.addEventListener('change', () => { accept.disabled = !box.checked; });
  accept.addEventListener('click', () => {
    if (!box.checked) return;
    record();
    overlay.remove();
    document.body.classList.remove('wp-locked');
    start();
  });
  decline.addEventListener('click', () => {
    // Declining is a real answer, so it gets a real screen rather than being
    // quietly ignored until the button is pressed again.
    panel.replaceChildren(
      brandMark(),
      el('h1', { text: 'Then Warp stays closed' }),
      el('p', { class: 'wp-terms-lead', text:
        'The terms are the whole basis on which this application can be used, so there is no version of it '
        + 'that runs without them. Nothing has been stored, and nothing has happened.' }),
      el('div', { class: 'wp-terms-actions' }, [
        el('button', { class: 'wp-btn ghost', type: 'button', text: 'Read them again', on: { click: () => { overlay.remove(); document.body.classList.remove('wp-locked'); requireAcceptance(start); } } }),
      ]),
    );
  });

  const panel = el('div', { class: 'wp-terms-panel', role: 'document' }, [
    brandMark(),
    el('h1', { text: 'Before you go in' }),
    el('p', { class: 'wp-terms-lead', text:
      'Warp is a market of index perpetuals you can practise on. Five things are worth knowing before you '
      + 'start, and all five are short.' }),
    clauseList(),
    el('label', { class: 'wp-terms-agree', for: 'termsAgree' }, [
      box,
      el('span', { text: 'I have read these terms and I accept them.' }),
    ]),
    el('div', { class: 'wp-terms-actions' }, [accept, decline]),
  ]);

  const overlay = el('div', {
    class: 'wp-terms', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Terms of use',
  }, [panel]);

  document.body.append(overlay);
  document.body.classList.add('wp-locked');
  // Focus lands on the checkbox, which is the only thing standing in the way.
  requestAnimationFrame(() => box.focus());

  // Tab must not escape the dialog while it is the only thing on screen.
  overlay.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Tab') return;
    const stops = [...overlay.querySelectorAll('input, button')].filter(n => !n.disabled);
    if (!stops.length) return;
    const first = stops[0], last = stops[stops.length - 1];
    if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  });
}

/** The same text, reachable from the footer once you are inside. */
export function openTerms() {
  const close = el('button', { class: 'wp-btn ghost', type: 'button', text: 'Close' });
  const a = acceptance();
  const panel = el('div', { class: 'wp-terms-panel', role: 'document' }, [
    brandMark(),
    el('h1', { text: 'Terms of use' }),
    a ? el('p', { class: 'wp-terms-lead', text: `Accepted on ${new Date(a.acceptedAt).toLocaleString('en-GB')}.` }) : null,
    clauseList(),
    el('div', { class: 'wp-terms-actions' }, [close]),
  ]);
  const overlay = el('div', { class: 'wp-terms', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Terms of use' }, [panel]);
  const shut = () => { overlay.remove(); document.body.classList.remove('wp-locked'); };
  close.addEventListener('click', shut);
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) shut(); });
  overlay.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') shut(); });
  document.body.append(overlay);
  document.body.classList.add('wp-locked');
  requestAnimationFrame(() => close.focus());
}


/* -------- the storage notice --------

   Warp sets no cookies. Saying "we use cookies" would be the easy copy and it
   would be false, so this says what actually happens: the account lives in this
   browser's local storage, nothing is sent anywhere, and there is no third party
   and nothing to track. Which also means there is no non-essential category to
   turn off, and the notice says that too rather than offering a toggle that
   controls nothing. Both buttons record a choice; neither changes what is
   stored, because the only thing stored is the application itself. */

export function storageChoice() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return raw && raw.choice ? raw : null;
  } catch { return null; }
}

function recordStorageChoice(choice) {
  const entry = { choice, at: Date.now() };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entry)); } catch {}
  return entry;
}

function storageBar() {
  const bar = el('div', {
    class: 'wp-cookie', role: 'region', 'aria-label': 'Cookies and storage',
  });
  const dismiss = (choice) => {
    recordStorageChoice(choice);
    bar.classList.add('is-going');
    setTimeout(() => bar.remove(), 220);
  };
  bar.append(
    el('div', { class: 'wp-cookie-text' }, [
      el('strong', { text: 'Cookies and storage' }),
      el('p', { text:
        "Warp sets no cookies and has no analytics, no third parties and nothing to track. Your balance, "
        + "positions and the indices you list are kept in this browser's local storage so the app can "
        + "remember them between visits, and that is the only thing stored. There is nothing "
        + "non-essential to switch off, so both buttons below record your answer and neither changes "
        + "what is kept." }),
    ]),
    el('div', { class: 'wp-cookie-actions' }, [
      el('button', { class: 'wp-btn sm', type: 'button', text: 'Accept', on: { click: () => dismiss('accepted') } }),
      el('button', { class: 'wp-btn sm ghost', type: 'button', text: 'Essential only', on: { click: () => dismiss('essential') } }),
      el('button', { class: 'wp-foot-link', type: 'button', text: 'Terms', on: { click: openTerms } }),
    ]),
  );
  return bar;
}

/** Shows the notice once, a while into the session, if it has not been answered. */
export function scheduleStorageNotice() {
  if (storageChoice()) return;
  setTimeout(() => {
    if (storageChoice() || document.querySelector('.wp-cookie')) return;
    document.body.append(storageBar());
  }, STORAGE_DELAY);
}
