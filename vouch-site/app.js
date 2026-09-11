/* Ovanto — the small amount of behaviour the page needs.
   Everything here is presentational: the demo mints nothing and the form posts
   nowhere. Addresses are generated locally so the flow feels real without one. */

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---- in page navigation ---- */
  const mobile = $('#mobile');
  const burger = $('#burger');

  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-scroll]');
    if (!target) return;
    const dest = document.getElementById(target.dataset.scroll);
    if (!dest) return;
    e.preventDefault();
    const top = target.dataset.scroll === 'top' ? 0 : dest.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top, behavior: 'smooth' });
    closeMenu();
  });

  function closeMenu() {
    if (!mobile || mobile.hidden) return;
    mobile.hidden = true;
    burger.setAttribute('aria-expanded', 'false');
  }

  burger?.addEventListener('click', () => {
    const open = mobile.hidden;
    mobile.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
  });

  /* ---- nav gets a rule once the page moves ---- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- code tabs ---- */
  const tabs = $$('.ts-code-tabs button');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });
      $$('.ts-code-pane').forEach((pane) => {
        pane.classList.toggle('is-active', pane.dataset.pane === tab.dataset.tab);
      });
    });
  });

  /* ---- the demo ---- */
  const btn = $('#demoBtn');
  const scan = $('#scan');
  const title = $('#demoTitle');
  const sub = $('#demoSub');
  const out = $('#demoOut');
  const steps = $$('.ts-step');
  const names = ['maria', 'tomas', 'june', 'kaveh', 'noor', 'rafa', 'ida', 'sol'];

  const hex = (n, alphabet = '0123456789abcdef') =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

  const bech32 = (prefix, n) => prefix + hex(n, 'qpzry9x8gf2tvdw0s3jn54khce6mua7l');

  const shorten = (value, head = 10, tail = 6) =>
    value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;

  const lightStep = (index) => steps.forEach((s, i) => s.classList.toggle('is-on', i <= index));

  let running = false;

  btn?.addEventListener('click', () => {
    if (running) return;

    if (out && !out.hidden) {
      // second press starts over
      out.hidden = true;
      scan.className = 'ts-scan';
      title.textContent = 'Create a wallet with a passkey';
      sub.textContent = 'Your device signs. Ovanto never sees a private key.';
      btn.textContent = 'Create wallet';
      lightStep(-1);
      return;
    }

    running = true;
    btn.disabled = true;
    btn.textContent = 'Waiting for the device…';
    scan.className = 'ts-scan is-working';
    title.textContent = 'Touch the sensor';
    sub.textContent = 'The enclave is creating a credential bound to this domain.';
    lightStep(0);

    setTimeout(() => {
      title.textContent = 'Deriving addresses';
      sub.textContent = 'One public key, three chains, no network round trip.';
      lightStep(1);
    }, 1100);

    setTimeout(() => {
      const handle = `${names[Math.floor(Math.random() * names.length)]}.ova.id`;
      $('#addrBtc').textContent = shorten(bech32('bc1p', 58));
      $('#addrOrd').textContent = shorten(bech32('bc1p', 58));
      $('#addrEvm').textContent = shorten('0x' + hex(40), 8, 6);
      $('#addrName').textContent = handle;

      scan.className = 'ts-scan is-done';
      title.textContent = 'Wallet ready';
      sub.textContent = 'Signed into three chains with nothing written down.';
      out.hidden = false;
      lightStep(2);
      btn.disabled = false;
      btn.textContent = 'Run it again';
      running = false;
    }, 2300);
  });

  /* ---- the sign up form is a prop ---- */
  const form = $('#form');
  const note = $('#formNote');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#email');
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
    email.setAttribute('aria-invalid', String(!ok));
    note.textContent = ok
      ? 'Thanks. This is a demo page, so no key is on its way.'
      : 'That address does not look right. Try again.';
    if (ok) form.reset();
  });

  /* ---- monthly / yearly prices ---- */
  const cycleBtns = $$('.ts-toggle button');
  function setCycle(cycle) {
    document.body.dataset.cycle = cycle;
    cycleBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.cycle === cycle));
    $$('.ts-figure, .ts-per').forEach((n) => {
      const v = n.dataset[cycle];
      if (v !== undefined) n.textContent = v;
    });
    // the ETH line comes from config, so a card can never quote a different
    // amount than the one checkout actually asks the wallet to send
    const cfg = window.VOUCH_CONFIG || {};
    $$('[data-plan-eth]').forEach((n) => {
      const usd = cfg.prices?.[n.dataset.planEth]?.[cycle];
      if (!usd) { n.textContent = ''; return; }
      const eth = (usd / (cfg.ethReferenceUsd || 1)).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
      n.textContent = `${eth} ETH at $${(cfg.ethReferenceUsd || 0).toLocaleString('en-US')}/ETH`;
    });
  }
  cycleBtns.forEach((b) => b.addEventListener('click', () => setCycle(b.dataset.cycle)));
  setCycle('monthly');

  /* ---- the hero tiles ----
     Each tile drops onto the slab, throws a green ring where it lands, rests
     with its glyph showing, then lifts away and the next one takes its place.
     The three run out of step so something is always in the air. The page
     starts with all three at rest, so the first frame is the finished picture
     rather than an empty slab. */

  const GLYPHS = [
    // padlock
    '<path d="M11.5 18.5h17v13.5c0 1.1-.9 2-2 2h-13c-1.1 0-2-.9-2-2z"/><path d="M15.5 18.5v-4.2a4.5 4.5 0 0 1 9 0v4.2"/><circle cx="20" cy="25" r="2"/>',
    // magnifier
    '<circle cx="17.5" cy="17.5" r="7.5"/><path d="M23 23l8.5 8.5"/>',
    // key
    '<circle cx="14.5" cy="17" r="5.5"/><path d="M18.5 20.5 31 33"/><path d="M27 29l2.8-2.8"/>',
    // fingerprint
    '<path d="M20 8.5c-4.2 0-7.6 3.4-7.6 7.6v3"/><path d="M27.6 19.1v-3c0-4.2-3.4-7.6-7.6-7.6"/><path d="M12.4 22.5v4.4c0 4.2 3.4 7.6 7.6 7.6"/><path d="M16.2 16.6v10.8"/><path d="M20 14.4v13.4"/><path d="M23.8 17.2v9.4"/>',
    // shield
    '<path d="M20 7.5 31 11.5v8.3c0 6-4.4 10.7-11 12.7-6.6-2-11-6.7-11-12.7V11.5z"/><path d="M15.8 20.2l3 3 5.6-5.6"/>',
    // gem
    '<path d="M20 7 32 17 20 33 8 17z"/><path d="M8 17h24"/><path d="M20 7l-5 10 5 16 5-16z"/>',
    // chip
    '<rect x="12" y="12" width="16" height="16" rx="3"/><path d="M17 8v4M23 8v4M17 28v4M23 28v4M8 17h4M8 23h4M28 17h4M28 23h4"/>',
    // signature
    '<path d="M9 26c4-1 6-14 9.5-14S22 26 25 26s4.5-3 6-6"/><path d="M9 32h22"/>'
  ];

  const wrap = (inner) =>
    `<svg viewBox="0 0 40 40"><g fill="none" stroke="currentColor" stroke-width="2.1"
       stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;

  const keys = $$('.ts-key');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (keys.length) {
    // the resting picture, painted before anything moves
    keys.forEach((key, i) => {
      const face = $('.ts-key-face', key);
      if (face) face.innerHTML = wrap(GLYPHS[i % GLYPHS.length]);
    });

    if (!still) {
      const DROP = 720, LAND = 500, LIT = 620, DWELL = 1900, LEAVE = 340;

      keys.forEach((key, i) => {
        const face = $('.ts-key-face', key);
        let n = i;
        let timers = [];

        const at = (ms, fn) => timers.push(setTimeout(fn, ms));

        function round() {
          timers.forEach(clearTimeout);
          timers = [];
          n = (n + keys.length) % GLYPHS.length;
          face.innerHTML = wrap(GLYPHS[n]);
          key.classList.remove('is-leaving', 'is-hit');
          key.classList.add('is-dropping');

          at(LAND, () => key.classList.add('is-hit'));
          at(LAND + LIT, () => key.classList.remove('is-hit'));
          at(DROP + DWELL, () => {
            key.classList.remove('is-dropping');
            key.classList.add('is-leaving');
          });
          at(DROP + DWELL + LEAVE, () => { n += keys.length; round(); });
        }

        // let the resting frame stand, then stagger the three into the loop
        setTimeout(round, 1400 + i * 780);
      });
    }
  }

  /* ---- footer year ---- */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
