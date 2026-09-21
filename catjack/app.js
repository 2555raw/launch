/* ============================================================
   CATJACK 招财猫二十一点 —— 黑杰克 + 猫市场（可做多做空）
   原生 JS，无依赖，状态保存在 localStorage。
   配色遵循中国市场惯例：红涨绿跌，红为盈。
   ============================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     0. 工具函数
     --------------------------------------------------------- */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const round2 = (n) => Math.round(n * 100) / 100;

  const nf  = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
  const nf2 = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (n) => nf.format(round2(n || 0));
  const fmtPrice = (n) => nf2.format(n);
  const fmtSigned = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
  const fmtPct = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + nf2.format(Math.abs(n)) + '%';
  const hhmm = (ts) => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  // 高斯噪声（Box–Muller），用于行情的随机游走
  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------------------------------------------------------
     1. 配置
     --------------------------------------------------------- */
  const STORE_KEY   = 'catjack.v2';
  const START_CHIPS = 1000;
  const MIN_BET     = 10;
  const DECKS       = 6;
  const FEE         = 0.002;   // 单边手续费 0.2%
  const TICK_MS     = 2600;
  const HIST_LEN    = 60;

  const TICKERS = [
    { sym: 'CATX', name: '猫山控股',   price: 184.20, vol: 0.016, drift:  0.0007 },
    { sym: 'MEOW', name: '喵喵基金',   price:  62.40, vol: 0.024, drift:  0.0005 },
    { sym: 'PURR', name: '呼噜能源',   price:  27.95, vol: 0.031, drift:  0.0003 },
    { sym: 'WHSK', name: '胡须实验室', price: 412.10, vol: 0.021, drift:  0.0009 },
    { sym: 'NINE', name: '九命保险',   price:  96.75, vol: 0.013, drift:  0.0004 },
    { sym: 'TUNA', name: '金枪鱼期货', price:  13.80, vol: 0.042, drift: -0.0002 }
  ];

  const SUITS = [
    { s: '♠', color: 'black' }, { s: '♥', color: 'red' },
    { s: '♦', color: 'red' },   { s: '♣', color: 'black' }
  ];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const C_UP = '#ff4d5e';   // 红：上涨 / 盈利
  const C_DN = '#2ecc8f';   // 绿：下跌 / 亏损

  /* ---------------------------------------------------------
     2. 状态
     --------------------------------------------------------- */
  const defaultState = () => ({
    v: 2,
    chips: START_CHIPS,
    bet: 50,
    baseline: START_CHIPS,
    stats: { hands: 0, wins: 0, losses: 0, pushes: 0, streak: 0, realized: 0 },
    positions: {},   // sym -> { side:'long'|'short', qty, avg }
    market: {},      // sym -> { price, open, history: [] }
    handLog: [],
    tradeLog: [],
    equity: []
  });

  let state = load();

  function load() {
    const base = defaultState();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && saved.v === 2) {
      base.chips     = typeof saved.chips === 'number' && isFinite(saved.chips) ? saved.chips : START_CHIPS;
      base.bet       = typeof saved.bet === 'number' ? saved.bet : 50;
      base.baseline  = typeof saved.baseline === 'number' ? saved.baseline : START_CHIPS;
      base.stats     = Object.assign(base.stats, saved.stats || {});
      base.positions = saved.positions && typeof saved.positions === 'object' ? saved.positions : {};
      base.market    = saved.market && typeof saved.market === 'object' ? saved.market : {};
      base.handLog   = Array.isArray(saved.handLog) ? saved.handLog : [];
      base.tradeLog  = Array.isArray(saved.tradeLog) ? saved.tradeLog : [];
      base.equity    = Array.isArray(saved.equity) ? saved.equity : [];
    }
    // 行情始终按标的定义补齐或修复
    TICKERS.forEach((t) => {
      const m = base.market[t.sym];
      if (!m || typeof m.price !== 'number' || !isFinite(m.price) || m.price <= 0) {
        base.market[t.sym] = { price: t.price, open: t.price, history: seedHistory(t.price, t.vol) };
      } else {
        if (typeof m.open !== 'number' || !isFinite(m.open) || m.open <= 0) m.open = m.price;
        if (!Array.isArray(m.history) || m.history.length < 2) m.history = seedHistory(m.price, t.vol);
      }
    });
    // 只保留已知标的、数量为正的持仓
    Object.keys(base.positions).forEach((sym) => {
      const p = base.positions[sym];
      const ok = p && p.qty > 0 && p.avg > 0 && (p.side === 'long' || p.side === 'short');
      if (!TICKERS.some((t) => t.sym === sym) || !ok) delete base.positions[sym];
    });
    return base;
  }

  function seedHistory(price, vol) {
    const out = [];
    let p = price * (1 - vol * 3);
    for (let i = 0; i < 28; i++) {
      p = Math.max(0.5, p * (1 + gauss() * vol * 0.8 + 0.0015));
      out.push(round2(p));
    }
    out.push(round2(price));
    return out;
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式 */ }
    }, 120);
  }

  /* ---------------------------------------------------------
     3. 持仓与资产计算
       多头：仓位价值 = 数量 × 现价
       空头：开仓时冻结等额保证金（数量 × 开仓均价），
             仓位价值 = 保证金 + 浮动盈亏 = 数量 × (2×均价 − 现价)
     --------------------------------------------------------- */
  const priceOf = (sym) => state.market[sym].price;
  const posOf   = (sym) => state.positions[sym] || null;

  function posValue(sym) {
    const p = posOf(sym);
    if (!p) return 0;
    const px = priceOf(sym);
    return p.side === 'long' ? p.qty * px : Math.max(0, p.qty * (2 * p.avg - px));
  }
  function posPL(sym) {
    const p = posOf(sym);
    if (!p) return 0;
    const px = priceOf(sym);
    return p.side === 'long' ? p.qty * (px - p.avg) : p.qty * (p.avg - px);
  }
  function portfolioValue() {
    return Object.keys(state.positions).reduce((s, sym) => s + posValue(sym), 0);
  }
  function unrealizedPL() {
    return Object.keys(state.positions).reduce((s, sym) => s + posPL(sym), 0);
  }
  const netWorth = () => state.chips + portfolioValue();

  /* ---------------------------------------------------------
     4. 猫：表情与台词
     --------------------------------------------------------- */
  const cat = $('#cat');
  const catLine = $('#cat-line');
  const catBubble = $('#cat-bubble');
  let catTimer = null;

  const LINES = {
    idle: [
      '下注吧，看看牌靴今天心情如何。🐾',
      '打牌还是炒股？两样都费猫粮。',
      '我有九条命，但没有耐心。发牌。',
      '市场在打呼噜……暂时是。'
    ],
    deal:  ['牌已上桌，请勿用爪子挠。', '发牌中……屏住胡须。', '来吧，愿金枪鱼与你同在。'],
    hit:   ['再要一张，有胆识。😼', '确定？好吧，你说了算。', '紧张的呼噜声正在加剧……'],
    safe:  ['这牌不错，我就不动了。', '一手好牌，别把它玩坏。'],
    risky: ['这个 16 点闻着像麻烦……', '你在玩毛线球的最后一圈。'],
    win:   ['喵！这一手是我们的了。🎉', '赢了！记得留点筹码买金枪鱼。', '这就叫稳稳落地。'],
    lose:  ['喵呜……这局归庄家了。', '庄家也是要吃饭的，你懂的。', '只是挠了一下自尊，不疼。'],
    push:  ['平局。没人呼噜，也没人哈气。', '技术性平局，很有外交风度。'],
    bj:    ['黑杰克！我得去多拿点筹码。😻', '开局就 21 点！这得去睡一觉庆祝。'],
    bust:  ['爆了。连猫都知道什么时候收手。', '22 点以上……那已经是别的游戏了。🙀'],
    dealerBust: ['我爆了。优雅地失手。', '庄家爆牌，别到处说。'],
    double:['加倍！我喜欢你这股莽劲。', '加倍下注，风险的呼噜声。'],
    long:  ['做多建仓，愿曲线一路向上。📈', '仓位已开，接下来盯紧盘面。', '买还是等？你已经决定了。🐱'],
    short: ['做空？跟逆着毛摸猫一样刺激。😼', '空单已开。记住：保证金被冻住了。', '看跌的猫，尾巴摇得最快。📉'],
    close: ['平仓完毕，盈亏落袋。', '仓位关闭，很明智。', '离开市场，回到牌桌。'],
    liq:   ['爆仓了！保证金被市场叼走了。🙀', '强制平仓……这一爪抓得有点狠。'],
    marketUp:  ['市场涨得像猫爬窗帘。📈', '满屏飘红！有人把金枪鱼撒了。'],
    marketDown:['这个市场在搞什么鬼…… 📉', '绿了。别慌，我替你慌。'],
    broke: ['筹码见底了。申请救济金，或者卖点仓位。', '仓位空、筹码空：流浪猫模式启动。'],
    rich:  ['总资产创新高，我要申请加薪。💰'],
    nope:  ['筹码不够，冠军。', '数学说不行，我也说不行。']
  };

  function catSay(text, mood, hold) {
    if (catLine.textContent !== text) {
      catLine.textContent = text;
      catBubble.classList.remove('pop');
      void catBubble.offsetWidth;
      catBubble.classList.add('pop');
    }
    cat.setAttribute('data-mood', mood || 'idle');
    clearTimeout(catTimer);
    catTimer = setTimeout(() => {
      cat.setAttribute('data-mood', 'idle');
      if (!game.inRound) catLine.textContent = pick(LINES.idle);
    }, hold || 5200);
  }
  const catEvent = (key, mood, hold) => catSay(pick(LINES[key]), mood, hold);

  /* ---------------------------------------------------------
     5. 特效：提示条、纸屑、金币
     --------------------------------------------------------- */
  const toasts = $('#toasts');
  const fxLayer = $('#fx-layer');

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = '<span>' + (kind === 'good' ? '🧧' : kind === 'bad' ? '⚠️' : '🐾') + '</span><span>' + msg + '</span>';
    toasts.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }

  function confetti(n, colors) {
    const cols = colors || ['#e8c26a', '#ff4d5e', '#ffffff', '#b8892f'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = pick(cols);
      c.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      c.style.animationDelay = (Math.random() * 0.35) + 's';
      fxLayer.appendChild(c);
      setTimeout(() => c.remove(), 3400);
    }
  }

  function coins(n) {
    const rect = $('#balance').getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const c = document.createElement('span');
      c.className = 'coin';
      c.textContent = Math.random() > 0.5 ? '🪙' : '🐟';
      c.style.left = (rect.left + Math.random() * rect.width) + 'px';
      c.style.top = rect.top + 'px';
      c.style.animationDelay = (i * 0.07) + 's';
      fxLayer.appendChild(c);
      setTimeout(() => c.remove(), 1600);
    }
  }

  /* ---------------------------------------------------------
     6. 迷你走势图
     --------------------------------------------------------- */
  function sparkPath(values, w, h, pad) {
    const p = pad == null ? 3 : pad;
    if (!values.length) return { line: '', area: '' };
    let min = Math.min.apply(null, values);
    let max = Math.max.apply(null, values);
    if (max - min < 1e-9) max = min + 1;
    const step = values.length > 1 ? (w - p * 2) / (values.length - 1) : 0;
    const pts = values.map((v, i) => {
      const x = p + i * step;
      const y = p + (h - p * 2) * (1 - (v - min) / (max - min));
      return [round2(x), round2(y)];
    });
    const line = pts.map((pt, i) => (i ? 'L' : 'M') + pt[0] + ' ' + pt[1]).join(' ');
    const area = line + ' L' + pts[pts.length - 1][0] + ' ' + h + ' L' + pts[0][0] + ' ' + h + ' Z';
    return { line: line, area: area };
  }

  /* ---------------------------------------------------------
     7. 顶栏与总资产面板
     --------------------------------------------------------- */
  const hud = {
    chips: $('#hud-chips'), portfolio: $('#hud-portfolio'), net: $('#hud-networth'),
    big: $('#networth-big'), delta: $('#networth-delta'),
    cash: $('#equity-cash'), mkt: $('#equity-mkt'),
    balance: $('#balance'),
    hands: $('#kpi-hands'), record: $('#kpi-record'), winrate: $('#kpi-winrate'),
    pl: $('#kpi-pl'), plx: $('#kpi-pl-x'), streak: $('#kpi-streak'),
    walletTotal: $('#wallet-total'), walletPl: $('#wallet-pl')
  };
  let lastNet = null;

  function flash(el, dir) {
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth;
    el.classList.add(dir > 0 ? 'flash-up' : 'flash-down');
  }

  function renderHUD() {
    const pv = portfolioValue();
    const nw = netWorth();

    hud.chips.textContent = fmt(state.chips);
    hud.portfolio.textContent = fmt(pv);
    hud.net.textContent = fmt(nw);
    hud.big.textContent = fmt(nw);
    hud.balance.textContent = fmt(state.chips);
    hud.walletTotal.textContent = fmt(pv);

    if (lastNet !== null && Math.abs(nw - lastNet) > 0.009) flash(hud.net, nw - lastNet);
    lastNet = nw;

    const d = nw - state.baseline;
    hud.delta.textContent = fmtSigned(d) + ' 筹码';
    hud.delta.className = 'delta ' + (d > 0.009 ? 'up' : d < -0.009 ? 'down' : '');

    const total = Math.max(nw, 1);
    const cashPct = clamp((state.chips / total) * 100, 0, 100);
    hud.cash.style.width = cashPct + '%';
    hud.mkt.style.width = (100 - cashPct) + '%';

    const up = unrealizedPL();
    hud.walletPl.textContent = fmtSigned(up);
    hud.walletPl.className = 'wallet-pl-v ' + (up > 0.009 ? 'pos' : up < -0.009 ? 'neg' : '');

    const s = state.stats;
    hud.hands.textContent = fmt(s.hands);
    hud.record.textContent = s.wins + '胜 · ' + s.losses + '负 · ' + s.pushes + '和';
    hud.winrate.textContent = s.hands ? Math.round((s.wins / s.hands) * 100) + '%' : '—';
    const marketPL = up + s.realized;
    hud.pl.textContent = fmtSigned(marketPL);
    hud.pl.className = 'kpi-v ' + (marketPL > 0.009 ? 'pos' : marketPL < -0.009 ? 'neg' : '');
    hud.plx.textContent = '已实现 ' + fmtSigned(s.realized);
    hud.streak.textContent = s.streak === 0 ? '—' : (s.streak > 0 ? s.streak + ' 连胜 🔥' : Math.abs(s.streak) + ' 连败 ❄️');
    hud.streak.className = 'kpi-v ' + (s.streak > 0 ? 'pos' : s.streak < 0 ? 'neg' : '');

    $('#btn-rescue').hidden = !(state.chips < MIN_BET && pv < 1);
    renderEquitySpark();
    updateBetUI();
  }

  function pushEquity() {
    state.equity.push(round2(netWorth()));
    if (state.equity.length > HIST_LEN) state.equity.shift();
  }

  function renderEquitySpark() {
    const vals = state.equity.length > 1 ? state.equity : [state.baseline, netWorth()];
    const p = sparkPath(vals, 600, 90, 4);
    $('#equity-line').setAttribute('d', p.line);
    $('#equity-area').setAttribute('d', p.area);
    $('#equity-line').setAttribute('stroke', vals[vals.length - 1] >= vals[0] ? '#e8c26a' : C_DN);
  }

  /* ---------------------------------------------------------
     8. 二十一点
     --------------------------------------------------------- */
  const game = { shoe: [], player: [], dealer: [], bet: 0, inRound: false, busy: false, doubled: false };

  const el = {
    dealerCards: $('#dealer-cards'), playerCards: $('#player-cards'),
    dealerScore: $('#dealer-score'), playerScore: $('#player-score'),
    badge: $('#result-badge'), felt: $('#felt'),
    betAmount: $('#bet-amount'), betPill: $('#bet-pill'), betPillV: $('#bet-pill-v'),
    shoeCount: $('#shoe-count'), shoeFill: $('#shoe-fill'),
    btnDeal: $('#btn-deal'), btnHit: $('#btn-hit'), btnStand: $('#btn-stand'),
    btnDouble: $('#btn-double'), btnNew: $('#btn-new')
  };

  function buildShoe() {
    const cards = [];
    for (let d = 0; d < DECKS; d++) {
      for (let s = 0; s < SUITS.length; s++) {
        for (let r = 0; r < RANKS.length; r++) {
          cards.push({ rank: RANKS[r], suit: SUITS[s].s, color: SUITS[s].color });
        }
      }
    }
    for (let i = cards.length - 1; i > 0; i--) {     // Fisher–Yates
      const j = Math.floor(Math.random() * (i + 1));
      const t = cards[i]; cards[i] = cards[j]; cards[j] = t;
    }
    game.shoe = cards;
    renderShoe();
  }

  function draw() {
    if (game.shoe.length < DECKS * 52 * 0.25) {
      buildShoe();
      toast('牌靴已重新洗牌 · 六副牌');
    }
    const c = game.shoe.pop();
    renderShoe();
    return c;
  }

  function renderShoe() {
    const n = game.shoe.length;
    el.shoeCount.textContent = n + ' 张';
    el.shoeFill.style.width = (n / (DECKS * 52)) * 100 + '%';
  }

  function handValue(cards) {
    let total = 0, aces = 0;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].rank;
      if (r === 'A') { aces++; total += 11; }
      else if (r === 'J' || r === 'Q' || r === 'K') total += 10;
      else total += parseInt(r, 10);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total: total, soft: aces > 0 };
  }
  const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;

  function cardEl(card, faceDown) {
    const slot = document.createElement('div');
    slot.className = 'card-slot' + (faceDown ? ' down' : '');
    slot.innerHTML =
      '<div class="card-inner">' +
        '<div class="card-face card-front ' + card.color + '">' +
          '<span class="card-corner"><b>' + card.rank + '</b><span>' + card.suit + '</span></span>' +
          '<span class="card-pip">' + card.suit + '</span>' +
          '<span class="card-corner br"><b>' + card.rank + '</b><span>' + card.suit + '</span></span>' +
        '</div>' +
        '<div class="card-face card-back">福</div>' +
      '</div>';
    return slot;
  }

  async function dealCard(to, faceDown) {
    const card = draw();
    (to === 'player' ? game.player : game.dealer).push(card);
    (to === 'player' ? el.playerCards : el.dealerCards).appendChild(cardEl(card, !!faceDown));
    renderScores();
    await sleep(380);
    return card;
  }

  function renderScores(revealAll) {
    const pv = handValue(game.player);
    el.playerScore.textContent = game.player.length ? (pv.soft && pv.total !== 21 ? '软' + pv.total : pv.total) : '—';
    el.playerScore.className = 'hand-score' + (pv.total > 21 ? ' bust' : isBlackjack(game.player) ? ' bj' : '');

    if (!game.dealer.length) {
      el.dealerScore.textContent = '—';
      el.dealerScore.className = 'hand-score';
      return;
    }
    const hidden = !revealAll && $$('.card-slot.down', el.dealerCards).length > 0;
    if (hidden) {
      el.dealerScore.textContent = handValue(game.dealer.slice(0, 1)).total + ' + ?';
      el.dealerScore.className = 'hand-score';
    } else {
      const dv = handValue(game.dealer);
      el.dealerScore.textContent = dv.total;
      el.dealerScore.className = 'hand-score' + (dv.total > 21 ? ' bust' : isBlackjack(game.dealer) ? ' bj' : '');
    }
  }

  function setActions(o) {
    el.btnHit.disabled = !o.hit;
    el.btnStand.disabled = !o.stand;
    el.btnDouble.disabled = !o.double;
    el.btnDeal.disabled = !o.deal;
  }

  function updateBetUI() {
    const maxBet = Math.floor(state.chips);
    if (state.bet > maxBet) state.bet = Math.max(0, maxBet);
    if (state.bet < MIN_BET && maxBet >= MIN_BET) state.bet = Math.min(MIN_BET, maxBet);
    el.betAmount.textContent = fmt(state.bet);
    if (!game.inRound) el.btnDeal.disabled = !(state.bet >= MIN_BET && state.bet <= maxBet);
  }

  function showBadge(text, kind) {
    el.badge.textContent = text;
    el.badge.className = 'result-badge show ' + kind;
  }
  function clearBadge() { el.badge.className = 'result-badge'; el.badge.textContent = ''; }

  async function startRound() {
    if (game.busy || game.inRound) return;
    const bet = Math.floor(state.bet);
    if (bet < MIN_BET) { toast('最低押注为 ' + MIN_BET + ' 筹码', 'bad'); return; }
    if (bet > state.chips) { catEvent('nope', 'shock'); toast('筹码不足', 'bad'); return; }

    game.busy = true;
    game.inRound = true;
    game.doubled = false;
    game.player = [];
    game.dealer = [];
    game.bet = bet;
    state.chips = round2(state.chips - bet);

    el.playerCards.innerHTML = '';
    el.dealerCards.innerHTML = '';
    clearBadge();
    el.felt.classList.remove('win', 'lose', 'push');
    el.betPill.hidden = false;
    el.betPillV.textContent = fmt(bet);
    setActions({ hit: false, stand: false, double: false, deal: false });
    renderHUD();
    save();
    catEvent('deal', 'deal', 3000);

    await dealCard('player');
    await dealCard('dealer');
    await dealCard('player');
    await dealCard('dealer', true);

    const playerBJ = isBlackjack(game.player);
    const dealerBJ = isBlackjack(game.dealer);

    if (playerBJ || dealerBJ) {
      await revealHole();
      if (playerBJ && dealerBJ) finishRound('push', '平局 · 双方黑杰克');
      else if (playerBJ) finishRound('blackjack', '黑杰克');
      else finishRound('lose', '庄家黑杰克');
      game.busy = false;
      return;
    }

    setActions({ hit: true, stand: true, double: state.chips >= game.bet, deal: false });
    game.busy = false;

    const pv = handValue(game.player).total;
    if (pv >= 17 && pv <= 20) catEvent('safe', 'smug');
    else if (pv >= 12 && pv <= 16) catEvent('risky', 'think');
    else catEvent('idle', 'idle');
  }

  async function hit() {
    if (game.busy || !game.inRound) return;
    game.busy = true;
    setActions({ hit: false, stand: false, double: false, deal: false });
    await dealCard('player');
    const v = handValue(game.player).total;

    if (v > 21) {
      await revealHole();
      finishRound('lose', '你爆牌了', 'bust');
      game.busy = false;
      return;
    }
    if (v === 21) { game.busy = false; await stand(); return; }
    catEvent('hit', 'think', 3200);
    setActions({ hit: true, stand: true, double: false, deal: false });
    game.busy = false;
  }

  async function doubleDown() {
    if (game.busy || !game.inRound) return;
    if (game.player.length !== 2 || state.chips < game.bet) return;
    game.busy = true;
    game.doubled = true;
    state.chips = round2(state.chips - game.bet);
    game.bet *= 2;
    el.betPillV.textContent = fmt(game.bet);
    renderHUD(); save();
    catEvent('double', 'money', 3200);
    setActions({ hit: false, stand: false, double: false, deal: false });

    await dealCard('player');
    if (handValue(game.player).total > 21) {
      await revealHole();
      finishRound('lose', '你爆牌了', 'bust');
      game.busy = false;
      return;
    }
    game.busy = false;
    await dealerTurn();
  }

  async function stand() {
    if (game.busy || !game.inRound) return;
    setActions({ hit: false, stand: false, double: false, deal: false });
    await dealerTurn();
  }

  async function revealHole() {
    const down = $$('.card-slot.down', el.dealerCards);
    down.forEach((n) => n.classList.remove('down'));
    if (down.length) await sleep(520);
    renderScores(true);
  }

  async function dealerTurn() {
    game.busy = true;
    await revealHole();
    await sleep(320);

    while (handValue(game.dealer).total < 17) {
      await dealCard('dealer');
      renderScores(true);
      await sleep(180);
    }
    renderScores(true);

    const p = handValue(game.player).total;
    const d = handValue(game.dealer).total;

    if (d > 21) finishRound('win', '庄家爆牌', 'dealerBust');
    else if (p > d) finishRound('win', '你赢了这一手');
    else if (p < d) finishRound('lose', '庄家获胜');
    else finishRound('push', '平局');

    game.busy = false;
  }

  function finishRound(result, label, catKey) {
    const bet = game.bet;
    let delta = 0;

    if (result === 'blackjack') {
      state.chips = round2(state.chips + bet * 2.5);
      delta = round2(bet * 1.5);
      showBadge('黑杰克 · +' + fmt(delta), 'bj');
      el.felt.classList.add('win');
      confetti(70); coins(9);
      catEvent('bj', 'money', 6000);
      toast('黑杰克！+' + fmt(delta) + ' 筹码', 'good');
      state.stats.wins++;
      state.stats.streak = state.stats.streak > 0 ? state.stats.streak + 1 : 1;
    } else if (result === 'win') {
      state.chips = round2(state.chips + bet * 2);
      delta = bet;
      showBadge(label + ' · +' + fmt(delta), 'win');
      el.felt.classList.add('win');
      confetti(40); coins(6);
      catEvent(catKey === 'dealerBust' ? 'dealerBust' : 'win', 'happy', 5200);
      toast('赢下一手：+' + fmt(delta) + ' 筹码', 'good');
      state.stats.wins++;
      state.stats.streak = state.stats.streak > 0 ? state.stats.streak + 1 : 1;
    } else if (result === 'push') {
      state.chips = round2(state.chips + bet);
      showBadge(label, 'push');
      el.felt.classList.add('push');
      catEvent('push', 'think', 4200);
      state.stats.pushes++;
      state.stats.streak = 0;
    } else {
      delta = -bet;
      showBadge(label + ' · −' + fmt(bet), 'lose');
      el.felt.classList.add('lose');
      catEvent(catKey === 'bust' ? 'bust' : 'lose', 'sad', 5200);
      state.stats.losses++;
      state.stats.streak = state.stats.streak < 0 ? state.stats.streak - 1 : -1;
    }

    state.stats.hands++;
    state.handLog.unshift({
      t: Date.now(), r: result, bet: bet, delta: delta,
      p: handValue(game.player).total, d: handValue(game.dealer).total, dbl: game.doubled
    });
    if (state.handLog.length > 24) state.handLog.pop();

    game.inRound = false;
    el.betPill.hidden = true;
    setActions({ hit: false, stand: false, double: false, deal: true });
    pushEquity();
    renderHUD();
    renderHandLog();
    save();

    if (state.chips < MIN_BET && portfolioValue() < 1) {
      setTimeout(() => catEvent('broke', 'sad', 7000), 1200);
    }
  }

  function newGame() {
    if (game.busy) return;
    game.inRound = false;
    game.player = [];
    game.dealer = [];
    el.playerCards.innerHTML = '';
    el.dealerCards.innerHTML = '';
    el.betPill.hidden = true;
    clearBadge();
    el.felt.classList.remove('win', 'lose', 'push');
    renderScores(true);
    buildShoe();
    setActions({ hit: false, stand: false, double: false, deal: true });
    updateBetUI();
    catSay('牌桌已清空，牌靴换新。这次押多少？🐾', 'idle');
  }

  /* ---------------------------------------------------------
     9. 牌局历史
     --------------------------------------------------------- */
  const RESULT_META = {
    win:       { cls: 'tag-win',  txt: '赢' },
    blackjack: { cls: 'tag-bj',   txt: '黑杰克' },
    lose:      { cls: 'tag-lose', txt: '输' },
    push:      { cls: 'tag-push', txt: '和' }
  };

  function renderHandLog() {
    const ul = $('#hand-log');
    if (!state.handLog.length) {
      ul.innerHTML = '<li class="empty">还没有打过任何一手牌。</li>';
      return;
    }
    ul.innerHTML = state.handLog.map((h, i) => {
      const m = RESULT_META[h.r] || RESULT_META.push;
      const cls = h.delta > 0 ? 'pos' : h.delta < 0 ? 'neg' : '';
      return '<li style="animation-delay:' + (i * 0.02) + 's">' +
        '<span class="log-tag ' + m.cls + '">' + m.txt + '</span>' +
        '<span class="log-text">你 <b>' + h.p + '</b> 点 · 庄家 <b>' + h.d + '</b> 点' +
          (h.dbl ? ' · <i>已加倍</i>' : '') + '</span>' +
        '<span class="log-val ' + cls + '">' + fmtSigned(h.delta) + '</span>' +
        '<span class="log-time">' + hhmm(h.t) + '</span></li>';
    }).join('');
  }

  /* ---------------------------------------------------------
     10. 猫市场行情
     --------------------------------------------------------- */
  const grid = $('#stock-grid');
  const sel = $('#trade-symbol');
  let selected = TICKERS[0].sym;
  let marketPaused = false;
  let tickTimer = null;
  let lastCatMarketComment = 0;

  function buildMarketUI() {
    grid.innerHTML = TICKERS.map((t) =>
      '<article class="stock" data-sym="' + t.sym + '" tabindex="0" role="button" aria-label="' + t.name + ' ' + t.sym + '">' +
        '<div class="stock-top">' +
          '<div><div class="stock-sym">' + t.sym + '</div><div class="stock-name">' + t.name + '</div></div>' +
          '<div><div class="stock-price" id="px-' + t.sym + '">—</div><div class="stock-chg" id="chg-' + t.sym + '">—</div></div>' +
        '</div>' +
        '<div class="stock-spark"><svg viewBox="0 0 240 46" preserveAspectRatio="none">' +
          '<path id="sp-area-' + t.sym + '" d="" fill="rgba(255,77,94,.12)"></path>' +
          '<path id="sp-' + t.sym + '" d="" fill="none" stroke="' + C_UP + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>' +
        '</svg></div>' +
        '<div class="stock-foot"><span>开盘 ' + fmtPrice(state.market[t.sym].open) + '</span>' +
          '<span class="hold-tag" id="hold-' + t.sym + '"></span></div>' +
      '</article>'
    ).join('');

    sel.innerHTML = TICKERS.map((t) => '<option value="' + t.sym + '">' + t.sym + ' · ' + t.name + '</option>').join('');
    sel.value = selected;

    $$('.stock', grid).forEach((node) => {
      const act = () => selectSymbol(node.dataset.sym);
      node.addEventListener('click', act);
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    });
  }

  function selectSymbol(sym) {
    selected = sym;
    sel.value = sym;
    $$('.stock', grid).forEach((n) => n.classList.toggle('selected', n.dataset.sym === sym));
    updateTradeCost();
  }

  function renderMarket(changed) {
    TICKERS.forEach((t) => {
      const m = state.market[t.sym];
      const chgPct = ((m.price - m.open) / m.open) * 100;
      const up = chgPct >= 0;
      const card = grid.querySelector('.stock[data-sym="' + t.sym + '"]');
      const pxEl = $('#px-' + t.sym);
      if (!card || !pxEl) return;
      const chgEl = $('#chg-' + t.sym);

      pxEl.textContent = fmtPrice(m.price);
      pxEl.style.color = up ? C_UP : C_DN;
      chgEl.textContent = fmtPct(chgPct);
      chgEl.style.color = up ? C_UP : C_DN;
      card.classList.toggle('up', up);
      card.classList.toggle('down', !up);

      // El color del gráfico sigue el mismo criterio que el porcentaje: precio contra apertura
      const p = sparkPath(m.history, 240, 46, 2);
      const line = $('#sp-' + t.sym);
      const area = $('#sp-area-' + t.sym);
      line.setAttribute('d', p.line);
      line.setAttribute('stroke', up ? C_UP : C_DN);
      area.setAttribute('d', p.area);
      area.setAttribute('fill', up ? 'rgba(255,77,94,.13)' : 'rgba(46,204,143,.12)');

      const pos = posOf(t.sym);
      const tag = $('#hold-' + t.sym);
      if (pos) {
        tag.className = 'hold-tag ' + pos.side;
        tag.innerHTML = '<span class="side-badge side-' + pos.side + '">' + (pos.side === 'long' ? '多' : '空') + '</span>' +
          pos.qty + ' 股 · ' + fmtSigned(posPL(t.sym));
      } else {
        tag.className = 'hold-tag';
        tag.textContent = '';
      }

      if (changed && changed[t.sym]) {
        card.classList.remove('tick-up', 'tick-down');
        void card.offsetWidth;
        card.classList.add(changed[t.sym] > 0 ? 'tick-up' : 'tick-down');
      }
    });
    renderHoldings();
    updateTradeCost();
  }

  function tick() {
    if (marketPaused) return;
    const changed = {};
    let sumPct = 0;
    TICKERS.forEach((t) => {
      const m = state.market[t.sym];
      const prev = m.price;
      const shock = Math.random() < 0.035 ? gauss() * t.vol * 3 : 0;   // 偶发跳动
      let next = m.price * (1 + t.drift + gauss() * t.vol + shock);
      next = clamp(next, t.price * 0.12, t.price * 9);
      m.price = round2(next);
      m.history.push(m.price);
      if (m.history.length > HIST_LEN) m.history.shift();
      changed[t.sym] = m.price - prev;
      sumPct += ((m.price - prev) / prev) * 100;
    });

    checkLiquidations();
    pushEquity();
    renderMarket(changed);
    renderHUD();
    save();

    const avg = sumPct / TICKERS.length;
    const now = Date.now();
    if (Math.abs(avg) > 1.15 && now - lastCatMarketComment > 22000 && !game.inRound) {
      lastCatMarketComment = now;
      catEvent(avg > 0 ? 'marketUp' : 'marketDown', avg > 0 ? 'money' : 'shock', 5200);
    }
  }

  // 空头保证金耗尽（价格涨到开仓均价的两倍）即强制平仓
  function checkLiquidations() {
    Object.keys(state.positions).forEach((sym) => {
      const p = state.positions[sym];
      if (p.side !== 'short') return;
      if (priceOf(sym) < p.avg * 2) return;

      const lost = round2(p.avg * p.qty);
      state.stats.realized = round2(state.stats.realized - lost);
      logTrade('liq', sym, p.qty, priceOf(sym), 0, -lost);
      delete state.positions[sym];
      toast(sym + ' 空单强制平仓，保证金 ' + fmt(lost) + ' 归零', 'bad');
      catEvent('liq', 'shock', 6000);
      renderTradeLog();
    });
  }

  function startMarket() {
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, TICK_MS);
  }

  setInterval(() => { $('#mkt-clock').textContent = new Date().toLocaleTimeString('zh-CN'); }, 1000);

  /* ---------------------------------------------------------
     11. 交易：做多 / 做空 / 平仓
     --------------------------------------------------------- */
  const qtyInput = $('#trade-qty');

  function currentQty() {
    const n = parseInt(qtyInput.value, 10);
    return isFinite(n) && n > 0 ? n : 0;
  }

  // 平仓可收回的筹码（含手续费）
  function closeProceeds(sym, qty) {
    const p = posOf(sym);
    if (!p) return 0;
    const px = priceOf(sym);
    const fee = qty * px * FEE;
    return p.side === 'long'
      ? round2(qty * px - fee)
      : round2(qty * p.avg + qty * (p.avg - px) - fee);
  }

  function updateTradeCost() {
    const q = currentQty();
    const px = priceOf(selected);
    const pos = posOf(selected);
    const open = round2(q * px * (1 + FEE));

    const closable = pos ? Math.min(q, pos.qty) : 0;
    if (pos && q >= 1) {
      $('#trade-cost-k').textContent = '平仓 ' + closable + ' 股预计收回';
      $('#trade-cost').textContent = fmt(Math.max(0, closeProceeds(selected, closable)));
    } else {
      $('#trade-cost-k').textContent = '开仓预计金额';
      $('#trade-cost').textContent = fmt(open);
    }

    $('#btn-long').disabled  = q < 1 || open > state.chips || (pos && pos.side === 'short');
    $('#btn-short').disabled = q < 1 || open > state.chips || (pos && pos.side === 'long');
    $('#btn-close').disabled = !pos || q < 1;

    const note = $('#trade-note');
    if (pos) {
      const pl = posPL(selected);
      note.className = 'trade-note warn';
      note.innerHTML = '当前持仓：<b>' + (pos.side === 'long' ? '做多' : '做空') + ' ' + pos.qty + ' 股</b>' +
        ' · 均价 ' + fmtPrice(pos.avg) + ' · 浮动 <b class="' + (pl >= 0 ? 'pos' : 'neg') + '">' + fmtSigned(pl) + '</b>' +
        '。同一标的需先平仓才能反向开仓。';
    } else {
      note.className = 'trade-note';
      note.textContent = '做空需按开仓价缴纳等额保证金；价格翻倍即触发强制平仓。';
    }
  }

  function openPosition(side) {
    const q = currentQty();
    if (q < 1) return;
    const px = priceOf(selected);
    const pos = posOf(selected);
    if (pos && pos.side !== side) {
      toast('请先平掉 ' + selected + ' 的' + (pos.side === 'long' ? '多头' : '空头') + '仓位', 'bad');
      return;
    }
    const cost = round2(q * px * (1 + FEE));   // 多头买入额 / 空头保证金，均含手续费
    if (cost > state.chips) {
      catEvent('nope', 'shock');
      toast('筹码不足，无法' + (side === 'long' ? '做多' : '做空'), 'bad');
      return;
    }

    state.chips = round2(state.chips - cost);
    const base = pos || { side: side, qty: 0, avg: 0 };
    const newQty = base.qty + q;
    // 多头均价含手续费；空头均价即保证金基准价
    base.avg = side === 'long'
      ? (base.avg * base.qty + cost) / newQty
      : (base.avg * base.qty + q * px) / newQty;
    base.qty = newQty;
    base.side = side;
    state.positions[selected] = base;

    logTrade(side, selected, q, px, -cost);
    catEvent(side, 'money', 4600);
    toast((side === 'long' ? '做多' : '做空') + ' ' + q + ' 股 ' + selected + ' · 占用 ' + fmt(cost) + ' 筹码', 'good');
    afterTrade();
  }

  function closePosition() {
    const pos = posOf(selected);
    if (!pos) return;
    const q = Math.min(currentQty(), pos.qty);
    if (q < 1) return;

    const px = priceOf(selected);
    const proceeds = Math.max(0, closeProceeds(selected, q));
    const invested = pos.side === 'long' ? pos.avg * q : pos.avg * q;
    const realized = round2(proceeds - invested);

    state.chips = round2(state.chips + proceeds);
    pos.qty -= q;
    if (pos.qty <= 0) delete state.positions[selected];
    state.stats.realized = round2(state.stats.realized + realized);

    logTrade('close', selected, q, px, proceeds, realized);
    catEvent('close', realized >= 0 ? 'money' : 'sad', 4600);
    toast('平仓 ' + q + ' 股 ' + selected + ' · 已实现 ' + fmtSigned(realized), realized >= 0 ? 'good' : 'bad');
    if (realized > 0) confetti(22, [C_UP, '#e8c26a']);
    afterTrade();
  }

  function afterTrade() {
    pushEquity();
    renderMarket();
    renderHUD();
    renderTradeLog();
    save();
  }

  function logTrade(kind, sym, qty, px, cash, realized) {
    state.tradeLog.unshift({ t: Date.now(), k: kind, sym: sym, q: qty, px: px, cash: cash, r: realized });
    if (state.tradeLog.length > 24) state.tradeLog.pop();
  }

  const TRADE_META = {
    long:  { cls: 'tag-long',  txt: '做多' },
    short: { cls: 'tag-short', txt: '做空' },
    close: { cls: 'tag-close', txt: '平仓' },
    liq:   { cls: 'tag-liq',   txt: '爆仓' }
  };

  function renderTradeLog() {
    const ul = $('#trade-log');
    if (!state.tradeLog.length) {
      ul.innerHTML = '<li class="empty">猫市场暂无交易记录。</li>';
      return;
    }
    ul.innerHTML = state.tradeLog.map((o, i) => {
      const m = TRADE_META[o.k] || TRADE_META.close;
      const isOpen = o.k === 'long' || o.k === 'short';
      const val = isOpen ? o.cash : o.r;
      const cls = isOpen ? '' : (val > 0 ? 'pos' : val < 0 ? 'neg' : '');
      return '<li style="animation-delay:' + (i * 0.02) + 's">' +
        '<span class="log-tag ' + m.cls + '">' + m.txt + '</span>' +
        '<span class="log-text"><b>' + o.q + '</b> 股 ' + o.sym + ' @ ' + fmtPrice(o.px) + '</span>' +
        '<span class="log-val ' + cls + '">' + fmtSigned(val) + '</span>' +
        '<span class="log-time">' + hhmm(o.t) + '</span></li>';
    }).join('');
  }

  function renderHoldings() {
    const body = $('#holdings-body');
    const syms = Object.keys(state.positions);
    if (!syms.length) {
      body.innerHTML = '<tr class="empty"><td colspan="6">暂无持仓。猫建议先配置一点金枪鱼。</td></tr>';
      return;
    }
    body.innerHTML = syms.map((sym) => {
      const p = state.positions[sym];
      const pl = posPL(sym);
      const plPct = p.avg > 0 ? (pl / (p.avg * p.qty)) * 100 : 0;
      const cls = pl > 0.009 ? 'pos' : pl < -0.009 ? 'neg' : '';
      return '<tr><td><b>' + sym + '</b></td>' +
        '<td><span class="side-badge side-' + p.side + '">' + (p.side === 'long' ? '多' : '空') + '</span></td>' +
        '<td>' + p.qty + '</td><td>' + fmtPrice(p.avg) + '</td><td>' + fmt(posValue(sym)) + '</td>' +
        '<td class="' + cls + '">' + fmtSigned(pl) + '<br><small>' + fmtPct(plPct) + '</small></td></tr>';
    }).join('');
  }

  /* ---------------------------------------------------------
     12. 事件绑定
     --------------------------------------------------------- */
  function wire() {
    // 押注
    $$('.chip', $('#chips-row')).forEach((b) => {
      b.addEventListener('click', () => {
        if (game.inRound) return;
        state.bet = clamp(state.bet + parseInt(b.dataset.chip, 10), 0, Math.floor(state.chips));
        updateBetUI(); save();
      });
    });
    $('#bet-clear').addEventListener('click', () => { if (game.inRound) return; state.bet = 0; updateBetUI(); save(); });
    $('#bet-max').addEventListener('click', () => { if (game.inRound) return; state.bet = Math.floor(state.chips); updateBetUI(); save(); });

    // 牌桌操作
    el.btnDeal.addEventListener('click', startRound);
    el.btnHit.addEventListener('click', hit);
    el.btnStand.addEventListener('click', stand);
    el.btnDouble.addEventListener('click', doubleDown);
    el.btnNew.addEventListener('click', newGame);

    $('#btn-rescue').addEventListener('click', () => {
      state.chips = round2(state.chips + 250);
      state.baseline = round2(state.baseline + 250);   // 救济金不计入盈利
      toast('猫咪救济站借给你 250 筹码 🐱', 'good');
      catSay('救济金到账。这次看好你的毛线球。🧶', 'happy', 5200);
      pushEquity(); renderHUD(); save();
    });

    // 市场
    sel.addEventListener('change', () => selectSymbol(sel.value));
    qtyInput.addEventListener('input', updateTradeCost);
    $('#qty-minus').addEventListener('click', () => { qtyInput.value = Math.max(1, currentQty() - 1); updateTradeCost(); });
    $('#qty-plus').addEventListener('click', () => { qtyInput.value = currentQty() + 1; updateTradeCost(); });
    $('#qty-max').addEventListener('click', () => {
      const pos = posOf(selected);
      if (pos) qtyInput.value = pos.qty;                 // 有持仓时「最大」= 全部平仓
      else qtyInput.value = Math.max(1, Math.floor(state.chips / (priceOf(selected) * (1 + FEE))));
      updateTradeCost();
    });
    $('#btn-long').addEventListener('click', () => openPosition('long'));
    $('#btn-short').addEventListener('click', () => openPosition('short'));
    $('#btn-close').addEventListener('click', closePosition);
    $('#btn-pause').addEventListener('click', (e) => {
      marketPaused = !marketPaused;
      e.target.textContent = marketPaused ? '恢复行情' : '暂停行情';
      toast(marketPaused ? '行情已暂停' : '行情已恢复');
    });

    // 重置
    $('#btn-reset').addEventListener('click', () => {
      if (!window.confirm('确定要重置本局吗？筹码、持仓与所有记录都会清空。')) return;
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      state = defaultState();
      TICKERS.forEach((t) => { state.market[t.sym] = { price: t.price, open: t.price, history: seedHistory(t.price, t.vol) }; });
      lastNet = null;
      newGame();
      renderMarket(); renderHUD(); renderHandLog(); renderTradeLog();
      save();
      catSay('新的一局，新的筹码。谁也没看见刚才那些。😼', 'smug', 5200);
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'h' && !el.btnHit.disabled) { e.preventDefault(); hit(); }
      else if (k === 's' && !el.btnStand.disabled) { e.preventDefault(); stand(); }
      else if (k === 'd' && !el.btnDouble.disabled) { e.preventDefault(); doubleDown(); }
      else if ((k === 'enter' || k === ' ') && !el.btnDeal.disabled) { e.preventDefault(); startRound(); }
    });

    // 页面隐藏时暂停行情，避免回来时价格跳变过大
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearInterval(tickTimer);
      else startMarket();
    });
  }

  /* ---------------------------------------------------------
     13. 启动
     --------------------------------------------------------- */
  function init() {
    buildShoe();
    buildMarketUI();
    selectSymbol(selected);
    wire();
    renderScores(true);
    renderMarket();
    renderHandLog();
    renderTradeLog();
    if (!state.equity.length) pushEquity();
    renderHUD();
    setActions({ hit: false, stand: false, double: false, deal: true });
    updateBetUI();
    startMarket();

    const returning = state.stats.hands > 0 || state.tradeLog.length > 0;
    catSay(
      returning
        ? '你回来了。' + fmt(state.chips) + ' 筹码还在原处。🐾'
        : '欢迎来到 CATJACK。先下注，看看牌靴今天心情如何。🐾',
      'smug', 6000
    );
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // 便于在控制台手动调试
  window.CatJack = {
    state: () => state,
    handValue: handValue,
    tick: tick,
    portfolioValue: portfolioValue,
    unrealizedPL: unrealizedPL
  };
})();
