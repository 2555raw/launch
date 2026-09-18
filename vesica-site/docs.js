/* Vesica — the documentation page: nothing but the contents rail.
   Measured on scroll rather than by observer, because jumping to an anchor
   lands the heading outside any sensible band and an observer would leave the
   previous entry lit. */

const links = [...document.querySelectorAll('#toc a[href^="#"]')];
const marks = links.map(a => ({ a, el: document.querySelector(a.getAttribute('href')) }))
                   .filter(m => m.el && m.a.querySelector('em') === null);

function markRead() {
  if (!marks.length) return;
  let i = 0;
  marks.forEach((m, n) => { if (m.el.getBoundingClientRect().top <= 120) i = n; });
  if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) i = marks.length - 1;
  links.forEach(a => a.classList.remove('on'));
  marks[i].a.classList.add('on');
}

let queued = false;
addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; markRead(); });
}, { passive: true });
addEventListener('hashchange', markRead);
markRead();
