/* Portada: solo adorno y una comprobación. Nada de esto toca claves. */
(() => {
  'use strict';

  /* La barra se separa del fondo con una línea en cuanto hay scroll. */
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('stuck', window.scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Las secciones entran al asomarse. Sin IntersectionObserver se quedan
     visibles, que es el estado correcto por defecto. */
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

  /* A quien ya tiene una wallet en este navegador no se le ofrece crear otra:
     crear otra encima sería perder la primera. */
  let has = false;
  try { has = !!localStorage.getItem('calma.v1.keystore'); } catch {}
  if (has) {
    document.querySelectorAll('#heroCta, #footCta').forEach(a => { a.textContent = 'Abrir mi wallet'; });
    const nav = document.getElementById('navCta');
    if (nav) nav.textContent = 'Mi wallet';
  }
})();
