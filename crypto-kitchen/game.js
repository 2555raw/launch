/* Crypto Kitchen — a Cooking-Fever style kitchen where the customers pay in
   crypto. Customers walk up with an order; you tap a tray to start cooking,
   tap the cooked dish to plate it on the pass, and tap the customer (or the
   plate) to serve. A full order pays in the customer's coin, at the game's
   own market price, plus a tip for speed. Levels have a cash goal and a
   clock; the shop sells permanent upgrades; the wallet keeps every coin. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  // ---------- storage, tolerant of browsers that block it ----------
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private window */ }
  }


  // ---------- languages ----------
  var I18N = {
    es: {
      'title.kicker': '🔥 Cooking · play to earn', 'title.tag': 'Los clientes entran. Tú cocinas. Ellos pagan en crypto.',
      'btn.play': '▶ Jugar', 'btn.wallet': '👛 Cartera', 'title.balance': 'Balance:', 'title.walletWord': 'cartera',
      'nav.home': '‹ Inicio', 'nav.levels': '‹ Niveles', 'h.levels': 'Niveles', 'h.shop': 'Tienda', 'h.wallet': 'Cartera', 'btn.shop': '🛒 Tienda',
      'hud.level': 'Nivel', 'pass': 'Pase', 'btn.launchpad': '🚀 Launchpad',
      'shop.note': 'Las mejoras se pagan con los dólares que ganas en la cocina. Cada nivel de mejora es permanente.', 'shop.max': 'MAX',
      'wallet.coin': 'Moneda', 'wallet.amount': 'Cantidad', 'wallet.price': 'Precio', 'wallet.value': 'Valor',
      'wallet.note': 'Lo que cobras a los clientes se guarda en la moneda en la que pagan. El valor sigue el mercado del juego, que se mueve solo. Todo vive en tu navegador; nada va a una cadena real.',
      'wallet.cash': '💵 Caja:', 'wallet.wallet': '🪙 Cartera:', 'wallet.served': '🍽️ Servidos:', 'wallet.lost': '😠 Perdidos:',
      'btn.reset': 'Borrar progreso', 'reset.confirm': '¿Borrar todo el progreso, la caja y la cartera?',
      'dish.burger': 'Burger', 'dish.fries': 'Patatas', 'dish.soda': 'Refresco', 'dish.steak': 'Chuletón', 'dish.pizza': 'Pizza',
      'st.grill': 'Parrilla', 'st.fryer': 'Freidora', 'st.soda': 'Bebidas', 'st.pan': 'Sartén', 'st.oven': 'Horno',
      'upg.grillSlots': ['Parrilla grande', 'Más huecos para hamburguesas a la vez.'], 'upg.grillSpeed': ['Parrilla rápida', 'Las hamburguesas se hacen antes.'],
      'upg.fryerSlots': ['Segunda cesta', 'Dos cestas de patatas en la freidora.'], 'upg.fryerSpeed': ['Aceite caliente', 'Las patatas fríen más rápido.'],
      'upg.sodaSpeed': ['Grifo a presión', 'Los refrescos salen casi al instante.'], 'upg.panSlots': ['Segunda sartén', 'Dos chuletones a la vez.'],
      'upg.passSlots': ['Pase más largo', 'Más platos esperando en el pase.'], 'upg.neon': ['Cartel de neón', 'Los clientes esperan un 20% más por nivel.'],
      'upg.jukebox': ['Jukebox', 'Buen ambiente: +10% de propina por nivel.'],
      'intro.level': 'Nivel {n}', 'intro.open': '¡Abrimos!', 'intro.shift': 'Turno {n}',
      'intro.text': 'Pagan en <b>{coins}</b>. Cuanto antes sirvas, más propina; con {amt} te llevas las tres estrellas.',
      'howto.1': 'Toca una <b>bandeja</b> para poner comida a cocinar.', 'howto.2': 'Cuando brille, tócala para pasarla al <b>pase</b>.', 'howto.3': 'Toca al <b>cliente</b> (o el plato) para servir. Si se aburre, se va.',
      'btn.start': '▶ Empezar', 'btn.back': 'Volver',
      'room.opening': 'Abriendo el local…', 'room.waiting': 'Esperando clientes…',
      'msg.passFull': '¡El pase está lleno!', 'msg.nobody': 'Nadie ha pedido {dish}', 'msg.missing': 'Le falta {items}', 'msg.burnt': '¡Se ha quemado! Tócalo para tirarlo',
      'msg.pump': '🚀 ¡{coin} está pumpeando! Los que pagan en {coin} pagan ×2', 'msg.left': 'Se fue 😠',
      'res.win': '¡Turno cerrado!', 'res.lose': 'No llegaste…', 'res.earned': 'Ganado', 'res.goal': 'Objetivo', 'res.served': 'Servidos', 'res.nothing': 'Nada cobrado',
      'res.lost': ['{n} cliente se fue sin pagar.', '{n} clientes se fueron sin pagar.'], 'res.burnt': ['{n} plato quemado.', '{n} platos quemados.'],
      'res.inWallet': 'Lo cobrado ya está en tu cartera.', 'res.tryShop': 'Prueba una mejora en la tienda y repite.',
      'btn.next': 'Siguiente ▶', 'res.done': '🏆 ¡Has completado la cocina!', 'btn.retry': '↻ Repetir', 'btn.levels': 'Niveles',
      'pause.title': 'Pausa', 'pause.text': 'La cocina espera. Los clientes también, por una vez.', 'btn.resume': '▶ Seguir', 'btn.quit': 'Abandonar'
    },
    en: {
      'title.kicker': '🔥 Cooking · play to earn', 'title.tag': 'Customers walk in. You cook. They pay in crypto.',
      'btn.play': '▶ Play', 'btn.wallet': '👛 Wallet', 'title.balance': 'Balance:', 'title.walletWord': 'wallet',
      'nav.home': '‹ Home', 'nav.levels': '‹ Levels', 'h.levels': 'Levels', 'h.shop': 'Shop', 'h.wallet': 'Wallet', 'btn.shop': '🛒 Shop',
      'hud.level': 'Level', 'pass': 'Pass', 'btn.launchpad': '🚀 Launchpad',
      'shop.note': 'Upgrades are paid with the dollars you earn in the kitchen. Every upgrade level is permanent.', 'shop.max': 'MAX',
      'wallet.coin': 'Coin', 'wallet.amount': 'Amount', 'wallet.price': 'Price', 'wallet.value': 'Value',
      'wallet.note': 'What customers pay is kept in the coin they pay with. Its value follows the game market, which moves on its own. Everything lives in your browser; nothing touches a real chain.',
      'wallet.cash': '💵 Cash:', 'wallet.wallet': '🪙 Wallet:', 'wallet.served': '🍽️ Served:', 'wallet.lost': '😠 Lost:',
      'btn.reset': 'Reset progress', 'reset.confirm': 'Erase all progress, cash and wallet?',
      'dish.burger': 'Burger', 'dish.fries': 'Fries', 'dish.soda': 'Soda', 'dish.steak': 'Steak', 'dish.pizza': 'Pizza',
      'st.grill': 'Grill', 'st.fryer': 'Fryer', 'st.soda': 'Drinks', 'st.pan': 'Pan', 'st.oven': 'Oven',
      'upg.grillSlots': ['Bigger grill', 'More burgers on the grill at once.'], 'upg.grillSpeed': ['Fast grill', 'Burgers cook sooner.'],
      'upg.fryerSlots': ['Second basket', 'Two baskets of fries in the fryer.'], 'upg.fryerSpeed': ['Hot oil', 'Fries fry faster.'],
      'upg.sodaSpeed': ['Pressure tap', 'Sodas pour almost instantly.'], 'upg.panSlots': ['Second pan', 'Two steaks at once.'],
      'upg.passSlots': ['Longer pass', 'More plates waiting on the pass.'], 'upg.neon': ['Neon sign', 'Customers wait 20% longer per level.'],
      'upg.jukebox': ['Jukebox', 'Good vibes: +10% tips per level.'],
      'intro.level': 'Level {n}', 'intro.open': 'We\'re open!', 'intro.shift': 'Shift {n}',
      'intro.text': 'They pay in <b>{coins}</b>. The faster you serve, the bigger the tip; reach {amt} for three stars.',
      'howto.1': 'Tap a <b>tray</b> to start cooking.', 'howto.2': 'When it glows, tap it to move it to the <b>pass</b>.', 'howto.3': 'Tap the <b>customer</b> (or the plate) to serve. If they get bored, they leave.',
      'btn.start': '▶ Start', 'btn.back': 'Back',
      'room.opening': 'Opening up…', 'room.waiting': 'Waiting for customers…',
      'msg.passFull': 'The pass is full!', 'msg.nobody': 'Nobody ordered {dish}', 'msg.missing': 'Still needs {items}', 'msg.burnt': 'Burnt! Tap it to bin it',
      'msg.pump': '🚀 {coin} is pumping! Customers paying in {coin} pay ×2', 'msg.left': 'Walked out 😠',
      'res.win': 'Shift over!', 'res.lose': 'Not quite…', 'res.earned': 'Earned', 'res.goal': 'Goal', 'res.served': 'Served', 'res.nothing': 'Nothing earned',
      'res.lost': ['{n} customer left without paying.', '{n} customers left without paying.'], 'res.burnt': ['{n} dish burnt.', '{n} dishes burnt.'],
      'res.inWallet': 'The takings are already in your wallet.', 'res.tryShop': 'Try an upgrade in the shop and go again.',
      'btn.next': 'Next ▶', 'res.done': '🏆 You\'ve completed the kitchen!', 'btn.retry': '↻ Retry', 'btn.levels': 'Levels',
      'pause.title': 'Paused', 'pause.text': 'The kitchen waits. So do the customers, for once.', 'btn.resume': '▶ Resume', 'btn.quit': 'Quit'
    },
    zh: {
      'title.kicker': '🔥 烹饪 · 边玩边赚', 'title.tag': '顾客进门，你来做菜，他们用加密货币付款。',
      'btn.play': '▶ 开始', 'btn.wallet': '👛 钱包', 'title.balance': '余额：', 'title.walletWord': '钱包',
      'nav.home': '‹ 首页', 'nav.levels': '‹ 关卡', 'h.levels': '关卡', 'h.shop': '商店', 'h.wallet': '钱包', 'btn.shop': '🛒 商店',
      'hud.level': '关卡', 'pass': '出餐口', 'btn.launchpad': '🚀 发射台',
      'shop.note': '升级用你在厨房赚到的美元支付。每一级升级都是永久的。', 'shop.max': '满级',
      'wallet.coin': '币种', 'wallet.amount': '数量', 'wallet.price': '价格', 'wallet.value': '价值',
      'wallet.note': '顾客付的钱会以他们所用的币种保存。价值跟随游戏内自行波动的行情。一切都只保存在你的浏览器里，不会上任何真实的链。',
      'wallet.cash': '💵 现金：', 'wallet.wallet': '🪙 钱包：', 'wallet.served': '🍽️ 已服务：', 'wallet.lost': '😠 流失：',
      'btn.reset': '清除进度', 'reset.confirm': '要清除全部进度、现金和钱包吗？',
      'dish.burger': '汉堡', 'dish.fries': '薯条', 'dish.soda': '汽水', 'dish.steak': '牛排', 'dish.pizza': '披萨',
      'st.grill': '烤架', 'st.fryer': '炸锅', 'st.soda': '饮料机', 'st.pan': '平底锅', 'st.oven': '烤箱',
      'upg.grillSlots': ['大烤架', '同时烤更多汉堡。'], 'upg.grillSpeed': ['快速烤架', '汉堡更快烤好。'],
      'upg.fryerSlots': ['第二个炸篮', '炸锅里可放两篮薯条。'], 'upg.fryerSpeed': ['热油', '薯条炸得更快。'],
      'upg.sodaSpeed': ['高压龙头', '汽水几乎瞬间倒好。'], 'upg.panSlots': ['第二口锅', '同时煎两块牛排。'],
      'upg.passSlots': ['更长的出餐口', '出餐口能放更多盘子。'], 'upg.neon': ['霓虹招牌', '每级顾客多等 20%。'],
      'upg.jukebox': ['点唱机', '气氛好：每级小费 +10%。'],
      'intro.level': '第 {n} 关', 'intro.open': '开业啦！', 'intro.shift': '第 {n} 班',
      'intro.text': '他们用 <b>{coins}</b> 付款。上菜越快小费越多；赚到 {amt} 可获三星。',
      'howto.1': '点<b>托盘</b>开始做菜。', 'howto.2': '菜发光时点它，送到<b>出餐口</b>。', 'howto.3': '点<b>顾客</b>（或盘子）上菜。等烦了他们就走。',
      'btn.start': '▶ 开始', 'btn.back': '返回',
      'room.opening': '正在开门…', 'room.waiting': '等待顾客…',
      'msg.passFull': '出餐口满了！', 'msg.nobody': '没人点{dish}', 'msg.missing': '还缺 {items}', 'msg.burnt': '烧焦了！点一下扔掉',
      'msg.pump': '🚀 {coin} 暴涨中！用 {coin} 付款的顾客付 ×2', 'msg.left': '走了 😠',
      'res.win': '收工！', 'res.lose': '差一点…', 'res.earned': '收入', 'res.goal': '目标', 'res.served': '已服务', 'res.nothing': '没有收入',
      'res.lost': ['{n} 位顾客没付钱就走了。', '{n} 位顾客没付钱就走了。'], 'res.burnt': ['烧焦了 {n} 份。', '烧焦了 {n} 份。'],
      'res.inWallet': '收入已进你的钱包。', 'res.tryShop': '去商店升级一下再试。',
      'btn.next': '下一关 ▶', 'res.done': '🏆 你通关了整个厨房！', 'btn.retry': '↻ 重玩', 'btn.levels': '关卡',
      'pause.title': '暂停', 'pause.text': '厨房在等，顾客这次也在等。', 'btn.resume': '▶ 继续', 'btn.quit': '放弃'
    }
  };
  var LANGS = ['es', 'en', 'zh'];
  var lang = 'es';
  function t(key, vars) {
    var v = (I18N[lang] && I18N[lang][key] !== undefined) ? I18N[lang][key] : I18N.es[key];
    if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
    return v;
  }
  function tn(key, n) { return t(key)[n === 1 ? 0 : 1].replace('{n}', n); }
  function applyLang() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    Array.prototype.forEach.call(document.querySelectorAll('#lang button'), function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === lang); });
  }

  // ---------- data ----------
  var COINS = {
    USDC: { name: 'USD Coin', color: '#2775CA', price: 1.0,   vol: 0.001, mult: 1.0,  sym: '$' },
    DOGE: { name: 'Dogecoin', color: '#C2A633', price: 0.118, vol: 0.05,  mult: 0.9,  sym: 'Ð' },
    SOL:  { name: 'Solana',   color: '#9945FF', price: 142,   vol: 0.03,  mult: 1.1,  sym: '◎' },
    ETH:  { name: 'Ethereum', color: '#627EEA', price: 3180,  vol: 0.02,  mult: 1.2,  sym: 'Ξ' },
    BTC:  { name: 'Bitcoin',  color: '#F7931A', price: 67420, vol: 0.015, mult: 1.6,  sym: '₿' }
  };
  var COIN_KEYS = Object.keys(COINS);

  var DISHES = {
    burger: { em: '🍔',  price: 8,  station: 'grill' },
    fries:  { em: '🍟', price: 5,  station: 'fryer' },
    soda:   { em: '🥤', price: 3, station: 'soda' },
    steak:  { em: '🥩', price: 14, station: 'pan' },
    pizza:  { em: '🍕', price: 12, station: 'oven' }
  };

  // Every station cooks one dish. `burn` is how long a cooked dish survives on
  // the station before it burns; 0 means it never does.
  var STATIONS = {
    grill: { raw: '🍖', em: '🔥', hue: '#F0433C', dish: 'burger', slots: 2, cook: 4200, burn: 5500, wide: true },
    fryer: { raw: '🥔', em: '🧺', hue: '#FFB020', dish: 'fries',  slots: 1, cook: 3200, burn: 6000 },
    soda:  { raw: '🧊', em: '🚰', hue: '#3BC9C4', dish: 'soda',   slots: 1, cook: 1300, burn: 0 },
    pan:   { raw: '🥩', em: '🍳', hue: '#7B4DD8', dish: 'steak',  slots: 1, cook: 5600, burn: 4500 },
    oven:  { raw: '🫓', em: '🔥', hue: '#FF8A1F', dish: 'pizza',  slots: 1, cook: 6500, burn: 5000 }
  };

  // Permanent upgrades, bought in the shop with earned dollars.
  var UPGRADES = [
    { id: 'grillSlots', em: '🍔', hue: '#F0433C', prices: [120, 320], apply: function (u, v) { u.grillSlots = 2 + v; } },
    { id: 'grillSpeed', em: '⚡', hue: '#F0433C', prices: [90, 240], apply: function (u, v) { u.grillCook = [4200, 3300, 2500][v]; } },
    { id: 'fryerSlots', em: '🍟', hue: '#FFB020', prices: [150], apply: function (u, v) { u.fryerSlots = 1 + v; } },
    { id: 'fryerSpeed', em: '🌡️', hue: '#FFB020', prices: [100], apply: function (u, v) { u.fryerCook = [3200, 2200][v]; } },
    { id: 'sodaSpeed', em: '🥤', hue: '#3BC9C4', prices: [60], apply: function (u, v) { u.sodaCook = [1300, 500][v]; } },
    { id: 'panSlots', em: '🥩', hue: '#7B4DD8', prices: [220], apply: function (u, v) { u.panSlots = 1 + v; } },
    { id: 'passSlots', em: '🍽️', hue: '#3BC9C4', prices: [80, 180], apply: function (u, v) { u.passSlots = 4 + v; } },
    { id: 'neon', em: '🪩', hue: '#FF5DA2', prices: [130, 260], apply: function (u, v) { u.patience = 1 + v * 0.2; } },
    { id: 'jukebox', em: '🎵', hue: '#7B4DD8', prices: [160, 300], apply: function (u, v) { u.tip = v * 0.1; } }
  ];

  // Levels: cash goal, seconds on the clock, which dishes are on the menu,
  // how big an order can be, how often customers arrive, how long they wait,
  // and which coins they carry (repeated entries weight the draw).
  var LEVELS = [
    { goal: 50,  time: 60,  dishes: ['burger', 'soda'],                            maxOrder: 1, spawn: [2900, 4000], patience: 20000, coins: ['USDC', 'USDC', 'DOGE'], maxCust: 3 },
    { goal: 100, time: 70,  dishes: ['burger', 'fries', 'soda'],                   maxOrder: 2, spawn: [2800, 3900], patience: 18000, coins: ['USDC', 'DOGE', 'DOGE', 'SOL'], maxCust: 3 },
    { goal: 170, time: 80,  dishes: ['burger', 'fries', 'soda'],                   maxOrder: 2, spawn: [2500, 3600], patience: 16000, coins: ['USDC', 'DOGE', 'SOL', 'SOL', 'ETH'], maxCust: 4 },
    { goal: 240, time: 90,  dishes: ['burger', 'fries', 'soda', 'steak'],          maxOrder: 2, spawn: [2400, 3400], patience: 16000, coins: ['DOGE', 'SOL', 'SOL', 'ETH', 'ETH'], maxCust: 4 },
    { goal: 330, time: 90,  dishes: ['burger', 'fries', 'soda', 'steak'],          maxOrder: 3, spawn: [2200, 3200], patience: 15000, coins: ['DOGE', 'SOL', 'ETH', 'ETH', 'BTC'], maxCust: 4 },
    { goal: 450, time: 100, dishes: ['burger', 'fries', 'soda', 'steak', 'pizza'], maxOrder: 3, spawn: [2000, 3000], patience: 15000, coins: ['SOL', 'SOL', 'ETH', 'BTC', 'BTC'], maxCust: 4 },
    { goal: 560, time: 100, dishes: ['burger', 'fries', 'soda', 'steak', 'pizza'], maxOrder: 3, spawn: [1900, 2800], patience: 14000, coins: ['DOGE', 'SOL', 'ETH', 'BTC', 'BTC'], maxCust: 4 },
    { goal: 700, time: 110, dishes: ['burger', 'fries', 'soda', 'steak', 'pizza'], maxOrder: 3, spawn: [1700, 2600], patience: 14000, coins: ['SOL', 'ETH', 'ETH', 'BTC', 'BTC'], maxCust: 4 },
    { goal: 850, time: 110, dishes: ['burger', 'fries', 'soda', 'steak', 'pizza'], maxOrder: 3, spawn: [1600, 2400], patience: 13000, coins: ['ETH', 'BTC', 'BTC', 'BTC'], maxCust: 4 },
    { goal: 1050, time: 120, dishes: ['burger', 'fries', 'soda', 'steak', 'pizza'], maxOrder: 3, spawn: [1500, 2200], patience: 12500, coins: ['ETH', 'BTC', 'BTC', 'BTC'], maxCust: 4 }
  ];
  var FACES = ['😀', '😺', '🤠', '🧑', '👵', '👦', '🧔', '👩', '🤖', '👽', '🦊', '🐼', '🧙', '👸', '🥷', '🧑‍🚀'];
  var FACE_COLORS = ['#FFB020', '#FF5DA2', '#3BC9C4', '#7B4DD8', '#4BE04A', '#FF8A1F'];

  // ---------- save ----------
  var DEFAULT_SAVE = { cash: 0, wallet: {}, stars: [], upg: {}, served: 0, lost: 0, sound: true, lang: '' };
  var save = load('ck-game', null) || JSON.parse(JSON.stringify(DEFAULT_SAVE));
  function persist() { store('ck-game', save); }
  (function () {
    var q = (location.search.match(/[?&]lang=(\w+)/) || [])[1];
    var nav = (navigator.language || 'es').toLowerCase();
    lang = LANGS.indexOf(q) !== -1 ? q : LANGS.indexOf(save.lang) !== -1 ? save.lang : nav.indexOf('zh') === 0 ? 'zh' : nav.indexOf('es') === 0 ? 'es' : 'en';
    save.lang = lang;
    applyLang();
  })();
  $('#lang').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (!b) return;
    lang = b.getAttribute('data-lang'); save.lang = lang; persist(); applyLang(); go('title');
  });

  // the numbers the upgrades produce, recomputed from `save.upg`
  var U = {};
  function applyUpgrades() {
    U = { grillSlots: 2, grillCook: 4200, fryerSlots: 1, fryerCook: 3200, sodaCook: 1300, panSlots: 1, passSlots: 4, patience: 1, tip: 0 };
    UPGRADES.forEach(function (up) { up.apply(U, save.upg[up.id] || 0); });
  }
  applyUpgrades();

  function money(n) {
    return '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function coinAmount(n) {
    if (n === 0) return '0';
    if (n >= 100) return n.toFixed(1);
    if (n >= 1) return n.toFixed(3);
    return n.toFixed(n >= 0.01 ? 4 : 6);
  }
  function walletValue() {
    var total = 0;
    COIN_KEYS.forEach(function (k) { total += (save.wallet[k] || 0) * market[k]; });
    return total;
  }

  // ---------- sound: a handful of oscillator blips ----------
  var actx = null;
  function beep(freq, dur, type, vol) {
    if (!save.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.05, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) { /* no audio */ }
  }
  var SFX = {
    tap: function () { beep(520, 0.06, 'square', 0.03); },
    ready: function () { beep(880, 0.12, 'triangle', 0.05); setTimeout(function () { beep(1320, 0.12, 'triangle', 0.05); }, 90); },
    plate: function () { beep(660, 0.08, 'sine', 0.05); },
    pay: function () { [880, 1100, 1320, 1760].forEach(function (f, i) { setTimeout(function () { beep(f, 0.12, 'triangle', 0.05); }, i * 70); }); },
    burn: function () { beep(140, 0.3, 'sawtooth', 0.06); },
    leave: function () { beep(300, 0.2, 'sawtooth', 0.04); setTimeout(function () { beep(220, 0.25, 'sawtooth', 0.04); }, 120); },
    pump: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { beep(f, 0.15, 'square', 0.04); }, i * 80); }); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { beep(f, 0.25, 'triangle', 0.06); }, i * 120); }); },
    lose: function () { [400, 350, 300, 200].forEach(function (f, i) { setTimeout(function () { beep(f, 0.3, 'sawtooth', 0.04); }, i * 160); }); }
  };

  // ---------- stage scaling ----------
  var stage = $('#stage');
  function fit() {
    var portrait = window.innerWidth < window.innerHeight * 0.95;
    var W = portrait ? 480 : 960, H = portrait ? 820 : 640;
    stage.classList.toggle('portrait', portrait);
    var s = Math.min(window.innerWidth / W, window.innerHeight / H);
    stage.style.width = W + 'px'; stage.style.height = H + 'px';
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  fit();

  // ---------- screens ----------
  function go(name) {
    Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (s) { s.classList.remove('is-on'); });
    $('#s-' + name).classList.add('is-on');
    if (name === 'title') $('#titleBalance').textContent = money(save.cash) + ' · ' + t('title.walletWord') + ' ' + money(walletValue());
    if (name === 'map') renderMap();
    if (name === 'shop') renderShop();
    if (name === 'wallet') renderWallet();
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go]');
    if (!t) return;
    SFX.tap();
    go(t.getAttribute('data-go'));
  });

  // ---------- market: prices drift; now and then a coin pumps ----------
  var market = {};
  COIN_KEYS.forEach(function (k) { market[k] = COINS[k].price; });
  var pump = null; // { coin, until }
  function tickMarket(now) {
    COIN_KEYS.forEach(function (k) {
      var c = COINS[k];
      market[k] = Math.max(c.price * 0.5, market[k] * (1 + (Math.random() - 0.5) * c.vol * 0.6));
    });
    if (pump && now > pump.until) pump = null;
    renderMarket();
  }
  function renderMarket() {
    $('#market').innerHTML = COIN_KEYS.map(function (k) {
      var chg = (market[k] / COINS[k].price - 1) * 100;
      var isPump = pump && pump.coin === k;
      return '<span class="mk' + (isPump ? ' pump' : '') + '" style="--c:' + COINS[k].color + '"><span class="sym">' + k + '</span>' +
        (isPump ? '🚀 ×2' : '<span class="chg ' + (chg >= 0 ? 'up' : 'down') + '">' + (chg >= 0 ? '+' : '') + chg.toFixed(1) + '%</span>') + '</span>';
    }).join('');
  }

  // ---------- the game ----------
  var G = null; // the running level
  var levelIndex = 0;
  var els = {
    hLevel: $('#hLevel'), hTime: $('#hTime'), hCash: $('#hCash'), goalFill: $('#hGoalFill'), goalText: $('#hGoalText'), goalBar: $('.goal-bar'),
    timePill: $('.pill-time'), customers: $('#customers'), pass: $('#pass'), kitchen: $('#kitchen'), fx: $('#fx'), banner: $('#banner'),
    overlay: $('#gOverlay'), overlayCard: $('#overlayCard')
  };

  function stationSlots(id) {
    return id === 'grill' ? U.grillSlots : id === 'fryer' ? U.fryerSlots : id === 'pan' ? U.panSlots : STATIONS[id].slots;
  }
  function stationCook(id) {
    return id === 'grill' ? U.grillCook : id === 'fryer' ? U.fryerCook : id === 'soda' ? U.sodaCook : STATIONS[id].cook;
  }

  function buildKitchen(level) {
    els.kitchen.innerHTML = '';
    G.stations = {};
    var ids = Object.keys(STATIONS).filter(function (id) { return level.dishes.indexOf(STATIONS[id].dish) !== -1; });
    els.kitchen.setAttribute('data-n', ids.length);
    ids.forEach(function (id) {
      var st = STATIONS[id], dish = DISHES[st.dish], n = stationSlots(id);
      var el = document.createElement('div');
      el.className = 'station' + (st.wide ? ' wide' : '');
      el.setAttribute('data-id', id);
      el.style.setProperty('--hue', st.hue);
      var slots = '';
      for (var i = 0; i < n; i++) slots += '<div class="slot" data-i="' + i + '"><span class="food">' + dish.em + '</span><div class="bar-track"><i></i></div></div>';
      el.innerHTML =
        '<div class="station-head">' + st.em + ' ' + t('st.' + id) + ' <small>' + (stationCook(id) / 1000).toFixed(1) + 's</small></div>' +
        '<div class="slots">' + slots + '</div>' +
        '<button class="tray" type="button"><span class="em">' + st.raw + st.raw + st.raw + '</span>' + t('dish.' + st.dish) + ' <span class="price">' + money(dish.price) + '</span></button>';
      els.kitchen.appendChild(el);
      G.stations[id] = { id: id, el: el, slots: [], cook: stationCook(id), burn: st.burn, dish: st.dish };
      for (var j = 0; j < n; j++) G.stations[id].slots.push({ state: 'empty', el: el.querySelectorAll('.slot')[j], t: 0 });
    });
    G.passSlots = U.passSlots;
    G.pass = [];
    renderPass();
  }

  function startLevel(i) {
    levelIndex = i;
    var L = LEVELS[i];
    G = { L: L, elapsed: 0, earned: 0, served: 0, lost: 0, burnt: 0, customers: [], spawnIn: 900, last: 0, raf: 0, paused: false, marketAt: 0, pumpAt: 12000 + Math.random() * 8000, shown: -1, coinsEarned: {}, ended: false };
    els.customers.innerHTML = '<span class="room-empty">' + t('room.opening') + '</span>';
    buildKitchen(L);
    els.hLevel.textContent = i + 1;
    els.hTime.textContent = L.time;
    els.timePill.classList.remove('low');
    pump = null;
    renderMarket();
    updateHud();
    go('game');
    showIntro(L, i);
  }

  function showIntro(L, i) {
    var menu = L.dishes.map(function (d) { return DISHES[d].em; }).join(' ');
    var coins = L.coins.filter(function (c, k, a) { return a.indexOf(c) === k; }).join(' · ');
    var howto = i === 0 ?
      '<div class="howto">' +
      '<div><span>🍔</span>' + t('howto.1') + '</div>' +
      '<div><span>🍽️</span>' + t('howto.2') + '</div>' +
      '<div><span>😀</span>' + t('howto.3') + '</div>' +
      '</div>' : '';
    els.overlayCard.innerHTML =
      '<span class="kicker">' + t('intro.level', { n: i + 1 }) + '</span>' +
      '<h3 class="display">' + (i === 0 ? t('intro.open') : t('intro.shift', { n: i + 1 })) + '</h3>' +
      '<div class="goal-line"><span class="pill pill-gold">🎯 ' + money(L.goal) + '</span><span class="pill">⏱ ' + L.time + 's</span><span class="pill">' + menu + '</span></div>' +
      '<p>' + t('intro.text', { coins: coins, amt: money(L.goal * 1.6) }) + '</p>' +
      howto +
      '<div class="btns"><button class="btn btn-green btn-xl" id="btnGo" type="button">' + t('btn.start') + '</button><button class="btn btn-cream btn-sm" data-go="map" type="button">' + t('btn.back') + '</button></div>';
    els.overlay.hidden = false;
    $('#btnGo').addEventListener('click', function () {
      SFX.tap();
      els.overlay.hidden = true;
      els.customers.innerHTML = '';
      G.last = performance.now();
      G.raf = requestAnimationFrame(tick);
    });
  }

  // customers
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function spawnCustomer() {
    var L = G.L;
    if (G.customers.length >= L.maxCust) return;
    var n = 1 + Math.floor(Math.random() * L.maxOrder);
    if (G.elapsed < 8 && levelIndex === 0) n = 1;
    var items = [];
    for (var i = 0; i < n; i++) items.push(pick(L.dishes));
    var coin = pick(L.coins);
    var whale = coin === 'BTC';
    var patience = L.patience * U.patience * (whale ? 0.85 : 1);
    var base = items.reduce(function (s, d) { return s + DISHES[d].price; }, 0);

    var el = document.createElement('div');
    el.className = 'cust';
    el.innerHTML =
      '<div class="cust-order"><div class="items">' + items.map(function (d) { return '<span class="it" data-d="' + d + '">' + DISHES[d].em + '</span>'; }).join('') + '</div>' +
      '<span class="cust-pay' + (whale ? ' whale' : '') + '" style="--c:' + COINS[coin].color + '">' + (whale ? '🐋 ' : '') + coin + '</span></div>' +
      '<div class="cust-patience"><i></i></div>' +
      '<div class="cust-face" style="--face:' + pick(FACE_COLORS) + '">' + pick(FACES) + '</div>';
    var empty = els.customers.querySelector('.room-empty');
    if (empty) empty.remove();
    els.customers.appendChild(el);

    var c = { el: el, items: items, pending: items.slice(), coin: coin, whale: whale, born: G.elapsed * 1000, patience: patience, base: base, bar: el.querySelector('.cust-patience i') };
    el.addEventListener('click', function () { serveCustomer(c); });
    G.customers.push(c);
  }
  function removeCustomer(c, cls) {
    G.customers = G.customers.filter(function (x) { return x !== c; });
    c.el.classList.add(cls);
    setTimeout(function () {
      c.el.remove();
      if (G && G.customers.length === 0 && !els.customers.querySelector('.cust')) els.customers.innerHTML = '<span class="room-empty">' + t('room.waiting') + '</span>';
    }, 500);
  }

  // stations
  function startCooking(id) {
    var st = G.stations[id];
    var slot = null;
    for (var i = 0; i < st.slots.length; i++) if (st.slots[i].state === 'empty') { slot = st.slots[i]; break; }
    if (!slot) { st.el.querySelector('.tray').classList.add('full'); setTimeout(function () { st.el.querySelector('.tray').classList.remove('full'); }, 250); return; }
    SFX.tap();
    slot.state = 'cooking'; slot.t = G.elapsed * 1000;
    slot.el.className = 'slot cooking';
  }
  function tapSlot(id, i) {
    var st = G.stations[id], slot = st.slots[i];
    if (slot.state === 'ready') {
      if (G.pass.length >= G.passSlots) { flashBanner(t('msg.passFull')); return; }
      slot.state = 'empty'; slot.el.className = 'slot'; slot.el.querySelector('.bar-track i').style.width = '0';
      G.pass.push(st.dish);
      SFX.plate();
      renderPass(true);
      autoHint();
    } else if (slot.state === 'burnt') {
      slot.state = 'empty'; slot.el.className = 'slot'; slot.el.querySelector('.bar-track i').style.width = '0';
      SFX.tap();
    } else if (slot.state === 'empty') {
      startCooking(id);
    }
  }
  els.kitchen.addEventListener('click', function (e) {
    if (!G || G.paused || G.ended) return;
    var tray = e.target.closest('.tray');
    if (tray) { startCooking(tray.closest('.station').getAttribute('data-id')); return; }
    var slot = e.target.closest('.slot');
    if (slot) tapSlot(slot.closest('.station').getAttribute('data-id'), +slot.getAttribute('data-i'));
  });

  // the pass
  function renderPass(popLast) {
    var html = '';
    for (var i = 0; i < G.passSlots; i++) {
      var d = G.pass[i];
      html += '<div class="plate' + (d && popLast && i === G.pass.length - 1 ? ' landed' : '') + '" data-i="' + i + '">' + (d ? DISHES[d].em : '') + '</div>';
    }
    els.pass.innerHTML = html;
    autoHint();
  }
  els.pass.addEventListener('click', function (e) {
    if (!G || G.paused || G.ended) return;
    var plate = e.target.closest('.plate');
    if (!plate) return;
    var i = +plate.getAttribute('data-i');
    var dish = G.pass[i];
    if (!dish) return;
    // first customer, in order of arrival, still waiting for this dish
    for (var k = 0; k < G.customers.length; k++) {
      if (G.customers[k].pending.indexOf(dish) !== -1) { G.pass.splice(i, 1); giveDish(G.customers[k], dish); renderPass(); return; }
    }
    flashBanner(t('msg.nobody', { dish: DISHES[dish].em + ' ' + t('dish.' + dish) }));
  });

  // serving
  function serveCustomer(c) {
    if (!G || G.paused || G.ended || c.pending.length === 0) return;
    var given = 0;
    c.pending.slice().forEach(function (d) {
      var i = G.pass.indexOf(d);
      if (i !== -1) { G.pass.splice(i, 1); giveDish(c, d); given++; }
    });
    if (given) renderPass();
    else { SFX.tap(); flashBanner(t('msg.missing', { items: c.pending.map(function (d) { return DISHES[d].em; }).join(' ') })); }
  }
  function giveDish(c, dish) {
    c.pending.splice(c.pending.indexOf(dish), 1);
    var its = c.el.querySelectorAll('.cust-order .it');
    for (var j = 0; j < its.length; j++) {
      if (its[j].getAttribute('data-d') === dish && !its[j].classList.contains('done')) { its[j].classList.add('done'); break; }
    }
    if (c.pending.length === 0) pay(c);
    else SFX.plate();
  }
  function pay(c) {
    var left = Math.max(0, 1 - (G.elapsed * 1000 - c.born) / c.patience);
    var tipRate = (left > 0.6 ? 0.3 : left > 0.3 ? 0.15 : 0) + U.tip;
    var mult = COINS[c.coin].mult * (pump && pump.coin === c.coin ? 2 : 1);
    var usd = c.base * mult;
    var tip = Math.round(usd * tipRate * 100) / 100;
    var total = Math.round((usd + tip) * 100) / 100;
    var amount = total / market[c.coin];

    G.earned += total;
    G.served += 1;
    G.coinsEarned[c.coin] = (G.coinsEarned[c.coin] || 0) + amount;
    save.wallet[c.coin] = (save.wallet[c.coin] || 0) + amount;
    save.cash += total;
    save.served += 1;

    var r = c.el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    var x = (r.left + r.width / 2 - s.left) / s.width * stage.offsetWidth;
    var y = (r.top + r.height / 2 - s.top) / s.height * stage.offsetHeight;
    popText('+' + money(total) + (tip ? ' 🤑' : ''), x, y - 20, '');
    popText('+' + coinAmount(amount) + ' ' + c.coin, x, y + 8, 'coin');
    flyCoins(x, y, c.whale ? 6 : 3);
    SFX.pay();
    removeCustomer(c, 'paid');
    updateHud();
  }

  // hints: light up plates a customer wants and customers who can be served
  function autoHint() {
    var wanted = {};
    G.customers.forEach(function (c) { c.pending.forEach(function (d) { wanted[d] = true; }); });
    Array.prototype.forEach.call(els.pass.querySelectorAll('.plate'), function (p, i) { p.classList.toggle('wanted', !!(G.pass[i] && wanted[G.pass[i]])); });
    G.customers.forEach(function (c) {
      var can = c.pending.some(function (d) { return G.pass.indexOf(d) !== -1; });
      c.el.classList.toggle('can-serve', can);
    });
  }

  // fx
  function popText(text, x, y, cls) {
    var el = document.createElement('span');
    el.className = 'pop ' + (cls || '');
    el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    els.fx.appendChild(el);
    setTimeout(function () { el.remove(); }, 1200);
  }
  function flyCoins(x, y, n) {
    var target = els.hCash.getBoundingClientRect(), s = stage.getBoundingClientRect();
    var tx = (target.left + target.width / 2 - s.left) / s.width * stage.offsetWidth;
    var ty = (target.top + target.height / 2 - s.top) / s.height * stage.offsetHeight;
    for (var i = 0; i < n; i++) {
      (function (i) {
        setTimeout(function () {
          var el = document.createElement('i');
          el.className = 'coin fly';
          var ox = x + (Math.random() - 0.5) * 40, oy = y + (Math.random() - 0.5) * 20;
          el.style.left = ox + 'px'; el.style.top = oy + 'px';
          el.style.setProperty('--dx', (tx - ox) + 'px'); el.style.setProperty('--dy', (ty - oy) + 'px');
          els.fx.appendChild(el);
          setTimeout(function () { el.remove(); }, 750);
        }, i * 60);
      })(i);
    }
  }
  var bannerTimer = 0;
  function flashBanner(text, ms) {
    els.banner.textContent = text;
    els.banner.classList.remove('show');
    void els.banner.offsetWidth;
    els.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { els.banner.classList.remove('show'); }, ms || 1400);
  }

  function updateHud() {
    var L = G.L;
    var p = Math.min(100, G.earned / L.goal * 100);
    els.goalFill.style.width = p + '%';
    els.goalBar.classList.toggle('met', G.earned >= L.goal);
    els.goalText.textContent = money(G.earned) + ' / ' + money(L.goal) + (G.earned >= L.goal * 1.6 ? ' ★★★' : G.earned >= L.goal * 1.3 ? ' ★★' : G.earned >= L.goal ? ' ★' : '');
    els.hCash.textContent = money(save.cash);
  }

  // the loop
  function tick(now) {
    if (!G || G.paused || G.ended) return;
    var dt = Math.min(100, now - G.last);
    G.last = now;
    G.elapsed += dt / 1000;
    var ms = G.elapsed * 1000;
    var L = G.L;

    // clock
    var left = Math.max(0, Math.ceil(L.time - G.elapsed));
    if (left !== G.shown) { G.shown = left; els.hTime.textContent = left; els.timePill.classList.toggle('low', left <= 10); }

    // customers arrive
    G.spawnIn -= dt;
    if (G.spawnIn <= 0) {
      spawnCustomer();
      G.spawnIn = L.spawn[0] + Math.random() * (L.spawn[1] - L.spawn[0]);
    }

    // patience
    G.customers.slice().forEach(function (c) {
      var p = 1 - (ms - c.born) / c.patience;
      c.bar.style.width = Math.max(0, p * 100) + '%';
      c.el.classList.toggle('hurry', p < 0.5 && p >= 0.25);
      c.el.classList.toggle('angry', p < 0.25);
      if (p <= 0) {
        G.lost += 1; save.lost += 1;
        var r = c.el.getBoundingClientRect(), s = stage.getBoundingClientRect();
        popText(t('msg.left'), (r.left + r.width / 2 - s.left) / s.width * stage.offsetWidth, (r.top + r.height / 2 - s.top) / s.height * stage.offsetHeight, 'bad');
        SFX.leave();
        removeCustomer(c, 'leaving');
        autoHint();
      }
    });

    // stations
    Object.keys(G.stations).forEach(function (id) {
      var st = G.stations[id];
      st.slots.forEach(function (slot) {
        if (slot.state === 'cooking') {
          var p = (ms - slot.t) / st.cook;
          slot.el.querySelector('.bar-track i').style.width = Math.min(100, p * 100) + '%';
          if (p >= 1) { slot.state = 'ready'; slot.t = ms; slot.el.className = 'slot ready'; SFX.ready(); }
        } else if (slot.state === 'ready' && st.burn) {
          var q = 1 - (ms - slot.t) / st.burn;
          slot.el.querySelector('.bar-track i').style.width = Math.max(0, q * 100) + '%';
          slot.el.classList.toggle('soon', q < 0.35);
          if (q <= 0) { slot.state = 'burnt'; slot.el.className = 'slot burnt'; G.burnt += 1; SFX.burn(); flashBanner(t('msg.burnt')); }
        }
      });
    });

    // market
    if (ms - G.marketAt > 2000) { G.marketAt = ms; tickMarket(ms); }
    if (!pump && ms > G.pumpAt) {
      var candidates = L.coins.filter(function (c, k, a) { return a.indexOf(c) === k && c !== 'USDC'; });
      if (candidates.length) {
        pump = { coin: pick(candidates), until: ms + 9000 };
        flashBanner(t('msg.pump', { coin: pump.coin }), 2600);
        SFX.pump();
        renderMarket();
      }
      G.pumpAt = ms + 18000 + Math.random() * 12000;
    }

    if (G.elapsed >= L.time) { endLevel(); return; }
    G.raf = requestAnimationFrame(tick);
  }

  function endLevel() {
    G.ended = true;
    cancelAnimationFrame(G.raf);
    var L = G.L, i = levelIndex;
    var stars = G.earned >= L.goal * 1.6 ? 3 : G.earned >= L.goal * 1.3 ? 2 : G.earned >= L.goal ? 1 : 0;
    save.stars[i] = Math.max(save.stars[i] || 0, stars);
    persist();
    (stars ? SFX.win : SFX.lose)();

    var coins = Object.keys(G.coinsEarned).map(function (k) { return '<span style="border-color:' + COINS[k].color + '">' + coinAmount(G.coinsEarned[k]) + ' ' + k + '</span>'; }).join('');
    var hasNext = i + 1 < LEVELS.length;
    els.overlayCard.innerHTML =
      '<span class="big-emoji">' + (stars === 3 ? '🤑' : stars ? '😋' : '😅') + '</span>' +
      '<h3 class="display">' + (stars ? t('res.win') : t('res.lose')) + '</h3>' +
      '<div class="result-stars">' + '★'.repeat(stars) + '<i>' + '★'.repeat(3 - stars) + '</i></div>' +
      '<div class="result-grid"><div>' + t('res.earned') + '<b>' + money(G.earned) + '</b></div><div>' + t('res.goal') + '<b>' + money(L.goal) + '</b></div><div>' + t('res.served') + '<b>' + G.served + '</b></div></div>' +
      '<div class="result-coins">' + (coins || '<span>' + t('res.nothing') + '</span>') + '</div>' +
      '<p style="margin-top:8px">' + (G.lost ? tn('res.lost', G.lost) + ' ' : '') + (G.burnt ? tn('res.burnt', G.burnt) + ' ' : '') + (stars ? t('res.inWallet') : t('res.tryShop')) + '</p>' +
      '<div class="btns">' +
      (stars && hasNext ? '<button class="btn btn-green btn-xl" id="btnNext" type="button">' + t('btn.next') + '</button>' : '') +
      (stars && !hasNext ? '<span class="pill pill-gold">' + t('res.done') + '</span>' : '') +
      '<button class="btn ' + (stars ? 'btn-cream' : 'btn-green btn-xl') + '" id="btnRetry" type="button">' + t('btn.retry') + '</button>' +
      '<button class="btn btn-gold" data-go="shop" type="button">' + t('btn.shop') + '</button>' +
      '<button class="btn btn-cream btn-sm" data-go="map" type="button">' + t('btn.levels') + '</button>' +
      '</div>';
    els.overlay.hidden = false;
    var next = $('#btnNext');
    if (next) next.addEventListener('click', function () { SFX.tap(); startLevel(i + 1); });
    $('#btnRetry').addEventListener('click', function () { SFX.tap(); startLevel(i); });
  }

  // pause
  function pause() {
    if (!G || G.paused || G.ended || !els.overlay.hidden) return;
    G.paused = true;
    cancelAnimationFrame(G.raf);
    els.overlayCard.innerHTML =
      '<span class="big-emoji">⏸</span><h3 class="display">' + t('pause.title') + '</h3><p>' + t('pause.text') + '</p>' +
      '<div class="btns"><button class="btn btn-green btn-xl" id="btnResume" type="button">' + t('btn.resume') + '</button><button class="btn btn-cream btn-sm" id="btnQuit" type="button">' + t('btn.quit') + '</button></div>';
    els.overlay.hidden = false;
    $('#btnResume').addEventListener('click', resume);
    $('#btnQuit').addEventListener('click', function () { SFX.tap(); G.ended = true; els.overlay.hidden = true; go('map'); });
  }
  function resume() {
    SFX.tap();
    els.overlay.hidden = true;
    G.paused = false;
    G.last = performance.now();
    G.raf = requestAnimationFrame(tick);
  }
  $('#btnPause').addEventListener('click', pause);
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'p') { if (G && G.paused) resume(); else pause(); }
    if (!G || G.paused || G.ended) return;
    // 1–5 start cooking on the nth station; space serves the first customer that can be served
    var n = parseInt(e.key, 10);
    var ids = Object.keys(G.stations);
    if (n >= 1 && n <= ids.length) startCooking(ids[n - 1]);
    if (e.key === ' ') {
      e.preventDefault();
      for (var i = 0; i < G.customers.length; i++) if (G.customers[i].el.classList.contains('can-serve')) { serveCustomer(G.customers[i]); break; }
    }
  });

  // sound toggle
  var btnSound = $('#btnSound');
  function renderSound() { btnSound.textContent = save.sound ? '🔊' : '🔇'; }
  btnSound.addEventListener('click', function () { save.sound = !save.sound; persist(); renderSound(); SFX.tap(); });
  renderSound();

  // ---------- map ----------
  function renderMap() {
    $('#mapBalance').textContent = money(save.cash);
    var unlocked = 0;
    while (unlocked < LEVELS.length - 1 && (save.stars[unlocked] || 0) > 0) unlocked++;
    $('#mapGrid').innerHTML = LEVELS.map(function (L, i) {
      var st = save.stars[i] || 0, locked = i > unlocked, next = i === unlocked;
      return '<div class="card level-card' + (locked ? ' locked' : '') + (next ? ' next' : '') + '" data-level="' + i + '">' +
        '<span class="level-num">' + (locked ? '🔒' : (i + 1)) + '</span>' +
        '<span class="level-stars">' + '★'.repeat(st) + '<i>' + '★'.repeat(3 - st) + '</i></span>' +
        '<h3>' + money(L.goal) + '</h3><small>' + L.time + 's · ' + L.coins.filter(function (c, k, a) { return a.indexOf(c) === k; }).join(' ') + '</small>' +
        '<span class="lv-dishes">' + L.dishes.map(function (d) { return DISHES[d].em; }).join('') + '</span>' +
        '</div>';
    }).join('');
  }
  $('#mapGrid').addEventListener('click', function (e) {
    var card = e.target.closest('.level-card');
    if (!card || card.classList.contains('locked')) return;
    SFX.tap();
    startLevel(+card.getAttribute('data-level'));
  });

  // ---------- shop ----------
  function renderShop() {
    $('#shopBalance').textContent = money(save.cash);
    $('#shopGrid').innerHTML = UPGRADES.map(function (up) {
      var lv = save.upg[up.id] || 0, max = up.prices.length, maxed = lv >= max;
      var price = maxed ? 0 : up.prices[lv];
      var dots = '';
      for (var i = 0; i < max; i++) dots += '<i class="' + (i < lv ? 'on' : '') + '"></i>';
      return '<div class="card upg' + (maxed ? ' maxed' : '') + '" style="--hue:' + up.hue + '">' +
        '<span class="upg-em">' + up.em + '</span>' +
        '<div><h3>' + t('upg.' + up.id)[0] + '</h3><p>' + t('upg.' + up.id)[1] + '</p><div class="upg-lv">' + dots + '</div></div>' +
        (maxed ? '<span class="pill">' + t('shop.max') + '</span>' : '<button class="btn btn-gold btn-sm" data-buy="' + up.id + '" type="button"' + (save.cash < price ? ' disabled' : '') + '>' + money(price) + '</button>') +
        '</div>';
    }).join('');
  }
  $('#shopGrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-buy]');
    if (!b || b.disabled) return;
    var up = UPGRADES.filter(function (u) { return u.id === b.getAttribute('data-buy'); })[0];
    var lv = save.upg[up.id] || 0;
    var price = up.prices[lv];
    if (save.cash < price) return;
    save.cash -= price;
    save.upg[up.id] = lv + 1;
    applyUpgrades();
    persist();
    SFX.pay();
    renderShop();
  });

  // ---------- wallet ----------
  function renderWallet() {
    $('#walletBalance').textContent = money(save.cash);
    $('#walletRows').innerHTML = COIN_KEYS.map(function (k) {
      var amt = save.wallet[k] || 0;
      return '<tr><td><span class="sym"><i style="--c:' + COINS[k].color + '">' + COINS[k].sym + '</i>' + k + ' <small style="color:#6B4A33;font-weight:700">' + COINS[k].name + '</small></span></td>' +
        '<td class="num">' + coinAmount(amt) + '</td><td class="num">' + money(market[k]) + '</td><td class="num"><b>' + money(amt * market[k]) + '</b></td></tr>';
    }).join('');
    var stars = save.stars.reduce(function (s, n) { return s + (n || 0); }, 0);
    $('#walletStats').innerHTML = '<span>' + t('wallet.cash') + ' <b>' + money(save.cash) + '</b></span><span>' + t('wallet.wallet') + ' <b>' + money(walletValue()) + '</b></span><span>' + t('wallet.served') + ' <b>' + save.served + '</b></span><span>' + t('wallet.lost') + ' <b>' + save.lost + '</b></span><span>⭐ ' + stars + '/' + LEVELS.length * 3 + '</span>';
  }
  $('#btnReset').addEventListener('click', function () {
    if (!window.confirm(t('reset.confirm'))) return;
    save = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    save.lang = lang;
    applyUpgrades();
    persist();
    renderWallet();
    renderSound();
  });

  go('title');
})();
