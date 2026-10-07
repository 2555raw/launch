/* UnyHooks docs — one page, many articles. The hash picks the article
   (#quickstart), the sidebar and breadcrumb follow it, the right rail lists
   the article's headings, and search filters the sidebar by title and text.
   Network details and the token address come from config.js. */

(() => {
  'use strict';

  const CONFIG = window.UNYHOOKS || {};
  const NET = CONFIG.NETWORK || {};

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const pages = $$('.dc-page');
  // Articles carry data-id, not id, so the browser never jumps to one on its own.
  const byId = Object.fromEntries(pages.map((p) => [p.dataset.id, p]));
  const sideLinks = $$('#sidenav a[data-page]');
  // Reading order is sidebar order.
  const order = sideLinks.map((a) => a.dataset.page).filter((id) => byId[id]);

  // Every in-page link gets a real href, so it can be opened in a new tab.
  $$('[data-page]').forEach((a) => { a.setAttribute('href', `#${a.dataset.page}`); });

  /* ---------- config-driven values ---------- */

  $$('[data-net]').forEach((el) => {
    const v = NET[el.dataset.net];
    if (v) el.textContent = v;
  });
  const docCa = $('#doc-ca');
  if (docCa && CONFIG.CONTRACT) docCa.textContent = CONFIG.CONTRACT;

  /* ---------- routing ---------- */

  const side = $('#side');
  const sideToggle = $('#side-toggle');
  const toc = $('#toc');
  const pager = $('#pager');
  const crumb = $('#crumb');

  const closeSide = () => {
    side.classList.remove('is-open');
    sideToggle?.setAttribute('aria-expanded', 'false');
  };

  // A hash can name an article or a heading inside one (#hooks-deltas).
  const resolve = (hash) => {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    if (byId[id]) return { page: id, anchor: null };
    const el = id && document.getElementById(id);
    const owner = el && el.closest('.dc-page');
    if (owner) return { page: owner.dataset.id, anchor: id };
    return { page: order[0], anchor: null };
  };

  const show = ({ page, anchor }) => {
    pages.forEach((p) => { p.hidden = p.dataset.id !== page; });
    const art = byId[page];
    const title = art.dataset.title;

    sideLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.page === page));
    const active = sideLinks.find((a) => a.dataset.page === page);
    active?.closest('details')?.setAttribute('open', '');
    crumb.textContent = title;
    document.title = 'UnyHooks';

    const heads = $$('h2[id]', art);
    toc.innerHTML = heads.map((h) => `<a href="#${h.id}" data-to="${h.id}">${h.textContent}</a>`).join('');
    toc.parentElement.hidden = heads.length === 0;

    const i = order.indexOf(page);
    const prev = order[i - 1];
    const next = order[i + 1];
    const label = (id) => byId[id].dataset.title;
    pager.innerHTML =
      (prev ? `<a href="#${prev}" class="is-prev"><small>Previous</small><b>« ${label(prev)}</b></a>` : '') +
      (next ? `<a href="#${next}" class="is-next"><small>Next</small><b>${label(next)} »</b></a>` : '');

    closeSide();
    if (anchor) {
      document.getElementById(anchor)?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
    spyOn(heads);
  };

  /* ---------- on this page ---------- */

  let spy = null;
  const spyOn = (heads) => {
    spy?.disconnect();
    if (!heads.length || !('IntersectionObserver' in window)) return;
    const mark = (id) => $$('#toc a').forEach((a) => a.classList.toggle('is-active', a.dataset.to === id));
    mark(heads[0].id);
    spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) mark(e.target.id); });
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });
    heads.forEach((h) => spy.observe(h));
  };

  window.addEventListener('hashchange', () => show(resolve(location.hash)));
  show(resolve(location.hash));

  /* ---------- mobile sidebar ---------- */

  sideToggle?.addEventListener('click', () => {
    const open = side.classList.toggle('is-open');
    sideToggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSide(); });

  /* ---------- search ---------- */

  const inputs = $$('.dc-q');
  const noresult = $('#noresult');
  const text = Object.fromEntries(pages.map((p) => [p.dataset.id, p.textContent.toLowerCase()]));

  const filter = (q) => {
    const term = q.trim().toLowerCase();
    let shown = 0;
    sideLinks.forEach((a) => {
      const hit = !term || a.textContent.toLowerCase().includes(term) || (text[a.dataset.page] || '').includes(term);
      a.hidden = !hit;
      if (hit) shown += 1;
    });
    $$('#sidenav details').forEach((d) => {
      const any = $$('a[data-page]', d).some((a) => !a.hidden);
      d.hidden = !any;
      if (term && any) d.open = true;
    });
    noresult.hidden = shown > 0;
  };

  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      inputs.forEach((other) => { if (other !== input) other.value = input.value; });
      filter(input.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const first = sideLinks.find((a) => !a.hidden);
      if (first) location.hash = first.dataset.page;
    });
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const top = $('#search');
      if (top && top.offsetParent !== null) { top.focus(); return; }
      // Small screens: the search box lives in the sidebar.
      side.classList.add('is-open');
      sideToggle?.setAttribute('aria-expanded', 'true');
      $('.dc-search-side .dc-q')?.focus();
    }
  });
})();
