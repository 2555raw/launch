/* Cusp — the nav: the quick trade, the dropdowns and the cube field.
   Everything here runs on all seven pages, because all seven share the bar
   and the footer. */

/* ---------- the quick trade, hung off the nav ----------
   The swap desk is a page away from wherever the reader is standing, so the
   pair and the size can be set here and carried over in the query. It quotes
   through the same market table the desk uses — one set of prices, one set of
   routers — so the number in the nav is the number on the desk.

   It replaces the plain "Swap" link: the link it was is still in the panel,
   at the bottom, carrying whatever has been typed. */

(function quickTrade() {
  if (typeof TOKENS === 'undefined') return;                  // market.js not on this page
  const link = document.querySelector('a[href^="swap.html"]');
  if (!link || !link.parentElement.matches('.hm-links, .dx-links, .tr-links, .cs-tabs')) return;
  if (link.classList.contains('on')) return;                  // already standing on the desk

  const syms = Object.keys(TOKENS);
  const opts = (chosen, banned) => syms
    .map(s => `<option value="${s}"${s === chosen ? ' selected' : ''}${s === banned ? ' disabled' : ''}>${s}</option>`)
    .join('');

  const mnu = document.createElement('div');
  mnu.className = 'mnu';
  mnu.innerHTML = `
    <button class="mnu-btn" type="button" aria-expanded="false">Swap<svg class="mnu-chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg></button>
    <div class="mnu-pop qt-pop">
      <p class="qt-h">Quick trade</p>
      <div class="qt-row">
        <label class="qt-lab" for="qt-amt">You pay</label>
        <div class="qt-field">
          <input id="qt-amt" type="number" min="0" step="any" value="1" inputmode="decimal" aria-label="Amount to pay">
          <select id="qt-pay" aria-label="Token to pay">${opts('ETH', 'USDG')}</select>
        </div>
      </div>
      <button class="qt-flip" id="qt-flip" type="button" aria-label="Flip the pair">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M7 20l-3.5-3.5M17 20V4M17 4l3.5 3.5"/></svg>
      </button>
      <div class="qt-row">
        <label class="qt-lab" for="qt-out">You receive</label>
        <div class="qt-field">
          <output id="qt-out" class="qt-out">—</output>
          <select id="qt-get" aria-label="Token to receive">${opts('USDG', 'ETH')}</select>
        </div>
      </div>
      <p class="qt-route" id="qt-route">Comparing four routers</p>
      <a class="qt-go" id="qt-go" href="swap.html">Open the swap desk</a>
    </div>`;
  link.replaceWith(mnu);

  const $$ = id => mnu.querySelector('#' + id);
  const amt = $$('qt-amt'), payS = $$('qt-pay'), getS = $$('qt-get');
  const out = $$('qt-out'), route = $$('qt-route'), go = $$('qt-go');

  function paint() {
    const pay = payS.value, get = getS.value;
    const n = parseFloat(amt.value);
    go.href = `swap.html?pay=${pay}&get=${get}` + (n > 0 ? `&amt=${n}` : '');
    if (!(n > 0)) {
      out.textContent = '—';
      route.textContent = 'Comparing four routers';
      route.classList.remove('on');
      return;
    }
    const best = quoteRoutes(pay, get, n)[0];
    out.textContent = best.out.toLocaleString('en-US', { maximumFractionDigits: TOKENS[get].dp });
    route.innerHTML = `Best route <b>${best.name}</b> · ${(best.out * TOKENS[get].px)
      .toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
    route.classList.add('on');
  }

  /* the two pickers can never land on the same token: choosing one bans it
     in the other, and picking the banned one flips the pair instead */
  function reoption() {
    [...payS.options].forEach(o => { o.disabled = o.value === getS.value; });
    [...getS.options].forEach(o => { o.disabled = o.value === payS.value; });
  }

  amt.addEventListener('input', paint);
  payS.addEventListener('change', () => { reoption(); paint(); });
  getS.addEventListener('change', () => { reoption(); paint(); });
  $$('qt-flip').addEventListener('click', () => {
    const a = payS.value; payS.value = getS.value; getS.value = a;
    reoption(); paint();
  });
  // a click inside the panel must not reach the document handler that closes it
  mnu.querySelector('.qt-pop').addEventListener('click', e => e.stopPropagation());

  reoption();
  paint();
})();

/* Cusp — the nav dropdowns.
   Click opens, hover opens once one is already open (so sliding along the bar
   works), Escape and an outside click close. Keyboard reaches everything: the
   trigger is a button and the panel holds plain links. */

(function menus() {
  const all = [...document.querySelectorAll('.mnu')];
  if (!all.length) return;

  const close = except => all.forEach(m => {
    if (m === except) return;
    m.classList.remove('on');
    m.querySelector('.mnu-btn').setAttribute('aria-expanded', 'false');
  });

  const open = m => {
    m.classList.add('on');
    m.querySelector('.mnu-btn').setAttribute('aria-expanded', 'true');
    close(m);
  };

  all.forEach(m => {
    const btn = m.querySelector('.mnu-btn');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      m.classList.contains('on') ? close(null) : open(m);
    });
    // once one is open, moving along the bar swaps between them
    m.addEventListener('pointerenter', () => {
      if (all.some(x => x.classList.contains('on'))) open(m);
    });
  });

  document.addEventListener('click', () => close(null));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(null); });
})();

/* ---------- the cube field lights under the pointer ----------
   :hover on an SVG <use> does not match here — the same quirk the fee loop
   hit — so the highlight is delegated from the svg and set as a class. */

(function lightTheCubes() {
  const field = document.querySelector('.ft-cubes svg');
  if (!field) return;
  let lit = null;
  const clear = () => { if (lit) { lit.classList.remove('on'); lit = null; } };
  field.addEventListener('pointermove', e => {
    const u = e.target.closest ? e.target.closest('.cube') : null;
    if (u === lit) return;
    clear();
    if (u) { u.classList.add('on'); lit = u; }
  });
  field.addEventListener('pointerleave', clear);
})();
