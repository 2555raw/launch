/* Landing page: decoration and one check. None of this touches keys. */
(() => {
  'use strict';

  /* The bar grows a hairline as soon as the page scrolls. */
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('stuck', window.scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Sections fade in as they appear. Without IntersectionObserver they simply
     stay visible, which is the right default. */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('seen');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .1 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('seen'));
  }

  /* Anyone who already has a wallet in this browser is not offered a new one:
     making another on top of it would lose the first. */
  let has = false;
  try { has = !!localStorage.getItem('quiver.v1.keystore') || localStorage.getItem('calma.v1.keystore'); } catch {}
  if (has) {
    document.querySelectorAll('#heroCta, #footCta').forEach(a => { a.textContent = 'Open my wallet'; });
    const nav = document.getElementById('navCta');
    if (nav) nav.textContent = 'My wallet';
  }
})();
