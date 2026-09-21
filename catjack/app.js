/* ============================================================
   CATJACK v3 —— 招财猫二十一点 + 猫市场（做多 / 做空）
   Bilingual: 中文 / English.  Vanilla JS, no deps, localStorage.
   配色：红涨绿跌（Chinese market convention: red = up/gain）
   ============================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     0. Helpers
     --------------------------------------------------------- */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const round2 = (n) => Math.round(n * 100) / 100;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------------------------------------------------------
     1. Config
     --------------------------------------------------------- */
  const STORE_KEY   = 'catjack.v3';
  const START_CHIPS = 1000;
  const MIN_BET     = 10;
  const DECKS       = 6;
  const FEE         = 0.002;
  const TICK_MS     = 2600;
  const HIST_LEN    = 60;
  const CHIP_DENOMS = [500, 100, 25, 10];

  const TICKERS = [
    { sym: 'CATX', zh: '猫山控股',   en: 'Catamount Holdings',   price: 184.20, vol: 0.016, drift:  0.0007 },
    { sym: 'MEOW', zh: '喵喵基金',   en: 'Meowtual Funds',       price:  62.40, vol: 0.024, drift:  0.0005 },
    { sym: 'PURR', zh: '呼噜能源',   en: 'Purrfect Energy',      price:  27.95, vol: 0.031, drift:  0.0003 },
    { sym: 'WHSK', zh: '胡须实验室', en: 'Whiskerworks Labs',    price: 412.10, vol: 0.021, drift:  0.0009 },
    { sym: 'NINE', zh: '九命保险',   en: 'Nine Lives Insurance', price:  96.75, vol: 0.013, drift:  0.0004 },
    { sym: 'TUNA', zh: '金枪鱼期货', en: 'Tuna Futures Corp.',   price:  13.80, vol: 0.042, drift: -0.0002 }
  ];

  const SUITS = [{ s: '♠', c: 'black' }, { s: '♥', c: 'red' }, { s: '♦', c: 'red' }, { s: '♣', c: 'black' }];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const C_UP = '#ff4d5e';   // 红 = up / gain
  const C_DN = '#2ecc8f';   // 绿 = down / loss

  /* ---------------------------------------------------------
     2. i18n
     --------------------------------------------------------- */
  const I18N = {
    zh: {
      'doc.title': 'CATJACK 招财猫二十一点 · 猫市场',
      'brand.sub': '招财猫二十一点',
      'nav.table': '牌桌', 'nav.market': '猫市场', 'nav.logs': '记录',
      'hud.chips': '筹码', 'hud.portfolio': '持仓市值', 'hud.networth': '总资产',
      'dash.eyebrow': '总资产 · 本局进行中', 'dash.unit': '筹码', 'dash.since': '自本次开局以来',
      'dash.cash': '筹码', 'dash.market': '市场',
      'kpi.hands': '已玩手数', 'kpi.winrate': '胜率', 'kpi.winrateX': '获胜手数 / 总手数',
      'kpi.pl': '市场盈亏', 'kpi.streak': '连胜连败', 'kpi.streakX': '连续手数',
      'record': '{w}胜 · {l}负 · {p}和', 'realized': '已实现 {n}',
      'streak.win': '{n} 连胜 🔥', 'streak.lose': '{n} 连败 ❄️',
      'table.title': '主牌桌', 'table.sub': '黑杰克赔付 3 比 2 · 庄家 17 点停牌 · 六副牌牌靴',
      'felt.arc': '黑 杰 克 赔 付 三 比 二 · 庄 家 十 七 点 停 牌',
      'cat.name': '胡须掌柜', 'cat.live': '在桌', 'cat.role': '首席荷官 · 九条命，零耐心',
      'shoe': '牌靴', 'shoe.count': '{n} 张',
      'dealer': '庄家', 'you': '你', 'pot': '本手押注', 'score.soft': '软{n}',
      'bet.k': '押注', 'bet.unit': '筹码', 'bet.max': '全下',
      'actions.k': '操作', 'btn.deal': '发牌', 'btn.hit': '要牌', 'btn.stand': '停牌',
      'btn.double': '加倍', 'btn.new': '新一局',
      'balance.k': '筹码余额', 'balance.x': '牌桌与市场共用同一份筹码', 'btn.rescue': '申请猫咪救济金（+250）',
      'market.title': '猫市场', 'market.sub': '实时模拟行情', 'market.legendUp': '红涨', 'market.legendDown': '绿跌',
      'market.fee': '手续费 0.2%', 'market.ls': '可做多做空', 'btn.pause': '暂停行情', 'btn.resume': '恢复行情',
      'heat.k': '市场情绪', 'heat.fear': '恐慌', 'heat.calm': '平静', 'heat.greed': '贪婪',
      'focus.open': '开盘', 'focus.hi': '最高', 'focus.lo': '最低', 'focus.vol': '波动',
      'wallet.title': '我的持仓', 'wallet.unit': '筹码', 'wallet.pl': '浮动盈亏',
      'trade.symbol': '标的', 'trade.qty': '数量（股）', 'trade.max': '最大',
      'trade.openCost': '开仓预计金额', 'trade.closeGet': '平仓 {n} 股预计收回',
      'btn.long': '做多', 'btn.short': '做空', 'btn.close': '平仓',
      'trade.note': '做空需按开仓价缴纳等额保证金；价格翻倍即触发强制平仓。',
      'trade.pos': '当前持仓：<b>{side} {n} 股</b> · 均价 {avg} · 浮动 <b class="{cls}">{pl}</b>。同一标的需先平仓才能反向开仓。',
      'th.symbol': '标的', 'th.side': '方向', 'th.qty': '数量', 'th.avg': '均价', 'th.value': '市值', 'th.pl': '盈亏',
      'side.long': '多', 'side.short': '空', 'side.longWord': '做多', 'side.shortWord': '做空',
      'holdings.empty': '暂无持仓。猫建议先配置一点金枪鱼。',
      'hold.tag': '{n} 股',
      'stock.open': '开盘 {p}',
      'logs.title': '记录', 'logs.saved': '全部保存在本浏览器', 'btn.reset': '重置本局',
      'logs.hands': '牌局历史', 'logs.trades': '交易记录',
      'logs.handsEmpty': '还没有打过任何一手牌。', 'logs.tradesEmpty': '猫市场暂无交易记录。',
      'log.hand': '你 <b>{p}</b> 点 · 庄家 <b>{d}</b> 点', 'log.doubled': ' · <i>已加倍</i>',
      'log.trade': '<b>{n}</b> 股 {sym} @ {px}',
      'tag.win': '赢', 'tag.lose': '输', 'tag.push': '和', 'tag.bj': '黑杰克',
      'tag.long': '做多', 'tag.short': '做空', 'tag.close': '平仓', 'tag.liq': '爆仓',
      'badge.bj': '黑杰克 · +{n}', 'badge.pushBoth': '平局 · 双方黑杰克', 'badge.dealerBJ': '庄家黑杰克 · −{n}',
      'badge.bust': '你爆牌了 · −{n}', 'badge.dealerBust': '庄家爆牌 · +{n}', 'badge.win': '你赢了这一手 · +{n}',
      'badge.dealerWin': '庄家获胜 · −{n}', 'badge.push': '平局',
      'toast.reshuffle': '牌靴已重新洗牌 · 六副牌', 'toast.minBet': '最低押注为 {n} 筹码', 'toast.noChips': '筹码不足',
      'toast.bj': '黑杰克！+{n} 筹码', 'toast.win': '赢下一手：+{n} 筹码',
      'toast.bailout': '猫咪救济站借给你 250 筹码 🐱',
      'toast.paused': '行情已暂停', 'toast.resumed': '行情已恢复',
      'toast.open': '{side} {n} 股 {sym} · 占用 {c} 筹码',
      'toast.close': '平仓 {n} 股 {sym} · 已实现 {r}',
      'toast.liq': '{sym} 空单强制平仓，保证金 {n} 归零',
      'toast.needClose': '请先平掉 {sym} 的{side}仓位', 'toast.cantAfford': '筹码不足，无法{side}',
      'confirm.reset': '确定要重置本局吗？筹码、持仓与所有记录都会清空。',
      'foot.1': 'CATJACK · 纯前端演示，无后端。筹码是虚拟的，猫是认真的。',
      'cat.welcome': '欢迎来到 CATJACK。先下注，看看牌靴今天心情如何。🐾',
      'cat.back': '你回来了。{n} 筹码还在原处。🐾',
      'cat.newGame': '牌桌已清空，牌靴换新。这次押多少？🐾',
      'cat.reset': '新的一局，新的筹码。谁也没看见刚才那些。😼',
      'cat.rescue': '救济金到账。这次看好你的毛线球。🧶'
    },
    en: {
      'doc.title': 'CATJACK · Blackjack & Cat Market',
      'brand.sub': 'lucky-cat blackjack',
      'nav.table': 'Table', 'nav.market': 'Cat Market', 'nav.logs': 'Logs',
      'hud.chips': 'Chips', 'hud.portfolio': 'Positions', 'hud.networth': 'Net worth',
      'dash.eyebrow': 'Net worth · session live', 'dash.unit': 'chips', 'dash.since': 'since the session started',
      'dash.cash': 'Chips', 'dash.market': 'Market',
      'kpi.hands': 'Hands played', 'kpi.winrate': 'Win rate', 'kpi.winrateX': 'wins / hands played',
      'kpi.pl': 'Market P/L', 'kpi.streak': 'Streak', 'kpi.streakX': 'consecutive hands',
      'record': '{w}W · {l}L · {p}P', 'realized': 'realized {n}',
      'streak.win': '{n} wins 🔥', 'streak.lose': '{n} losses ❄️',
      'table.title': 'Main table', 'table.sub': 'Blackjack pays 3:2 · Dealer stands on 17 · Six-deck shoe',
      'felt.arc': 'B L A C K J A C K   P A Y S   3   T O   2 · D E A L E R   S T A N D S   O N   1 7',
      'cat.name': 'Mr. Whiskers', 'cat.live': 'at table', 'cat.role': 'Head dealer · nine lives, zero patience',
      'shoe': 'Shoe', 'shoe.count': '{n} cards',
      'dealer': 'Dealer', 'you': 'You', 'pot': 'In the pot', 'score.soft': 'soft {n}',
      'bet.k': 'Bet', 'bet.unit': 'chips', 'bet.max': 'ALL IN',
      'actions.k': 'Actions', 'btn.deal': 'Deal', 'btn.hit': 'Hit', 'btn.stand': 'Stand',
      'btn.double': 'Double', 'btn.new': 'New game',
      'balance.k': 'Chip balance', 'balance.x': 'The same chips fund the table and the market',
      'btn.rescue': 'Claim cat bailout (+250)',
      'market.title': 'Cat Market', 'market.sub': 'Live simulated feed', 'market.legendUp': 'red = up',
      'market.legendDown': 'green = down', 'market.fee': '0.2% fee', 'market.ls': 'long & short',
      'btn.pause': 'pause feed', 'btn.resume': 'resume feed',
      'heat.k': 'Market mood', 'heat.fear': 'Fear', 'heat.calm': 'Calm', 'heat.greed': 'Greed',
      'focus.open': 'Open', 'focus.hi': 'High', 'focus.lo': 'Low', 'focus.vol': 'Range',
      'wallet.title': 'My positions', 'wallet.unit': 'chips', 'wallet.pl': 'Unrealized P/L',
      'trade.symbol': 'Symbol', 'trade.qty': 'Quantity (shares)', 'trade.max': 'MAX',
      'trade.openCost': 'Est. cost to open', 'trade.closeGet': 'Est. proceeds closing {n}',
      'btn.long': 'Long', 'btn.short': 'Short', 'btn.close': 'Close',
      'trade.note': 'A short locks an equal margin at entry; if the price doubles it is liquidated.',
      'trade.pos': 'Open position: <b>{side} {n} sh</b> · avg {avg} · unrealized <b class="{cls}">{pl}</b>. Close it before opening the other side.',
      'th.symbol': 'Symbol', 'th.side': 'Side', 'th.qty': 'Qty', 'th.avg': 'Avg', 'th.value': 'Value', 'th.pl': 'P/L',
      'side.long': 'L', 'side.short': 'S', 'side.longWord': 'Long', 'side.shortWord': 'Short',
      'holdings.empty': 'No positions. The cat suggests some tuna exposure.',
      'hold.tag': '{n} sh',
      'stock.open': 'open {p}',
      'logs.title': 'Logs', 'logs.saved': 'Everything is stored in this browser', 'btn.reset': 'reset session',
      'logs.hands': 'Hand history', 'logs.trades': 'Trade history',
      'logs.handsEmpty': 'No hands played yet.', 'logs.tradesEmpty': 'No trades in the Cat Market yet.',
      'log.hand': 'You <b>{p}</b> · dealer <b>{d}</b>', 'log.doubled': ' · <i>doubled</i>',
      'log.trade': '<b>{n}</b> × {sym} @ {px}',
      'tag.win': 'Win', 'tag.lose': 'Loss', 'tag.push': 'Push', 'tag.bj': 'Blackjack',
      'tag.long': 'Long', 'tag.short': 'Short', 'tag.close': 'Close', 'tag.liq': 'Liquidated',
      'badge.bj': 'BLACKJACK · +{n}', 'badge.pushBoth': 'PUSH · BOTH BLACKJACK', 'badge.dealerBJ': 'DEALER BLACKJACK · −{n}',
      'badge.bust': 'YOU BUST · −{n}', 'badge.dealerBust': 'DEALER BUSTS · +{n}', 'badge.win': 'YOU WIN · +{n}',
      'badge.dealerWin': 'DEALER WINS · −{n}', 'badge.push': 'PUSH',
      'toast.reshuffle': 'Shoe reshuffled · six decks', 'toast.minBet': 'Minimum bet is {n} chips',
      'toast.noChips': 'Not enough chips',
      'toast.bj': 'Blackjack! +{n} chips', 'toast.win': 'Hand won: +{n} chips',
      'toast.bailout': 'The cat shelter lends you 250 chips 🐱',
      'toast.paused': 'Feed paused', 'toast.resumed': 'Feed running',
      'toast.open': '{side} {n} × {sym} · {c} chips committed',
      'toast.close': 'Closed {n} × {sym} · realized {r}',
      'toast.liq': '{sym} short liquidated — {n} margin wiped',
      'toast.needClose': 'Close your {side} position on {sym} first', 'toast.cantAfford': 'Not enough chips to go {side}',
      'confirm.reset': 'Reset the session? Chips, positions and every log will be cleared.',
      'foot.1': 'CATJACK · front-end demo, no backend. The chips are virtual, the cat is serious.',
      'cat.welcome': 'Welcome to CATJACK. Place a bet and let us see what the shoe says. 🐾',
      'cat.back': 'You are back. Your {n} chips are exactly where you left them. 🐾',
      'cat.newGame': 'Table cleared, fresh shoe. How much this time? 🐾',
      'cat.reset': 'New session, new chips. Nobody saw any of that. 😼',
      'cat.rescue': 'Bailout received. Mind your yarn ball this time. 🧶'
    }
  };

  const LINES = {
    zh: {
      idle: ['下注吧，看看牌靴今天心情如何。🐾', '打牌还是炒股？两样都费猫粮。', '我有九条命，但没有耐心。发牌。', '市场在打呼噜……暂时是。'],
      deal: ['牌已上桌，请勿用爪子挠。', '发牌中……屏住胡须。', '来吧，愿金枪鱼与你同在。'],
      hit:  ['再要一张，有胆识。😼', '确定？好吧，你说了算。', '紧张的呼噜声正在加剧……'],
      safe: ['这牌不错，我就不动了。', '一手好牌，别把它玩坏。'],
      risky:['这个 16 点闻着像麻烦……', '你在玩毛线球的最后一圈。'],
      win:  ['喵！这一手是我们的了。🎉', '赢了！记得留点筹码买金枪鱼。', '这就叫稳稳落地。'],
      lose: ['喵呜……这局归庄家了。', '庄家也是要吃饭的，你懂的。', '只是挠了一下自尊，不疼。'],
      push: ['平局。没人呼噜，也没人哈气。', '技术性平局，很有外交风度。'],
      bj:   ['黑杰克！我得去多拿点筹码。😻', '开局就 21 点！这得去睡一觉庆祝。'],
      bust: ['爆了。连猫都知道什么时候收手。', '22 点以上……那已经是别的游戏了。🙀'],
      dealerBust: ['我爆了。优雅地失手。', '庄家爆牌，别到处说。'],
      double:['加倍！我喜欢你这股莽劲。', '加倍下注，风险的呼噜声。'],
      long: ['做多建仓，愿曲线一路向上。📈', '仓位已开，接下来盯紧盘面。', '买还是等？你已经决定了。🐱'],
      short:['做空？跟逆着毛摸猫一样刺激。😼', '空单已开。记住：保证金被冻住了。', '看跌的猫，尾巴摇得最快。📉'],
      close:['平仓完毕，盈亏落袋。', '仓位关闭，很明智。', '离开市场，回到牌桌。'],
      liq:  ['爆仓了！保证金被市场叼走了。🙀', '强制平仓……这一爪抓得有点狠。'],
      marketUp:  ['市场涨得像猫爬窗帘。📈', '满屏飘红！有人把金枪鱼撒了。'],
      marketDown:['这个市场在搞什么鬼…… 📉', '绿了。别慌，我替你慌。'],
      broke:['筹码见底了。申请救济金，或者卖点仓位。', '仓位空、筹码空：流浪猫模式启动。'],
      nope: ['筹码不够，冠军。', '数学说不行，我也说不行。']
    },
    en: {
      idle: ['Place your bet and let us see what the shoe says. 🐾', 'Cards or markets? Both burn cat food.', 'Nine lives, zero patience. Deal.', 'The market is purring… for now.'],
      deal: ['Cards on the table. No claws, please.', 'Dealing… hold your whiskers.', 'Here we go. May the tuna be with you.'],
      hit:  ['One more card. Bold. 😼', 'Sure? Fine, you are the boss.', 'Nervous purring intensifies…'],
      safe: ['Nice hand. I would not move.', 'Good cards. Do not ruin them.'],
      risky:['That 16 smells like trouble…', 'You are playing the last loop of the yarn.'],
      win:  ['Meow! That hand is ours. 🎉', 'A win! Save some chips for tuna.', 'That is what landing on your feet looks like.'],
      lose: ['Meowch… the house takes that one.', 'The dealer has to eat too, you know.', 'Just a scratch on your pride.'],
      push: ['Push. Nobody purrs, nobody hisses.', 'A technical draw. Very diplomatic.'],
      bj:   ['BLACKJACK! I need more chips. 😻', 'Twenty-one off the deal! Time for a nap.'],
      bust: ['Bust. Even a cat knows when to stop.', 'Over 21… that is a different game. 🙀'],
      dealerBust: ['I busted. Elegantly clumsy.', 'Dealer bust. Do not tell anyone.'],
      double:['Doubling! I like your reckless streak.', 'Double down: the purr of risk.'],
      long: ['Long it is. May the curve go up. 📈', 'Position open. Now watch the tape.', 'Buy or wait? You already chose. 🐱'],
      short:['Short? As thrilling as petting a cat backwards. 😼', 'Short open. Remember: your margin is frozen.', 'A bearish cat wags fastest. 📉'],
      close:['Closed. Profit in the jar.', 'Position closed. Very sensible.', 'Out of the market, back to the table.'],
      liq:  ['Liquidated! The market took the margin. 🙀', 'Forced close… that one had claws.'],
      marketUp:  ['The market is climbing like a cat up a curtain. 📈', 'Red everywhere! Someone spilled the tuna.'],
      marketDown:['That market is doing something weird… 📉', 'Green. Relax. I will panic for you.'],
      broke:['Chips are gone. Claim the bailout or close something.', 'No chips, no positions: stray-cat mode.'],
      nope: ['Not enough chips, champ.', 'Maths says no. So do I.']
    }
  };

  let lang = 'zh';
  let nf, nf2;

  function setLocale() {
    const loc = lang === 'zh' ? 'zh-CN' : 'en-US';
    nf  = new Intl.NumberFormat(loc, { maximumFractionDigits: 2 });
    nf2 = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  setLocale();

  const fmt = (n) => nf.format(round2(n || 0));
  const fmtPrice = (n) => nf2.format(n);
  const fmtSigned = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
  const fmtPct = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + nf2.format(Math.abs(n)) + '%';
  const hhmm = (ts) => new Date(ts).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  function t(key, params) {
    let s = (I18N[lang] && I18N[lang][key]) || (I18N.zh[key]) || key;
    if (params) Object.keys(params).forEach((k) => { s = s.split('{' + k + '}').join(params[k]); });
    return s;
  }
  const tickerOf = (sym) => TICKERS.filter((x) => x.sym === sym)[0];
  const nameOf = (sym) => tickerOf(sym)[lang];
  const catLines = () => LINES[lang];

  /* ---------------------------------------------------------
     3. State
     --------------------------------------------------------- */
  const defaultState = () => ({
    v: 3, lang: 'zh',
    chips: START_CHIPS, bet: 50, baseline: START_CHIPS,
    stats: { hands: 0, wins: 0, losses: 0, pushes: 0, streak: 0, realized: 0 },
    positions: {}, market: {}, handLog: [], tradeLog: [], equity: []
  });

  let state = load();

  function load() {
    const base = defaultState();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && saved.v === 3) {
      base.chips     = typeof saved.chips === 'number' && isFinite(saved.chips) ? saved.chips : START_CHIPS;
      base.bet       = typeof saved.bet === 'number' ? saved.bet : 50;
      base.baseline  = typeof saved.baseline === 'number' ? saved.baseline : START_CHIPS;
      base.lang      = saved.lang === 'en' ? 'en' : 'zh';
      base.stats     = Object.assign(base.stats, saved.stats || {});
      base.positions = saved.positions && typeof saved.positions === 'object' ? saved.positions : {};
      base.market    = saved.market && typeof saved.market === 'object' ? saved.market : {};
      base.handLog   = Array.isArray(saved.handLog) ? saved.handLog : [];
      base.tradeLog  = Array.isArray(saved.tradeLog) ? saved.tradeLog : [];
      base.equity    = Array.isArray(saved.equity) ? saved.equity : [];
    }
    TICKERS.forEach((tk) => {
      const m = base.market[tk.sym];
      if (!m || typeof m.price !== 'number' || !isFinite(m.price) || m.price <= 0) {
        base.market[tk.sym] = { price: tk.price, open: tk.price, history: seedHistory(tk.price, tk.vol) };
      } else {
        if (typeof m.open !== 'number' || !isFinite(m.open) || m.open <= 0) m.open = m.price;
        if (!Array.isArray(m.history) || m.history.length < 2) m.history = seedHistory(m.price, tk.vol);
      }
    });
    Object.keys(base.positions).forEach((sym) => {
      const p = base.positions[sym];
      const ok = p && p.qty > 0 && p.avg > 0 && (p.side === 'long' || p.side === 'short');
      if (!TICKERS.some((tk) => tk.sym === sym) || !ok) delete base.positions[sym];
    });
    return base;
  }

  function seedHistory(price, vol) {
    const out = [];
    let p = price * (1 - vol * 3);
    for (let i = 0; i < 28; i++) { p = Math.max(0.5, p * (1 + gauss() * vol * 0.8 + 0.0015)); out.push(round2(p)); }
    out.push(round2(price));
    return out;
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
    }, 120);
  }

  /* ---------------------------------------------------------
     4. Portfolio maths
       long  → value = qty × price
       short → margin frozen at entry; value = qty × (2·avg − price)
     --------------------------------------------------------- */
  const priceOf = (sym) => state.market[sym].price;
  const posOf   = (sym) => state.positions[sym] || null;

  function posValue(sym) {
    const p = posOf(sym); if (!p) return 0;
    const px = priceOf(sym);
    return p.side === 'long' ? p.qty * px : Math.max(0, p.qty * (2 * p.avg - px));
  }
  function posPL(sym) {
    const p = posOf(sym); if (!p) return 0;
    const px = priceOf(sym);
    return p.side === 'long' ? p.qty * (px - p.avg) : p.qty * (p.avg - px);
  }
  const portfolioValue = () => Object.keys(state.positions).reduce((s, sym) => s + posValue(sym), 0);
  const unrealizedPL   = () => Object.keys(state.positions).reduce((s, sym) => s + posPL(sym), 0);
  const netWorth       = () => state.chips + portfolioValue();

  /* ---------------------------------------------------------
     5. Cat
     --------------------------------------------------------- */
  const cat = $('#cat'), catLine = $('#cat-line'), catBubble = $('#cat-bubble');
  let catTimer = null, lastCatKey = 'welcome';

  function catSay(text, mood, hold) {
    if (catLine.textContent !== text) {
      catLine.textContent = text;
      catBubble.classList.remove('pop'); void catBubble.offsetWidth; catBubble.classList.add('pop');
    }
    cat.setAttribute('data-mood', mood || 'idle');
    clearTimeout(catTimer);
    catTimer = setTimeout(() => {
      cat.setAttribute('data-mood', 'idle');
      if (!game.inRound) { lastCatKey = 'idle'; catLine.textContent = pick(catLines().idle); }
    }, hold || 5200);
  }
  function catEvent(key, mood, hold) { lastCatKey = key; catSay(pick(catLines()[key]), mood, hold); }

  /* ---------------------------------------------------------
     6. FX
     --------------------------------------------------------- */
  const toasts = $('#toasts'), fxLayer = $('#fx-layer');

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = '<span>' + (kind === 'good' ? '🧧' : kind === 'bad' ? '⚠️' : '🐾') + '</span><span>' + msg + '</span>';
    toasts.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3200);
  }

  function confetti(n, colors) {
    if (reduceMotion) return;
    const cols = colors || ['#e8c26a', C_UP, '#ffffff', '#b8892f'];
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
    if (reduceMotion) return;
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

  function ambientPaws() {
    const box = $('#bg-paws');
    if (reduceMotion) return;
    let html = '';
    for (let i = 0; i < 8; i++) {
      html += '<span style="left:' + (5 + Math.random() * 90) + 'vw;animation-duration:' +
        (22 + Math.random() * 26) + 's;animation-delay:-' + (Math.random() * 30) + 's;font-size:' +
        (16 + Math.random() * 22) + 'px">🐾</span>';
    }
    box.innerHTML = html;
  }

  /* ---------------------------------------------------------
     7. Chip stacks
     --------------------------------------------------------- */
  function chipBreakdown(amount) {
    const out = [];
    let rest = Math.floor(amount);
    for (let i = 0; i < CHIP_DENOMS.length; i++) {
      const d = CHIP_DENOMS[i];
      while (rest >= d && out.length < 14) { out.push(d); rest -= d; }
    }
    return out;
  }
  function renderStack(el, amount, max) {
    const chips = chipBreakdown(amount).slice(0, max || 8).reverse();
    el.innerHTML = chips.map((d, i) =>
      '<i class="stack-chip v' + d + '" style="bottom:' + (i * 7) + 'px;animation-delay:' + (i * 0.04) + 's">' + d + '</i>'
    ).join('');
  }

  /* ---------------------------------------------------------
     8. Sparkline helper
     --------------------------------------------------------- */
  function sparkPath(values, w, h, pad, lo, hi) {
    const p = pad == null ? 3 : pad;
    if (!values.length) return { line: '', area: '', pts: [] };
    let min = lo != null ? lo : Math.min.apply(null, values);
    let max = hi != null ? hi : Math.max.apply(null, values);
    if (max - min < 1e-9) max = min + 1;
    const step = values.length > 1 ? (w - p * 2) / (values.length - 1) : 0;
    const pts = values.map((v, i) => [round2(p + i * step), round2(p + (h - p * 2) * (1 - (v - min) / (max - min)))]);
    const line = pts.map((pt, i) => (i ? 'L' : 'M') + pt[0] + ' ' + pt[1]).join(' ');
    const area = line + ' L' + pts[pts.length - 1][0] + ' ' + h + ' L' + pts[0][0] + ' ' + h + ' Z';
    return { line: line, area: area, pts: pts, min: min, max: max };
  }

  /* ---------------------------------------------------------
     9. HUD
     --------------------------------------------------------- */
  const hud = {
    chips: $('#hud-chips'), portfolio: $('#hud-portfolio'), net: $('#hud-networth'),
    big: $('#networth-big'), delta: $('#networth-delta'),
    cash: $('#equity-cash'), mkt: $('#equity-mkt'), balance: $('#balance'),
    hands: $('#kpi-hands'), record: $('#kpi-record'), winrate: $('#kpi-winrate'),
    pl: $('#kpi-pl'), plx: $('#kpi-pl-x'), streak: $('#kpi-streak'),
    walletTotal: $('#wallet-total'), walletPl: $('#wallet-pl')
  };
  let lastNet = null;

  function flash(el, dir) {
    el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth;
    el.classList.add(dir > 0 ? 'flash-up' : 'flash-down');
  }

  function renderHUD() {
    const pv = portfolioValue(), nw = netWorth();
    hud.chips.textContent = fmt(state.chips);
    hud.portfolio.textContent = fmt(pv);
    hud.net.textContent = fmt(nw);
    hud.big.textContent = fmt(nw);
    hud.balance.textContent = fmt(state.chips);
    hud.walletTotal.textContent = fmt(pv);

    if (lastNet !== null && Math.abs(nw - lastNet) > 0.009) flash(hud.net, nw - lastNet);
    lastNet = nw;

    const d = nw - state.baseline;
    hud.delta.textContent = fmtSigned(d) + ' ' + t('dash.unit');
    hud.delta.className = 'delta ' + (d > 0.009 ? 'up' : d < -0.009 ? 'down' : '');

    const cashPct = clamp((state.chips / Math.max(nw, 1)) * 100, 0, 100);
    hud.cash.style.width = cashPct + '%';
    hud.mkt.style.width = (100 - cashPct) + '%';

    const up = unrealizedPL();
    hud.walletPl.textContent = fmtSigned(up);
    hud.walletPl.className = 'wallet-pl-v ' + (up > 0.009 ? 'pos' : up < -0.009 ? 'neg' : '');

    const s = state.stats;
    hud.hands.textContent = fmt(s.hands);
    hud.record.textContent = t('record', { w: s.wins, l: s.losses, p: s.pushes });
    hud.winrate.textContent = s.hands ? Math.round((s.wins / s.hands) * 100) + '%' : '—';
    const marketPL = up + s.realized;
    hud.pl.textContent = fmtSigned(marketPL);
    hud.pl.className = 'kpi-v ' + (marketPL > 0.009 ? 'pos' : marketPL < -0.009 ? 'neg' : '');
    hud.plx.textContent = t('realized', { n: fmtSigned(s.realized) });
    hud.streak.textContent = s.streak === 0 ? '—'
      : (s.streak > 0 ? t('streak.win', { n: s.streak }) : t('streak.lose', { n: Math.abs(s.streak) }));
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
     10. Blackjack
     --------------------------------------------------------- */
  const game = { shoe: [], player: [], dealer: [], bet: 0, inRound: false, busy: false, doubled: false };

  const el = {
    dealerCards: $('#dealer-cards'), playerCards: $('#player-cards'),
    dealerScore: $('#dealer-score'), playerScore: $('#player-score'),
    badge: $('#result-badge'), felt: $('#felt'),
    betAmount: $('#bet-amount'), betStack: $('#bet-stack'),
    pot: $('#pot'), potStack: $('#pot-stack'), potValue: $('#bet-pill-v'),
    shoeCount: $('#shoe-count'), shoeFill: $('#shoe-fill'),
    btnDeal: $('#btn-deal'), btnHit: $('#btn-hit'), btnStand: $('#btn-stand'),
    btnDouble: $('#btn-double'), btnNew: $('#btn-new')
  };

  function buildShoe() {
    const cards = [];
    for (let d = 0; d < DECKS; d++)
      for (let s = 0; s < SUITS.length; s++)
        for (let r = 0; r < RANKS.length; r++)
          cards.push({ rank: RANKS[r], suit: SUITS[s].s, color: SUITS[s].c });
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
    }
    game.shoe = cards;
    renderShoe();
  }

  function draw() {
    if (game.shoe.length < DECKS * 52 * 0.25) { buildShoe(); toast(t('toast.reshuffle')); }
    const c = game.shoe.pop();
    renderShoe();
    return c;
  }
  function renderShoe() {
    el.shoeCount.textContent = t('shoe.count', { n: game.shoe.length });
    el.shoeFill.style.width = (game.shoe.length / (DECKS * 52)) * 100 + '%';
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
        '</div><div class="card-face card-back">福</div>' +
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
    el.playerScore.textContent = game.player.length
      ? (pv.soft && pv.total !== 21 ? t('score.soft', { n: pv.total }) : pv.total) : '—';
    el.playerScore.className = 'hand-score' + (pv.total > 21 ? ' bust' : isBlackjack(game.player) ? ' bj' : '');

    if (!game.dealer.length) { el.dealerScore.textContent = '—'; el.dealerScore.className = 'hand-score'; return; }
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
    el.btnHit.disabled = !o.hit; el.btnStand.disabled = !o.stand;
    el.btnDouble.disabled = !o.double; el.btnDeal.disabled = !o.deal;
  }

  function updateBetUI() {
    const maxBet = Math.floor(state.chips);
    if (state.bet > maxBet) state.bet = Math.max(0, maxBet);
    if (state.bet < MIN_BET && maxBet >= MIN_BET) state.bet = Math.min(MIN_BET, maxBet);
    el.betAmount.textContent = fmt(state.bet);
    if (!game.inRound) {
      el.btnDeal.disabled = !(state.bet >= MIN_BET && state.bet <= maxBet);
      renderStack(el.betStack, state.bet, 6);
    }
  }

  function showBadge(key, params, kind) {
    el.badge.textContent = t(key, params);
    el.badge.className = 'result-badge show ' + kind;
  }
  function clearBadge() { el.badge.className = 'result-badge'; el.badge.textContent = ''; }

  async function startRound() {
    if (game.busy || game.inRound) return;
    const bet = Math.floor(state.bet);
    if (bet < MIN_BET) { toast(t('toast.minBet', { n: MIN_BET }), 'bad'); return; }
    if (bet > state.chips) { catEvent('nope', 'shock'); toast(t('toast.noChips'), 'bad'); return; }

    game.busy = true; game.inRound = true; game.doubled = false;
    game.player = []; game.dealer = []; game.bet = bet;
    state.chips = round2(state.chips - bet);

    el.playerCards.innerHTML = ''; el.dealerCards.innerHTML = '';
    clearBadge();
    el.felt.classList.remove('win', 'lose', 'push');
    el.pot.hidden = false; el.pot.classList.remove('paid');
    el.potValue.textContent = fmt(bet);
    renderStack(el.potStack, bet, 7);
    el.betStack.innerHTML = '';
    setActions({ hit: false, stand: false, double: false, deal: false });
    renderHUD(); save();
    catEvent('deal', 'deal', 3000);

    await dealCard('player'); await dealCard('dealer');
    await dealCard('player'); await dealCard('dealer', true);

    const pBJ = isBlackjack(game.player), dBJ = isBlackjack(game.dealer);
    if (pBJ || dBJ) {
      await revealHole();
      if (pBJ && dBJ) finishRound('push', 'badge.pushBoth');
      else if (pBJ) finishRound('blackjack', 'badge.bj');
      else finishRound('lose', 'badge.dealerBJ');
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
    if (v > 21) { await revealHole(); finishRound('lose', 'badge.bust', 'bust'); game.busy = false; return; }
    if (v === 21) { game.busy = false; await stand(); return; }
    catEvent('hit', 'think', 3200);
    setActions({ hit: true, stand: true, double: false, deal: false });
    game.busy = false;
  }

  async function doubleDown() {
    if (game.busy || !game.inRound) return;
    if (game.player.length !== 2 || state.chips < game.bet) return;
    game.busy = true; game.doubled = true;
    state.chips = round2(state.chips - game.bet);
    game.bet *= 2;
    el.potValue.textContent = fmt(game.bet);
    renderStack(el.potStack, game.bet, 7);
    renderHUD(); save();
    catEvent('double', 'money', 3200);
    setActions({ hit: false, stand: false, double: false, deal: false });
    await dealCard('player');
    if (handValue(game.player).total > 21) { await revealHole(); finishRound('lose', 'badge.bust', 'bust'); game.busy = false; return; }
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
    while (handValue(game.dealer).total < 17) { await dealCard('dealer'); renderScores(true); await sleep(180); }
    renderScores(true);
    const p = handValue(game.player).total, d = handValue(game.dealer).total;
    if (d > 21) finishRound('win', 'badge.dealerBust', 'dealerBust');
    else if (p > d) finishRound('win', 'badge.win');
    else if (p < d) finishRound('lose', 'badge.dealerWin');
    else finishRound('push', 'badge.push');
    game.busy = false;
  }

  function finishRound(result, badgeKey, catKey) {
    const bet = game.bet;
    let delta = 0;

    if (result === 'blackjack') {
      state.chips = round2(state.chips + bet * 2.5);
      delta = round2(bet * 1.5);
      showBadge(badgeKey, { n: fmt(delta) }, 'bj');
      el.felt.classList.add('win');
      confetti(70); coins(9);
      catEvent('bj', 'money', 6000);
      toast(t('toast.bj', { n: fmt(delta) }), 'good');
      state.stats.wins++; state.stats.streak = state.stats.streak > 0 ? state.stats.streak + 1 : 1;
    } else if (result === 'win') {
      state.chips = round2(state.chips + bet * 2);
      delta = bet;
      showBadge(badgeKey, { n: fmt(delta) }, 'win');
      el.felt.classList.add('win');
      confetti(40); coins(6);
      catEvent(catKey === 'dealerBust' ? 'dealerBust' : 'win', 'happy', 5200);
      toast(t('toast.win', { n: fmt(delta) }), 'good');
      state.stats.wins++; state.stats.streak = state.stats.streak > 0 ? state.stats.streak + 1 : 1;
    } else if (result === 'push') {
      state.chips = round2(state.chips + bet);
      showBadge(badgeKey, {}, 'push');
      el.felt.classList.add('push');
      catEvent('push', 'think', 4200);
      state.stats.pushes++; state.stats.streak = 0;
    } else {
      delta = -bet;
      showBadge(badgeKey, { n: fmt(bet) }, 'lose');
      el.felt.classList.add('lose');
      catEvent(catKey === 'bust' ? 'bust' : 'lose', 'sad', 5200);
      state.stats.losses++; state.stats.streak = state.stats.streak < 0 ? state.stats.streak - 1 : -1;
    }

    state.stats.hands++;
    state.handLog.unshift({
      t: Date.now(), r: result, bet: bet, delta: delta,
      p: handValue(game.player).total, d: handValue(game.dealer).total, dbl: game.doubled
    });
    if (state.handLog.length > 24) state.handLog.pop();

    game.inRound = false;
    el.pot.classList.add('paid');
    setTimeout(() => { el.pot.hidden = true; el.pot.classList.remove('paid'); }, 700);
    setActions({ hit: false, stand: false, double: false, deal: true });
    pushEquity(); renderHUD(); renderHandLog(); save();

    if (state.chips < MIN_BET && portfolioValue() < 1) setTimeout(() => catEvent('broke', 'sad', 7000), 1200);
  }

  function newGame() {
    if (game.busy) return;
    game.inRound = false; game.player = []; game.dealer = [];
    el.playerCards.innerHTML = ''; el.dealerCards.innerHTML = '';
    el.pot.hidden = true; clearBadge();
    el.felt.classList.remove('win', 'lose', 'push');
    renderScores(true); buildShoe();
    setActions({ hit: false, stand: false, double: false, deal: true });
    updateBetUI();
    lastCatKey = 'newGame';
    catSay(t('cat.newGame'), 'idle');
  }

  /* ---------------------------------------------------------
     11. Hand log
     --------------------------------------------------------- */
  const RESULT_META = {
    win: { cls: 'tag-win', k: 'tag.win' }, blackjack: { cls: 'tag-bj', k: 'tag.bj' },
    lose: { cls: 'tag-lose', k: 'tag.lose' }, push: { cls: 'tag-push', k: 'tag.push' }
  };

  function renderHandLog() {
    const ul = $('#hand-log');
    if (!state.handLog.length) { ul.innerHTML = '<li class="empty">' + t('logs.handsEmpty') + '</li>'; return; }
    ul.innerHTML = state.handLog.map((h, i) => {
      const m = RESULT_META[h.r] || RESULT_META.push;
      const cls = h.delta > 0 ? 'pos' : h.delta < 0 ? 'neg' : '';
      return '<li style="animation-delay:' + (i * 0.02) + 's">' +
        '<span class="log-tag ' + m.cls + '">' + t(m.k) + '</span>' +
        '<span class="log-text">' + t('log.hand', { p: h.p, d: h.d }) + (h.dbl ? t('log.doubled') : '') + '</span>' +
        '<span class="log-val ' + cls + '">' + fmtSigned(h.delta) + '</span>' +
        '<span class="log-time">' + hhmm(h.t) + '</span></li>';
    }).join('');
  }

  /* ---------------------------------------------------------
     12. Market
     --------------------------------------------------------- */
  const grid = $('#stock-grid'), sel = $('#trade-symbol');
  let selected = TICKERS[0].sym, marketPaused = false, tickTimer = null, lastCatMarketComment = 0;

  function buildTape() {
    const html = TICKERS.concat(TICKERS).map((tk) =>
      '<span class="tape-item" data-sym="' + tk.sym + '"><b>' + tk.sym + '</b>' +
      '<span class="tape-px mono">—</span><i class="tape-chg">—</i></span>'
    ).join('');
    $('#tape-track').innerHTML = html;
    $('#tape-track-2').innerHTML = html;
  }

  function renderTape() {
    TICKERS.forEach((tk) => {
      const m = state.market[tk.sym];
      const chg = ((m.price - m.open) / m.open) * 100;
      const up = chg >= 0;
      $$('.tape-item[data-sym="' + tk.sym + '"]').forEach((n) => {
        n.querySelector('.tape-px').textContent = fmtPrice(m.price);
        const c = n.querySelector('.tape-chg');
        c.textContent = (up ? '▲ ' : '▼ ') + fmtPct(chg);
        c.className = 'tape-chg ' + (up ? 'tape-up' : 'tape-down');
      });
    });
  }

  function buildMarketUI() {
    grid.innerHTML = TICKERS.map((tk) =>
      '<article class="stock" data-sym="' + tk.sym + '" tabindex="0" role="button">' +
        '<div class="stock-top">' +
          '<div><div class="stock-sym">' + tk.sym + '</div><div class="stock-name" data-name="' + tk.sym + '"></div></div>' +
          '<div><div class="stock-price mono" id="px-' + tk.sym + '">—</div><div class="stock-chg" id="chg-' + tk.sym + '">—</div></div>' +
        '</div>' +
        '<div class="stock-spark"><svg viewBox="0 0 240 46" preserveAspectRatio="none">' +
          '<path id="sp-area-' + tk.sym + '" d="" fill="rgba(255,77,94,.12)"></path>' +
          '<path id="sp-' + tk.sym + '" d="" fill="none" stroke="' + C_UP + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>' +
        '</svg></div>' +
        '<div class="stock-foot"><span class="stock-open" data-open="' + tk.sym + '"></span>' +
          '<span class="hold-tag" id="hold-' + tk.sym + '"></span></div>' +
      '</article>'
    ).join('');

    $$('.stock', grid).forEach((node) => {
      const act = () => selectSymbol(node.dataset.sym);
      node.addEventListener('click', act);
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
      if (!reduceMotion) {
        node.addEventListener('mousemove', (e) => {
          const r = node.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          node.style.setProperty('--ry', ((px - 0.5) * 9).toFixed(2) + 'deg');
          node.style.setProperty('--rx', ((0.5 - py) * 9).toFixed(2) + 'deg');
          node.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
          node.style.setProperty('--my', (py * 100).toFixed(1) + '%');
          node.classList.add('tilt');
        });
        node.addEventListener('mouseleave', () => node.classList.remove('tilt'));
      }
    });
    buildTape();
    renderSymbolNames();
  }

  function renderSymbolNames() {
    sel.innerHTML = TICKERS.map((tk) => '<option value="' + tk.sym + '">' + tk.sym + ' · ' + tk[lang] + '</option>').join('');
    sel.value = selected;
    $$('[data-name]').forEach((n) => { n.textContent = tickerOf(n.dataset.name)[lang]; });
    $$('[data-open]').forEach((n) => { n.textContent = t('stock.open', { p: fmtPrice(state.market[n.dataset.open].open) }); });
  }

  function selectSymbol(sym) {
    selected = sym;
    sel.value = sym;
    $$('.stock', grid).forEach((n) => n.classList.toggle('selected', n.dataset.sym === sym));
    renderFocus();
    updateTradeCost();
  }

  function renderMarket(changed) {
    TICKERS.forEach((tk) => {
      const m = state.market[tk.sym];
      const chgPct = ((m.price - m.open) / m.open) * 100;
      const up = chgPct >= 0;
      const card = grid.querySelector('.stock[data-sym="' + tk.sym + '"]');
      if (!card) return;
      const pxEl = $('#px-' + tk.sym), chgEl = $('#chg-' + tk.sym);

      pxEl.textContent = fmtPrice(m.price);
      pxEl.style.color = up ? C_UP : C_DN;
      chgEl.textContent = fmtPct(chgPct);
      chgEl.style.color = up ? C_UP : C_DN;
      card.classList.toggle('up', up);
      card.classList.toggle('down', !up);

      const p = sparkPath(m.history, 240, 46, 2);
      const line = $('#sp-' + tk.sym), area = $('#sp-area-' + tk.sym);
      line.setAttribute('d', p.line);
      line.setAttribute('stroke', up ? C_UP : C_DN);
      area.setAttribute('d', p.area);
      area.setAttribute('fill', up ? 'rgba(255,77,94,.13)' : 'rgba(46,204,143,.12)');

      const pos = posOf(tk.sym), tag = $('#hold-' + tk.sym);
      if (pos) {
        tag.className = 'hold-tag ' + pos.side;
        tag.innerHTML = '<span class="side-badge side-' + pos.side + '">' + t('side.' + pos.side) + '</span>' +
          t('hold.tag', { n: pos.qty }) + ' · ' + fmtSigned(posPL(tk.sym));
      } else { tag.className = 'hold-tag'; tag.textContent = ''; }

      if (changed && changed[tk.sym]) {
        card.classList.remove('tick-up', 'tick-down'); void card.offsetWidth;
        card.classList.add(changed[tk.sym] > 0 ? 'tick-up' : 'tick-down');
      }
    });
    renderTape();
    renderFocus();
    renderHeat();
    renderHoldings();
    updateTradeCost();
  }

  /* --- gráfico principal / focus chart --- */
  function renderFocus() {
    const m = state.market[selected];
    const W = 700, H = 220, PAD = 12;
    const vals = m.history;
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    const span = Math.max(hi - lo, hi * 0.004);
    lo -= span * 0.12; hi += span * 0.12;

    const p = sparkPath(vals, W, H, PAD, lo, hi);
    const chg = ((m.price - m.open) / m.open) * 100;
    const up = chg >= 0;
    const col = up ? C_UP : C_DN;

    $('#fc-line').setAttribute('d', p.line);
    $('#fc-line').setAttribute('stroke', col);
    $('#fc-area').setAttribute('d', p.area);
    $('#fcStop0').setAttribute('stop-color', col);
    $('#fcStop1').setAttribute('stop-color', col);

    let gridHtml = '';
    for (let i = 0; i <= 4; i++) {
      const y = PAD + ((H - PAD * 2) / 4) * i;
      gridHtml += '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '"></line>';
    }
    $('#fc-grid').innerHTML = gridHtml;

    const openY = PAD + (H - PAD * 2) * (1 - (m.open - lo) / (hi - lo));
    const openLine = $('#fc-openline');
    if (m.open >= lo && m.open <= hi) {
      openLine.setAttribute('y1', openY); openLine.setAttribute('y2', openY);
      openLine.style.display = '';
    } else openLine.style.display = 'none';

    const last = p.pts[p.pts.length - 1];
    ['#fc-dot', '#fc-dot-halo'].forEach((id) => {
      const n = $(id);
      n.setAttribute('cx', last[0]); n.setAttribute('cy', last[1]);
      n.setAttribute('fill', col);
    });

    $('#focus-sym').textContent = selected;
    $('#focus-name').textContent = nameOf(selected);
    const priceEl = $('#focus-price');
    priceEl.textContent = fmtPrice(m.price);
    priceEl.style.color = col;
    const chgEl = $('#focus-chg');
    chgEl.textContent = (up ? '▲ ' : '▼ ') + fmtPct(chg);
    chgEl.style.color = col;

    const rawHi = Math.max.apply(null, vals), rawLo = Math.min.apply(null, vals);
    $('#focus-open').textContent = fmtPrice(m.open);
    $('#focus-hi').textContent = fmtPrice(rawHi);
    $('#focus-lo').textContent = fmtPrice(rawLo);
    $('#focus-vol').textContent = nf2.format(((rawHi - rawLo) / rawLo) * 100) + '%';
  }

  function wireFocusTip() {
    const box = $('.focus-chart'), tip = $('#focus-tip');
    box.addEventListener('mousemove', (e) => {
      const m = state.market[selected], vals = m.history;
      const r = box.getBoundingClientRect();
      const ratio = clamp((e.clientX - r.left) / r.width, 0, 1);
      const idx = Math.round(ratio * (vals.length - 1));
      const v = vals[idx];
      const ago = (vals.length - 1 - idx) * (TICK_MS / 1000);
      tip.hidden = false;
      tip.textContent = fmtPrice(v) + '  ·  −' + Math.round(ago) + 's';
      tip.style.left = (ratio * r.width) + 'px';
      tip.style.top = (r.height * 0.5) + 'px';
    });
    box.addEventListener('mouseleave', () => { tip.hidden = true; });
  }

  /* --- termómetro / mood meter --- */
  function renderHeat() {
    let avg = 0;
    TICKERS.forEach((tk) => {
      const m = state.market[tk.sym];
      avg += ((m.price - m.open) / m.open) * 100;
    });
    avg /= TICKERS.length;
    const pos = clamp(50 + avg * 7, 3, 97);
    $('#heat-needle').style.left = pos + '%';
    const label = avg > 1.2 ? t('heat.greed') : avg < -1.2 ? t('heat.fear') : t('heat.calm');
    const lab = $('#heat-label');
    lab.textContent = label;
    lab.style.color = avg > 1.2 ? C_UP : avg < -1.2 ? C_DN : 'var(--ink)';
    const a = $('#heat-avg');
    a.textContent = fmtPct(avg);
    a.className = 'heat-x mono ' + (avg > 0.009 ? 'pos' : avg < -0.009 ? 'neg' : '');
    return avg;
  }

  function tick() {
    if (marketPaused) return;
    const changed = {};
    let sumPct = 0;
    TICKERS.forEach((tk) => {
      const m = state.market[tk.sym];
      const prev = m.price;
      const shock = Math.random() < 0.035 ? gauss() * tk.vol * 3 : 0;
      let next = m.price * (1 + tk.drift + gauss() * tk.vol + shock);
      next = clamp(next, tk.price * 0.12, tk.price * 9);
      m.price = round2(next);
      m.history.push(m.price);
      if (m.history.length > HIST_LEN) m.history.shift();
      changed[tk.sym] = m.price - prev;
      sumPct += ((m.price - prev) / prev) * 100;
    });

    checkLiquidations();
    pushEquity();
    renderMarket(changed);
    renderHUD();
    save();

    const avg = sumPct / TICKERS.length, now = Date.now();
    if (Math.abs(avg) > 1.15 && now - lastCatMarketComment > 22000 && !game.inRound) {
      lastCatMarketComment = now;
      catEvent(avg > 0 ? 'marketUp' : 'marketDown', avg > 0 ? 'money' : 'shock', 5200);
    }
  }

  function checkLiquidations() {
    Object.keys(state.positions).forEach((sym) => {
      const p = state.positions[sym];
      if (p.side !== 'short' || priceOf(sym) < p.avg * 2) return;
      const lost = round2(p.avg * p.qty);
      state.stats.realized = round2(state.stats.realized - lost);
      logTrade('liq', sym, p.qty, priceOf(sym), 0, -lost);
      delete state.positions[sym];
      toast(t('toast.liq', { sym: sym, n: fmt(lost) }), 'bad');
      catEvent('liq', 'shock', 6000);
      renderTradeLog();
    });
  }

  function startMarket() { clearInterval(tickTimer); tickTimer = setInterval(tick, TICK_MS); }
  setInterval(() => {
    $('#mkt-clock').textContent = new Date().toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-GB');
  }, 1000);

  /* ---------------------------------------------------------
     13. Trading
     --------------------------------------------------------- */
  const qtyInput = $('#trade-qty');
  const currentQty = () => { const n = parseInt(qtyInput.value, 10); return isFinite(n) && n > 0 ? n : 0; };

  function closeProceeds(sym, qty) {
    const p = posOf(sym); if (!p) return 0;
    const px = priceOf(sym), fee = qty * px * FEE;
    return p.side === 'long' ? round2(qty * px - fee) : round2(qty * p.avg + qty * (p.avg - px) - fee);
  }

  function updateTradeCost() {
    const q = currentQty(), px = priceOf(selected), pos = posOf(selected);
    const open = round2(q * px * (1 + FEE));

    if (pos && q >= 1) {
      const closable = Math.min(q, pos.qty);
      $('#trade-cost-k').textContent = t('trade.closeGet', { n: closable });
      $('#trade-cost').textContent = fmt(Math.max(0, closeProceeds(selected, closable)));
    } else {
      $('#trade-cost-k').textContent = t('trade.openCost');
      $('#trade-cost').textContent = fmt(open);
    }

    $('#btn-long').disabled  = q < 1 || open > state.chips || !!(pos && pos.side === 'short');
    $('#btn-short').disabled = q < 1 || open > state.chips || !!(pos && pos.side === 'long');
    $('#btn-close').disabled = !pos || q < 1;

    const note = $('#trade-note');
    if (pos) {
      const pl = posPL(selected);
      note.className = 'trade-note warn';
      note.innerHTML = t('trade.pos', {
        side: t(pos.side === 'long' ? 'side.longWord' : 'side.shortWord'),
        n: pos.qty, avg: fmtPrice(pos.avg),
        pl: fmtSigned(pl), cls: pl >= 0 ? 'pos' : 'neg'
      });
    } else { note.className = 'trade-note'; note.textContent = t('trade.note'); }
  }

  function openPosition(side) {
    const q = currentQty(); if (q < 1) return;
    const px = priceOf(selected), pos = posOf(selected);
    const sideWord = t(side === 'long' ? 'side.longWord' : 'side.shortWord');
    if (pos && pos.side !== side) {
      toast(t('toast.needClose', { sym: selected, side: t(pos.side === 'long' ? 'side.longWord' : 'side.shortWord') }), 'bad');
      return;
    }
    const cost = round2(q * px * (1 + FEE));
    if (cost > state.chips) { catEvent('nope', 'shock'); toast(t('toast.cantAfford', { side: sideWord }), 'bad'); return; }

    state.chips = round2(state.chips - cost);
    const base = pos || { side: side, qty: 0, avg: 0 };
    const newQty = base.qty + q;
    base.avg = side === 'long' ? (base.avg * base.qty + cost) / newQty : (base.avg * base.qty + q * px) / newQty;
    base.qty = newQty; base.side = side;
    state.positions[selected] = base;

    logTrade(side, selected, q, px, -cost);
    catEvent(side, 'money', 4600);
    toast(t('toast.open', { side: sideWord, n: q, sym: selected, c: fmt(cost) }), 'good');
    afterTrade();
  }

  function closePosition() {
    const pos = posOf(selected); if (!pos) return;
    const q = Math.min(currentQty(), pos.qty); if (q < 1) return;
    const px = priceOf(selected);
    const proceeds = Math.max(0, closeProceeds(selected, q));
    const realized = round2(proceeds - pos.avg * q);

    state.chips = round2(state.chips + proceeds);
    pos.qty -= q;
    if (pos.qty <= 0) delete state.positions[selected];
    state.stats.realized = round2(state.stats.realized + realized);

    logTrade('close', selected, q, px, proceeds, realized);
    catEvent('close', realized >= 0 ? 'money' : 'sad', 4600);
    toast(t('toast.close', { n: q, sym: selected, r: fmtSigned(realized) }), realized >= 0 ? 'good' : 'bad');
    if (realized > 0) confetti(22, [C_UP, '#e8c26a']);
    afterTrade();
  }

  function afterTrade() { pushEquity(); renderMarket(); renderHUD(); renderTradeLog(); save(); }

  function logTrade(kind, sym, qty, px, cash, realized) {
    state.tradeLog.unshift({ t: Date.now(), k: kind, sym: sym, q: qty, px: px, cash: cash, r: realized });
    if (state.tradeLog.length > 24) state.tradeLog.pop();
  }

  const TRADE_META = {
    long: { cls: 'tag-long', k: 'tag.long' }, short: { cls: 'tag-short', k: 'tag.short' },
    close: { cls: 'tag-close', k: 'tag.close' }, liq: { cls: 'tag-liq', k: 'tag.liq' }
  };

  function renderTradeLog() {
    const ul = $('#trade-log');
    if (!state.tradeLog.length) { ul.innerHTML = '<li class="empty">' + t('logs.tradesEmpty') + '</li>'; return; }
    ul.innerHTML = state.tradeLog.map((o, i) => {
      const m = TRADE_META[o.k] || TRADE_META.close;
      const isOpen = o.k === 'long' || o.k === 'short';
      const val = isOpen ? o.cash : o.r;
      const cls = isOpen ? '' : (val > 0 ? 'pos' : val < 0 ? 'neg' : '');
      return '<li style="animation-delay:' + (i * 0.02) + 's">' +
        '<span class="log-tag ' + m.cls + '">' + t(m.k) + '</span>' +
        '<span class="log-text">' + t('log.trade', { n: o.q, sym: o.sym, px: fmtPrice(o.px) }) + '</span>' +
        '<span class="log-val ' + cls + '">' + fmtSigned(val) + '</span>' +
        '<span class="log-time">' + hhmm(o.t) + '</span></li>';
    }).join('');
  }

  function renderHoldings() {
    const body = $('#holdings-body');
    const syms = Object.keys(state.positions);
    if (!syms.length) { body.innerHTML = '<tr class="empty"><td colspan="6">' + t('holdings.empty') + '</td></tr>'; return; }
    body.innerHTML = syms.map((sym) => {
      const p = state.positions[sym];
      const pl = posPL(sym);
      const plPct = p.avg > 0 ? (pl / (p.avg * p.qty)) * 100 : 0;
      const cls = pl > 0.009 ? 'pos' : pl < -0.009 ? 'neg' : '';
      return '<tr><td><b>' + sym + '</b></td>' +
        '<td><span class="side-badge side-' + p.side + '">' + t('side.' + p.side) + '</span></td>' +
        '<td>' + p.qty + '</td><td>' + fmtPrice(p.avg) + '</td><td>' + fmt(posValue(sym)) + '</td>' +
        '<td class="' + cls + '">' + fmtSigned(pl) + '<br><small>' + fmtPct(plPct) + '</small></td></tr>';
    }).join('');
  }

  /* ---------------------------------------------------------
     14. Language switching
     --------------------------------------------------------- */
  function applyLang(next) {
    lang = next === 'en' ? 'en' : 'zh';
    state.lang = lang;
    setLocale();
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('doc.title');
    $$('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    $$('.lang-btn').forEach((b) => b.classList.toggle('is-on', b.dataset.lang === lang));
    $('#felt-arc').textContent = t('felt.arc');
    $('#btn-pause').textContent = t(marketPaused ? 'btn.resume' : 'btn.pause');
    renderSymbolNames();
    renderShoe();
    renderScores(!game.inRound);
    renderMarket();
    renderHUD();
    renderHandLog();
    renderTradeLog();
    // el gato repite su última frase en el nuevo idioma
    if (catLines()[lastCatKey]) catSay(pick(catLines()[lastCatKey]), cat.getAttribute('data-mood'));
    else catSay(t(lastCatKey === 'welcome' ? 'cat.welcome' : 'cat.newGame'), 'smug');
    save();
  }

  /* ---------------------------------------------------------
     15. Events
     --------------------------------------------------------- */
  function wire() {
    $$('.chip', $('#chips-row')).forEach((b) => {
      b.addEventListener('click', () => {
        if (game.inRound) return;
        state.bet = clamp(state.bet + parseInt(b.dataset.chip, 10), 0, Math.floor(state.chips));
        updateBetUI(); save();
      });
    });
    $('#bet-clear').addEventListener('click', () => { if (game.inRound) return; state.bet = 0; updateBetUI(); save(); });
    $('#bet-max').addEventListener('click', () => { if (game.inRound) return; state.bet = Math.floor(state.chips); updateBetUI(); save(); });

    el.btnDeal.addEventListener('click', startRound);
    el.btnHit.addEventListener('click', hit);
    el.btnStand.addEventListener('click', stand);
    el.btnDouble.addEventListener('click', doubleDown);
    el.btnNew.addEventListener('click', newGame);

    $('#btn-rescue').addEventListener('click', () => {
      state.chips = round2(state.chips + 250);
      state.baseline = round2(state.baseline + 250);
      toast(t('toast.bailout'), 'good');
      lastCatKey = 'rescue';
      catSay(t('cat.rescue'), 'happy', 5200);
      pushEquity(); renderHUD(); save();
    });

    sel.addEventListener('change', () => selectSymbol(sel.value));
    qtyInput.addEventListener('input', updateTradeCost);
    $('#qty-minus').addEventListener('click', () => { qtyInput.value = Math.max(1, currentQty() - 1); updateTradeCost(); });
    $('#qty-plus').addEventListener('click', () => { qtyInput.value = currentQty() + 1; updateTradeCost(); });
    $('#qty-max').addEventListener('click', () => {
      const pos = posOf(selected);
      qtyInput.value = pos ? pos.qty : Math.max(1, Math.floor(state.chips / (priceOf(selected) * (1 + FEE))));
      updateTradeCost();
    });
    $('#btn-long').addEventListener('click', () => openPosition('long'));
    $('#btn-short').addEventListener('click', () => openPosition('short'));
    $('#btn-close').addEventListener('click', closePosition);
    $('#btn-pause').addEventListener('click', (e) => {
      marketPaused = !marketPaused;
      e.target.textContent = t(marketPaused ? 'btn.resume' : 'btn.pause');
      toast(t(marketPaused ? 'toast.paused' : 'toast.resumed'));
    });

    $$('.lang-btn').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));

    $('#btn-reset').addEventListener('click', () => {
      if (!window.confirm(t('confirm.reset'))) return;
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      const keepLang = lang;
      state = defaultState();
      state.lang = keepLang;
      TICKERS.forEach((tk) => { state.market[tk.sym] = { price: tk.price, open: tk.price, history: seedHistory(tk.price, tk.vol) }; });
      lastNet = null;
      newGame();
      renderMarket(); renderHUD(); renderHandLog(); renderTradeLog();
      save();
      lastCatKey = 'reset';
      catSay(t('cat.reset'), 'smug', 5200);
    });

    document.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'h' && !el.btnHit.disabled) { e.preventDefault(); hit(); }
      else if (k === 's' && !el.btnStand.disabled) { e.preventDefault(); stand(); }
      else if (k === 'd' && !el.btnDouble.disabled) { e.preventDefault(); doubleDown(); }
      else if ((k === 'enter' || k === ' ') && !el.btnDeal.disabled) { e.preventDefault(); startRound(); }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearInterval(tickTimer); else startMarket();
    });

    wireFocusTip();
  }

  /* ---------------------------------------------------------
     16. Boot
     --------------------------------------------------------- */
  function init() {
    lang = state.lang === 'en' ? 'en' : 'zh';
    buildShoe();
    buildMarketUI();
    wire();
    ambientPaws();
    selectSymbol(selected);
    if (!state.equity.length) pushEquity();
    setActions({ hit: false, stand: false, double: false, deal: true });
    applyLang(lang);

    const returning = state.stats.hands > 0 || state.tradeLog.length > 0;
    lastCatKey = 'welcome';
    catSay(returning ? t('cat.back', { n: fmt(state.chips) }) : t('cat.welcome'), 'smug', 6000);
    startMarket();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.CatJack = {
    state: () => state, handValue: handValue, tick: tick,
    portfolioValue: portfolioValue, unrealizedPL: unrealizedPL,
    setLang: applyLang, lang: () => lang
  };
})();
