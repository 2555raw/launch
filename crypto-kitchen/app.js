/* Crypto Kitchen — navigation, the price ticker, the leaderboard, the coin
   counter in the HUD and Order Rush, the 60-second cooking game. */
(function () {
  'use strict';

  var root = document.querySelector('.ck');
  root.classList.add('ck-js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- storage, tolerant of browsers that block it ----------
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private window, blocked storage */ }
  }

  // ---------- the HUD coin counter ----------
  var hudCoins = document.getElementById('hudCoins');
  var hudWrap = hudCoins.parentNode;
  var wallet = load('ck-coins', 0);
  function renderWallet() { hudCoins.textContent = wallet.toLocaleString('en-US'); }
  function addCoins(n) {
    wallet = Math.max(0, wallet + n);
    save('ck-coins', wallet);
    renderWallet();
    hudWrap.classList.remove('pop');
    void hudWrap.offsetWidth; // restart the animation
    hudWrap.classList.add('pop');
  }
  renderWallet();

  // ---------- navigation ----------
  var hud = document.querySelector('.hud');
  var links = document.getElementById('navlinks');
  var burger = document.getElementById('burger');

  function scrollTo(id) {
    if (id === 'top') { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); return; }
    var el = document.getElementById(id);
    if (!el) return;
    var y = el.getBoundingClientRect().top + window.pageYOffset - hud.offsetHeight - 8;
    window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-scroll]');
    if (!t) return;
    e.preventDefault();
    scrollTo(t.getAttribute('data-scroll'));
    links.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  });
  burger.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // mark the section in view
  var navLinks = Array.prototype.slice.call(links.querySelectorAll('a[data-scroll]'));
  var sections = navLinks.map(function (a) { return document.getElementById(a.getAttribute('data-scroll')); }).filter(Boolean);
  if ('IntersectionObserver' in window) {
    var active = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('data-scroll') === en.target.id); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { active.observe(s); });
  }

  // ---------- reveal on scroll ----------
  var risers = document.querySelectorAll('.section-head, .station-card, .level, .recipe-step, .faq-item, .menu-card, .pizza-wrap, .board, .arcade');
  Array.prototype.forEach.call(risers, function (el) { el.classList.add('rise'); });
  if ('IntersectionObserver' in window && !reduceMotion) {
    var reveal = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); reveal.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(risers, function (el) { reveal.observe(el); });
  } else {
    Array.prototype.forEach.call(risers, function (el) { el.classList.add('in'); });
  }

  // ---------- price ticker (sample data) ----------
  var MENU = [
    { em: '🔥', name: '$SIZZLE', price: '$0.0042', chg: '+18.4%' },
    { em: '🍔', name: 'BTC Burger', price: '$67,420', chg: '+2.1%' },
    { em: '🍟', name: 'ETH Fries', price: '$3,180', chg: '+0.8%' },
    { em: '🥩', name: 'SOL Steak', price: '$142', chg: '-1.3%' },
    { em: '🍩', name: 'DOGE Donut', price: '$0.118', chg: '+5.6%' },
    { em: '🌮', name: 'BNB Taco', price: '$585', chg: '+0.4%' },
    { em: '🍕', name: 'AVAX Pizza', price: '$31.2', chg: '-2.7%' },
    { em: '🥤', name: 'USDC Soda', price: '$1.00', chg: '+0.0%' },
    { em: '🍳', name: 'LINK Eggs', price: '$14.9', chg: '+3.2%' },
    { em: '🍦', name: 'PEPE Sundae', price: '$0.000009', chg: '+12.0%' }
  ];
  var ticker = document.getElementById('ticker');
  var items = MENU.concat(MENU).map(function (m) { // doubled so the loop is seamless
    var up = m.chg.charAt(0) !== '-';
    return '<span class="ticker-item"><span class="em">' + m.em + '</span>' + m.name + ' <span>' + m.price + '</span><span class="chg ' + (up ? 'up' : 'down') + '">' + m.chg + '</span></span>';
  });
  ticker.innerHTML = items.join('');

  // ---------- leaderboard (sample data) ----------
  var CHEFS = [
    { em: '👩‍🍳', face: '#FF5DA2', name: 'MamaWok', wallet: '7xKp…9fQ2', orders: 4812, combo: 41, coins: 96240 },
    { em: '🧑‍🍳', face: '#3BC9C4', name: 'GrillGod', wallet: '0x3a…c81e', orders: 4390, combo: 38, coins: 87800 },
    { em: '👨‍🍳', face: '#FFB020', name: 'DeepFryDegen', wallet: 'Bq2m…Lp7t', orders: 4105, combo: 35, coins: 82100 },
    { em: '🧑‍🍳', face: '#7B4DD8', name: 'SauceBoss', wallet: '0x91…44aa', orders: 3760, combo: 29, coins: 75200 },
    { em: '👩‍🍳', face: '#4BE04A', name: 'nonna.eth', wallet: '0xde…f00d', orders: 3421, combo: 27, coins: 68420 },
    { em: '👨‍🍳', face: '#F0433C', name: 'BurntToast', wallet: 'Hn8w…2sVc', orders: 3188, combo: 22, coins: 63760 }
  ];
  document.getElementById('board').innerHTML = CHEFS.map(function (c, i) {
    return '<tr>' +
      '<td><span class="board-rank r' + (i + 1) + '">' + (i + 1) + '</span></td>' +
      '<td><span class="board-chef"><span class="em" style="--face:' + c.face + '">' + c.em + '</span>' + c.name + '</span></td>' +
      '<td class="board-wallet">' + c.wallet + '</td>' +
      '<td class="num">' + c.orders.toLocaleString('en-US') + '</td>' +
      '<td class="num">×' + c.combo + '</td>' +
      '<td class="num board-coins">' + c.coins.toLocaleString('en-US') + '</td>' +
      '</tr>';
  }).join('');

  // ---------- copy the contract ----------
  var copyBtn = document.getElementById('copyContract');
  copyBtn.addEventListener('click', function () {
    var text = document.getElementById('contract').textContent;
    var done = function () { copyBtn.textContent = 'Copied!'; setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else done();
  });

  // ---------- Order Rush ----------
  // Customers walk up wanting one or two dishes. Tap the matching station: the
  // dish cooks for a moment, then goes to the first customer waiting for it.
  // Serve a full order before the patience bar empties for the tip; the faster
  // the serve, the bigger the tip, and each serve in a row raises the combo.
  // Cook something nobody is waiting for and it burns.
  var DISHES = {
    burger: { em: '🍔', time: 1000, pay: 10 },
    fries:  { em: '🍟', time: 800,  pay: 8 },
    steak:  { em: '🥩', time: 1400, pay: 15 },
    soda:   { em: '🥤', time: 500,  pay: 5 }
  };
  var DISH_KEYS = Object.keys(DISHES);
  var FACES = ['😀', '😺', '🤠', '🧑', '👵', '👦', '🧔', '👩', '🤖', '👽', '🦊', '🐼'];
  var FACE_COLORS = ['#FFB020', '#FF5DA2', '#3BC9C4', '#7B4DD8', '#4BE04A', '#FF8A1F'];
  var SHIFT = 60;          // seconds
  var MAX_CUSTOMERS = 4;
  var PATIENCE = 9000;     // ms before a customer walks away
  var BURN_PENALTY = 3;

  var arcade = document.getElementById('arcade');
  var custWrap = document.getElementById('customers');
  var stations = Array.prototype.slice.call(arcade.querySelectorAll('.station'));
  var overlay = document.getElementById('gOverlay');
  var startBtn = document.getElementById('gStart');
  var elTime = document.getElementById('gTime');
  var elScore = document.getElementById('gScore');
  var elCombo = document.getElementById('gCombo');
  var elBest = document.getElementById('gBest');
  var toast = document.getElementById('gToast');
  var panelEmoji = document.getElementById('gPanelEmoji');
  var panelTitle = document.getElementById('gPanelTitle');
  var panelText = document.getElementById('gPanelText');

  var best = load('ck-best', 0);
  elBest.textContent = best;

  var game = null;

  function showToast(text, bad) {
    toast.textContent = text;
    toast.classList.toggle('bad', !!bad);
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
  }

  function renderEmpty() {
    custWrap.innerHTML = '<span class="cust-empty">Waiting for customers…</span>';
  }
  renderEmpty();

  function spawnCustomer() {
    if (!game || game.customers.length >= MAX_CUSTOMERS) return;
    var wants = [DISH_KEYS[Math.floor(Math.random() * DISH_KEYS.length)]];
    if (Math.random() < 0.35 + game.elapsed / SHIFT * 0.3) wants.push(DISH_KEYS[Math.floor(Math.random() * DISH_KEYS.length)]);

    var el = document.createElement('div');
    el.className = 'cust';
    el.innerHTML =
      '<div class="cust-order">' + wants.map(function (d) { return '<span>' + DISHES[d].em + '</span>'; }).join('') + '</div>' +
      '<div class="cust-face" style="--face:' + FACE_COLORS[Math.floor(Math.random() * FACE_COLORS.length)] + '">' + FACES[Math.floor(Math.random() * FACES.length)] + '</div>' +
      '<div class="cust-patience"><i></i></div>';
    var empty = custWrap.querySelector('.cust-empty');
    if (empty) empty.remove();
    custWrap.appendChild(el);

    game.customers.push({ el: el, wants: wants, born: performance.now(), patience: PATIENCE - game.elapsed * 40, gone: false });
  }

  function removeCustomer(c, cls) {
    c.gone = true;
    game.customers = game.customers.filter(function (x) { return x !== c; });
    c.el.classList.add(cls);
    setTimeout(function () {
      c.el.remove();
      if (game && game.customers.length === 0 && !custWrap.querySelector('.cust')) renderEmpty();
    }, reduceMotion ? 0 : 450);
  }

  function cook(station) {
    if (!game || station.classList.contains('busy')) return;
    var dish = station.getAttribute('data-dish');
    var spec = DISHES[dish];
    station.classList.add('busy');
    station.classList.remove('burnt');
    station.style.setProperty('--t', spec.time + 'ms');
    setTimeout(function () {
      station.classList.remove('busy');
      if (!game) return;
      serve(dish, station);
    }, spec.time);
  }

  function serve(dish, station) {
    // first customer, in order of arrival, still waiting for this dish
    var c = null;
    for (var i = 0; i < game.customers.length; i++) {
      if (game.customers[i].wants.indexOf(dish) !== -1) { c = game.customers[i]; break; }
    }
    if (!c) {
      game.combo = 1;
      game.score = Math.max(0, game.score - BURN_PENALTY);
      station.classList.add('burnt');
      setTimeout(function () { station.classList.remove('burnt'); }, 700);
      showToast('Burnt! −' + BURN_PENALTY, true);
      updateHud();
      return;
    }
    c.wants.splice(c.wants.indexOf(dish), 1);
    var slots = c.el.querySelectorAll('.cust-order span');
    for (var j = 0; j < slots.length; j++) {
      if (slots[j].textContent === DISHES[dish].em && !slots[j].classList.contains('done')) { slots[j].classList.add('done'); break; }
    }
    if (c.wants.length > 0) return;

    // full order served: pay + tip for speed, combo grows
    var left = Math.max(0, 1 - (performance.now() - c.born) / c.patience);
    var base = 0;
    for (var k = 0; k < slots.length; k++) {
      var em = slots[k].textContent;
      for (var d in DISHES) if (DISHES[d].em === em) base += DISHES[d].pay;
    }
    var tip = Math.round(base * left * 0.6);
    var earned = Math.round((base + tip) * (1 + (game.combo - 1) * 0.25)); // combo ×5 doubles the pay
    game.score += earned;
    game.served += 1;
    game.combo = Math.min(5, game.combo + 1);
    showToast('+' + earned + (tip > 0 ? '  🤑 tip ' + tip : ''));
    removeCustomer(c, 'served');
    updateHud();
  }

  function updateHud() {
    elScore.textContent = game ? game.score : 0;
    elCombo.textContent = game ? game.combo : 1;
  }

  function tick(now) {
    if (!game) return;
    var dt = now - game.last;
    game.last = now;
    game.elapsed += dt / 1000;
    game.spawnIn -= dt;

    var secondsLeft = Math.max(0, Math.ceil(SHIFT - game.elapsed));
    if (secondsLeft !== game.shown) { game.shown = secondsLeft; elTime.textContent = secondsLeft; }

    if (game.spawnIn <= 0) {
      spawnCustomer();
      // the room fills faster as the shift goes on
      game.spawnIn = Math.max(900, 2400 - game.elapsed * 22) + Math.random() * 600;
    }

    game.customers.slice().forEach(function (c) {
      var p = 1 - (now - c.born) / c.patience;
      c.el.querySelector('.cust-patience i').style.setProperty('--p', Math.max(0, p * 100) + '%');
      c.el.classList.toggle('hurry', p < 0.5 && p >= 0.25);
      c.el.classList.toggle('angry', p < 0.25);
      if (p <= 0) {
        game.combo = 1;
        game.lost += 1;
        showToast('Customer left 😠', true);
        removeCustomer(c, 'leaving');
        updateHud();
      }
    });

    if (game.elapsed >= SHIFT) { endShift(); return; }
    game.raf = requestAnimationFrame(tick);
  }

  function startShift() {
    custWrap.innerHTML = '';
    stations.forEach(function (s) { s.classList.remove('busy', 'burnt'); });
    game = { score: 0, combo: 1, served: 0, lost: 0, customers: [], elapsed: 0, spawnIn: 400, last: performance.now(), shown: -1, raf: 0 };
    overlay.hidden = true;
    elTime.textContent = SHIFT;
    updateHud();
    game.raf = requestAnimationFrame(tick);
  }

  function endShift() {
    var g = game;
    cancelAnimationFrame(g.raf);
    game = null;
    g.customers.forEach(function (c) { c.el.remove(); });
    renderEmpty();
    stations.forEach(function (s) { s.classList.remove('busy', 'burnt'); });

    if (g.score > best) { best = g.score; save('ck-best', best); elBest.textContent = best; }
    if (g.score > 0) addCoins(g.score);

    var rating = g.score >= 300 ? '⭐⭐⭐' : g.score >= 150 ? '⭐⭐' : g.score >= 50 ? '⭐' : '🍳';
    panelEmoji.textContent = g.score >= 150 ? '🤑' : g.score >= 50 ? '😋' : '😅';
    panelTitle.textContent = 'Shift over ' + rating;
    panelText.innerHTML = 'You served <b>' + g.served + '</b> order' + (g.served === 1 ? '' : 's') +
      (g.lost ? ' and lost <b>' + g.lost + '</b> customer' + (g.lost === 1 ? '' : 's') : '') +
      '. <b>' + g.score + ' $SIZZLE</b> went into your counter up top.' +
      (g.score >= best && g.score > 0 ? ' New personal best!' : '');
    startBtn.textContent = 'Cook again';
    overlay.hidden = false;
    startBtn.focus();
  }

  startBtn.addEventListener('click', startShift);
  stations.forEach(function (s) { s.addEventListener('click', function () { cook(s); }); });
  document.addEventListener('keydown', function (e) {
    if (!game) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= stations.length) { e.preventDefault(); cook(stations[n - 1]); }
  });

  // pause the clock while the tab is hidden, so a lost minute doesn't end the
  // shift or send every customer home angry
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (!game) return;
    if (document.hidden) { hiddenAt = performance.now(); return; }
    var away = performance.now() - hiddenAt;
    game.last = performance.now();
    game.customers.forEach(function (c) { c.born += away; });
  });
})();
