/* Asanka — page behaviour.
   No dependencies: theme, navigation, menu and filters, the cart drawer, the
   checkout that hands the order to WhatsApp, catering quotes, opening hours and
   the scroll reveal. Everything the business would edit lives in CONFIG and MENU. */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- business settings: edit these before going live ---------- */

  const CONFIG = {
    currency: 'EUR',
    locale: 'en-IE',
    whatsapp: '34600000000',          // international format, digits only
    phoneLabel: '+34 600 000 000',
    email: 'orders@asanka.example',
    address: '12 Example Street, Madrid',
    deliveryFee: 3.9,
    freeDelivery: 35,
    minDelivery: 15,
    prepMinutes: 45,
    // opening hours per weekday, 0 = Sunday, in minutes after midnight
    hours: [
      [12 * 60, 22 * 60], [12 * 60, 22 * 60], [12 * 60, 22 * 60], [12 * 60, 22 * 60],
      [12 * 60, 22 * 60], [12 * 60, 23 * 60], [12 * 60, 23 * 60],
    ],
  };

  /* ---------- the menu ---------- */

  // allergens follow the EU list of 14; only the ones the kitchen actually uses appear
  const ALLERGENS = {
    gluten: 'Gluten', peanut: 'Peanut', fish: 'Fish', shellfish: 'Shellfish',
    egg: 'Egg', dairy: 'Dairy', sesame: 'Sesame', soy: 'Soy',
  };

  const MENU = [
    { id: 'fufu-light', cat: 'fufu', name: 'Fufu with light soup', native: 'Nkrakra', price: 13.5, spice: 2, gf: true, popular: true, allergens: [],
      desc: 'Light tomato, pepper and ginger soup with free-range chicken and a fufu of cassava and plantain.', art: 'fufu:light' },
    { id: 'fufu-groundnut', cat: 'fufu', name: 'Fufu with groundnut soup', native: 'Nkatenkwan', price: 14.5, spice: 1, gf: true, allergens: ['peanut'],
      desc: 'Roasted peanut soup, simmered for four hours with chicken and goat.', art: 'fufu:groundnut' },
    { id: 'fufu-palmnut', cat: 'fufu', name: 'Fufu with palm nut soup', native: 'Abenkwan', price: 15, spice: 2, gf: true, allergens: ['fish', 'shellfish'],
      desc: 'Deep red palm nut soup with smoked fish, beef and crab.', art: 'fufu:palmnut:fish' },
    { id: 'fufu-egusi', cat: 'fufu', name: 'Fufu with egusi', native: 'Egusi soup', price: 14.9, spice: 2, gf: true, allergens: ['shellfish'],
      desc: 'Ground melon seeds with spinach, palm oil, crayfish and beef.', art: 'fufu:egusi' },
    { id: 'fufu-vegan', cat: 'fufu', name: 'Fufu with vegan groundnut soup', native: 'Green nkatenkwan', price: 13.5, spice: 1, gf: true, vegan: true, allergens: ['peanut'],
      desc: 'The same roasted peanut soup, with roast mushrooms, chickpeas and aubergine.', art: 'fufu:groundnut' },
    { id: 'egusi-vegan', cat: 'fufu', name: 'Vegan egusi', native: 'Garden egusi', price: 13.9, spice: 2, gf: true, vegan: true, allergens: [],
      desc: 'Egusi with spinach, squash and oyster mushrooms, no shellfish or meat. Served with fufu.', art: 'fufu:egusi' },

    { id: 'jollof-chicken', cat: 'jollof', name: 'Jollof with grilled chicken', native: 'Party jollof', price: 12.9, spice: 2, gf: true, popular: true, allergens: [],
      desc: 'Smoky rice in tomato and pepper sauce, with a chargrilled leg, dodo and salad.', art: 'jollof:chicken' },
    { id: 'jollof-beef', cat: 'jollof', name: 'Jollof with beef suya', native: 'Suya jollof', price: 13.9, spice: 3, gf: true, allergens: ['peanut'],
      desc: 'Beef skewers in peanut and chilli suya spice, on smoky jollof.', art: 'jollof:beef' },
    { id: 'jollof-fish', cat: 'jollof', name: 'Jollof with grilled tilapia', native: 'Tilapia jollof', price: 15.5, spice: 2, gf: true, allergens: ['fish'],
      desc: 'Whole tilapia marinated in ginger and garlic, chargrilled, with jollof, dodo and lime.', art: 'jollof:fish' },
    { id: 'jollof-veg', cat: 'jollof', name: 'Garden jollof', native: 'Vegetable jollof', price: 10.9, spice: 1, gf: true, vegan: true, allergens: [],
      desc: 'Jollof with black-eyed beans, roast peppers and fried plantain. 100% plants.', art: 'jollof:veg' },

    { id: 'redred', cat: 'side', name: 'Red red', native: 'Accra bean stew', price: 9.5, spice: 1, gf: true, vegan: true, allergens: [],
      desc: 'Black-eyed beans stewed in palm oil and tomato, with dodo and gari.', art: 'side:dodo' },
    { id: 'kelewele', cat: 'side', name: 'Kelewele', native: 'Accra street food', price: 4.5, spice: 2, gf: true, vegan: true, allergens: ['peanut'],
      desc: 'Cubes of plantain with ginger, clove and chilli, fried and topped with peanuts.', art: 'side:kelewele' },
    { id: 'dodo', cat: 'side', name: 'Dodo', native: 'Fried plantain', price: 4, spice: 0, gf: true, vegan: true, allergens: [],
      desc: 'Slices of ripe plantain fried until caramelised.', art: 'side:dodo' },
    { id: 'shito', cat: 'side', name: 'House shito', native: 'Black pepper sauce', price: 2.5, spice: 3, gf: true, allergens: ['shellfish', 'fish'],
      desc: 'Pepper, dried shrimp and slow-cooked onion. The spoonful that changes everything.', art: 'side:shito' },
    { id: 'fufu-extra', cat: 'side', name: 'Extra fufu', native: 'One more ball', price: 3.5, spice: 0, gf: true, vegan: true, allergens: [],
      desc: 'Another portion of freshly pounded fufu for your soup.', art: 'side:fufu' },

    { id: 'sobolo', cat: 'drink', name: 'Sobolo', native: 'Hibiscus and ginger', price: 3.5, spice: 0, gf: true, vegan: true, allergens: [],
      desc: 'Cold hibiscus flower infusion with ginger, pineapple and clove. 500 ml.', art: 'drink:sobolo' },
    { id: 'ginger', cat: 'drink', name: 'House ginger beer', native: 'Alcohol-free', price: 3.5, spice: 1, gf: true, vegan: true, allergens: [],
      desc: 'Fresh ginger fermented with lemon and a little heat. 500 ml.', art: 'drink:ginger' },
  ];

  const EXTRAS = {
    combo: { id: 'combo', name: 'Asanka combo for two', price: 34.9, was: 41.3, allergens: ['peanut'] },
    'combo-vegan': { id: 'combo-vegan', name: 'Vegan combo for two', price: 31.9, was: 38.9, vegan: true, allergens: ['peanut'] },
    'tray-10':  { id: 'tray-10',  name: 'Jollof tray · 10 people', price: 89,  people: 10, allergens: [],
      desc: 'Jollof with chicken, dodo and salad. Made for birthdays and team lunches.' },
    'tray-25':  { id: 'tray-25',  name: 'Jollof tray · 25 people', price: 209, people: 25, popular: true, allergens: ['peanut'],
      desc: 'Jollof, chicken and beef suya, dodo, kelewele and salad. The party size.' },
    'fufu-20':  { id: 'fufu-20',  name: 'Fufu and two soups · 20 people', price: 239, people: 20, allergens: ['peanut', 'fish'],
      desc: 'Freshly pounded fufu with groundnut soup and light soup, meat and fish.' },
  };

  // cart thumbnails for the items that have no card of their own
  const LINE_ART = { combo: 'jollof:chicken', 'combo-vegan': 'jollof:veg', 'tray-10': 'tray', 'tray-25': 'tray', 'fufu-20': 'fufu:groundnut' };

  const ITEMS = Object.fromEntries([...MENU, ...Object.values(EXTRAS)].map((i) => [i.id, i]));

  const money = new Intl.NumberFormat(CONFIG.locale, { style: 'currency', currency: CONFIG.currency });
  const fmt = (n) => money.format(n);

  $$('[data-money]').forEach((el) => {
    const key = el.dataset.money;
    const v = {
      freeDelivery: CONFIG.freeDelivery, combo: EXTRAS.combo.price, comboWas: EXTRAS.combo.was,
      comboVegan: EXTRAS['combo-vegan'].price, comboVeganWas: EXTRAS['combo-vegan'].was,
    }[key];
    if (v != null) el.textContent = fmt(v);
  });

  /* ---------- storage (never trusted to exist) ---------- */

  /* Until the visitor accepts preferences, only their consent choice is written
     to the browser; the cart and allergies live in memory for this visit. */
  const CONSENT_KEY = 'asanka-consent';
  const memory = {};
  const readLocal = (key) => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const writeLocal = (key, v) => { try { localStorage.setItem(key, v); } catch (_) { /* storage blocked */ } };
  const dropLocal = (key) => { try { localStorage.removeItem(key); } catch (_) { /* storage blocked */ } };
  let consent = readLocal(CONSENT_KEY);

  const store = {
    get(key) { return key in memory ? memory[key] : consent === 'all' ? readLocal(key) : null; },
    set(key, v) {
      memory[key] = v;
      if (key === CONSENT_KEY || consent === 'all') writeLocal(key, v);
    },
  };

  /* ---------- theme: follows the system until the visitor picks one ---------- */

  const SUN  = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>';
  const MOON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
  const themeBtn = $('#theme');
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)');

  const currentTheme = () =>
    document.documentElement.dataset.theme || (systemDark?.matches ? 'dark' : 'light');

  const paintThemeBtn = () => { themeBtn.innerHTML = currentTheme() === 'dark' ? SUN : MOON; };

  const savedTheme = store.get('asanka-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;
  paintThemeBtn();
  systemDark?.addEventListener?.('change', paintThemeBtn);

  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('asanka-theme', next);
    paintThemeBtn();
  });

  /* ---------- navigation ---------- */

  const nav = $('#nav');
  const burger = $('#burger');
  const links = $('#navlinks');

  burger.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });

  const scrollToId = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    const y = id === 'top' ? 0 : target.getBoundingClientRect().top + window.scrollY - nav.offsetHeight - 16;
    window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-scroll]');
    if (!el) return;
    e.preventDefault();
    if (el.hasAttribute('data-close-cart')) closeCart();
    scrollToId(el.dataset.scroll);
    links.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  });

  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navItems = $$('#navlinks a');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navItems.forEach((a) => a.classList.toggle('is-active', a.dataset.scroll === entry.target.id));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    navItems.map((a) => document.getElementById(a.dataset.scroll)).filter(Boolean).forEach((s) => spy.observe(s));
  }

  /* ---------- illustrations ---------- */

  let artSeq = 0;
  const drawArt = (spec) => {
    const A = window.AsankaArt;
    if (!A) return '';
    const [kind, a, b] = spec.split(':');
    const p = `a${++artSeq}`;
    const seed = [...spec].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
    if (kind === 'fufu') return A.fufu(p, seed, a, { fish: b === 'fish' });
    if (kind === 'jollof') return A.jollof(p, seed, a);
    if (kind === 'drink') return A.drink(p, seed, a);
    if (kind === 'tray') return A.tray(p, seed);
    if (kind === 'stick') return A.stickman(p, a);
    if (kind === 'side') {
      if (a === 'kelewele') return A.kelewele(p, seed);
      if (a === 'dodo') return A.dodo(p, seed);
      if (a === 'shito') return A.shito(p, seed);
      if (a === 'fufu') return A.fufuSide(p);
    }
    return '';
  };

  $$('[data-art]').forEach((el) => { el.innerHTML = drawArt(el.dataset.art); });

  /* ---------- menu ---------- */

  const CHILI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15c3 0 6-2 8-5 1.4-2 3-3 5-3-.5 5-4.5 11-11 11-2 0-3-1.5-2-3z" fill="currentColor"/><path d="M18 7c0-2 1-3 2.5-3.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';
  const SPICE_LABEL = ['Not spicy', 'Mild', 'Medium', 'Hot'];

  const grid = $('#menu-grid');

  const allergenText = (list) => list.map((k) => ALLERGENS[k].toLowerCase()).join(', ');

  const cardHTML = (item) => `
    <article class="as-card as-rise" data-cat="${item.cat}" data-id="${item.id}"${item.vegan ? ' data-vegan' : ''}>
      <div class="as-card-art">
        ${item.popular ? '<span class="as-ribbon">Most ordered</span>' : ''}
        <span class="as-warn" hidden></span>
        ${drawArt(item.art)}
      </div>
      <div class="as-card-body">
        <p class="as-card-native">${item.native}</p>
        <div class="as-card-top">
          <h3>${item.name}</h3>
          <span class="as-card-price">${fmt(item.price)}</span>
        </div>
        <p class="as-card-desc">${item.desc}</p>
        <p class="as-card-allergens">${item.allergens.length ? `Allergens: ${allergenText(item.allergens)}` : 'No major allergens'}</p>
        <div class="as-card-foot">
          <div class="as-card-meta">
            <span class="as-spice" title="${SPICE_LABEL[item.spice]}" aria-label="Spice: ${SPICE_LABEL[item.spice]}">
              ${[1, 2, 3].map((n) => `<i class="${n <= item.spice ? 'on' : ''}">${CHILI}</i>`).join('')}
            </span>
            ${item.vegan ? '<span class="as-tag as-tag-leaf">Vegan</span>' : ''}
            ${item.gf ? '<span class="as-tag">Gluten-free</span>' : ''}
          </div>
          <div class="as-card-action" data-action="${item.id}"></div>
        </div>
      </div>
    </article>`;

  grid.insertAdjacentHTML('beforeend', MENU.map(cardHTML).join(''));
  $('#vegan-grid').innerHTML = MENU.filter((i) => i.vegan && i.cat !== 'drink' && i.id !== 'fufu-extra').map(cardHTML).join('');

  $('#trays').innerHTML = ['tray-10', 'tray-25', 'fufu-20'].map((id) => {
    const t = EXTRAS[id];
    return `
      <article class="as-tray as-rise${t.popular ? ' is-popular' : ''}">
        ${t.popular ? '<span class="as-ribbon">Recommended</span>' : ''}
        <div class="as-tray-art">${drawArt(id === 'fufu-20' ? 'fufu:groundnut' : 'tray')}</div>
        <h3>${t.name.split(' · ')[0]}</h3>
        <p class="as-tray-people">${t.people} people</p>
        <p>${t.desc}</p>
        <div class="as-tray-foot">
          <span><b>${fmt(t.price)}</b><small>${fmt(t.price / t.people)} per person</small></span>
          <div class="as-card-action" data-action="${id}"></div>
        </div>
      </article>`;
  }).join('');

  /* ---------- allergies and filters ---------- */

  let prefs = { allergies: [], hideUnsafe: false };
  try { prefs = { ...prefs, ...JSON.parse(store.get('asanka-prefs') || '{}') }; } catch (_) { /* keep defaults */ }
  prefs.allergies = (prefs.allergies || []).filter((k) => k in ALLERGENS);

  let filter = 'all';
  const conflicts = (item) => (item.allergens || []).filter((k) => prefs.allergies.includes(k));

  function applyFilters() {
    $$('.as-card').forEach((card) => {
      const item = ITEMS[card.dataset.id];
      const bad = conflicts(item);
      card.classList.toggle('is-unsafe', bad.length > 0);
      const warn = $('.as-warn', card);
      warn.hidden = !bad.length;
      warn.textContent = bad.length ? `Contains ${allergenText(bad)}` : '';
      if (card.closest('#menu-grid')) {
        const inTab = filter === 'all' || (filter === 'vegan' ? item.vegan : item.cat === filter);
        card.hidden = !inTab || (prefs.hideUnsafe && bad.length > 0);
      } else card.hidden = prefs.hideUnsafe && bad.length > 0;
    });

    const bar = $('#allergy-bar');
    if (prefs.allergies.length) {
      const hidden = MENU.filter((i) => conflicts(i).length).length;
      bar.innerHTML = `
        <span class="as-allergy-i" aria-hidden="true">!</span>
        <span>Your allergies: <b>${prefs.allergies.map((k) => ALLERGENS[k]).join(', ')}</b>. ${hidden} ${hidden === 1 ? 'dish contains them and is' : 'dishes contain them and are'} flagged.</span>
        <label class="as-switch"><input type="checkbox" id="hide-unsafe"${prefs.hideUnsafe ? ' checked' : ''}><span>Hide them</span></label>
        <button type="button" class="as-link-btn" data-open-prefs>Change</button>`;
    } else {
      bar.innerHTML = `
        <span class="as-allergy-i as-allergy-ok" aria-hidden="true">✓</span>
        <span>The whole menu is <b>gluten-free</b>. Any other allergy or intolerance?</span>
        <button type="button" class="as-link-btn" data-open-prefs>Tell us here</button>`;
    }
  }

  document.addEventListener('change', (e) => {
    if (e.target.id !== 'hide-unsafe') return;
    prefs.hideUnsafe = e.target.checked;
    store.set('asanka-prefs', JSON.stringify(prefs));
    applyFilters();
  });

  const tabs = $$('.as-tab');
  const selectTab = (f) => {
    filter = f;
    tabs.forEach((t) => {
      const on = t.dataset.filter === f;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    applyFilters();
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab.dataset.filter)));

  /* ---------- welcome: privacy and allergies ---------- */

  const welcome = $('#welcome');
  $('#welcome-allergies').innerHTML = Object.entries(ALLERGENS).map(([k, label]) => `
    <label class="as-chip"><input type="checkbox" name="allergy" value="${k}"><span>${label}</span></label>`).join('');

  function openWelcome(focusAllergies = false) {
    $$('#welcome-allergies input').forEach((el) => { el.checked = prefs.allergies.includes(el.value); });
    welcome.hidden = false;
    document.body.classList.add('as-lock');
    requestAnimationFrame(() => welcome.classList.add('is-on'));
    (focusAllergies ? $('#welcome-allergies input') : $('#welcome-accept')).focus();
  }

  function closeWelcome(choice) {
    consent = choice;
    store.set(CONSENT_KEY, choice);
    prefs.allergies = $$('#welcome-allergies input:checked').map((el) => el.value);
    if (!prefs.allergies.length) prefs.hideUnsafe = false;
    if (choice === 'all') {
      Object.entries(memory).forEach(([k, v]) => { if (k !== CONSENT_KEY) writeLocal(k, v); });
    } else {
      ['asanka-cart', 'asanka-prefs', 'asanka-theme'].forEach(dropLocal);
    }
    store.set('asanka-prefs', JSON.stringify(prefs));
    welcome.classList.remove('is-on');
    welcome.hidden = true;
    document.body.classList.remove('as-lock');
    applyFilters();
  }

  $('#welcome-accept').addEventListener('click', () => closeWelcome('all'));
  $('#welcome-necessary').addEventListener('click', () => closeWelcome('necessary'));
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-open-prefs]');
    if (!el) return;
    e.preventDefault();
    openWelcome(true);
  });

  applyFilters();
  if (consent !== 'all' && consent !== 'necessary') openWelcome();

  /* ---------- cart ---------- */

  let cart = {};
  try { cart = JSON.parse(store.get('asanka-cart') || '{}') || {}; } catch (_) { cart = {}; }
  Object.keys(cart).forEach((id) => { if (!ITEMS[id] || !(cart[id] > 0)) delete cart[id]; });

  const saveCart = () => store.set('asanka-cart', JSON.stringify(cart));
  const count = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const subtotal = () => Object.entries(cart).reduce((s, [id, q]) => s + ITEMS[id].price * q, 0);
  const mode = () => $('#checkout').elements.mode.value;
  const shipping = () => {
    if (mode() === 'pickup' || !count()) return 0;
    return subtotal() >= CONFIG.freeDelivery ? 0 : CONFIG.deliveryFee;
  };

  const setQty = (id, q) => {
    if (q <= 0) delete cart[id]; else cart[id] = Math.min(q, 99);
    saveCart();
    renderCart();
  };

  const stepper = (id, q) => `
    <div class="as-stepper" role="group" aria-label="Quantity of ${ITEMS[id].name}">
      <button type="button" data-dec="${id}" aria-label="Remove one">−</button>
      <span>${q}</span>
      <button type="button" data-inc="${id}" aria-label="Add one">+</button>
    </div>`;

  const addBtn = (id) =>
    `<button class="as-add" type="button" data-add="${id}"><span aria-hidden="true">+</span> Add</button>`;

  function renderCart() {
    // buttons on the cards
    $$('[data-action]').forEach((el) => {
      const id = el.dataset.action;
      el.innerHTML = cart[id] ? stepper(id, cart[id]) : addBtn(id);
    });

    const n = count();
    const badge = $('#cart-count');
    badge.textContent = n;
    badge.classList.toggle('is-on', n > 0);

    const lines = $('#cart-lines');
    lines.innerHTML = Object.entries(cart).map(([id, q]) => {
      const it = ITEMS[id];
      return `
        <li class="as-line">
          <div class="as-line-art" aria-hidden="true">${drawArt(it.art || LINE_ART[id])}</div>
          <div class="as-line-info">
            <b>${it.name}</b>
            <span>${fmt(it.price)} each</span>
            ${stepper(id, q)}
          </div>
          <div class="as-line-right">
            <b>${fmt(it.price * q)}</b>
            <button type="button" class="as-link-btn" data-remove="${id}">Remove</button>
          </div>
        </li>`;
    }).join('');

    const empty = n === 0;
    $('#cart-empty').hidden = !empty;
    $('#checkout').hidden = empty;
    $('#drawer-foot').hidden = empty;

    const sub = subtotal(), ship = shipping();
    $('#t-sub').textContent = fmt(sub);
    $('#t-ship').textContent = mode() === 'pickup' ? 'Pickup' : ship === 0 ? 'Free' : fmt(ship);
    $('#t-total').textContent = fmt(sub + ship);

    const hint = $('#free-hint');
    if (mode() === 'delivery' && sub < CONFIG.freeDelivery && !empty) {
      const pct = Math.min(100, (sub / CONFIG.freeDelivery) * 100);
      hint.innerHTML = `Add <b>${fmt(CONFIG.freeDelivery - sub)}</b> more for free delivery<span class="as-meter"><i style="width:${pct}%"></i></span>`;
      hint.hidden = false;
    } else if (mode() === 'delivery' && !empty) {
      hint.innerHTML = '<b>You get free delivery!</b>';
      hint.hidden = false;
    } else hint.hidden = true;

    $('#address-field').hidden = mode() === 'pickup';
  }

  const toast = $('#toast');
  let toastTimer;
  const showToast = (msg) => {
    toast.innerHTML = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2600);
  };

  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    const inc = e.target.closest('[data-inc]');
    const dec = e.target.closest('[data-dec]');
    const rm  = e.target.closest('[data-remove]');
    if (add) {
      const id = add.dataset.add;
      setQty(id, (cart[id] || 0) + 1);
      showToast(`<b>${ITEMS[id].name}</b> added · <button type="button" class="as-link-btn" data-open-cart>View order</button>`);
    } else if (inc) setQty(inc.dataset.inc, (cart[inc.dataset.inc] || 0) + 1);
    else if (dec) setQty(dec.dataset.dec, (cart[dec.dataset.dec] || 0) - 1);
    else if (rm) setQty(rm.dataset.remove, 0);
    else if (e.target.closest('[data-open-cart]')) openCart();
  });

  /* ---------- drawer ---------- */

  const drawer = $('#drawer');
  const scrim = $('#scrim');
  let lastFocus = null;

  function openCart() {
    lastFocus = document.activeElement;
    fillSlots();
    scrim.hidden = false;
    requestAnimationFrame(() => {
      drawer.classList.add('is-open');
      scrim.classList.add('is-on');
    });
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('as-lock');
    drawer.focus();
  }

  function closeCart() {
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-on');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('as-lock');
    setTimeout(() => { scrim.hidden = true; }, 250);
    lastFocus?.focus?.();
  }

  $('#cart-open').addEventListener('click', openCart);
  $('#cart-close').addEventListener('click', closeCart);
  scrim.addEventListener('click', closeCart);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeCart();
  });

  $('#checkout').addEventListener('change', (e) => {
    if (e.target.name === 'mode') { fillSlots(); renderCart(); }
  });

  /* ---------- opening hours and time slots ---------- */

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

  const isOpen = (d = new Date()) => {
    const [o, c] = CONFIG.hours[d.getDay()];
    const m = nowMin(d);
    return m >= o && m < c;
  };

  function fillSlots() {
    const sel = $('#when');
    const now = new Date();
    const lead = mode() === 'pickup' ? 25 : CONFIG.prepMinutes;
    const opts = [];
    for (let dayOffset = 0; dayOffset < 2 && opts.length < 16; dayOffset++) {
      const d = new Date(now); d.setDate(d.getDate() + dayOffset);
      const [o, c] = CONFIG.hours[d.getDay()];
      let start = dayOffset === 0 ? Math.max(o + lead, Math.ceil((nowMin(now) + lead) / 15) * 15) : o + lead;
      for (let m = start; m <= c && opts.length < 16; m += 15) {
        const label = `${dayOffset === 0 ? 'Today' : 'Tomorrow'} · ${hhmm(m)}`;
        opts.push(`<option>${label}</option>`);
      }
    }
    const asap = isOpen(now) ? `<option>As soon as possible (~${lead} min)</option>` : '';
    sel.innerHTML = asap + opts.join('');
  }

  const status = $('#open-status');
  const paintStatus = () => {
    const d = new Date();
    const [o, c] = CONFIG.hours[d.getDay()];
    if (isOpen(d)) status.innerHTML = `<span class="as-live"></span><b>Open now</b> · orders until ${hhmm(c)}`;
    else if (nowMin(d) < o) status.innerHTML = `Opening today at <b>${hhmm(o)}</b> · you can schedule your order now`;
    else status.innerHTML = `Closed · opening tomorrow at <b>${hhmm(CONFIG.hours[(d.getDay() + 1) % 7][0])}</b>`;
  };
  paintStatus();
  setInterval(paintStatus, 60 * 1000);

  // footer hours, grouping consecutive days that share a schedule
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups = [];
  order.forEach((d) => {
    const key = CONFIG.hours[d].join('-');
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.to = d; else groups.push({ key, from: d, to: d });
  });
  $('#hours').innerHTML = groups.map((g) => {
    const days = g.from === g.to ? DAYS[g.from] : `${DAYS[g.from]} to ${DAYS[g.to]}`;
    const [o, c] = CONFIG.hours[g.from];
    return `<li><span>${days}</span><span>${hhmm(o)}–${hhmm(c)}</span></li>`;
  }).join('');

  $('#contact-address').textContent = CONFIG.address;
  $('#contact-phone').textContent = CONFIG.phoneLabel;
  $('#contact-phone').href = `https://wa.me/${CONFIG.whatsapp}`;
  $('#contact-mail').textContent = CONFIG.email;
  $('#contact-mail').href = `mailto:${CONFIG.email}`;
  $('#year').textContent = new Date().getFullYear();

  /* ---------- checkout: the order goes to WhatsApp ---------- */

  const markInvalid = (form) => {
    let first = null;
    $$('input, select, textarea', form).forEach((el) => {
      const hiddenField = el.closest('[hidden]');
      const bad = !hiddenField && el.required && !el.value.trim();
      el.closest('.as-field')?.classList.toggle('is-invalid', bad);
      if (bad && !first) first = el;
    });
    return first;
  };

  const waLink = (text) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;

  $('#checkout').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const msg = $('#checkout-msg');
    const bad = markInvalid(form);
    if (bad) { msg.textContent = 'Fill in the highlighted fields to send your order.'; bad.focus(); return; }

    const phone = form.elements.phone.value.replace(/[^\d+]/g, '');
    if (phone.replace(/\D/g, '').length < 9) {
      form.elements.phone.closest('.as-field').classList.add('is-invalid');
      msg.textContent = 'Check the phone number.';
      form.elements.phone.focus();
      return;
    }

    const sub = subtotal();
    if (mode() === 'delivery' && sub < CONFIG.minDelivery) {
      msg.textContent = `The minimum for delivery is ${fmt(CONFIG.minDelivery)}.`;
      return;
    }
    msg.textContent = '';

    const ref = `AS-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const f = form.elements;
    const lines = Object.entries(cart).map(([id, q]) => `• ${q} × ${ITEMS[id].name} — ${fmt(ITEMS[id].price * q)}`);
    const ship = shipping();
    const text = [
      `Hi Asanka, I'd like to place an order (${ref}):`,
      '',
      ...lines,
      '',
      `Subtotal: ${fmt(sub)}`,
      mode() === 'delivery' ? `Delivery: ${ship ? fmt(ship) : 'free'}` : 'Pickup at the kitchen',
      `Total: ${fmt(sub + ship)}`,
      '',
      `Spice: ${f.spice.value}`,
      prefs.allergies.length ? `Allergies: ${prefs.allergies.map((k) => ALLERGENS[k]).join(', ')}` : null,
      `Time: ${f.when.value}`,
      `Name: ${f.name.value.trim()}`,
      `Phone: ${f.phone.value.trim()}`,
      mode() === 'delivery' ? `Address: ${f.address.value.trim()}` : null,
      f.notes.value.trim() ? `Notes: ${f.notes.value.trim()}` : null,
    ].filter((l) => l !== null).join('\n');

    const url = waLink(text);

    $('#done-ref').textContent = ref;
    $('#done-link').href = url;
    $('#drawer-body').hidden = true;
    $('#drawer-foot').hidden = true;
    $('#done').hidden = false;
  });

  $('#done-new').addEventListener('click', () => {
    cart = {};
    saveCart();
    $('#checkout').reset();
    $('#done').hidden = true;
    $('#drawer-body').hidden = false;
    renderCart();
    closeCart();
  });

  $$('#checkout input, #checkout textarea').forEach((el) =>
    el.addEventListener('input', () => el.closest('.as-field')?.classList.remove('is-invalid')));

  /* ---------- catering quote ---------- */

  $('#quote').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const msg = $('#quote-msg');
    const bad = markInvalid(form);
    if (bad) { msg.textContent = 'Fill in your name, the date and the number of guests.'; bad.focus(); return; }
    const f = form.elements;
    const date = new Date(`${f.date.value}T12:00`).toLocaleDateString(CONFIG.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const text = `Hi Asanka, I'm ${f.name.value.trim()}. I'd like a catering quote for ${f.guests.value} guests on ${date}.`;
    msg.innerHTML = `Request ready. <a href="${waLink(text)}" target="_blank" rel="noopener">Send it on WhatsApp</a> and we will reply within 24 hours.`;
  });

  /* ---------- scroll reveal ---------- */

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('as-js');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.as-rise').forEach((el) => io.observe(el));
  }

  renderCart();
})();
