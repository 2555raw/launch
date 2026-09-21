/* Crypto Kitchen launchpad — food coins on a kitchen bonding curve that
   graduate to PonsV2 or Uniswap. Everything is simulated in the browser:
   the coins, the market, the wallet. The cash you spend here is what the
   kitchen game (play.html) pays you; both share localStorage. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function load(k, f) { try { var v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); } catch (e) { return f; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ---------- languages ----------
  var I18N = {
    en: {
      'nav.explore': 'Explore', 'nav.launch': 'Drop a coin', 'nav.pair': 'Make a pair', 'nav.exchange': 'Exchange', 'nav.you': 'You', 'nav.portfolio': 'Portfolio', 'nav.earnings': 'Earnings', 'nav.kitchen': 'Kitchen (game)', 'nav.ref': 'Reference', 'nav.rates': 'Rates', 'nav.how': 'How it works', 'side.chain': 'Kitchen Chain · testnet',
      'wallet.connect': 'Connect wallet', 'wallet.title': 'Connect a wallet', 'wallet.kitchen': 'Kitchen Wallet', 'wallet.kitchenSub': 'The game wallet. Cash: {cash}', 'wallet.soon': 'Coming soon', 'wallet.disconnect': 'Disconnect', 'wallet.connected': 'Wallet connected', 'wallet.need': 'Connect a wallet first',
      'hero.eyebrow': '● Cook it. Drop it. Trade it.', 'hero.h1': 'Food coins.', 'hero.h2': 'Global market.', 'hero.p': 'Discover and launch memecoins named after dishes. Every coin is born on the kitchen curve and graduates to PonsV2 or Uniswap. You earn the cash in the game.', 'hero.launch': 'Drop a coin', 'hero.how': 'How it works', 'hero.play': 'Play to earn cash',
      'stat.coins': 'Indexed coins', 'stat.coinsSub': 'across all kitchens', 'stat.grad': 'Graduated', 'stat.gradSub': 'on PonsV2 and Uniswap', 'stat.vol': '24h volume', 'stat.volSub': 'simulated', 'stat.fee': 'Base fee', 'stat.feeSub': 'half goes to the creator',
      'feat.official': 'Official', 'feat.on': 'on {dex}, paired with {q}', 'feat.price': 'Price', 'feat.mcap': 'Market cap', 'feat.status': 'Status', 'feat.trade': 'Trade {t} on {dex}', 'feat.burned': '{n} {t} burned · {p}% of supply', 'feat.only': 'The only coin issued by Crypto Kitchen. Anything else calling itself that is somebody else\'s.',
      'market.title': 'Explore the market', 'market.sub': 'Find your next coin. Start with a dish.', 'market.search': 'Search coins, tickers or addresses', 'market.empty': 'No coin matches. Drop your own.',
      'tab.mcap': 'Top market cap', 'tab.new': 'Newest', 'tab.vol': 'Most traded', 'tab.curve': 'On the curve', 'col.coin': 'Coin', 'col.price': 'Price', 'col.mcap': 'Market cap', 'col.status': 'Status',
      'st.curve': 'Curve', 'st.grad': 'Graduated', 'st.you': 'yours',
      'coin.back': '‹ Back to market', 'coin.by': 'by {who}', 'coin.you': 'you', 'coin.liq': 'Liquidity', 'coin.holders': 'Holders', 'coin.vol': '24h vol', 'coin.created': 'Created', 'coin.supply': 'Supply', 'coin.dex': 'DEX', 'coin.quote': 'Pair', 'coin.curveOn': 'Kitchen curve', 'coin.gradTo': 'Graduates to {dex} at {amt} raised', 'coin.raised': '{a} of {b} raised', 'coin.tradeOn': 'Trade on {dex} ↗',
      'trade.buy': 'Buy', 'trade.sell': 'Sell', 'trade.youPay': 'You pay', 'trade.youGet': 'You get', 'trade.fee': 'Fee', 'trade.impact': 'Impact', 'trade.route': 'Route', 'trade.balance': 'Balance: {b}', 'trade.max': 'Max', 'trade.go': 'Confirm {side}', 'trade.done': '{side}: {amt} {t} for {usd}', 'trade.noCash': 'Not enough cash. Earn it in the kitchen.', 'trade.noTok': 'You don\'t hold that many {t}.', 'trade.grad': '🎓 {t} has graduated to {dex}!',
      'launch.title': 'Drop a food coin', 'launch.sub': 'Pick a dish, give it a ticker and it goes onto the kitchen curve. At $12,000 raised it graduates to the DEX you choose.', 'launch.emoji': 'Dish', 'launch.name': 'Name', 'launch.ticker': 'Ticker', 'launch.desc': 'Description', 'launch.descPh': 'Fried, sugared and headed to the moon.', 'launch.quote': 'Pair', 'launch.dex': 'Graduation DEX', 'launch.buy': 'Initial buy (USD)', 'launch.fee': 'Launch fee', 'launch.submit': 'Drop coin', 'launch.preview': 'Preview', 'launch.startPrice': 'Starting price', 'launch.startMcap': 'Starting market cap', 'launch.yourBag': 'Your bag', 'launch.cost': 'Total cost', 'launch.steps': 'What happens on drop', 'launch.s1': 'The token is minted with a 1,000,000,000 supply on the kitchen curve.', 'launch.s2': 'Your initial buy goes in first: you are the first holder.', 'launch.s3': 'At $12,000 raised, liquidity is sent to the DEX and the LP is burned.', 'launch.s4': 'You earn 0.5% of every trade while it is on the curve.', 'launch.done': '🚀 {t} dropped. It\'s on the curve.', 'launch.taken': 'That ticker already exists.', 'launch.needCash': 'You need {amt} in cash. Earn it in the kitchen.',
      'pair.title': 'Make a pair', 'pair.sub': 'Add liquidity to a graduated coin on PonsV2 or Uniswap. You get LP and 0.25% of every swap on the pair.', 'pair.coin': 'Coin', 'pair.amount': 'Liquidity (USD)', 'pair.submit': 'Make pair', 'pair.yours': 'Your pairs', 'pair.none': 'You haven\'t made a pair yet.', 'pair.done': 'Pair {t}/{q} made on {dex}.', 'pair.needGrad': 'Only graduated coins can have a DEX pair.',
      'swap.title': 'Exchange', 'swap.from': 'You sell', 'swap.to': 'You buy', 'swap.go': 'Swap', 'swap.routes': 'Routes', 'swap.routesSub': 'Quoted on every DEX, executed on the best one.', 'swap.best': 'Best', 'swap.same': 'Pick two different assets.', 'swap.cash': 'Cash (USD)',
      'pf.title': 'Portfolio', 'pf.total': 'Total value', 'pf.cash': 'Kitchen cash', 'pf.coins': 'Food coins', 'pf.game': 'Game crypto', 'pf.holdings': 'Holdings', 'pf.none': 'No holdings yet. Buy a coin or drop your own.', 'pf.cta': 'More cash: serve more orders', 'pf.ctaSub': 'Every shift in the game adds cash to this wallet.',
      'earn.title': 'Earnings', 'earn.creator': 'Creator fees', 'earn.creatorSub': '0.5% of every trade on your coins', 'earn.lp': 'LP fees', 'earn.lpSub': '0.25% of every swap on your pairs', 'earn.kitchen': 'Earned in the kitchen', 'earn.kitchenSub': '{n} orders served', 'earn.yourCoins': 'Your coins', 'earn.none': 'You haven\'t dropped a coin yet.', 'earn.claim': 'Claim', 'earn.claimed': '{amt} claimed to your cash.',
      'kitchen.title': 'The kitchen', 'kitchen.sub': 'Customers pay in crypto; what you earn here is the cash you spend on the launchpad.', 'kitchen.full': 'Open fullscreen ↗',
      'rates.title': 'Rates', 'rates.sub': 'The assets customers pay in and coins are paired with.', 'rates.asset': 'Asset', 'rates.price': 'Price', 'rates.index': 'Food index', 'rates.indexSub': 'The ten largest coins, weighted by market cap.',
      'how.title': 'How it works', 'how.1': 'Earn cash in the kitchen', 'how.1p': 'Play a shift: customers pay in BTC, ETH, SOL, DOGE or USDC and the total lands as cash in your Kitchen Wallet.', 'how.2': 'Drop a coin', 'how.2p': 'Pick a dish, a ticker and a DEX. The coin goes onto the kitchen curve with a 1B supply and you are the first holder.', 'how.3': 'It graduates', 'how.3p': 'At $12,000 raised, liquidity is sent to PonsV2 or Uniswap v3 and the LP is burned. From there it trades like any token.', 'how.4': 'Collect fees', 'how.4p': 'The creator earns 0.5% of every trade on the curve; whoever makes pairs earns 0.25% of every swap.',
      'faq.1': 'Is this real?', 'faq.1p': 'No. It is a simulated launchpad: the coins, the market and the wallet live in your browser. PonsV2 and Uniswap appear as graduation targets for the demo; nothing is sent to a real chain.', 'faq.2': 'Where does the cash come from?', 'faq.2p': 'The kitchen. Every order served in the game adds dollars to the Kitchen Wallet, which is the same wallet you use here.', 'faq.3': 'Which DEX is better?', 'faq.3p': 'PonsV2 charges 0.25% per swap and Uniswap v3 0.30%. The Exchange quotes both and executes on the better one.', 'faq.4': 'Can I lose?', 'faq.4p': 'Yes: it is a curve. Buy high and sell low and your cash goes down. It is a game, but the maths is real.',
      'toast.copied': 'Address copied', 'status.grad': 'Graduated', 'status.curve': 'On the curve'
    },
    zh: {
      'nav.explore': '探索', 'nav.launch': '发币', 'nav.pair': '创建交易对', 'nav.exchange': '兑换', 'nav.you': '我的', 'nav.portfolio': '资产', 'nav.earnings': '收益', 'nav.kitchen': '厨房（游戏）', 'nav.ref': '参考', 'nav.rates': '行情', 'nav.how': '玩法说明', 'side.chain': 'Kitchen Chain · 测试网',
      'wallet.connect': '连接钱包', 'wallet.title': '连接钱包', 'wallet.kitchen': '厨房钱包', 'wallet.kitchenSub': '游戏内钱包。现金：{cash}', 'wallet.soon': '即将支持', 'wallet.disconnect': '断开连接', 'wallet.connected': '钱包已连接', 'wallet.need': '请先连接钱包',
      'hero.eyebrow': '● 做菜。发币。交易。', 'hero.h1': '美食币。', 'hero.h2': '全球市场。', 'hero.p': '发现并发行以菜品命名的 meme 币。每个币从厨房曲线诞生，毕业后上线 PonsV2 或 Uniswap。现金在游戏里赚。', 'hero.launch': '发一个币', 'hero.how': '玩法说明', 'hero.play': '玩游戏赚现金',
      'stat.coins': '已收录币种', 'stat.coinsSub': '全部厨房', 'stat.grad': '已毕业', 'stat.gradSub': '在 PonsV2 与 Uniswap', 'stat.vol': '24h 成交量', 'stat.volSub': '模拟', 'stat.fee': '基础费率', 'stat.feeSub': '一半归创建者',
      'feat.official': '官方', 'feat.on': '在 {dex}，与 {q} 配对', 'feat.price': '价格', 'feat.mcap': '市值', 'feat.status': '状态', 'feat.trade': '在 {dex} 交易 {t}', 'feat.burned': '已销毁 {n} {t} · 占供应量 {p}%', 'feat.only': 'Crypto Kitchen 发行的唯一代币。其他同名币都不是我们的。',
      'market.title': '探索市场', 'market.sub': '找到你的下一个币，从一道菜开始。', 'market.search': '搜索币种、代码或地址', 'market.empty': '没有匹配的币。发一个你自己的。',
      'tab.mcap': '市值榜', 'tab.new': '最新', 'tab.vol': '最活跃', 'tab.curve': '曲线中', 'col.coin': '币种', 'col.price': '价格', 'col.mcap': '市值', 'col.status': '状态',
      'st.curve': '曲线', 'st.grad': '已毕业', 'st.you': '你的',
      'coin.back': '‹ 返回市场', 'coin.by': '由 {who} 创建', 'coin.you': '你', 'coin.liq': '流动性', 'coin.holders': '持有人', 'coin.vol': '24h 成交', 'coin.created': '创建于', 'coin.supply': '供应量', 'coin.dex': 'DEX', 'coin.quote': '交易对', 'coin.curveOn': '厨房曲线', 'coin.gradTo': '筹满 {amt} 后毕业到 {dex}', 'coin.raised': '已筹 {a} / {b}', 'coin.tradeOn': '在 {dex} 交易 ↗',
      'trade.buy': '买入', 'trade.sell': '卖出', 'trade.youPay': '支付', 'trade.youGet': '获得', 'trade.fee': '手续费', 'trade.impact': '价格影响', 'trade.route': '路径', 'trade.balance': '余额：{b}', 'trade.max': '最大', 'trade.go': '确认{side}', 'trade.done': '{side}：{amt} {t}，共 {usd}', 'trade.noCash': '现金不足。去厨房赚一点。', 'trade.noTok': '你没有这么多 {t}。', 'trade.grad': '🎓 {t} 已毕业到 {dex}！',
      'launch.title': '发一个美食币', 'launch.sub': '选一道菜，起个代码，它就会进入厨房曲线。筹满 $12,000 后毕业到你选的 DEX。', 'launch.emoji': '菜品', 'launch.name': '名称', 'launch.ticker': '代码', 'launch.desc': '简介', 'launch.descPh': '油炸、撒糖、冲向月球。', 'launch.quote': '交易对', 'launch.dex': '毕业 DEX', 'launch.buy': '初始买入（USD）', 'launch.fee': '发行费', 'launch.submit': '发币', 'launch.preview': '预览', 'launch.startPrice': '起始价格', 'launch.startMcap': '起始市值', 'launch.yourBag': '你的持仓', 'launch.cost': '总花费', 'launch.steps': '发币后会发生什么', 'launch.s1': '在厨房曲线上铸造 1,000,000,000 供应量。', 'launch.s2': '你的初始买入最先成交：你是第一个持有人。', 'launch.s3': '筹满 $12,000 后，流动性注入 DEX 并销毁 LP。', 'launch.s4': '在曲线期间，每笔交易你赚 0.5%。', 'launch.done': '🚀 {t} 已发行，上曲线了。', 'launch.taken': '这个代码已存在。', 'launch.needCash': '需要 {amt} 现金。去厨房赚一点。',
      'pair.title': '创建交易对', 'pair.sub': '为已毕业的币在 PonsV2 或 Uniswap 添加流动性。你获得 LP 以及该交易对每笔兑换的 0.25%。', 'pair.coin': '币种', 'pair.amount': '流动性（USD）', 'pair.submit': '创建交易对', 'pair.yours': '你的交易对', 'pair.none': '你还没有创建交易对。', 'pair.done': '{t}/{q} 交易对已在 {dex} 创建。', 'pair.needGrad': '只有已毕业的币才能创建 DEX 交易对。',
      'swap.title': '兑换', 'swap.from': '卖出', 'swap.to': '买入', 'swap.go': '兑换', 'swap.routes': '路径', 'swap.routesSub': '在每个 DEX 报价，按最优执行。', 'swap.best': '最优', 'swap.same': '请选择两种不同资产。', 'swap.cash': '现金（USD）',
      'pf.title': '资产', 'pf.total': '总价值', 'pf.cash': '厨房现金', 'pf.coins': '美食币', 'pf.game': '游戏加密资产', 'pf.holdings': '持仓', 'pf.none': '暂无持仓。买一个币或发一个自己的。', 'pf.cta': '更多现金：多上几单', 'pf.ctaSub': '游戏里的每一班都会给这个钱包加现金。',
      'earn.title': '收益', 'earn.creator': '创建者费用', 'earn.creatorSub': '你的币每笔交易的 0.5%', 'earn.lp': 'LP 费用', 'earn.lpSub': '你的交易对每笔兑换的 0.25%', 'earn.kitchen': '厨房收入', 'earn.kitchenSub': '已服务 {n} 单', 'earn.yourCoins': '你的币', 'earn.none': '你还没有发过币。', 'earn.claim': '领取', 'earn.claimed': '已领取 {amt} 到现金。',
      'kitchen.title': '厨房', 'kitchen.sub': '顾客用加密货币付款；你在这里赚的现金就是发射台里花的钱。', 'kitchen.full': '全屏打开 ↗',
      'rates.title': '行情', 'rates.sub': '顾客用来付款、币种用来配对的资产。', 'rates.asset': '资产', 'rates.price': '价格', 'rates.index': '美食指数', 'rates.indexSub': '市值最大的十个币，按市值加权。',
      'how.title': '玩法说明', 'how.1': '在厨房赚现金', 'how.1p': '玩一班：顾客用 BTC、ETH、SOL、DOGE 或 USDC 付款，总额作为现金进入你的厨房钱包。', 'how.2': '发一个币', 'how.2p': '选菜品、代码和 DEX。币以 10 亿供应量进入厨房曲线，你是第一个持有人。', 'how.3': '毕业', 'how.3p': '筹满 $12,000 后，流动性注入 PonsV2 或 Uniswap v3 并销毁 LP。之后像任何代币一样交易。', 'how.4': '收取费用', 'how.4p': '创建者赚曲线上每笔交易的 0.5%；创建交易对的人赚每笔兑换的 0.25%。',
      'faq.1': '这是真的吗？', 'faq.1p': '不是。这是模拟发射台：币、市场和钱包都在你的浏览器里。PonsV2 和 Uniswap 只是演示用的毕业目标，不会上任何真实的链。', 'faq.2': '现金从哪来？', 'faq.2p': '厨房。游戏里每上一单都会给厨房钱包加美元，和这里用的是同一个钱包。', 'faq.3': '哪个 DEX 更好？', 'faq.3p': 'PonsV2 每笔兑换收 0.25%，Uniswap v3 收 0.30%。兑换页会同时报价并按最优执行。', 'faq.4': '会亏吗？', 'faq.4p': '会：这是一条曲线。高买低卖现金就会减少。虽是游戏，数学是真的。',
      'toast.copied': '地址已复制', 'status.grad': '已毕业', 'status.curve': '曲线中'
    }
  };
  var lang = 'en';
  function t(k, v) { var s = (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k; if (v) s = s.replace(/\{(\w+)\}/g, function (m, x) { return v[x] !== undefined ? v[x] : m; }); return s; }
  function applyLang() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
    $$('#lang button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === lang); });
    var f = $('#gameFrame'); if (f.getAttribute('src')) f.setAttribute('src', 'play.html?lang=' + lang);
  }

  // ---------- state ----------
  var game = load('ck-game', null) || { cash: 0, wallet: {}, stars: [], served: 0, lost: 0, lang: '' };
  var pad = load('ck-pad', null) || { coins: [], hold: {}, pools: [], fees: 0, lpFees: 0, connected: false, trades: [] };
  function saveAll() { store('ck-game', game); store('ck-pad', pad); }
  var q = (location.search.match(/[?&]lang=(\w+)/) || [])[1];
  var nav = (navigator.language || 'en').toLowerCase();
  lang = ['en', 'zh'].indexOf(q) !== -1 ? q : ['en', 'zh'].indexOf(game.lang) !== -1 ? game.lang : nav.indexOf('zh') === 0 ? 'zh' : 'en';
  game.lang = lang;

  var QUOTES = { USDC: { price: 1, color: '#2775CA', sym: '$' }, ETH: { price: 3180, color: '#627EEA', sym: 'Ξ' }, SOL: { price: 142, color: '#9945FF', sym: '◎' }, BTC: { price: 67420, color: '#F7931A', sym: '₿' }, DOGE: { price: 0.118, color: '#C2A633', sym: 'Ð' } };
  var DEX = { ponsv2: { name: 'PonsV2', fee: 0.0025, cls: 'pons' }, uniswap: { name: 'Uniswap v3', fee: 0.003, cls: 'uni' } };
  var SUPPLY = 1e9, V_USD = 4000, K = V_USD * SUPPLY, GRAD = 12000, LAUNCH_FEE = 2, CURVE_FEE = 0.01;

  // deterministic pseudo-random for seeded histories
  function rng(seed) { var x = seed; return function () { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; }
  function history(seed, start, drift, n) { var r = rng(seed), p = start, out = []; for (var i = 0; i < n; i++) { p = Math.max(start * 0.2, p * (1 + (r() - 0.5) * 0.12 + drift)); out.push(p); } return out; }

  var SEED = [
    { em: '🔥', name: 'Sizzle', t: 'SIZZLE', official: true, grad: true, dex: 'ponsv2', quote: 'USDC', mcap: 121445, vol: 18400, holders: 3120, by: 'Crypto Kitchen', age: 61, desc: 'The kitchen\'s own coin. Every tip in the game is denominated in it.', burned: 48836802 },
    { em: '🍔', name: 'Burger coin', t: 'BURG', grad: true, dex: 'uniswap', quote: 'ETH', mcap: 84200, vol: 9100, holders: 1840, by: '0x9a…f4c1', age: 42, desc: 'Two patties, no bun, all gains.' },
    { em: '🍕', name: 'Pizza coin', t: 'PIZZA', grad: true, dex: 'ponsv2', quote: 'USDC', mcap: 63900, vol: 7400, holders: 1210, by: 'nonna.eth', age: 37, desc: 'Ten slices, ten holders, one pie.' },
    { em: '🌮', name: 'Taco Tuesday', t: 'TACO', grad: true, dex: 'uniswap', quote: 'SOL', mcap: 51300, vol: 12800, holders: 990, by: '0x3c…88de', age: 29, desc: 'Pumps every Tuesday. Allegedly.' },
    { em: '🍜', name: 'Ramen coin', t: 'RAMEN', grad: true, dex: 'ponsv2', quote: 'USDC', mcap: 44100, vol: 5300, holders: 870, by: 'slurp.sol', age: 25, desc: 'Broth-backed. Noodles are the utility.' },
    { em: '🍣', name: 'Sushi Roll', t: 'ROLL', grad: true, dex: 'uniswap', quote: 'ETH', mcap: 38700, vol: 4100, holders: 640, by: '0xaa…21b0', age: 22, desc: 'Not that Sushi. This one has rice.' },
    { em: '🍩', name: 'Donut', t: 'DONUT', grad: false, raised: 9650, vol: 6900, holders: 512, by: 'glaze.eth', age: 6, desc: 'A hole in the middle, a bag on the side.' },
    { em: '🧋', name: 'Boba', t: 'BOBA', grad: false, raised: 7300, vol: 4200, holders: 388, by: '0x71…c9e2', age: 5, desc: 'Tapioca-backed pearls of liquidity.' },
    { em: '🍕', name: 'PEPEroni', t: 'PEPERONI', grad: false, raised: 5800, vol: 8800, holders: 720, by: 'frog.sol', age: 3, desc: 'Rare pizza. Spicy meme.' },
    { em: '🥟', name: 'Dumpling', t: 'DUMP', grad: false, raised: 3900, vol: 2100, holders: 260, by: '0xde…f00d', age: 4, desc: 'Steamed, not dumped. Read the ticker carefully.' },
    { em: '🥑', name: 'Avocado toast', t: 'AVO', grad: false, raised: 2600, vol: 1500, holders: 190, by: 'brunch.eth', age: 2, desc: 'The reason you can\'t afford a house.' },
    { em: '🍦', name: 'Moon Mochi', t: 'MOCHI', grad: false, raised: 1700, vol: 1900, holders: 140, by: '0x55…7a1e', age: 2, desc: 'Soft launch. Literally.' },
    { em: '🌭', name: 'HODL Hotdog', t: 'HODL', grad: false, raised: 950, vol: 900, holders: 81, by: 'wien.sol', age: 1, desc: 'Hold it with both hands.' },
    { em: '🧇', name: 'WAGMI Waffle', t: 'WAFFLE', grad: false, raised: 420, vol: 600, holders: 44, by: '0x0b…33aa', age: 1, desc: 'Syrup goes up.' },
    { em: '🥘', name: 'Paella', t: 'PAELLA', grad: false, raised: 210, vol: 300, holders: 22, by: 'valencia.eth', age: 0, desc: 'Sin chorizo, con socarrat.' },
    { em: '🌶️', name: 'Kimchi', t: 'KIMCHI', grad: false, raised: 90, vol: 120, holders: 9, by: '0xc0…ffee', age: 0, desc: 'Fermented for 24h. Premium spice.' }
  ];
  var EMOJIS = ['🍔', '🍟', '🍕', '🌮', '🌯', '🍜', '🍣', '🍩', '🧋', '🥟', '🥑', '🍦', '🌭', '🧇', '🥘', '🌶️', '🥩', '🍗', '🍤', '🍰', '🍪', '🥐', '🍫', '☕', '🍺', '🍉', '🥞', '🧀', '🍿', '🥨'];

  var coins = [];
  function curvePrice(raised) { var x = V_USD + raised; return x * x / K; }
  function buildCoins() {
    var now = Date.now();
    coins = SEED.map(function (s, i) {
      var c = Object.assign({}, s);
      c.id = 'seed' + i;
      c.created = now - c.age * 864e5 - i * 3.6e6;
      if (c.grad) { c.price = c.mcap / SUPPLY; c.hist = history(100 + i, c.price * 0.8, 0.003, 48); c.hist[47] = c.price; c.liq = c.mcap * 0.18; }
      else { c.price = curvePrice(c.raised); c.hist = history(200 + i, curvePrice(c.raised * 0.3), 0.02, 48); c.hist[47] = c.price; c.liq = V_USD + c.raised; }
      c.burned = c.burned || 0;
      return c;
    }).concat(pad.coins.map(function (c) { c.you = true; if (!c.hist) c.hist = [c.price]; return c; }));
  }
  buildCoins();
  function byT(tk) { return coins.filter(function (c) { return c.t === tk; })[0]; }
  function mcap(c) { return c.price * (SUPPLY - (c.burned || 0)); }
  function change(c) { var h = c.hist; return h.length > 1 ? (h[h.length - 1] / h[Math.max(0, h.length - 24)] - 1) * 100 : 0; }
  function money(n, d) { if (n === undefined || isNaN(n)) n = 0; var abs = Math.abs(n); var dec = d !== undefined ? d : abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : abs > 0 ? 8 : 2; return (n < 0 ? '-' : '') + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function num(n, d) { return n.toLocaleString('en-US', { maximumFractionDigits: d === undefined ? 0 : d }); }
  function tok(n) { return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(n >= 1 ? 2 : 4); }
  function pct(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function addr(seed) { var r = rng(seed), h = '0123456789abcdef', s = '0x'; for (var i = 0; i < 40; i++) s += h[Math.floor(r() * 16)]; return s; }
  function short(a) { return a.slice(0, 6) + '…' + a.slice(-4); }
  function dexName(c) { return c.grad ? DEX[c.dex].name : t('coin.curveOn'); }

  // the market drifts while the page is open
  setInterval(function () {
    coins.forEach(function (c) {
      if (c.grad) { c.price *= 1 + (Math.random() - 0.5) * 0.02; c.hist.push(c.price); if (c.hist.length > 96) c.hist.shift(); c.vol += Math.random() * 40; }
      else if (!c.you) { var d = (Math.random() - 0.45) * 60; c.raised = Math.max(0, c.raised + d); if (c.raised >= GRAD) graduate(c); c.price = c.grad ? c.price : curvePrice(c.raised); c.hist.push(c.price); if (c.hist.length > 96) c.hist.shift(); c.vol += Math.abs(d); }
      else { // other people trade your coin too
        var d2 = (Math.random() - 0.4) * 25; if (!c.grad) { c.raised = Math.max(0, c.raised + d2); c.price = curvePrice(c.raised); pad.fees += Math.abs(d2) * CURVE_FEE * 0.5; if (c.raised >= GRAD) graduate(c); } else { c.price *= 1 + (Math.random() - 0.5) * 0.02; }
        c.vol += Math.abs(d2); c.hist.push(c.price); if (c.hist.length > 96) c.hist.shift(); c.holders += Math.random() < 0.3 ? 1 : 0; }
    });
    pad.pools.forEach(function (p) { pad.lpFees += p.usd * 0.0002 * Math.random(); });
    for (var k in QUOTES) QUOTES[k].live = (QUOTES[k].live || QUOTES[k].price) * (1 + (Math.random() - 0.5) * (k === 'USDC' ? 0.0005 : 0.01));
    if (view === 'explore') { renderStats(); renderMarket(); renderFeatured(); }
    if (view === 'coin' && current) renderCoin(current);
    if (view === 'rates') renderRates();
    if (view === 'exchange') quoteSwap();
    saveAll();
  }, 3000);
  function graduate(c) { if (c.grad) return; c.grad = true; c.liq = GRAD * 0.9; if (c.you) toast(t('trade.grad', { t: c.t, dex: DEX[c.dex].name })); }

  // ---------- sparklines / chart ----------
  function spark(h, w, hgt) {
    var min = Math.min.apply(null, h), max = Math.max.apply(null, h), r = max - min || 1;
    var pts = h.map(function (v, i) { return [(i / (h.length - 1)) * w, hgt - 2 - (v - min) / r * (hgt - 4)]; });
    var d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L');
    var cls = h[h.length - 1] >= h[0] ? 'up-c' : 'down-c';
    return '<svg viewBox="0 0 ' + w + ' ' + hgt + '" preserveAspectRatio="none"><path class="a ' + cls + '" stroke="none" d="' + d + 'L' + w + ' ' + hgt + 'L0 ' + hgt + 'Z"/><path class="l ' + cls + '" fill="none" d="' + d + '"/></svg>';
  }
  function chart(h) {
    var W = 600, H = 220, padL = 52, padB = 18, padT = 8, iw = W - padL - 8, ih = H - padB - padT;
    var min = Math.min.apply(null, h), max = Math.max.apply(null, h), r = max - min || max * 0.1 || 1;
    var pts = h.map(function (v, i) { return [padL + (i / (h.length - 1)) * iw, padT + ih - (v - min) / r * ih]; });
    var d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L');
    var cls = h[h.length - 1] >= h[0] ? 'up-c' : 'down-c';
    var grid = '', labels = '';
    for (var i = 0; i <= 3; i++) { var y = padT + ih * i / 3, v = max - r * i / 3; grid += '<line class="grid" x1="' + padL + '" x2="' + W + '" y1="' + y + '" y2="' + y + '"/>'; labels += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + money(v) + '</text>'; }
    var last = pts[pts.length - 1];
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + grid + labels +
      '<path class="a ' + cls + '" stroke="none" d="' + d + 'L' + last[0] + ' ' + (padT + ih) + 'L' + padL + ' ' + (padT + ih) + 'Z"/><path class="l ' + cls + '" fill="none" d="' + d + '"/>' +
      '<circle class="' + cls + '" cx="' + last[0] + '" cy="' + last[1] + '" r="3.5"/><text x="' + padL + '" y="' + (H - 4) + '">−48h</text><text x="' + W + '" y="' + (H - 4) + '" text-anchor="end">now</text></svg>';
  }

  // ---------- wallet ----------
  var ADDR = addr(4242);
  function connected() { return pad.connected; }
  function renderWallet() {
    var b = $('#btnWallet');
    b.classList.toggle('on', connected());
    $('#walletLabel').textContent = connected() ? short(ADDR) + ' · ' + money(game.cash) : t('wallet.connect');
  }
  $('#btnWallet').addEventListener('click', function () {
    if (connected()) { modal('<h3>' + t('wallet.kitchen') + '</h3><p class="mono muted">' + ADDR + '</p><p><b>' + money(game.cash) + '</b></p><button class="btn btn-ghost" id="mDisc" type="button">' + t('wallet.disconnect') + '</button>'); $('#mDisc').addEventListener('click', function () { pad.connected = false; saveAll(); renderWallet(); closeModal(); }); return; }
    modal('<h3>' + t('wallet.title') + '</h3>' +
      '<button class="wopt" id="mKitchen" type="button"><span class="logo">🍳</span><span><b>' + t('wallet.kitchen') + '</b><small>' + t('wallet.kitchenSub', { cash: money(game.cash) }) + '</small></span></button>' +
      '<button class="wopt" type="button" disabled><span class="logo">🦊</span><span><b>MetaMask</b><small>' + t('wallet.soon') + '</small></span></button>' +
      '<button class="wopt" type="button" disabled><span class="logo">👻</span><span><b>Phantom</b><small>' + t('wallet.soon') + '</small></span></button>');
    $('#mKitchen').addEventListener('click', function () { pad.connected = true; saveAll(); renderWallet(); closeModal(); toast(t('wallet.connected')); });
  });
  function needWallet() { if (connected()) return true; toast(t('wallet.need')); $('#btnWallet').click(); return false; }
  function modal(html) { $('#modalCard').innerHTML = html; $('#modal').hidden = false; }
  function closeModal() { $('#modal').hidden = true; }
  $('#modal').addEventListener('click', function (e) { if (e.target === $('#modal')) closeModal(); });
  var toastT = 0;
  function toast(msg) { var el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 2600); }

  // ---------- routing ----------
  var view = 'explore', current = null;
  var TITLES = { explore: 'nav.explore', launch: 'nav.launch', pair: 'nav.pair', exchange: 'nav.exchange', portfolio: 'nav.portfolio', earnings: 'nav.earnings', kitchen: 'nav.kitchen', rates: 'nav.rates', how: 'nav.how', coin: 'nav.explore' };
  function route() {
    var h = (location.hash || '#explore').slice(1), parts = h.split('/');
    view = parts[0]; if (!TITLES[view]) view = 'explore';
    $$('.view').forEach(function (v) { v.classList.toggle('on', v.getAttribute('data-view') === view); });
    $$('.nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-view') === (view === 'coin' ? 'explore' : view)); });
    $('#topTitle').textContent = t(TITLES[view]);
    $('#side').classList.remove('open');
    if (view === 'explore') { renderStats(); renderFeatured(); renderMarket(); }
    if (view === 'coin') { current = coins.filter(function (c) { return c.id === parts[1]; })[0]; if (!current) { location.hash = '#explore'; return; } renderCoin(current); }
    if (view === 'launch') renderLaunchPreview();
    if (view === 'pair') renderPair();
    if (view === 'exchange') renderSwap();
    if (view === 'portfolio') renderPortfolio();
    if (view === 'earnings') renderEarnings();
    if (view === 'kitchen') { var f = $('#gameFrame'); if (!f.getAttribute('src')) f.setAttribute('src', 'play.html?lang=' + lang); }
    if (view === 'rates') renderRates();
    if (view === 'how') renderHow();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  $('#burger').addEventListener('click', function () { $('#side').classList.toggle('open'); });
  $('#lang').addEventListener('click', function (e) { var b = e.target.closest('[data-lang]'); if (!b) return; lang = b.getAttribute('data-lang'); game.lang = lang; saveAll(); applyLang(); renderWallet(); route(); });
  // the game writes cash while it plays in the iframe; pick it up when it changes
  window.addEventListener('storage', function (e) { if (e.key === 'ck-game') { game = load('ck-game', game); renderWallet(); if (view === 'portfolio') renderPortfolio(); } });
  window.addEventListener('focus', function () { var g = load('ck-game', null); if (g && g.cash !== game.cash) { game = g; renderWallet(); } });

  // ---------- explore ----------
  function renderStats() {
    var grad = coins.filter(function (c) { return c.grad; }).length, vol = coins.reduce(function (s, c) { return s + c.vol; }, 0);
    $('#stats').innerHTML = [[t('stat.coins'), coins.length, t('stat.coinsSub')], [t('stat.grad'), grad, t('stat.gradSub')], [t('stat.vol'), money(vol), t('stat.volSub')], [t('stat.fee'), '1%', t('stat.feeSub')]]
      .map(function (s) { return '<div class="stat"><small>' + s[0] + '</small><b>' + s[1] + '</b><span>' + s[2] + '</span></div>'; }).join('');
  }
  function badge(c) {
    if (c.grad) return '<span class="badge badge-' + DEX[c.dex].cls + '">' + DEX[c.dex].name + '</span>';
    return '<span class="badge badge-curve">' + t('st.curve') + ' ' + Math.min(99, Math.round(c.raised / GRAD * 100)) + '%</span>';
  }
  function renderFeatured() {
    var c = byT('SIZZLE');
    $('#featured').innerHTML =
      '<div class="feat-head"><span class="logo">' + c.em + '</span><div><h4>' + c.name + ' <span class="badge badge-official">' + t('feat.official') + '</span></h4><p>' + c.t + ' · ' + t('feat.on', { dex: DEX[c.dex].name, q: c.quote }) + '</p></div><span class="addr" data-copy="' + addr(1) + '">' + short(addr(1)) + ' ⧉</span></div>' +
      '<div class="kv3"><div><small>' + t('feat.price') + '</small><b>' + money(c.price) + '</b></div><div><small>' + t('feat.mcap') + '</small><b>' + money(mcap(c)) + '</b></div><div><small>' + t('feat.status') + '</small><b class="chg up" style="font-family:var(--body)">' + t('status.grad') + '</b></div></div>' +
      '<a class="btn btn-' + DEX[c.dex].cls + ' btn-wide" href="#coin/' + c.id + '">' + t('feat.trade', { t: c.t, dex: DEX[c.dex].name }) + '</a>' +
      '<div class="feat-foot"><span><b>' + num(c.burned) + '</b> ' + t('feat.burned', { n: '', t: c.t, p: (c.burned / SUPPLY * 100).toFixed(2) }).replace(/^\s*/, '') + '</span><span>' + t('feat.only') + '</span></div>';
  }
  var sort = 'mcap', query = '';
  $('#tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-sort]'); if (!b) return; sort = b.getAttribute('data-sort'); $$('#tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderMarket(); });
  $('#search').addEventListener('input', function (e) { query = e.target.value.trim().toLowerCase(); renderMarket(); });
  function renderMarket() {
    var list = coins.slice();
    if (query) list = list.filter(function (c) { return (c.name + ' ' + c.t + ' ' + addr(c.id.length + c.t.length)).toLowerCase().indexOf(query) !== -1; });
    if (sort === 'curve') list = list.filter(function (c) { return !c.grad; });
    list.sort(sort === 'new' ? function (a, b) { return b.created - a.created; } : sort === 'vol' ? function (a, b) { return b.vol - a.vol; } : sort === 'curve' ? function (a, b) { return b.raised - a.raised; } : function (a, b) { return mcap(b) - mcap(a); });
    $('#marketRows').innerHTML = list.length ? list.map(function (c) {
      var ch = change(c);
      return '<tr data-coin="' + c.id + '"><td><div class="coin-cell"><span class="logo">' + c.em + '</span><div><b>' + c.name + (c.you ? ' <span class="badge badge-grad">' + t('st.you') + '</span>' : '') + '</b><small>' + c.t + '</small></div></div></td>' +
        '<td class="num">' + money(c.price) + '</td><td class="num chg ' + (ch >= 0 ? 'up' : 'down') + '">' + pct(ch) + '</td><td class="num">' + money(mcap(c)) + '</td>' +
        '<td>' + (c.grad ? badge(c) : '<div class="prog"><i><b style="--p:' + Math.min(100, c.raised / GRAD * 100) + '%"></b></i><span>' + Math.round(c.raised / GRAD * 100) + '%</span></div>') + '</td>' +
        '<td class="spark">' + spark(c.hist.slice(-24), 110, 34) + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty">' + t('market.empty') + '</td></tr>';
  }
  $('#marketRows').addEventListener('click', function (e) { var tr = e.target.closest('[data-coin]'); if (tr) location.hash = '#coin/' + tr.getAttribute('data-coin'); });
  document.addEventListener('click', function (e) { var a = e.target.closest('[data-copy]'); if (!a) return; var txt = a.getAttribute('data-copy'); if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast(t('toast.copied')); }, function () { toast(t('toast.copied')); }); else toast(t('toast.copied')); });

  // ---------- coin detail + trading ----------
  var side = 'buy';
  function renderCoin(c) {
    var ch = change(c), held = pad.hold[c.t] || 0, amtEl = $('#tAmt'), amt = amtEl ? amtEl.value : '';
    $('#coinView').innerHTML =
      '<a class="back" href="#explore">' + t('coin.back') + '</a>' +
      '<div class="coin-top"><span class="logo lg">' + c.em + '</span><div><h2>' + c.name + ' ' + (c.official ? '<span class="badge badge-official">' + t('feat.official') + '</span>' : badge(c)) + '</h2><p>' + c.t + ' · ' + t('coin.by', { who: c.you ? t('coin.you') : c.by }) + ' · <span class="mono" data-copy="' + addr(c.id.length + c.t.length) + '" style="cursor:pointer">' + short(addr(c.id.length + c.t.length)) + ' ⧉</span></p></div></div>' +
      '<div class="coin-grid"><div class="card">' +
      '<div class="price-big">' + money(c.price) + ' <span class="chg ' + (ch >= 0 ? 'up' : 'down') + '" style="font-size:16px">' + pct(ch) + '</span></div>' + chart(c.hist) +
      '<div class="kv"><div><small>' + t('coin.supply') + '</small><b>1B</b></div><div><small>' + t('feat.mcap') + '</small><b>' + money(mcap(c)) + '</b></div><div><small>' + t('coin.liq') + '</small><b>' + money(c.liq) + '</b></div><div><small>' + t('coin.vol') + '</small><b>' + money(c.vol) + '</b></div><div><small>' + t('coin.holders') + '</small><b>' + num(c.holders) + '</b></div><div><small>' + t('coin.dex') + '</small><b>' + (c.grad ? DEX[c.dex].name : DEX[c.dex || 'ponsv2'].name + ' *') + '</b></div><div><small>' + t('coin.quote') + '</small><b>' + (c.quote || 'USDC') + '</b></div><div><small>' + t('coin.created') + '</small><b>' + new Date(c.created).toLocaleDateString() + '</b></div></div>' +
      '<p class="desc" style="margin-top:16px">' + c.desc + '</p></div>' +
      '<div class="card trade">' +
      (c.grad ? '<a class="btn btn-' + DEX[c.dex].cls + ' btn-wide" href="#exchange">' + t('coin.tradeOn', { dex: DEX[c.dex].name }) + '</a>' :
        '<div class="grad-box"><b>' + t('coin.gradTo', { dex: DEX[c.dex || 'ponsv2'].name, amt: money(GRAD) }) + '</b><div class="bar"><b style="--p:' + Math.min(100, c.raised / GRAD * 100) + '%"></b></div>' + t('coin.raised', { a: money(c.raised), b: money(GRAD) }) + '</div>') +
      '<div class="seg"><button type="button" class="buy ' + (side === 'buy' ? 'on' : '') + '" data-side="buy">' + t('trade.buy') + '</button><button type="button" class="sell ' + (side === 'sell' ? 'on' : '') + '" data-side="sell">' + t('trade.sell') + '</button></div>' +
      '<div class="amt"><input id="tAmt" type="number" min="0" step="any" placeholder="0" value="' + amt + '"><span>' + (side === 'buy' ? 'USD' : c.t) + '</span></div>' +
      '<div class="quick">' + (side === 'buy' ? [5, 10, 25, 50].map(function (v) { return '<button type="button" data-q="' + v + '">$' + v + '</button>'; }).join('') : [25, 50, 75, 100].map(function (v) { return '<button type="button" data-qp="' + v + '">' + v + '%</button>'; }).join('')) + '</div>' +
      '<small class="muted">' + t('trade.balance', { b: side === 'buy' ? money(game.cash) : tok(held) + ' ' + c.t }) + '</small>' +
      '<div class="quote-box" id="tQuote"></div>' +
      '<button class="btn ' + (side === 'buy' ? 'btn-accent' : 'btn-dark') + ' btn-wide" id="tGo" type="button">' + t('trade.go', { side: side === 'buy' ? t('trade.buy') : t('trade.sell') }) + '</button>' +
      '</div></div>';
    $$('#coinView [data-side]').forEach(function (b) { b.addEventListener('click', function () { side = b.getAttribute('data-side'); $('#tAmt').value = ''; renderCoin(c); }); });
    $$('#coinView [data-q]').forEach(function (b) { b.addEventListener('click', function () { $('#tAmt').value = b.getAttribute('data-q'); quoteTrade(c); }); });
    $$('#coinView [data-qp]').forEach(function (b) { b.addEventListener('click', function () { $('#tAmt').value = (held * +b.getAttribute('data-qp') / 100).toFixed(2); quoteTrade(c); }); });
    $('#tAmt').addEventListener('input', function () { quoteTrade(c); });
    $('#tGo').addEventListener('click', function () { trade(c); });
    quoteTrade(c);
  }
  // quotes: on the curve it's the constant-product curve; graduated coins fill at market with the DEX fee
  function quoteBuy(c, usd) {
    if (!c.grad) { var x = V_USD + c.raised, y = K / x, fee = usd * CURVE_FEE, net = usd - fee, out = y - K / (x + net); return { out: out, fee: fee, impact: ((x + net) * (x + net) / K / c.price - 1) * 100, route: t('coin.curveOn') }; }
    var f = usd * DEX[c.dex].fee, o = (usd - f) / c.price, imp = usd / c.liq * 100; return { out: o * (1 - imp / 100), fee: f, impact: imp, route: DEX[c.dex].name };
  }
  function quoteSell(c, tokens) {
    if (!c.grad) { var x = V_USD + c.raised, y = K / x, gross = x - K / (y + tokens), fee = gross * CURVE_FEE; return { out: gross - fee, fee: fee, impact: (1 - (x - gross) * (x - gross) / K / c.price) * 100, route: t('coin.curveOn') }; }
    var g = tokens * c.price, imp = g / c.liq * 100, f = g * DEX[c.dex].fee; return { out: (g - f) * (1 - imp / 100), fee: f, impact: imp, route: DEX[c.dex].name };
  }
  function quoteTrade(c) {
    var v = parseFloat($('#tAmt').value) || 0, box = $('#tQuote');
    if (!v) { box.innerHTML = ''; return; }
    var qu = side === 'buy' ? quoteBuy(c, v) : quoteSell(c, v);
    box.innerHTML = '<div><span>' + t('trade.youGet') + '</span><b>' + (side === 'buy' ? tok(qu.out) + ' ' + c.t : money(qu.out)) + '</b></div><div><span>' + t('trade.fee') + '</span><b>' + money(qu.fee) + '</b></div><div><span>' + t('trade.impact') + '</span><b>' + qu.impact.toFixed(2) + '%</b></div><div><span>' + t('trade.route') + '</span><b>' + qu.route + '</b></div>';
  }
  function trade(c) {
    if (!needWallet()) return;
    var v = parseFloat($('#tAmt').value) || 0; if (!v) return;
    if (side === 'buy') {
      if (v > game.cash) { toast(t('trade.noCash')); return; }
      var qb = quoteBuy(c, v); game.cash -= v; pad.hold[c.t] = (pad.hold[c.t] || 0) + qb.out;
      if (!c.grad) { c.raised += v - qb.fee; c.price = curvePrice(c.raised); if (c.you) pad.fees += qb.fee * 0.5; if (c.raised >= GRAD) graduate(c); } else { c.price *= 1 + qb.impact / 100 * 0.5; }
      c.vol += v; c.holders += 1; c.hist.push(c.price);
      toast(t('trade.done', { side: t('trade.buy'), amt: tok(qb.out), t: c.t, usd: money(v) }));
    } else {
      var held = pad.hold[c.t] || 0; if (v > held + 1e-9) { toast(t('trade.noTok', { t: c.t })); return; }
      var qs = quoteSell(c, v); pad.hold[c.t] = held - v; if (pad.hold[c.t] < 1e-6) delete pad.hold[c.t]; game.cash += qs.out;
      if (!c.grad) { c.raised = Math.max(0, c.raised - qs.out - qs.fee); c.price = curvePrice(c.raised); if (c.you) pad.fees += qs.fee * 0.5; } else { c.price *= 1 - qs.impact / 100 * 0.5; }
      c.vol += qs.out; c.hist.push(c.price);
      toast(t('trade.done', { side: t('trade.sell'), amt: tok(v), t: c.t, usd: money(qs.out) }));
    }
    pad.trades.push({ t: c.t, side: side, v: v, at: Date.now() });
    if (c.you) syncUserCoin(c);
    saveAll(); renderWallet(); $('#tAmt').value = ''; renderCoin(c);
  }
  function syncUserCoin(c) { var i = pad.coins.findIndex(function (x) { return x.id === c.id; }); if (i !== -1) pad.coins[i] = c; }

  // ---------- launch ----------
  var pickEm = '🍩';
  $('#emojiPick').innerHTML = EMOJIS.map(function (e) { return '<button type="button" data-em="' + e + '"' + (e === pickEm ? ' class="on"' : '') + '>' + e + '</button>'; }).join('');
  $('#emojiPick').addEventListener('click', function (e) { var b = e.target.closest('[data-em]'); if (!b) return; pickEm = b.getAttribute('data-em'); $$('#emojiPick button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderLaunchPreview(); });
  ['lName', 'lTicker', 'lDesc', 'lQuote', 'lDex', 'lBuy'].forEach(function (id) { $('#' + id).addEventListener('input', renderLaunchPreview); });
  function renderLaunchPreview() {
    var name = $('#lName').value || t('launch.name'), tk = ($('#lTicker').value || 'TICKER').toUpperCase(), buy = Math.max(0, parseFloat($('#lBuy').value) || 0), qb = buy ? quoteBuy({ grad: false, raised: 0, price: curvePrice(0), dex: $('#lDex').value }, buy) : { out: 0 };
    $('#launchPreview').innerHTML =
      '<small class="muted" style="text-transform:uppercase;letter-spacing:.06em;font-size:11px;font-weight:600">' + t('launch.preview') + '</small>' +
      '<div class="pv-head"><span class="logo lg">' + pickEm + '</span><div><h4>' + name + '</h4><small>' + tk + ' · ' + DEX[$('#lDex').value].name + ' · ' + $('#lQuote').value + '</small></div></div>' +
      '<p class="desc">' + ($('#lDesc').value || t('launch.descPh')) + '</p>' +
      '<div class="pv-kv"><div><small>' + t('launch.startPrice') + '</small><b>' + money(curvePrice(0)) + '</b></div><div><small>' + t('launch.startMcap') + '</small><b>' + money(curvePrice(0) * SUPPLY) + '</b></div><div><small>' + t('launch.yourBag') + '</small><b>' + tok(qb.out) + ' ' + tk + '</b></div><div><small>' + t('launch.cost') + '</small><b>' + money(buy + LAUNCH_FEE) + '</b></div></div>' +
      '<b style="font-size:13px">' + t('launch.steps') + '</b><div class="steps">' + [1, 2, 3, 4].map(function (i) { return '<div class="step"><i>' + i + '</i><span>' + t('launch.s' + i) + '</span></div>'; }).join('') + '</div>';
  }
  $('#launchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!needWallet()) return;
    var tk = $('#lTicker').value.toUpperCase().replace(/[^A-Z0-9]/g, ''), buy = Math.max(0, parseFloat($('#lBuy').value) || 0), cost = buy + LAUNCH_FEE;
    if (!tk) return;
    if (byT(tk)) { toast(t('launch.taken')); return; }
    if (cost > game.cash) { toast(t('launch.needCash', { amt: money(cost) })); return; }
    var c = { id: 'u' + Date.now().toString(36), em: pickEm, name: $('#lName').value.trim(), t: tk, desc: $('#lDesc').value.trim() || t('launch.descPh'), quote: $('#lQuote').value, dex: $('#lDex').value, grad: false, raised: 0, vol: 0, holders: 1, by: short(ADDR), created: Date.now(), price: curvePrice(0), hist: [curvePrice(0)], liq: V_USD, burned: 0, you: true };
    game.cash -= LAUNCH_FEE;
    if (buy) { var qb = quoteBuy(c, buy); game.cash -= buy; pad.hold[tk] = qb.out; c.raised = buy - qb.fee; c.price = curvePrice(c.raised); c.vol = buy; c.hist.push(c.price); }
    pad.coins.push(c); coins.push(c);
    saveAll(); renderWallet();
    toast(t('launch.done', { t: tk }));
    $('#launchForm').reset(); $('#lBuy').value = 20;
    location.hash = '#coin/' + c.id;
  });

  // ---------- pairs ----------
  function renderPair() {
    var sel = $('#pCoin'); sel.innerHTML = coins.filter(function (c) { return c.grad; }).map(function (c) { return '<option value="' + c.t + '">' + c.em + ' ' + c.name + ' (' + c.t + ')</option>'; }).join('');
    $('#pools').innerHTML = '<h3 style="font-family:var(--display);font-size:22px;font-weight:500;margin-bottom:6px">' + t('pair.yours') + '</h3>' + (pad.pools.length ? pad.pools.map(function (p) { var c = byT(p.t) || { em: '🍽️' }; return '<div class="pool"><span class="logo">' + c.em + '</span><div><b>' + p.t + '/' + p.q + '</b><br><span class="badge badge-' + DEX[p.dex].cls + '">' + DEX[p.dex].name + '</span></div><b>' + money(p.usd) + '</b></div>'; }).join('') : '<p class="muted">' + t('pair.none') + '</p>');
  }
  $('#pairForm').addEventListener('submit', function (e) {
    e.preventDefault(); if (!needWallet()) return;
    var tk = $('#pCoin').value, c = byT(tk), usd = Math.max(1, parseFloat($('#pAmount').value) || 0);
    if (!c || !c.grad) { toast(t('pair.needGrad')); return; }
    if (usd > game.cash) { toast(t('trade.noCash')); return; }
    game.cash -= usd; c.liq += usd; pad.pools.push({ t: tk, q: $('#pQuote').value, dex: $('#pDex').value, usd: usd, at: Date.now() });
    if (c.you) syncUserCoin(c);
    saveAll(); renderWallet(); renderPair(); toast(t('pair.done', { t: tk, q: $('#pQuote').value, dex: DEX[$('#pDex').value].name }));
  });

  // ---------- exchange ----------
  var swapFrom = 'USD', swapTo = 'SIZZLE';
  function assetOptions(sel) {
    var opts = ['<option value="USD"' + (sel === 'USD' ? ' selected' : '') + '>💵 ' + t('swap.cash') + '</option>'];
    coins.forEach(function (c) { opts.push('<option value="' + c.t + '"' + (sel === c.t ? ' selected' : '') + '>' + c.em + ' ' + c.t + '</option>'); });
    return opts.join('');
  }
  function bal(a) { return a === 'USD' ? game.cash : (pad.hold[a] || 0); }
  function renderSwap() {
    $('#swap').innerHTML = '<h3>' + t('swap.title') + '</h3>' +
      '<div class="sw-box"><small><span>' + t('swap.from') + '</span><span>' + t('trade.balance', { b: swapFrom === 'USD' ? money(bal('USD')) : tok(bal(swapFrom)) }) + '</span></small><div class="sw-row"><input id="swAmt" type="number" min="0" step="any" placeholder="0"><select id="swFrom">' + assetOptions(swapFrom) + '</select></div></div>' +
      '<button class="sw-flip" id="swFlip" type="button" aria-label="flip">⇅</button>' +
      '<div class="sw-box"><small><span>' + t('swap.to') + '</span><span>' + t('trade.balance', { b: swapTo === 'USD' ? money(bal('USD')) : tok(bal(swapTo)) }) + '</span></small><div class="sw-row"><input id="swOut" type="text" readonly placeholder="0"><select id="swTo">' + assetOptions(swapTo) + '</select></div></div>' +
      '<button class="btn btn-accent btn-wide" id="swGo" type="button">' + t('swap.go') + '</button>';
    $('#routes').innerHTML = '<h3 class="routes">' + t('swap.routes') + '</h3><p class="muted">' + t('swap.routesSub') + '</p><div id="routeList"></div>';
    $('#swFrom').addEventListener('change', function (e) { swapFrom = e.target.value; renderSwap(); });
    $('#swTo').addEventListener('change', function (e) { swapTo = e.target.value; renderSwap(); });
    $('#swFlip').addEventListener('click', function () { var x = swapFrom; swapFrom = swapTo; swapTo = x; renderSwap(); });
    $('#swAmt').addEventListener('input', quoteSwap);
    $('#swGo').addEventListener('click', doSwap);
    quoteSwap();
  }
  // a swap is a sell into USD then a buy out of USD; each leg quoted on every DEX it can run on
  function swapRoutes(v) {
    var usd = v, legs = [];
    if (swapFrom !== 'USD') { var cf = byT(swapFrom); var qs = quoteSell(cf, v); usd = qs.out; legs.push({ c: cf, q: qs }); }
    var routes = [];
    if (swapTo === 'USD') routes.push({ dex: legs.length ? legs[0].q.route : '—', out: usd, fee: legs.length ? legs[0].q.fee : 0, usd: usd });
    else {
      var ct = byT(swapTo);
      if (!ct.grad) { var qb = quoteBuy(ct, usd); routes.push({ dex: t('coin.curveOn'), out: qb.out, fee: qb.fee + (legs[0] ? legs[0].q.fee : 0), usd: usd }); }
      else Object.keys(DEX).forEach(function (d) { var f = usd * DEX[d].fee, imp = usd / ct.liq * (d === ct.dex ? 1 : 2.5); routes.push({ dex: DEX[d].name, out: (usd - f) / ct.price * (1 - imp), fee: f + (legs[0] ? legs[0].q.fee : 0), usd: usd, key: d }); });
    }
    routes.sort(function (a, b) { return b.out - a.out; });
    return routes;
  }
  function quoteSwap() {
    var amt = $('#swAmt'); if (!amt) return;
    var v = parseFloat(amt.value) || 0, out = $('#swOut'), list = $('#routeList');
    if (swapFrom === swapTo) { out.value = ''; list.innerHTML = '<p class="muted">' + t('swap.same') + '</p>'; return; }
    if (!v) { out.value = ''; list.innerHTML = ''; return; }
    var routes = swapRoutes(v);
    out.value = swapTo === 'USD' ? money(routes[0].out) : tok(routes[0].out);
    list.innerHTML = routes.map(function (r, i) { return '<div class="route' + (i === 0 ? ' best' : '') + '"><div><span class="r-dex">' + r.dex + '</span>' + (i === 0 ? ' <span class="tag">' + t('swap.best') + '</span>' : '') + '<small>' + t('trade.fee') + ' ' + money(r.fee) + '</small></div><b>' + (swapTo === 'USD' ? money(r.out) : tok(r.out) + ' ' + swapTo) + '</b></div>'; }).join('');
  }
  function doSwap() {
    if (!needWallet()) return;
    var v = parseFloat($('#swAmt').value) || 0; if (!v || swapFrom === swapTo) return;
    if (v > bal(swapFrom) + 1e-9) { toast(swapFrom === 'USD' ? t('trade.noCash') : t('trade.noTok', { t: swapFrom })); return; }
    var r = swapRoutes(v)[0];
    if (swapFrom === 'USD') game.cash -= v; else { pad.hold[swapFrom] -= v; if (pad.hold[swapFrom] < 1e-6) delete pad.hold[swapFrom]; var cf = byT(swapFrom); cf.vol += r.usd; if (!cf.grad) { cf.raised = Math.max(0, cf.raised - r.usd); cf.price = curvePrice(cf.raised); } cf.hist.push(cf.price); }
    if (swapTo === 'USD') game.cash += r.out; else { pad.hold[swapTo] = (pad.hold[swapTo] || 0) + r.out; var ct = byT(swapTo); ct.vol += r.usd; if (!ct.grad) { ct.raised += r.usd; ct.price = curvePrice(ct.raised); if (ct.raised >= GRAD) graduate(ct); } ct.hist.push(ct.price); ct.holders += 1; }
    pad.trades.push({ t: swapFrom + '→' + swapTo, v: v, at: Date.now() });
    saveAll(); renderWallet(); toast(t('trade.done', { side: t('swap.go'), amt: swapTo === 'USD' ? money(r.out) : tok(r.out), t: swapTo === 'USD' ? '' : swapTo, usd: r.dex })); renderSwap();
  }

  // ---------- portfolio / earnings ----------
  function qLive(k) { return QUOTES[k].live || QUOTES[k].price; }
  function gameValue() { var v = 0; for (var k in game.wallet) if (QUOTES[k]) v += game.wallet[k] * qLive(k); return v; }
  function coinsValue() { var v = 0; for (var k in pad.hold) { var c = byT(k); if (c) v += pad.hold[k] * c.price; } return v; }
  function renderPortfolio() {
    var rows = Object.keys(pad.hold).map(function (k) { var c = byT(k); if (!c) return ''; var v = pad.hold[k] * c.price; return '<div class="hold"><span class="logo">' + c.em + '</span><div class="h-name"><b>' + c.name + '</b><small>' + tok(pad.hold[k]) + ' ' + k + '</small></div><div class="h-val"><b>' + money(v) + '</b><small class="chg ' + (change(c) >= 0 ? 'up' : 'down') + '">' + pct(change(c)) + '</small></div></div>'; }).join('');
    var grows = Object.keys(game.wallet).filter(function (k) { return QUOTES[k] && game.wallet[k] > 0; }).map(function (k) { return '<div class="hold"><span class="c-ico" style="background:' + QUOTES[k].color + '">' + QUOTES[k].sym + '</span><div class="h-name"><b>' + k + '</b><small>' + game.wallet[k].toFixed(k === 'BTC' ? 6 : 4) + '</small></div><div class="h-val"><b>' + money(game.wallet[k] * qLive(k)) + '</b></div></div>'; }).join('');
    $('#portfolioView').innerHTML =
      '<div class="pf-grid"><div class="tile"><small>' + t('pf.total') + '</small><b>' + money(game.cash + coinsValue() + gameValue()) + '</b></div><div class="tile"><small>' + t('pf.cash') + '</small><b>' + money(game.cash) + '</b></div><div class="tile"><small>' + t('pf.coins') + '</small><b>' + money(coinsValue()) + '</b><span>' + Object.keys(pad.hold).length + '</span></div></div>' +
      '<div class="card pf"><h3>' + t('pf.holdings') + '</h3>' + (rows || '<p class="muted" style="margin-top:8px">' + t('pf.none') + '</p>') + '</div>' +
      (grows ? '<div class="card pf"><h3>' + t('pf.game') + '</h3>' + grows + '</div>' : '') +
      '<div class="cta-card"><span class="big">👩‍🍳</span><div><h4>' + t('pf.cta') + '</h4><p>' + t('pf.ctaSub') + '</p></div><a class="btn btn-dark" href="#kitchen">' + t('hero.play') + ' ▶</a></div>';
  }
  function renderEarnings() {
    var mine = coins.filter(function (c) { return c.you; });
    $('#earningsView').innerHTML =
      '<div class="pf-grid"><div class="tile"><small>' + t('earn.creator') + '</small><b>' + money(pad.fees) + '</b><span>' + t('earn.creatorSub') + '</span></div><div class="tile"><small>' + t('earn.lp') + '</small><b>' + money(pad.lpFees) + '</b><span>' + t('earn.lpSub') + '</span></div><div class="tile"><small>' + t('earn.kitchen') + '</small><b>' + money(game.cash) + '</b><span>' + t('earn.kitchenSub', { n: game.served || 0 }) + '</span></div></div>' +
      '<div class="card pf"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h3>' + t('earn.yourCoins') + '</h3><button class="btn btn-dark" id="claim" type="button"' + (pad.fees + pad.lpFees < 0.01 ? ' disabled' : '') + '>' + t('earn.claim') + ' ' + money(pad.fees + pad.lpFees) + '</button></div>' +
      (mine.length ? mine.map(function (c) { return '<div class="hold"><span class="logo">' + c.em + '</span><div class="h-name"><b>' + c.name + '</b><small>' + c.t + ' · ' + (c.grad ? DEX[c.dex].name : Math.round(c.raised / GRAD * 100) + '% → ' + DEX[c.dex].name) + '</small></div><div class="h-val"><b>' + money(mcap(c)) + '</b><small>' + t('coin.vol') + ' ' + money(c.vol) + '</small></div></div>'; }).join('') : '<p class="muted" style="margin-top:8px">' + t('earn.none') + '</p>') + '</div>' +
      '<div class="cta-card"><span class="big">🍩</span><div><h4>' + t('launch.title') + '</h4><p>' + t('launch.s4') + '</p></div><a class="btn btn-dark" href="#launch">' + t('hero.launch') + ' +</a></div>';
    $('#claim').addEventListener('click', function () { if (!needWallet()) return; var amt = pad.fees + pad.lpFees; game.cash += amt; pad.fees = 0; pad.lpFees = 0; saveAll(); renderWallet(); renderEarnings(); toast(t('earn.claimed', { amt: money(amt) })); });
  }

  // ---------- rates / how ----------
  function renderRates() {
    var top = coins.slice().sort(function (a, b) { return mcap(b) - mcap(a); }).slice(0, 10), tot = top.reduce(function (s, c) { return s + mcap(c); }, 0), idx = top.reduce(function (s, c) { return s + change(c) * mcap(c) / tot; }, 0);
    $('#ratesView').innerHTML = '<div class="card"><h3 style="font-family:var(--display);font-size:24px;font-weight:500">' + t('rates.title') + '</h3><p class="muted" style="margin:4px 0 12px">' + t('rates.sub') + '</p><table class="rates-table"><thead><tr><th>' + t('rates.asset') + '</th><th class="num">' + t('rates.price') + '</th><th class="num">24h</th></tr></thead><tbody>' +
      Object.keys(QUOTES).map(function (k) { var ch = (qLive(k) / QUOTES[k].price - 1) * 100; return '<tr><td><span class="c-ico" style="background:' + QUOTES[k].color + '">' + QUOTES[k].sym + '</span><b>' + k + '</b></td><td class="num">' + money(qLive(k), k === 'DOGE' ? 4 : 2) + '</td><td class="num chg ' + (ch >= 0 ? 'up' : 'down') + '">' + pct(ch) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="card"><h3 style="font-family:var(--display);font-size:24px;font-weight:500">' + t('rates.index') + ' <span class="chg ' + (idx >= 0 ? 'up' : 'down') + '" style="font-size:16px">' + pct(idx) + '</span></h3><p class="muted" style="margin:4px 0 12px">' + t('rates.indexSub') + '</p><table class="rates-table"><tbody>' +
      top.map(function (c, i) { return '<tr><td><span class="muted mono" style="margin-right:10px">' + (i + 1) + '</span>' + c.em + ' <b>' + c.t + '</b></td><td class="num">' + money(mcap(c)) + '</td><td class="num chg ' + (change(c) >= 0 ? 'up' : 'down') + '">' + pct(change(c)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function renderHow() {
    $('#howView').innerHTML = '<h3 style="font-family:var(--display);font-size:30px;font-weight:500">' + t('how.title') + '</h3><div class="how-grid">' + [1, 2, 3, 4].map(function (i) { return '<div class="how-card"><span class="n">' + i + '</span><h4>' + t('how.' + i) + '</h4><p>' + t('how.' + i + 'p') + '</p></div>'; }).join('') + '</div>' +
      '<div class="card faq">' + [1, 2, 3, 4].map(function (i) { return '<details' + (i === 1 ? ' open' : '') + '><summary>' + t('faq.' + i) + '</summary><p>' + t('faq.' + i + 'p') + '</p></details>'; }).join('') + '</div>';
  }

  // ---------- boot ----------
  applyLang(); renderWallet(); saveAll(); route();
})();
