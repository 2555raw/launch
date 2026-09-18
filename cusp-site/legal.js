/* Cusp — the legal pages: the mobile menu and the contents list.
   The vaults page's app.js is about vaults and would throw here, so these pages
   carry their own small script instead. */

const nav = document.querySelector('.cs-nav');
const burger = document.getElementById('burger');
burger.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
});

/* mark the section being read — measured on scroll rather than on intersection,
   because jumping to an anchor lands the heading outside any sensible band and
   an observer would leave the previous one lit */
const links = [...document.querySelectorAll('#toc a')];
const heads = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);

function markRead() {
  const line = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav')) || 58) + 90;
  let i = 0;
  heads.forEach((h, n) => { if (h.getBoundingClientRect().top <= line) i = n; });
  // at the foot of the document the last sections never reach the line, so the
  // bottom of the page counts as being in the last one
  const end = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
  if (end) i = heads.length - 1;
  links.forEach((a, n) => a.classList.toggle('on', n === i));
}

if (heads.length) {
  let queued = false;
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; markRead(); });
  }, { passive: true });
  addEventListener('hashchange', markRead);
  markRead();
}
