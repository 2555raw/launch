/* Vesica — the way a page arrives.

   Two things, and both of them are optional in the strict sense: if this
   script never runs, every page is exactly as it was. Nothing is hidden by
   the stylesheet on its own — the hiding rule is behind .rv, which only this
   file adds — so a failure here costs an animation, not the site.

   1. The first page of a visit opens on the mark, which draws itself in and
      lifts away. Once per session, not once per page: a curtain is charming
      the first time and tiresome on the fourth click.

   2. After that, blocks arrive rather than appear. What is already on screen
      comes in on a short stagger; what is below the fold waits until it is
      nearly in view. */

(function reveal() {
  const root = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ---------- what moves ----------
     Named per page rather than generically, because "every direct child of
     main" reveals the dashed rules and the spacer divs too, and a hairline
     sliding up from nowhere looks like a bug. */
  const SEL = [
    '.hm-hero h1', '.hm-hero-copy > p', '.hm-actions', '.hm-fine', '.hm-ca', '.hm-form',
    '.hm-strip', '.hm-stock', '.hm-cta-in > div > *', '.hm-figs > div',
    '.pr-head > div', '.pr-more', '.pr-card', '.pr-p', '.pr-strat > *',
    '.cs-head > *', '.cs-stat', '.cs-toolbar', '.cs-v',
    '.tr-head > *', '.tr-mode', '.tr-card', '.tr-side',
    '.dx-head > *', '.dx-sec > *', '.dx-toc',
    '.cs-legal-head > *', '.cs-legal-body > *',
    '.ft-brand', '.ft-col',
  ].join(',');

  const els = [...document.querySelectorAll(SEL)].filter(el => el.offsetParent !== null || el.closest('.hm-form'));
  if (!els.length) return;

  root.classList.add('rv');
  els.forEach(el => el.setAttribute('data-rv', ''));

  const show = (el, delay) => {
    el.style.transitionDelay = delay + 'ms';
    el.classList.add('rv-in');
  };

  /* below the fold, a block waits until it is nearly in view */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, o) => {
        entries.filter(e => e.isIntersecting).forEach((e, i) => {
          show(e.target, Math.min(i * 55, 260));
          o.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -8% 0px' })
    : null;

  const vh = innerHeight;
  const above = [], below = [];
  els.forEach(el => (el.getBoundingClientRect().top < vh * 0.92 ? above : below).push(el));

  function run() {
    above.forEach((el, i) => show(el, 40 + i * 62));
    below.forEach(el => (io ? io.observe(el) : show(el, 0)));
  }

  /* ---------- the curtain ---------- */
  let first = true;
  try { first = !sessionStorage.getItem('vesica-seen'); sessionStorage.setItem('vesica-seen', '1'); }
  catch (e) { /* private window: the curtain simply shows every time */ }

  if (!first) { run(); return; }

  const curtain = document.createElement('div');
  curtain.className = 'rv-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.innerHTML = '<i></i>';
  document.body.appendChild(curtain);

  let done = false;
  function lift() {
    if (done) return;
    done = true;
    curtain.classList.add('rv-out');
    root.classList.add('rv-open');
    setTimeout(() => curtain.remove(), 700);
    run();
  }

  setTimeout(lift, 760);
  /* whatever happens above, the page is never held behind the curtain */
  setTimeout(() => { lift(); els.forEach(el => el.classList.add('rv-in')); }, 2600);
})();
