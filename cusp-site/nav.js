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
