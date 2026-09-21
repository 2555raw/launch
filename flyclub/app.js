/* ============================================================
   NEUROCLUB — the digitized fly behind the bar
   数字果蝇 · 吧台之夜
   Vanilla JS. Beat, lights and sound are all generated here.
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const STORE = 'neuroclub.v1';
  const BPM = 124;
  const SPB = 60 / BPM;

  /* ---------------------------------------------------------
     1. Drinks
     --------------------------------------------------------- */
  const DRINKS = [
    { id: 'beer',     en: 'Beer',     zh: '啤酒',   tip: 8,  color: '#ffd166', key: '1' },
    { id: 'shot',     en: 'Shot',     zh: '烈酒',   tip: 6,  color: '#ff2d6f', key: '2' },
    { id: 'cocktail', en: 'Cocktail', zh: '鸡尾酒', tip: 14, color: '#4ce3ff', key: '3' },
    { id: 'martini',  en: 'Martini',  zh: '马天尼', tip: 12, color: '#2fe3a0', key: '4' }
  ];
  const drinkOf = (id) => DRINKS.filter((d) => d.id === id)[0];

  // Cada vaso se dibuja con un <g class="liq"> que se llena al servir.
  function drinkSVG(id, color) {
    const c = color;
    if (id === 'beer') {
      return '<svg viewBox="0 0 40 50"><g>' +
        '<path d="M8 8h20v36a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill="rgba(255,255,255,.1)" stroke="' + c + '" stroke-width="2"/>' +
        '<path d="M28 14h5a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-5" fill="none" stroke="' + c + '" stroke-width="2"/>' +
        '<g class="liq"><rect x="10" y="18" width="16" height="28" rx="2" fill="' + c + '" opacity=".75"/></g>' +
        '<ellipse cx="18" cy="10" rx="10" ry="5" fill="#fff" opacity=".85"/>' +
        '<circle cx="12" cy="7" r="4" fill="#fff" opacity=".9"/><circle cx="24" cy="7" r="3.4" fill="#fff" opacity=".9"/>' +
        '</g></svg>';
    }
    if (id === 'shot') {
      return '<svg viewBox="0 0 40 50"><g>' +
        '<path d="M11 20h18l-2.5 24a3 3 0 0 1-3 2.6h-7a3 3 0 0 1-3-2.6z" fill="rgba(255,255,255,.1)" stroke="' + c + '" stroke-width="2"/>' +
        '<g class="liq"><path d="M13 26h14l-2 18h-10z" fill="' + c + '" opacity=".85"/></g>' +
        '<path d="M9 17h22" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="20" cy="12" r="3" fill="#fff" opacity=".7"/>' +
        '</g></svg>';
    }
    if (id === 'cocktail') {
      return '<svg viewBox="0 0 40 50"><g>' +
        '<path d="M10 12h20l-2 32a4 4 0 0 1-4 3.6h-8A4 4 0 0 1 12 44z" fill="rgba(255,255,255,.1)" stroke="' + c + '" stroke-width="2"/>' +
        '<g class="liq"><path d="M12.5 22h15l-1.6 22h-11.8z" fill="' + c + '" opacity=".8"/></g>' +
        '<path d="M26 10 33 2" stroke="#ff4fd8" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="14" cy="8" r="4" fill="#ff2d6f"/><path d="M14 8v-5" stroke="#2fe3a0" stroke-width="2"/>' +
        '</g></svg>';
    }
    return '<svg viewBox="0 0 40 50"><g>' +
      '<path d="M5 8h30L21 27v14" fill="rgba(255,255,255,.1)" stroke="' + c + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<g class="liq"><path d="M10 11h22L21 26z" fill="' + c + '" opacity=".8"/></g>' +
      '<path d="M13 45h16" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="27" cy="14" r="3.4" fill="#2fe3a0"/><circle cx="27" cy="14" r="1.4" fill="#ff2d6f"/>' +
      '</g></svg>';
  }

  /* ---------------------------------------------------------
     2. i18n
     --------------------------------------------------------- */
  const I18N = {
    en: {
      'doc.title': 'NEUROCLUB · The Fly Behind the Bar',
      'logo.sub': 'digital fly · bar shift',
      'btn.musicOn': '🔈 Music on', 'btn.musicOff': '🔊 Music off',
      'hud.tips': 'Tips', 'hud.tipsX': "tonight's take", 'hud.served': 'Served', 'hud.combo': 'Combo',
      'hud.missed': '{n} missed', 'hud.best': 'best ×{n}',
      'meter.hype': 'Crowd hype', 'meter.dopa': 'Dopamine',
      'sign': 'OPEN BAR', 'shelf.k': 'Pour a drink',
      'shelf.hint': 'Click the drink the customer at the front asked for — or press 1-4.',
      'queue.empty': 'The bar is quiet… someone is coming.',
      'overdrive': 'NEURAL OVERDRIVE · DOUBLE TIPS', 'shotround': 'SHOT ROUND! everyone wants shots',
      'info.1.t': 'How the shift works',
      'info.1.p': 'Customers come to the bar and ask for a beer, a cocktail, a martini or a shot. Pour the right one before their patience runs out. Correct pours build a combo and the crowd’s hype; a wrong pour spills the glass and resets it.',
      'info.2.t': 'Hype & dopamine',
      'info.2.p': 'Fill the hype bar and the club calls a SHOT ROUND: everyone wants shots, tips double and the lasers lose their mind. The dopamine bar fills as you serve, and at 100% the fly goes into NEURAL OVERDRIVE.',
      'info.3.t': 'About the fly',
      'info.3.p': 'A playful nod to the viral thread about the digitized fruit-fly connectome — the one where the simulated fly supposedly drinks beer, trades crypto and plays DOOM. This page is a toy, not a simulation, and is not affiliated with that research.',
      'foot': 'NEUROCLUB · front-end demo, no backend. The sound is synthesized live in your browser.',
      'fly.idle': ['Let’s pour.', 'Six legs, four taps. Easy.', 'Who ordered what again?', 'The bass is in my thorax.'],
      'fly.serve': ['There you go! 🍻', 'Clean pour.', 'Enjoy — tip the fly.', 'Next!'],
      'fly.combo': ['I am ON it! 🔥', 'Nobody pours like me.', 'Look at that streak!'],
      'fly.spill': ['Wrong glass… my bad.', 'That is going on the floor.', 'Nobody saw that. 🫥'],
      'fly.miss': ['They left. Ouch.', 'Too slow — they walked.', 'We lost that one.'],
      'fly.shot': ['SHOTS! SHOTS! SHOTS! 🥃', 'Line them up!', 'Everyone wants a shot!'],
      'fly.over': ['My dopamine receptors are SINGING. ✨', 'Neural overdrive engaged.'],
      'tip.miss': 'walked out'
    },
    zh: {
      'doc.title': 'NEUROCLUB 神经夜店 · 吧台果蝇',
      'logo.sub': '数字果蝇 · 吧台之夜',
      'btn.musicOn': '🔈 开音乐', 'btn.musicOff': '🔊 关音乐',
      'hud.tips': '小费', 'hud.tipsX': '今晚进账', 'hud.served': '已上单', 'hud.combo': '连击',
      'hud.missed': '漏单 {n}', 'hud.best': '最佳 ×{n}',
      'meter.hype': '全场气氛', 'meter.dopa': '多巴胺',
      'sign': '营业中', 'shelf.k': '倒一杯',
      'shelf.hint': '点击队首客人要的那一杯，或者按 1-4 键。',
      'queue.empty': '吧台暂时安静……马上有人来。',
      'overdrive': '神经超频 · 小费翻倍', 'shotround': '全场干杯！都要烈酒',
      'info.1.t': '这一班怎么上',
      'info.1.p': '客人会来吧台点啤酒、鸡尾酒、马天尼或烈酒。在他们失去耐心之前倒对那一杯。倒对了会累积连击和全场气氛；倒错了酒洒一地，连击归零。',
      'info.2.t': '气氛与多巴胺',
      'info.2.p': '气氛条满了就会触发「全场干杯」：所有人都要烈酒，小费翻倍，激光也跟着疯。多巴胺条随着上单上升，满格时果蝇进入「神经超频」。',
      'info.3.t': '关于这只果蝇',
      'info.3.p': '灵感来自那条关于果蝇全脑连接组被数字化的热帖——据说那只模拟果蝇会喝啤酒、炒币、打 DOOM。本页只是个玩具，不是仿真，也与相关研究没有任何关系。',
      'foot': 'NEUROCLUB · 纯前端演示，无后端。音乐由浏览器实时合成。',
      'fly.idle': ['开倒吧。', '六条腿，四个酒头，小意思。', '刚才谁点的什么来着？', '低音直接震进我的胸腔。'],
      'fly.serve': ['您的酒，拿好！🍻', '干净利落。', '慢用——记得给果蝇小费。', '下一位！'],
      'fly.combo': ['我手感来了！🔥', '倒酒没人比我快。', '看看这连击！'],
      'fly.spill': ['拿错杯了……我的锅。', '这杯要洒地上了。', '没人看见啊。🫥'],
      'fly.miss': ['人走了，肉疼。', '太慢了，客人跑了。', '这单丢了。'],
      'fly.shot': ['烈酒！烈酒！烈酒！🥃', '一排排好！', '全场都要烈酒！'],
      'fly.over': ['我的多巴胺受体在唱歌。✨', '神经超频，启动。'],
      'tip.miss': '客人走了'
    }
  };

  let lang = 'en';
  const t = (k, p) => {
    let s = (I18N[lang] && I18N[lang][k]) !== undefined ? I18N[lang][k] : I18N.en[k];
    if (s === undefined) s = k;
    if (p && typeof s === 'string') Object.keys(p).forEach((x) => { s = s.split('{' + x + '}').join(p[x]); });
    return s;
  };
  const nameOf = (d) => d[lang];

  /* ---------------------------------------------------------
     3. State
     --------------------------------------------------------- */
  const S = {
    tips: 0, served: 0, missed: 0, combo: 0,
    hype: 0, dopa: 0,
    shotRound: false, overdrive: false,
    pouring: false, running: false,
    best: { tips: 0, combo: 0, served: 0 }
  };

  function loadBest() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (raw && raw.best) S.best = Object.assign(S.best, raw.best);
      if (raw && (raw.lang === 'zh' || raw.lang === 'en')) lang = raw.lang;
    } catch (e) {}
  }
  function saveBest() {
    try { localStorage.setItem(STORE, JSON.stringify({ best: S.best, lang: lang })); } catch (e) {}
  }

  /* ---------------------------------------------------------
     4. Scenery
     --------------------------------------------------------- */
  function buildScenery() {
    const colors = ['#b06cff', '#4ce3ff', '#ff4fd8', '#ffd166', '#2fe3a0'];
    $('#crowd').innerHTML = Array.from({ length: 15 }, () =>
      '<i style="--d:' + rnd(0.8, 1.35).toFixed(2) + 's;--c:' + pick(colors) +
      ';animation-delay:-' + rnd(0, 1.2).toFixed(2) + 's;height:' + rnd(70, 105).toFixed(0) + '%"></i>').join('');

    $('#ball-glints').innerHTML = Array.from({ length: 30 }, () =>
      '<i style="left:' + rnd(2, 98).toFixed(1) + 'vw;top:' + rnd(6, 88).toFixed(1) +
      'vh;animation-delay:-' + rnd(0, 5).toFixed(2) + 's;animation-duration:' + rnd(3.5, 7).toFixed(2) + 's"></i>').join('');

    $('#bottles').innerHTML = Array.from({ length: 22 }, () =>
      '<i style="--c:' + pick(colors) + ';height:' + rnd(34, 74).toFixed(0) +
      'px;animation-delay:-' + rnd(0, 4).toFixed(2) + 's"></i>').join('');
  }

  /* ---------------------------------------------------------
     5. Beat + audio
     --------------------------------------------------------- */
  let actx = null, master = null, musicOn = false;
  let nextNoteTime = 0, step = 0, schedTimer = null, visualTimer = null;
  const BASS = [0, 0, 3, 0, 5, 3, 7, 5];   // semitonos sobre A1

  function flashBeat(strong) {
    document.body.classList.add('beat');
    setTimeout(() => document.body.classList.remove('beat'), 90);
    if (strong && S.shotRound && !reduceMotion) strobe();
  }

  function strobe() {
    const s = $('#strobe');
    s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
  }

  function env(node, t0, a, d, peak) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  function kick(t0) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(45, t0 + 0.13);
    env(g, t0, 0.005, 0.24, 0.95);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.32);
  }
  function hat(t0, open) {
    const len = open ? 0.16 : 0.045;
    const buf = actx.createBuffer(1, actx.sampleRate * len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = actx.createBufferSource(); src.buffer = buf;
    const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
    const g = actx.createGain(); g.gain.value = open ? 0.16 : 0.1;
    src.connect(hp).connect(g).connect(master); src.start(t0);
  }
  function clap(t0) {
    const buf = actx.createBuffer(1, actx.sampleRate * 0.2, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    const src = actx.createBufferSource(); src.buffer = buf;
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 1.2;
    const g = actx.createGain(); g.gain.value = 0.3;
    src.connect(bp).connect(g).connect(master); src.start(t0);
  }
  function bass(t0, semi) {
    const o = actx.createOscillator(), g = actx.createGain(), f = actx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.value = 55 * Math.pow(2, semi / 12);
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t0);
    f.frequency.exponentialRampToValueAtTime(240, t0 + 0.22);
    env(g, t0, 0.01, 0.2, 0.28);
    o.connect(f).connect(g).connect(master); o.start(t0); o.stop(t0 + 0.3);
  }
  function stab(t0, semi) {
    [0, 3, 7].forEach((iv) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square';
      o.frequency.value = 220 * Math.pow(2, (semi + iv) / 12);
      env(g, t0, 0.01, 0.18, 0.055);
      o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.26);
    });
  }

  function scheduleStep(n, time) {
    const q = n % 4;
    if (q === 0) kick(time);
    if (n % 8 === 4) clap(time);
    hat(time, n % 4 === 2);
    if (n % 2 === 0) bass(time, BASS[(n / 2) % 8]);
    if (S.shotRound && n % 8 === 6) stab(time, 12);
    if (q === 0) {
      const delay = Math.max(0, (time - actx.currentTime) * 1000);
      setTimeout(() => flashBeat(n % 16 === 0), delay);
    }
  }

  function scheduler() {
    while (nextNoteTime < actx.currentTime + 0.14) {
      scheduleStep(step, nextNoteTime);
      nextNoteTime += SPB / 4;
      step = (step + 1) % 64;
    }
  }

  function startMusic() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.55;
      const comp = actx.createDynamicsCompressor();
      master.connect(comp).connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume();
    clearInterval(visualTimer); visualTimer = null;
    nextNoteTime = actx.currentTime + 0.08;
    step = 0;
    clearInterval(schedTimer);
    schedTimer = setInterval(scheduler, 25);
    musicOn = true;
    return true;
  }

  function stopMusic() {
    clearInterval(schedTimer); schedTimer = null;
    if (actx) actx.suspend();
    musicOn = false;
    startVisualBeat();
  }

  function startVisualBeat() {
    clearInterval(visualTimer);
    let n = 0;
    visualTimer = setInterval(() => { flashBeat(n % 4 === 0); n++; }, SPB * 1000);
  }

  /* ---------------------------------------------------------
     6. Fly talk
     --------------------------------------------------------- */
  const flyEl = $('#fly'), flyLine = $('#fly-line'), flyBubble = $('#fly-bubble');
  let flyTimer = null, lastLineKey = 'fly.idle';

  function flySay(key) {
    lastLineKey = key;
    const arr = t(key);
    flyLine.textContent = Array.isArray(arr) ? pick(arr) : arr;
    flyBubble.classList.remove('pop'); void flyBubble.offsetWidth; flyBubble.classList.add('pop');
    clearTimeout(flyTimer);
    flyTimer = setTimeout(() => {
      lastLineKey = 'fly.idle';
      flyLine.textContent = pick(t('fly.idle'));
    }, 4200);
  }

  /* ---------------------------------------------------------
     7. HUD
     --------------------------------------------------------- */
  function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  function renderHUD() {
    $('#hud-tips').textContent = Math.round(S.tips);
    $('#hud-served').textContent = S.served;
    $('#hud-missed').textContent = t('hud.missed', { n: S.missed });
    $('#hud-combo').textContent = '×' + (S.combo + 1);
    $('#hud-best').textContent = t('hud.best', { n: S.best.combo + 1 });
    $('#hype-fill').style.width = S.hype + '%';
    $('#dopa-fill').style.width = S.dopa + '%';
    $('#hype-pct').textContent = Math.round(S.hype) + '%';
    $('#dopa-pct').textContent = Math.round(S.dopa) + '%';
  }

  function floatText(x, y, text, bad) {
    const n = document.createElement('div');
    n.className = 'float-tip' + (bad ? ' bad' : '');
    n.textContent = text;
    n.style.left = x + 'px'; n.style.top = y + 'px';
    $('#fx').appendChild(n);
    setTimeout(() => n.remove(), 1100);
  }

  function sparks(x, y, color, n) {
    if (reduceMotion) return;
    for (let i = 0; i < (n || 12); i++) {
      const s = document.createElement('i');
      s.className = 'spark';
      s.style.left = x + 'px'; s.style.top = y + 'px';
      s.style.background = color;
      s.style.setProperty('--dx', rnd(-70, 70).toFixed(0) + 'px');
      s.style.setProperty('--dy', rnd(-90, -20).toFixed(0) + 'px');
      s.style.animationDelay = (i * 0.015) + 's';
      $('#fx').appendChild(s);
      setTimeout(() => s.remove(), 1100);
    }
  }

  /* ---------------------------------------------------------
     8. Customers
     --------------------------------------------------------- */
  const queueEl = $('#queue');
  let queue = [], custId = 0, spawnTimer = null;

  function patienceMs() {
    if (S.shotRound) return 4600;
    return Math.max(5200, 11000 - S.served * 110);
  }
  function spawnDelay() {
    if (S.shotRound) return rnd(700, 1200);
    return Math.max(1100, rnd(1900, 3000) - S.served * 25);
  }

  function renderQueuePlaceholder() {
    if (queue.length) { const ph = $('.queue-empty', queueEl); if (ph) ph.remove(); return; }
    if (!$('.queue-empty', queueEl)) {
      const p = document.createElement('div');
      p.className = 'queue-empty';
      p.textContent = t('queue.empty');
      queueEl.appendChild(p);
    }
  }

  function spawnCustomer() {
    if (queue.length >= 4) return;
    const drink = S.shotRound ? drinkOf('shot') : pick(DRINKS);
    const ms = patienceMs();
    const c = { id: ++custId, drink: drink.id, done: false };

    const el = document.createElement('div');
    el.className = 'cust';
    el.dataset.id = c.id;
    el.style.color = drink.color;
    el.innerHTML =
      '<div class="cust-head"></div>' +
      '<div class="cust-order">' + drinkSVG(drink.id, drink.color) + '</div>' +
      '<div class="cust-name">' + nameOf(drink) + '</div>' +
      '<div class="patience"><i style="animation-duration:' + ms + 'ms"></i></div>';
    c.el = el;
    queueEl.appendChild(el);
    // el llenado del vaso del pedido no se anima: es sólo el icono
    $$('.liq', el).forEach((g) => g.style.animation = 'none');
    requestAnimationFrame(() => { $('.patience i', el).classList.add('run'); });

    c.timer = setTimeout(() => missCustomer(c), ms);
    queue.push(c);
    renderQueuePlaceholder();
    markFront();
  }

  function markFront() {
    queue.forEach((c, i) => c.el.classList.toggle('front', i === 0));
  }

  function removeCustomer(c, cls) {
    clearTimeout(c.timer);
    c.done = true;
    c.el.classList.add(cls);
    setTimeout(() => c.el.remove(), 520);
    queue = queue.filter((x) => x.id !== c.id);
    markFront();
    renderQueuePlaceholder();
  }

  function missCustomer(c) {
    if (c.done) return;
    const r = c.el.getBoundingClientRect();
    removeCustomer(c, 'angry');
    S.missed++;
    S.combo = 0;
    S.hype = clamp(S.hype - 14, 0, 100);
    S.dopa = clamp(S.dopa - 8, 0, 100);
    floatText(r.left + r.width / 2, r.top, '✖ ' + t('tip.miss'), true);
    flySay('fly.miss');
    renderHUD();
  }

  /* ---------------------------------------------------------
     9. Pouring
     --------------------------------------------------------- */
  function pour(drinkId) {
    if (S.pouring) return;
    const drink = drinkOf(drinkId);
    S.pouring = true;
    $$('.drink').forEach((d) => d.classList.add('busy'));
    flyEl.classList.remove('pouring'); void flyEl.offsetWidth; flyEl.classList.add('pouring');

    const spot = $('#pour-spot').getBoundingClientRect();
    const glass = document.createElement('div');
    glass.className = 'glass';
    glass.innerHTML = drinkSVG(drink.id, drink.color);
    glass.style.left = (spot.left - 27) + 'px';
    glass.style.top = (spot.top - 66) + 'px';
    $('#fx').appendChild(glass);

    setTimeout(() => {
      const target = queue.filter((c) => !c.done && c.drink === drinkId)[0];
      if (target) {
        const r = target.el.getBoundingClientRect();
        const g = glass.getBoundingClientRect();
        glass.style.transform = 'translate(' + (r.left + r.width / 2 - g.left - g.width / 2) + 'px,' +
          (r.top + 10 - g.top) + 'px)';
        setTimeout(() => { glass.remove(); serve(target, drink); }, 430);
      } else {
        glass.classList.add('spill');
        setTimeout(() => glass.remove(), 560);
        spill(drink);
      }
      S.pouring = false;
      $$('.drink').forEach((d) => d.classList.remove('busy'));
    }, 620);
  }

  function serve(c, drink) {
    const r = c.el.getBoundingClientRect();
    removeCustomer(c, 'served');

    S.combo++;
    S.served++;
    const comboMult = Math.min(1 + S.combo * 0.1, 3);
    const mult = comboMult * (S.overdrive ? 2 : 1) * (S.shotRound ? 2 : 1);
    const tip = Math.round(drink.tip * mult);
    S.tips += tip;
    S.hype = clamp(S.hype + (S.shotRound ? 4 : 8), 0, 100);
    S.dopa = clamp(S.dopa + 9, 0, 100);

    floatText(r.left + r.width / 2, r.top + 10, '+' + tip + ' ¢');
    sparks(r.left + r.width / 2, r.top + 30, drink.color, 14);
    bump($('#hud-tips'));
    flyEl.classList.remove('cheer'); void flyEl.offsetWidth; flyEl.classList.add('cheer');
    flySay(S.combo >= 5 && Math.random() < 0.6 ? 'fly.combo' : 'fly.serve');

    if (S.combo > S.best.combo) S.best.combo = S.combo;
    if (S.tips > S.best.tips) S.best.tips = S.tips;
    if (S.served > S.best.served) S.best.served = S.served;
    saveBest();

    if (S.hype >= 100 && !S.shotRound) startShotRound();
    if (S.dopa >= 100 && !S.overdrive) startOverdrive();
    renderHUD();
  }

  function spill(drink) {
    S.combo = 0;
    S.hype = clamp(S.hype - 10, 0, 100);
    const spot = $('#pour-spot').getBoundingClientRect();
    floatText(spot.left, spot.top + 30, '✖', true);
    sparks(spot.left, spot.top + 40, drink.color, 8);
    flySay('fly.spill');
    renderHUD();
  }

  /* ---------------------------------------------------------
     10. Special modes
     --------------------------------------------------------- */
  function startShotRound() {
    S.shotRound = true;
    document.body.classList.add('rave');
    const b = $('#shotround'); b.hidden = false;
    flySay('fly.shot');
    strobe();
    // vacía la cola y reinicia el ritmo de llegadas: ahora todos piden chupito
    queue.slice().forEach((c) => removeCustomer(c, 'served'));
    loopSpawn();
    setTimeout(() => {
      S.shotRound = false;
      S.hype = 30;
      document.body.classList.remove('rave');
      b.hidden = true;
      loopSpawn();
      renderHUD();
    }, 14000);
    setTimeout(() => { if (b) b.hidden = true; }, 2600);
  }

  function startOverdrive() {
    S.overdrive = true;
    const b = $('#overdrive'); b.hidden = false;
    document.body.classList.add('overdrive');
    flySay('fly.over');
    setTimeout(() => { b.hidden = true; }, 2600);
    setTimeout(() => {
      S.overdrive = false;
      S.dopa = 35;
      document.body.classList.remove('overdrive');
      renderHUD();
    }, 15000);
  }

  /* ---------------------------------------------------------
     11. Shelf + language
     --------------------------------------------------------- */
  function buildShelf() {
    $('#drinks').innerHTML = DRINKS.map((d) =>
      '<button class="drink" type="button" data-drink="' + d.id + '" style="--c:' + d.color + ';color:' + d.color + '">' +
        '<span class="drink-key">' + d.key + '</span>' +
        drinkSVG(d.id, d.color) +
        '<span class="drink-name" data-dname="' + d.id + '">' + nameOf(d) + '</span>' +
        '<span class="drink-val mono">+' + d.tip + ' ¢</span>' +
      '</button>').join('');
    $$('.drink').forEach((b) => b.addEventListener('click', () => pour(b.dataset.drink)));
  }

  function applyLang(next) {
    lang = next === 'zh' ? 'zh' : 'en';
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('doc.title');
    $$('[data-i18n]').forEach((n) => {
      const v = t(n.dataset.i18n);
      if (typeof v === 'string') n.textContent = v;
    });
    $$('.lang-btn').forEach((b) => b.classList.toggle('is-on', b.dataset.lang === lang));
    $('#btn-music').textContent = t(musicOn ? 'btn.musicOff' : 'btn.musicOn');
    $$('[data-dname]').forEach((n) => { n.textContent = nameOf(drinkOf(n.dataset.dname)); });
    queue.forEach((c) => { $('.cust-name', c.el).textContent = nameOf(drinkOf(c.drink)); });
    const ph = $('.queue-empty', queueEl); if (ph) ph.textContent = t('queue.empty');
    flyLine.textContent = pick(t(lastLineKey === 'fly.idle' ? 'fly.idle' : lastLineKey));
    renderHUD();
    saveBest();
  }

  /* ---------------------------------------------------------
     12. Loop
     --------------------------------------------------------- */
  function decay() {
    if (!S.shotRound) S.hype = clamp(S.hype - 0.5, 0, 100);
    if (!S.overdrive) S.dopa = clamp(S.dopa - 1.1, 0, 100);
    renderHUD();
  }

  function loopSpawn() {
    clearTimeout(spawnTimer);
    spawnTimer = setTimeout(() => { spawnCustomer(); loopSpawn(); }, spawnDelay());
  }

  /* ---------------------------------------------------------
     13. Boot
     --------------------------------------------------------- */
  function init() {
    loadBest();
    buildScenery();
    buildShelf();
    applyLang(lang);
    renderHUD();
    renderQueuePlaceholder();
    startVisualBeat();

    $('#btn-music').addEventListener('click', (e) => {
      if (musicOn) { stopMusic(); e.target.textContent = t('btn.musicOn'); e.target.classList.remove('on'); }
      else if (startMusic()) { e.target.textContent = t('btn.musicOff'); e.target.classList.add('on'); }
    });
    $$('.lang-btn').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));

    document.addEventListener('keydown', (e) => {
      const d = DRINKS.filter((x) => x.key === e.key)[0];
      if (d) { e.preventDefault(); pour(d.id); }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { clearTimeout(spawnTimer); if (musicOn) stopMusic(); }
      else loopSpawn();
    });

    setInterval(decay, 1000);
    setTimeout(() => { spawnCustomer(); loopSpawn(); }, 900);
    $('#bpm-val').textContent = BPM;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.NeuroClub = {
    state: () => S, pour: pour, spawn: spawnCustomer,
    queue: () => queue, setLang: applyLang,
    shotRound: startShotRound, overdrive: startOverdrive
  };
})();
