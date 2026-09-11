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
    $$('.ts-sol, .ts-per, .ts-fiat').forEach((n) => {
      const v = n.dataset[cycle];
      if (v !== undefined) n.textContent = v;
    });
  }
  cycleBtns.forEach((b) => b.addEventListener('click', () => setCycle(b.dataset.cycle)));
  setCycle('monthly');

  /* ---- footer year ---- */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
