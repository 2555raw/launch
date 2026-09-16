/* Landing page: motion and one check. None of this touches keys — the wallet
   lives at /app and shares nothing with this file but a localStorage read. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Everything that reacts to scrolling shares one listener and one frame.
     Four separate scroll handlers would fight each other for the same 16ms. */
  const onScroll = [];
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll.forEach(f => f()); ticking = false; });
  }, { passive: true });

  /* ── The bar closes into a capsule once the page moves ─────────────────── */
  const nav = $('.nav');
  onScroll.push(() => nav.classList.toggle('stuck', scrollY > 8));

  /* ── Sections arriving ─────────────────────────────────────────────────── */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('seen');
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: .1 });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('seen'));
  }

  /* ── Counters ──────────────────────────────────────────────────────────── */
  const repaint = [];
  $$('[data-count]').forEach(el => {
    const to = Number(el.dataset.count);
    const paint = v => { el.textContent = (el.dataset.prefix || '') + v + (el.dataset.suffix || ''); };
    /* The suffix is translated, so the final value has to be repaintable. */
    repaint.push(() => paint(el.dataset.done ? to : 0));
    if (calm || !('IntersectionObserver' in window)) { el.dataset.done = '1'; return paint(to); }
    paint(0);
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), ms = 900;
      const tick = now => {
        const k = Math.min(1, (now - t0) / ms);
        paint(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(tick); else el.dataset.done = '1';
      };
      requestAnimationFrame(tick);
    }), { threshold: .6 });
    io.observe(el);
  });

  /* ── The hero card follows the pointer ─────────────────────────────────── */
  const stage = $('#stage'), card = $('#heroCard');
  if (stage && card && !calm && matchMedia('(hover: hover)').matches) {
    const base = 'rotateX(9deg) rotateY(-13deg) rotateZ(1.5deg)';
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `rotateX(${9 - y * 16}deg) rotateY(${-13 + x * 18}deg) rotateZ(1.5deg)`;
      card.style.setProperty('--sheen', `${(x + .5) * 100}%`);
    });
    stage.addEventListener('pointerleave', () => { card.style.transform = base; });
  }

  /* ── The walkthrough ─────────────────────────────────────────────────────
     It steps along on its own so the section shows what it does without being
     touched, and stops the moment somebody picks a step, because a thing that
     keeps moving under your finger is worse than one that stands still. */
  const rail = $('#rail'), walkGrid = $('#walkGrid');
  if (rail && walkGrid) {
    const pills = $$('.rail-pill', rail);
    const lines = $$('.rail-line', rail);
    const cards = $$('.step', walkGrid);
    let at = 0, timer = null;

    const paintStep = () => {
      pills.forEach((p, i) => {
        p.classList.toggle('on', i === at);
        p.classList.toggle('done', i < at);
        p.setAttribute('aria-selected', String(i === at));
      });
      lines.forEach((l, i) => l.classList.toggle('done', i < at));
      cards.forEach((c, i) => c.classList.toggle('on', i === at));
    };
    const go = i => { at = (i + cards.length) % cards.length; paintStep(); };
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => { if (!timer && !calm) timer = setInterval(() => go(at + 1), 4200); };

    pills.forEach((p, i) => p.addEventListener('click', () => { stop(); go(i); }));
    cards.forEach((c, i) => c.addEventListener('click', () => { stop(); go(i); }));
    walkGrid.addEventListener('pointerenter', stop);

    /* It only runs while the section is actually on screen. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? start() : stop()), { threshold: .25 })
        .observe(walkGrid);
    } else start();
    paintStep();
  }

  /* ── Plan cards lean towards the cursor ────────────────────────────────── */
  if (!calm && matchMedia('(hover: hover)').matches) {
    $$('.tier .tcard').forEach(tc => {
      const host = tc.parentElement;
      host.addEventListener('pointermove', e => {
        const r = tc.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        tc.style.transform = `rotateX(${-y * 10}deg) rotateY(${x * 12}deg)`;
        tc.style.setProperty('--sheen', `${(x + .5) * 100}%`);
      });
      host.addEventListener('pointerleave', () => { tc.style.transform = ''; });
    });
  }

  /* ── What Ward stores ───────────────────────────────────────────────────
     It waits for the page to move rather than blocking the first screen: a
     notice about storage is worth reading, and nobody reads one that lands
     before they have seen what the site is. Dismissing it is itself the only
     thing it writes. */
  const consent = $('#consent');
  const SEEN = 'ward.v1.notice';
  let told = true;
  try { told = !!localStorage.getItem(SEEN); } catch {}

  if (consent && !told) {
    let shown = false;
    const reveal = () => {
      if (shown || scrollY < 180) return;
      shown = true;
      consent.hidden = false;
      document.body.classList.add('notice-up');
      requestAnimationFrame(() => consent.classList.add('in'));
    };
    onScroll.push(reveal);

    const dismiss = () => {
      consent.classList.remove('in');
      consent.classList.add('out');
      try { localStorage.setItem(SEEN, String(Date.now())); } catch {}
      document.body.classList.remove('notice-up');
      setTimeout(() => { consent.hidden = true; }, 500);
    };
    $('#csOk').addEventListener('click', dismiss);

    const more = $('#csMore'), detail = $('#csDetail');
    more.addEventListener('click', () => {
      const open = detail.hidden;
      detail.hidden = !open;
      const d = (window.WARD_I18N || {})[document.documentElement.lang.slice(0, 2)] || {};
      more.textContent = open ? (d['cs.hide'] || 'Hide details') : (d['cs.more'] || "What's stored");
    });
  }

  /* ── Language ────────────────────────────────────────────────────────────
     One page, four dictionaries, swapped at runtime. English stays in the HTML
     as the source, so a failure to load i18n.js leaves a readable page rather
     than an empty one. */
  const LANGS = (window.WARD_LANGS || [{ id: 'en', name: 'English', short: 'EN', html: 'en' }]);
  const LOADER = window.WARD_LANG;
  const LANG_KEY = 'ward.v1.lang';
  /* English arrives with the page; the rest are filled in here as they load. */
  const DICT = window.WARD_I18N || { en: {} };

  /* English by default, always. Guessing from navigator.language meant someone
     on a Spanish browser landed in Spanish without asking for it; the picker is
     right there, and a deliberate choice is the only thing that changes it. */
  function chooseLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && LANGS.some(l => l.id === saved)) return saved;
    } catch {}
    return 'en';
  }

  /* What the page is meant to be showing. A second pick while the first is
     still in the air must not be overwritten when that one lands. */
  let chosen = 'en';

  /* Paints from whatever is already to hand — the copy kept in this browser
     from last time, if there is one — and then again when the fetch answers.
     A language that cannot be loaded leaves the page in English rather than
     half-translated. */
  function useLang(id, remember) {
    chosen = id;
    if (remember) { try { localStorage.setItem(LANG_KEY, id); } catch {} }
    if (DICT[id]) applyLang(id);
    else {
      const c = LOADER && LOADER.cached('land', id);
      if (c) { DICT[id] = c; applyLang(id); }
    }
    if (!LOADER) return;
    LOADER.load('land', id).then(d => {
      if (!d || chosen !== id) return;
      /* Revalidating costs one cheap 304 and usually changes nothing, so only
         a dictionary that actually differs is worth redrawing the page for. */
      if (DICT[id] && JSON.stringify(DICT[id]) === JSON.stringify(d)) return;
      DICT[id] = d;
      applyLang(id);
    });
  }

  window.WARD_THEME_LABEL = dark => {
    const d = DICT[chosen] || DICT.en || {};
    return d[dark ? 'th.day' : 'th.night'] || (dark ? 'Switch to day' : 'Switch to night');
  };

  function applyLang(id) {
    const d = DICT[id];
    if (!d) return;
    const meta = LANGS.find(l => l.id === id);
    document.documentElement.lang = (meta && meta.html) || id;
    /* Arabic reads right to left, so the page has to be laid out that way and
       not merely filled with Arabic words. */
    document.documentElement.dir = meta && meta.rtl ? 'rtl' : 'ltr';
    $$('[data-i18n]').forEach(el => {
      const v = d[el.dataset.i18n];
      if (v != null) el.innerHTML = v;
    });
    $$('[data-i18n-suffix]').forEach(el => {
      const v = d[el.dataset.i18nSuffix];
      if (v != null) el.dataset.suffix = v;
    });
    $$('[data-i18n-ph]').forEach(el => {
      const v = d[el.dataset.i18nPh];
      if (v != null) el.placeholder = v;
    });
    $$('[data-i18n-label]').forEach(el => {
      const v = d[el.dataset.i18nLabel];
      if (v != null) el.setAttribute('aria-label', v);
    });
    paintAsk();
    repaint.forEach(f => f());
    if (d['meta.title']) document.title = d['meta.title'];
    const desc = $('meta[name="description"]');
    if (desc && d['meta.desc']) desc.setAttribute('content', d['meta.desc']);

    if ($('#langNow')) $('#langNow').textContent = meta ? meta.short : id.toUpperCase();
    if (window.WARD_THEME) window.WARD_THEME.paint();
    $$('#langMenu button').forEach(b => {
      const on = b.dataset.lang === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });

    /* The notice button carries two labels; keep the one it is showing. */
    const more = $('#csMore'), detail = $('#csDetail');
    if (more && detail && !detail.hidden) more.textContent = d['cs.hide'] || more.textContent;
    if (hasWallet) markHasWallet();
  }

  let hasWallet = false;
  try {
    hasWallet = ['ward.v1', 'quiver.v1', 'calma.v1'].some(ns => localStorage.getItem(ns + '.keystore'));
  } catch {}
  function markHasWallet() {
    const d = DICT[chosen] || DICT.en || {};
    const open = d['nav.openmine'] || 'Open my wallet';
    $$('#heroCta, #footCta').forEach(a => { a.textContent = open; });
    if ($('#navCta')) $('#navCta').textContent = d['nav.mine'] || 'My wallet';
  }

  const menu = $('#langMenu'), langBtn = $('#langBtn');
  if (menu && langBtn) {
    LANGS.forEach(l => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.lang = l.id; b.role = 'option';
      /* The name sits in its own element so the tick beside it is not part of
         the label a screen reader reads out. */
      const n = document.createElement('span');
      n.className = 'lm-name'; n.textContent = l.name;
      /* Each name is written in its own language, so it has to be tagged with
         that language or the browser picks the wrong font for it. */
      n.lang = l.html || l.id;
      if (l.rtl) n.dir = 'rtl';
      const tick = document.createElement('span');
      tick.className = 'lm-tick'; tick.setAttribute('aria-hidden', 'true');
      b.appendChild(n); b.appendChild(tick);
      b.addEventListener('click', () => { useLang(l.id, true); closeMenu(); });
      li.appendChild(b); menu.appendChild(li);
    });
    const closeMenu = () => { menu.hidden = true; langBtn.setAttribute('aria-expanded', 'false'); };
    langBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      langBtn.setAttribute('aria-expanded', String(open));
      /* Twenty-one entries do not fit on screen, so the list opens scrolled to
         the one in use rather than at the top with the tick out of sight. */
      if (open) {
        const sel = menu.querySelector('button.on');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
      }
    });
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }

  /* ── Ask about Ward ──────────────────────────────────────────────────────
     Every entry here is a section of this page, so the panel is translated for
     free and can never drift from what the page actually says. */
  const ASK = [
    ['ask.g1', ['faq.q1','faq.q2','faq.q3','faq.q4','faq.q5','faq.q6','faq.q7','faq.q8'].map(q => [q, q.replace('.q', '.a')])],
    ['ask.g2', [['sec.f1h','sec.f1p'], ['sec.f2h','sec.f2p'], ['sec.f3h','sec.f3p'], ['sec.f4h','sec.f4p']]],
    ['ask.g3', [['tm.t1h','tm.t1p'], ['tm.t2h','tm.t2p'], ['tm.t3h','tm.t3p'], ['tm.t4h','tm.t4p'], ['tm.t5h','tm.t5p']]]
  ];
  const askList = $('#askList'), askQ = $('#askQ');
  let askTab = 'all';
  const plain = html => { const t = document.createElement('div'); t.innerHTML = html || ''; return t.textContent || ''; };
  /* Fold accents so "contrasena" finds "contraseña". */
  const fold = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function paintAsk() {
    if (!askList) return;
    const d = DICT[document.documentElement.lang.slice(0, 2)] || DICT.en || {};
    const term = fold((askQ && askQ.value || '').trim());
    askList.innerHTML = '';
    let shown = 0;

    ASK.forEach(([groupKey, pairs]) => {
      if (askTab !== 'all' && askTab !== groupKey) return;
      const hits = pairs.filter(([q, a]) =>
        !term || fold(plain(d[q]) + ' ' + plain(d[a])).includes(term));
      if (!hits.length) return;

      if (askTab === 'all') {
        const h = document.createElement('p');
        h.className = 'ask-group';
        h.textContent = d[groupKey] || groupKey;
        askList.appendChild(h);
      }

      hits.forEach(([q, a]) => {
        shown++;
        const item = document.createElement('details');
        item.className = 'ask-item';
        item.innerHTML = '<summary></summary><div></div>';
        item.querySelector('summary').textContent = plain(d[q]);
        item.querySelector('div').innerHTML = d[a] || '';
        if (term) item.open = true;
        askList.appendChild(item);
      });
    });

    if (!shown) {
      const none = document.createElement('p');
      none.className = 'ask-none';
      none.textContent = d['ask.none'] || '';
      askList.appendChild(none);
    }
  }

  const tabs = $('#askTabs');
  if (tabs) {
    tabs.addEventListener('click', e => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      askTab = b.dataset.tab;
      $$('#askTabs button').forEach(x => x.classList.toggle('on', x === b));
      paintAsk();
      const body = $('#askBody');
      if (body) body.scrollTop = 0;
    });
  }

  const ask = $('#ask'), askFab = $('#askFab');
  if (ask && askFab) {
    const openAsk = () => {
      askTab = 'all';
      if (askQ) askQ.value = '';
      $$('#askTabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === 'all'));
      paintAsk();
      ask.hidden = false;
      requestAnimationFrame(() => ask.classList.add('in'));
      setTimeout(() => askQ && askQ.focus({ preventScroll: true }), 220);
    };
    const closeAsk = () => {
      ask.classList.remove('in');
      setTimeout(() => { ask.hidden = true; }, 260);
    };
    askFab.addEventListener('click', openAsk);
    $('#askX').addEventListener('click', closeAsk);
    $$('[data-ask-close]').forEach(el => el.addEventListener('click', closeAsk));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ask.hidden) closeAsk(); });
    askQ.addEventListener('input', paintAsk);
  }

  useLang(chooseLang(), false);

  onScroll.forEach(f => f());

  /* ── the launched coins ───────────────────────────────────────────────
     Everything below comes off a public chain, which means anyone can put
     anything in it: a coin's name is whatever its creator typed. It is all
     inserted as text and never as markup, and the logo is only used when it is
     an https URL, so a coin cannot paint itself into this page. */
  (function feed() {
    const list = $('#fdList'), note = $('#fdNote');
    if (!list || !window.WARD_FEED) return;
    const F = window.WARD_FEED;
    const d = () => DICT[document.documentElement.lang.slice(0, 2)] || DICT.en || {};
    const say = k => d()[k] || k;

    const short = a => a.slice(0, 6) + '\u00b7\u00b7\u00b7' + a.slice(-4);

    function row(c) {
      const li = document.createElement('li');
      li.className = 'fd-item';

      const av = document.createElement('span');
      av.className = 'fd-av';
      /* The coin's own picture. The letter is drawn first and stays until an
         image really loads, so a dead host, an ipfs gateway having a bad day,
         or a host serving HTML all leave a finished-looking row.
         Only https and ipfs, and no referrer, so the host learns an address
         and nothing about where the visitor came from. The storage notice
         says this is the one thing on the page that reaches outside it. */
      av.textContent = (c.symbol || c.name || '?').slice(0, 1).toUpperCase();
      const src = F.picture(c.logo);
      if (src) {
        const img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = '';
        img.onload = () => { av.textContent = ''; av.appendChild(img); av.classList.add('has-img'); };
        img.src = src;
      }

      const mid = document.createElement('span');
      mid.className = 'fd-mid';
      const b = document.createElement('b');
      b.textContent = c.name || short(c.token);
      const sym = document.createElement('small');
      sym.textContent = c.symbol || '';
      const desc = document.createElement('span');
      desc.className = 'fd-desc';
      desc.textContent = c.description || '';
      mid.append(b, sym, desc);

      const a = document.createElement('a');
      a.className = 'fd-go';
      a.href = F.tokenUrl(c.token);
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = short(c.token);
      a.setAttribute('aria-label', (c.name || c.symbol || 'coin') + ' on the explorer');

      li.append(av, mid, a);
      return li;
    }

    let mine = true, token = 0;
    function load() {
      const run = ++token;
      note.hidden = true;
      list.innerHTML = '';
      const li = document.createElement('li');
      li.className = 'fd-loading';
      li.textContent = say('fd.loading');
      list.appendChild(li);
      F.recent(12, mine).then(coins => {
        if (run !== token) return;            // a tab was clicked meanwhile
        list.innerHTML = '';
        if (!coins.length) {
          note.textContent = say(mine ? 'fd.nonemine' : 'fd.none');
          note.hidden = false;
          return;
        }
        coins.forEach(c => list.appendChild(row(c)));
      }).catch(() => {
        if (run !== token) return;
        list.innerHTML = '';
        note.textContent = say('fd.off');
        note.hidden = false;
      });
    }

    function tab(wantMine) {
      mine = wantMine;
      $('#fdMine').classList.toggle('on', mine);
      $('#fdAll').classList.toggle('on', !mine);
      $('#fdMine').setAttribute('aria-selected', String(mine));
      $('#fdAll').setAttribute('aria-selected', String(!mine));
      load();
      relive();
    }
    if ($('#fdMine')) $('#fdMine').addEventListener('click', () => tab(true));
    if ($('#fdAll')) $('#fdAll').addEventListener('click', () => tab(false));
    /* A launch that lands while someone is reading should appear, because a
       list headed "live" that only updates on reload is a screenshot. */
    let watcher = null;
    function relive() {
      if (watcher) watcher.stop();
      watcher = F.watch(c => {
        const empty = list.querySelector('.fd-loading');
        if (empty) empty.remove();
        note.hidden = true;
        const li = row(c);
        li.classList.add('fd-fresh');
        list.prepend(li);
        /* The flash is once, not forever: the class comes off when the
           animation ends so a row does not keep announcing itself. */
        li.addEventListener('animationend', () => li.classList.remove('fd-fresh'), { once: true });
        while (list.children.length > 24) list.lastElementChild.remove();
      }, { mine });
    }

    repaint.push(load);
    load();
    relive();
  })();


  /* ── the contract address, and the account ────────────────────────────
     Both are switched on by putting a value in the attributes on #caBar and
     nothing else. Until then the chip reads PENDING and does nothing, and the
     mark is not a link: no pointer, no hover, out of the tab order. A dead
     link is worse than an obvious placeholder. */
  (function ca() {
    const bar = $('#caBar');
    if (!bar) return;
    const addr = (bar.dataset.ca || '').trim();
    const xUrl = (bar.dataset.x || '').trim();
    const d = () => DICT[document.documentElement.lang.slice(0, 2)] || DICT.en || {};

    if (/^https:\/\//i.test(xUrl)) {
      const a = $('#caX');
      a.href = xUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.removeAttribute('tabindex');
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return;   // still pending

    const chip = $('#caChip'), val = $('#caVal');
    chip.disabled = false;
    chip.classList.add('live');
    val.textContent = addr.slice(0, 6) + '\u00b7\u00b7\u00b7' + addr.slice(-4);
    val.removeAttribute('data-i18n');               // no longer a translated word
    chip.title = addr;
    chip.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(addr); } catch { return; }
      const was = val.textContent;
      val.textContent = d()['ca.copied'] || 'Copied';
      setTimeout(() => { val.textContent = was; }, 1400);
    });
  })();

})();
