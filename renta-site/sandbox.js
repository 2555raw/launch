/* ===========================================================================
   RENTA — the sandbox. The vault's rules (contracts/Vault.sol) run here in
   the browser with play money, and every visitor shares one vault.

   Where the vault lives:
     · on claude.ai, in the artifact's shared store (`claude.use("db")`):
       one document, sandbox/vault, that every open page subscribes to and
       writes under a short lease, so two people cannot overwrite each other;
     · anywhere else, in this browser's localStorage, and the page says so.

   Who you are:
     · a guest, by a name you pick (on claude.ai the guest id is your
       account's opaque id, so your position follows you between devices);
     · or a wallet: the page asks it to sign one message. The signature is
       not verified anywhere — there is no server — it is the wallet flow,
       for real, with no transaction behind it.
   =========================================================================== */
(function () {
  'use strict';
  var D = window.RENTA_DATA;
  if (!D) { console.error('RENTA: data/vault.js did not load'); return; }

  /* ---------------------------------------------------------- language --- */
  var LANG = document.documentElement.lang || 'en';
  var LOCALE = { en: 'en-GB', zh: 'zh-CN' }[LANG] || 'en-GB';
  var STR = {
    en: {
      months: { '01': 'January', '02': 'February', '03': 'March', '04': 'April', '05': 'May', '06': 'June', '07': 'July', '08': 'August', '09': 'September', '10': 'October', '11': 'November', '12': 'December' },
      shared: 'Shared vault. Everyone on this page sees the same state, live.',
      local: 'This browser only. The shared store is not available on this host, so the vault lives in your localStorage.',
      guest: 'guest', wallet: 'wallet', you: 'you',
      rolls: 'the Rolls', sandbox: 'sandbox', bought: 'bought',
      nameNeeded: 'Pick a name first.',
      noWallet: 'No wallet found. Install MetaMask, Rabby or Coinbase Wallet, or continue as a guest.',
      cancelled: 'Cancelled in the wallet.',
      couldNot: 'Could not connect: ',
      signMsg: function (a) { return 'RENTA sandbox\n\nSign to use ' + a + ' in the sandbox.\nNo transaction, no gas, nothing goes on chain.'; },
      signedIn: function (n) { return 'Signed in as ' + n + '.'; },
      signedOut: 'Signed out. Your position stays in the vault under that name.',
      tapOk: function (a) { return 'The tap gave you ' + a + ' EURG.'; },
      tapMax: 'You already hold the most the tap allows, €100,000.',
      depMin: 'The minimum deposit is €100.',
      depFunds: 'Not enough EURG in hand. Try the tap.',
      depOk: function (a, s, p) { return 'Deposited ' + a + ' at ' + p + ': ' + s + ' vRENTA.'; },
      redNone: 'Nothing to redeem.',
      redMore: 'You do not hold that many vRENTA.',
      redOk: function (n, t) { return 'Redeemed: ' + n + ' paid out' + (t ? ', ' + t + ' curve tax stayed in the vault' : '') + '.'; },
      redQueued: function (s) { return 'The reserve cannot cover it right now: ' + s + ' vRENTA queued for the next close.'; },
      closeOk: function (m, p) { return 'Closed ' + m + '. The price is now ' + p + '.'; },
      closeMax: 'The sandbox has run twenty years. Reset it to go on.',
      busy: 'Someone else is writing to the vault right now. Try again in a second.',
      failed: 'The vault did not accept that: ',
      resetQ: 'Reset the sandbox for everyone? Every position and every sandbox close is wiped.',
      resetOk: 'The sandbox is back to where the Rolls end.',
      curveNote: function (pct, n) { return pct ? 'Your last deposit is within 90 days. Redeeming now keeps ' + pct + ' in the vault; ' + n + ' more close' + (n > 1 ? 's' : '') + ' and it is gone.' : 'No curve: your last deposit is more than 90 days back, or you have not deposited yet.'; },
      depPreview: function (s) { return '→ ' + s + ' vRENTA'; },
      redPreview: function (n, t) { return '→ ' + n + (t ? ' after ' + t + ' curve' : ''); },
      closePreview: function (m, sch, col, cost, kept, p, buy) { return m + ': ' + sch + ' scheduled, about ' + col + ' expected to arrive, ' + cost + ' of costs, so ' + kept + ' more in the reserve' + (buy ? ', and with the reserve that fat the vault buys a building for ' + buy : '') + '. Price after: ' + p + '.'; },
      closeBtn: function (m) { return 'Close ' + m; },
      queueNote: function (s) { return s + ' vRENTA of yours are queued. They settle at the next close, at that close’s price.'; },
      nobody: 'No one holds sandbox shares yet. Be the first.',
      empty: 'Nothing yet.',
      kinds: { tap: 'Tap', deposit: 'Deposit', redeem: 'Redeem', queue: 'Queued', settle: 'Settled', close: 'Close', reset: 'Reset' },
      ledger: {
        tap: function (w, a) { return w + ' took ' + a + ' from the tap.'; },
        deposit: function (w, a, s, p) { return w + ' deposited ' + a + ' for ' + s + ' vRENTA at ' + p + '.'; },
        redeem: function (w, s, n, t) { return w + ' redeemed ' + s + ' vRENTA for ' + n + (t ? ' (' + t + ' curve)' : '') + '.'; },
        queue: function (w, s) { return w + ' queued ' + s + ' vRENTA for the close.'; },
        settle: function (w, s, n) { return 'The close paid ' + w + ' ' + n + ' for ' + s + ' queued vRENTA.'; },
        close: function (w, m, k, p) { return w + ' closed ' + m + ': ' + k + ' kept, price ' + p + '.'; },
        reset: function (w) { return w + ' reset the sandbox.'; }
      }
    },
    zh: {
      months: { '01': '1月', '02': '2月', '03': '3月', '04': '4月', '05': '5月', '06': '6月', '07': '7月', '08': '8月', '09': '9月', '10': '10月', '11': '11月', '12': '12月' },
      shared: '共享金库。本页所有访客实时看到同一状态。',
      local: '仅限此浏览器。此主机上没有共享存储，金库保存在你的 localStorage 里。',
      guest: '访客', wallet: '钱包', you: '你',
      rolls: '月报', sandbox: '沙盒', bought: '购楼',
      nameNeeded: '先取个名字。',
      noWallet: '未找到钱包。请安装 MetaMask、Rabby 或 Coinbase Wallet，或以访客身份继续。',
      cancelled: '已在钱包中取消。',
      couldNot: '无法连接：',
      signMsg: function (a) { return 'RENTA 沙盒\n\n签名以在沙盒中使用 ' + a + '。\n没有交易，没有 gas，不会上链。'; },
      signedIn: function (n) { return '已以 ' + n + ' 登录。'; },
      signedOut: '已退出。你的仓位仍以该名字留在金库里。',
      tapOk: function (a) { return '水龙头给了你 ' + a + ' EURG。'; },
      tapMax: '你已持有水龙头允许的上限 €100,000。',
      depMin: '最低存入 €100。',
      depFunds: '手头 EURG 不够。试试水龙头。',
      depOk: function (a, s, p) { return '以 ' + p + ' 存入 ' + a + '：' + s + ' vRENTA。'; },
      redNone: '没有可赎回的份额。',
      redMore: '你没有那么多 vRENTA。',
      redOk: function (n, t) { return '已赎回：支付 ' + n + (t ? '，' + t + ' 曲线税留在金库' : '') + '。'; },
      redQueued: function (s) { return '储备目前不足以支付：' + s + ' vRENTA 已排队等待下次结算。'; },
      closeOk: function (m, p) { return '已结算 ' + m + '。价格现为 ' + p + '。'; },
      closeMax: '沙盒已运行二十年。请重置后继续。',
      busy: '有人正在写入金库。请稍后再试。',
      failed: '金库未接受该操作：',
      resetQ: '为所有人重置沙盒？所有仓位和沙盒结算都会被清除。',
      resetOk: '沙盒已回到月报结束的地方。',
      curveNote: function (pct, n) { return pct ? '你上次存入不满 90 天。现在赎回会有 ' + pct + ' 留在金库；再过 ' + n + ' 次结算即归零。' : '没有曲线税：你上次存入已超过 90 天，或尚未存入。'; },
      depPreview: function (s) { return '→ ' + s + ' vRENTA'; },
      redPreview: function (n, t) { return '→ ' + n + (t ? '（扣除 ' + t + ' 曲线税后）' : ''); },
      closePreview: function (m, sch, col, cost, kept, p, buy) { return m + '：应收 ' + sch + '，预计实收约 ' + col + '，成本 ' + cost + '，储备因此增加 ' + kept + (buy ? '；储备充裕，金库将以 ' + buy + ' 购入一栋楼' : '') + '。结算后价格 ' + p + '。'; },
      closeBtn: function (m) { return '结算 ' + m; },
      queueNote: function (s) { return '你有 ' + s + ' vRENTA 在排队，将在下次结算时按当时价格结清。'; },
      nobody: '还没有人持有沙盒份额。做第一个吧。',
      empty: '暂无记录。',
      kinds: { tap: '水龙头', deposit: '存入', redeem: '赎回', queue: '排队', settle: '结清', close: '结算', reset: '重置' },
      ledger: {
        tap: function (w, a) { return w + ' 从水龙头取了 ' + a + '。'; },
        deposit: function (w, a, s, p) { return w + ' 以 ' + p + ' 存入 ' + a + '，得到 ' + s + ' vRENTA。'; },
        redeem: function (w, s, n, t) { return w + ' 赎回 ' + s + ' vRENTA，得到 ' + n + (t ? '（曲线税 ' + t + '）' : '') + '。'; },
        queue: function (w, s) { return w + ' 将 ' + s + ' vRENTA 排队等待结算。'; },
        settle: function (w, s, n) { return '结算向 ' + w + ' 支付 ' + n + '，对应 ' + s + ' 排队的 vRENTA。'; },
        close: function (w, m, k, p) { return w + ' 结算了 ' + m + '：留存 ' + k + '，价格 ' + p + '。'; },
        reset: function (w) { return w + ' 重置了沙盒。'; }
      }
    }
  };
  var T = STR[LANG] || STR.en;

  /* ------------------------------------------------------------ helpers --- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var r6 = function (n) { return Math.round(n * 1e6) / 1e6; };
  var euro = function (n, dp) { dp = dp === undefined ? 2 : dp; return '€' + n.toLocaleString(LOCALE, { minimumFractionDigits: dp, maximumFractionDigits: dp }); };
  var num = function (n, dp) { dp = dp === undefined ? 2 : dp; return n.toLocaleString(LOCALE, { minimumFractionDigits: dp, maximumFractionDigits: dp }); };
  var price4 = function (p) { return '€' + p.toFixed(4); };
  var monthName = function (m) { return LANG === 'zh' ? m.slice(0, 4) + '年' + T.months[m.slice(5, 7)] : T.months[m.slice(5, 7)] + ' ' + m.slice(0, 4); };
  var nextMonth = function (m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) + 1; if (mo > 12) { mo = 1; y++; } return y + '-' + (mo < 10 ? '0' : '') + mo; };
  var parseAmt = function (s) { var n = parseFloat(String(s).replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var short = function (a) { return a.slice(0, 6) + '…' + a.slice(-4); };
  /* a small deterministic hash, so every visitor forecasts the same month */
  function hash01(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }

  var toast = $('#toast'), toastT;
  function say(msg) { if (!toast) return; toast.textContent = msg; toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('is-on'); }, 3600); }

  /* ------------------------------------------------------------ the nav --- */
  var nav = $('#nav'), links = $('#navlinks'), burger = $('#burger');
  function onScroll() { nav.classList.toggle('is-stuck', window.scrollY > 12); }
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  if (burger) burger.addEventListener('click', function () { var o = links.classList.toggle('is-open'); burger.setAttribute('aria-expanded', String(o)); });

  /* ----------------------------------------------------------- the rules ---
     Money in cents' precision, shares to the cent too, price to 6 dp: the
     contract does this in integers; here rounding drift is a rounding error
     on a game, not on a ledger.                                            */
  var CURVE_BPS = 300, CURVE_CLOSES = 3;   /* 90 days, a month per close */
  var TAP = 25000, TAP_MAX = 100000, MIN_DEP = 100, MAX_CLOSES = 240, LEDGER_MAX = 40;
  var BUY_ABOVE = 600000, KEEP = 150000;   /* a close with a fat reserve buys a building and keeps this much */

  function seed() {
    var closes = D.closes.map(function (c) {
      return { month: c.month, price: c.price, collected: c.collected, costs: c.costs, kept: c.kept, supply: c.sharesClose, real: true };
    });
    return { v: 1, supply: D.sharesInIssue, reserve: D.reserve, buildings: D.buildingsAtCost, closes: closes, queue: [], holders: {}, ledger: [], seq: 0 };
  }
  function priceOf(S) { return S.supply > 0 ? r6((S.reserve + S.buildings) / S.supply) : 1; }
  function holder(S, who) {
    var h = S.holders[who.id];
    if (!h) h = S.holders[who.id] = { name: who.name, kind: who.kind, eurg: 0, shares: 0, lastDep: -1, taps: 0 };
    if (who.name && h.name !== who.name) h.name = who.name;
    return h;
  }
  function curveBps(S, h) {
    if (!h || h.lastDep < 0) return 0;
    var since = S.closes.length - h.lastDep;
    if (since >= CURVE_CLOSES) return 0;
    return CURVE_BPS * (CURVE_CLOSES - since) / CURVE_CLOSES;
  }
  function previewRedeem(S, h, shares) {
    var gross = r2(shares * priceOf(S)), tax = r2(gross * curveBps(S, h) / 10000);
    return { gross: gross, tax: tax, net: r2(gross - tax) };
  }
  function forecast(S) {
    var m = nextMonth(S.closes[S.closes.length - 1].month);
    var sch = Math.round(D.scheduledMonthly * S.buildings / D.buildingsAtCost);   /* more buildings, more rent */
    var collected = Math.round(sch * (0.90 + 0.10 * hash01('rent:' + m)));
    var costs = Math.round(sch * (0.26 + 0.10 * hash01('cost:' + m)));
    var kept = collected - costs;
    var reserve = S.reserve + kept;
    var buy = reserve > BUY_ABOVE ? Math.floor((reserve - KEEP) / 10000) * 10000 : 0;
    var price = S.supply > 0 ? r6((reserve + S.buildings) / S.supply) : 1;
    return { month: m, scheduled: sch, collected: collected, costs: costs, kept: kept, buy: buy, price: price };
  }
  function log(S, entry) {
    entry.t = Date.now(); entry.n = ++S.seq;
    S.ledger.unshift(entry);
    if (S.ledger.length > LEDGER_MAX) S.ledger.length = LEDGER_MAX;
  }

  /* each action mutates S in place and returns the toast; throws to refuse */
  var ACT = {
    tap: function (S, who) {
      var h = holder(S, who);
      if (h.eurg >= TAP_MAX) throw new Error(T.tapMax);
      var a = Math.min(TAP, TAP_MAX - h.eurg);
      h.eurg = r2(h.eurg + a); h.taps++;
      log(S, { kind: 'tap', who: who.id, eurg: a });
      return T.tapOk(euro(a, 0));
    },
    deposit: function (S, who, amount) {
      var h = holder(S, who);
      amount = r2(amount);
      if (amount < MIN_DEP) throw new Error(T.depMin);
      if (amount > h.eurg) throw new Error(T.depFunds);
      var p = priceOf(S), shares = r2(amount / p);
      h.eurg = r2(h.eurg - amount); h.shares = r2(h.shares + shares); h.lastDep = S.closes.length;
      S.reserve = r2(S.reserve + amount); S.supply = r2(S.supply + shares);
      log(S, { kind: 'deposit', who: who.id, eurg: amount, shares: shares, price: p });
      return T.depOk(euro(amount), num(shares), price4(p));
    },
    redeem: function (S, who, shares) {
      var h = holder(S, who);
      shares = shares ? r2(shares) : h.shares;
      if (!(shares > 0)) throw new Error(T.redNone);
      if (shares > h.shares + 1e-9) throw new Error(T.redMore);
      var q = previewRedeem(S, h, shares);
      h.shares = r2(h.shares - shares);
      if (q.net > S.reserve) {
        S.queue.push({ who: who.id, shares: shares, at: S.closes.length });
        log(S, { kind: 'queue', who: who.id, shares: shares });
        return T.redQueued(num(shares));
      }
      S.supply = r2(S.supply - shares); S.reserve = r2(S.reserve - q.net);
      h.eurg = r2(h.eurg + q.net);
      log(S, { kind: 'redeem', who: who.id, shares: shares, eurg: q.net, tax: q.tax });
      return T.redOk(euro(q.net), q.tax ? euro(q.tax) : '');
    },
    close: function (S, who) {
      if (S.closes.length >= MAX_CLOSES) throw new Error(T.closeMax);
      holder(S, who);
      var f = forecast(S);
      S.reserve = r2(S.reserve + f.kept);
      if (f.buy) { S.reserve = r2(S.reserve - f.buy); S.buildings += f.buy; }
      /* settle the queue in order, at this close's price, as far as the reserve reaches */
      var left = [];
      for (var i = 0; i < S.queue.length; i++) {
        var q = S.queue[i], qh = S.holders[q.who];
        var pv = previewRedeem(S, qh, q.shares);
        if (left.length || pv.net > S.reserve) { left.push(q); continue; }
        S.supply = r2(S.supply - q.shares); S.reserve = r2(S.reserve - pv.net);
        if (qh) qh.eurg = r2(qh.eurg + pv.net);
        log(S, { kind: 'settle', who: q.who, shares: q.shares, eurg: pv.net, tax: pv.tax });
      }
      S.queue = left;
      var p = priceOf(S);
      S.closes.push({ month: f.month, price: p, collected: f.collected, costs: f.costs, kept: f.kept, bought: f.buy, supply: S.supply, real: false, by: who.id });
      log(S, { kind: 'close', who: who.id, month: f.month, eurg: f.kept, price: p });
      return T.closeOk(monthName(f.month), price4(p));
    },
    reset: function (S, who) {
      var fresh = seed();
      Object.keys(S).forEach(function (k) { delete S[k]; });
      Object.keys(fresh).forEach(function (k) { S[k] = fresh[k]; });
      holder(S, who);
      log(S, { kind: 'reset', who: who.id });
      return T.resetOk;
    }
  };

  /* ---------------------------------------------------------- the store ---
     Two backends behind one shape: subscribe(cb) delivers the state now and
     on every change; mutate(fn) runs fn(S, who, ...) on the latest state and
     commits it. Shared mode takes a short lease first, so concurrent
     visitors queue up instead of overwriting each other.                   */
  var LS_KEY = 'renta.sandbox.v1';
  var store = { shared: false, owner: true, uid: null };
  var db = null, listeners = [];
  function notify(S) { listeners.forEach(function (f) { f(S); }); }

  function localRead() { try { var s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.v === 1) return s; } catch (e) {} return seed(); }
  function localWrite(S) { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }

  store.subscribe = function (cb) {
    listeners.push(cb);
    if (db) {
      db.doc('sandbox/vault').onSnapshot(function (snap) { cb(snap.exists ? snap.data() : seed()); }, function (e) { console.warn('RENTA sandbox: store lost', e); });
    } else cb(localRead());
  };
  store.mutate = function (fn, args) {
    if (db) {
      var ref = db.doc('sandbox/vault');
      return ref.acquire({ holder: store.uid || who.id, ttlMs: 8000 }).then(function (r) {
        if (!r.acquired) throw new Error(T.busy);
        return ref.get();
      }).then(function (snap) {
        var S = snap.exists ? JSON.parse(JSON.stringify(snap.data())) : seed();
        var msg = fn.apply(null, [S].concat(args));
        return ref.set(S).then(function () { return msg; });
      });
    }
    return new Promise(function (resolve) {
      var S = localRead();
      var msg = fn.apply(null, [S].concat(args));
      localWrite(S); notify(S); resolve(msg);
    });
  };

  /* -------------------------------------------------------------- who ---- */
  var WHO_KEY = 'renta.sandbox.who';
  var who = null;
  function loadWho() { try { var w = JSON.parse(localStorage.getItem(WHO_KEY)); if (w && w.id && w.name) return w; } catch (e) {} return null; }
  function saveWho(w) { who = w; try { if (w) localStorage.setItem(WHO_KEY, JSON.stringify(w)); else localStorage.removeItem(WHO_KEY); } catch (e) {} renderMe(); }
  function guestId() { if (store.uid) return 'g:' + store.uid; var id = 'g:' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); return id; }

  /* wallets: EIP-6963 discovery, then the injected provider */
  var providers = [];
  window.addEventListener('eip6963:announceProvider', function (e) { if (!providers.some(function (p) { return p.info.uuid === e.detail.info.uuid; })) providers.push(e.detail); });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  function pickProvider() { if (providers.length) return providers[0]; if (window.ethereum) return { info: { name: 'Injected wallet' }, provider: window.ethereum }; return null; }
  function toHex(s) { var b = new TextEncoder().encode(s), h = '0x'; for (var i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0'); return h; }
  function connectWallet() {
    var p = pickProvider();
    if (!p) { say(T.noWallet); return; }
    var addr;
    p.provider.request({ method: 'eth_requestAccounts' }).then(function (acc) {
      addr = acc[0];
      return p.provider.request({ method: 'personal_sign', params: [toHex(T.signMsg(addr)), addr] });
    }).then(function (sig) {
      saveWho({ kind: 'wallet', id: addr.toLowerCase(), name: short(addr), sig: String(sig).slice(0, 12) + '…' });
      say(T.signedIn(short(addr)));
    }).catch(function (err) { if (err && err.code === 4001) say(T.cancelled); else say(T.couldNot + (err && err.message || err)); });
  }

  /* ------------------------------------------------------------ render --- */
  var S = seed();
  var el = {
    mode: $('#sb-mode'), signin: $('#sb-signin'), me: $('#sb-me'), name: $('#sb-name'),
    meName: $('#sb-me-name'), meKind: $('#sb-me-kind'), eurg: $('#sb-eurg'), shares: $('#sb-shares'), worth: $('#sb-worth'), curve: $('#sb-curve'), curveNote: $('#sb-curve-note'),
    depAmt: $('#sb-dep-amt'), depPrev: $('#sb-dep-preview'), redAmt: $('#sb-red-amt'), redPrev: $('#sb-red-preview'), queueNote: $('#sb-queue-note'),
    price: $('#sb-price'), supply: $('#sb-supply'), reserve: $('#sb-reserve'), buildings: $('#sb-buildings'), holdersN: $('#sb-holders-n'), queued: $('#sb-queued'),
    closeH: $('#sb-close-h'), closePrev: $('#sb-close-preview'), closeBtn: $('#sb-close'), closes: $('#sb-closes tbody'), holders: $('#sb-holders tbody'), ledger: $('#sb-ledger'), reset: $('#sb-reset'),
    navWallet: $('#sb-nav-wallet')
  };

  function nameOf(id) {
    var h = S.holders[id];
    var n = h && h.name ? h.name : id.slice(0, 10);
    return who && id === who.id ? n + ' (' + T.you + ')' : n;
  }
  function renderMe() {
    var on = !!who;
    el.signin.hidden = on; el.me.hidden = !on;
    $$('[data-needs-me]').forEach(function (b) { b.disabled = !on; });
    if (el.navWallet) { el.navWallet.textContent = who && who.kind === 'wallet' ? who.name : (LANG === 'zh' ? '连接钱包' : 'Connect wallet'); el.navWallet.classList.toggle('is-connected', !!(who && who.kind === 'wallet')); }
    if (!on) return;
    el.meName.textContent = who.name;
    el.meKind.textContent = who.kind === 'wallet' ? T.wallet : T.guest;
    var h = S.holders[who.id] || { eurg: 0, shares: 0, lastDep: -1 };
    var p = priceOf(S), bps = curveBps(S, h);
    el.eurg.textContent = euro(h.eurg);
    el.shares.textContent = num(h.shares);
    el.worth.textContent = euro(r2(h.shares * p));
    el.curve.textContent = (bps / 100).toFixed(bps % 100 ? 1 : 0) + '%';
    var left = h.lastDep < 0 ? 0 : Math.max(0, CURVE_CLOSES - (S.closes.length - h.lastDep));
    el.curveNote.textContent = T.curveNote(bps ? (bps / 100).toFixed(bps % 100 ? 1 : 0) + '%' : '', left);
    var mine = S.queue.filter(function (q) { return q.who === who.id; }).reduce(function (s, q) { return s + q.shares; }, 0);
    el.queueNote.hidden = !mine; if (mine) el.queueNote.textContent = T.queueNote(num(mine));
    renderPreviews();
  }
  function renderPreviews() {
    var p = priceOf(S);
    var a = parseAmt(el.depAmt.value);
    el.depPrev.textContent = a >= MIN_DEP ? T.depPreview(num(r2(a / p))) : '';
    var h = who ? S.holders[who.id] : null;
    var sh = parseAmt(el.redAmt.value) || (h ? h.shares : 0);
    if (h && sh > 0 && sh <= h.shares + 1e-9) { var q = previewRedeem(S, h, sh); el.redPrev.textContent = T.redPreview(euro(q.net), q.tax ? euro(q.tax) : ''); }
    else el.redPrev.textContent = '';
  }
  function renderVault() {
    var p = priceOf(S);
    el.price.textContent = price4(p);
    el.supply.textContent = num(S.supply, 0);
    el.reserve.textContent = euro(S.reserve, 0);
    el.buildings.textContent = euro(S.buildings, 0);
    var hs = Object.keys(S.holders).filter(function (k) { return S.holders[k].shares > 0; });
    el.holdersN.textContent = String(hs.length);
    var queued = S.queue.reduce(function (s, q) { return s + q.shares; }, 0);
    el.queued.textContent = num(queued, 0);

    var f = forecast(S);
    el.closeH.textContent = T.closeBtn(monthName(f.month));
    el.closePrev.textContent = T.closePreview(monthName(f.month), euro(f.scheduled, 0), euro(f.collected, 0), euro(f.costs, 0), euro(f.kept, 0), price4(f.price), f.buy ? euro(f.buy, 0) : '');
    el.closeBtn.textContent = T.closeBtn(monthName(f.month));

    el.closes.innerHTML = S.closes.slice().reverse().map(function (c) {
      return '<tr class="' + (c.real ? 'is-real' : 'is-sb') + '"><th>' + esc(monthName(c.month)) + '</th><td>' + euro(c.collected, 0) + '</td><td>' + euro(c.costs, 0) + '</td><td class="rt-sb-pos">' + euro(c.kept, 0) + '</td><td>' + price4(c.price) + '</td><td>' + (c.real ? T.rolls : esc(T.sandbox + (c.by ? ' · ' + nameOf(c.by) : ''))) + (c.bought ? ' <span class="rt-sb-kind">' + T.bought + ' ' + euro(c.bought, 0) + '</span>' : '') + '</td></tr>';
    }).join('');

    hs.sort(function (a, b) { return S.holders[b].shares - S.holders[a].shares; });
    el.holders.innerHTML = hs.length ? hs.slice(0, 12).map(function (id) {
      var h = S.holders[id];
      return '<tr' + (who && id === who.id ? ' class="is-me"' : '') + '><th>' + esc(nameOf(id)) + ' <span class="rt-sb-kind">' + (h.kind === 'wallet' ? T.wallet : T.guest) + '</span></th><td>' + num(h.shares) + '</td><td>' + euro(r2(h.shares * p)) + '</td></tr>';
    }).join('') : '<tr><td colspan="3" class="rt-sb-empty">' + T.nobody + '</td></tr>';

    el.ledger.innerHTML = S.ledger.length ? S.ledger.slice(0, 20).map(function (e) {
      var w = nameOf(e.who), L = T.ledger, text;
      switch (e.kind) {
        case 'tap': text = L.tap(w, euro(e.eurg, 0)); break;
        case 'deposit': text = L.deposit(w, euro(e.eurg), num(e.shares), price4(e.price)); break;
        case 'redeem': text = L.redeem(w, num(e.shares), euro(e.eurg), e.tax ? euro(e.tax) : ''); break;
        case 'queue': text = L.queue(w, num(e.shares)); break;
        case 'settle': text = L.settle(w, num(e.shares), euro(e.eurg)); break;
        case 'close': text = L.close(w, monthName(e.month), euro(e.eurg, 0), price4(e.price)); break;
        default: text = L.reset(w);
      }
      return '<li><span class="rt-sb-kind rt-sb-kind--' + e.kind + '">' + T.kinds[e.kind] + '</span><span>' + esc(text) + '</span></li>';
    }).join('') : '<li class="rt-sb-empty">' + T.empty + '</li>';
  }
  function render(next) { S = next; renderVault(); renderMe(); }

  /* ------------------------------------------------------------ actions -- */
  var busy = false;
  function run(fn, args, after) {
    if (!who || busy) return;
    busy = true; document.body.classList.add('rt-sb-busy');
    store.mutate(fn, [who].concat(args || [])).then(function (msg) {
      say(msg); if (after) after();
    }).catch(function (err) {
      var m = err && err.message || String(err);
      say(m === T.busy || Object.keys(T).some(function (k) { return T[k] === m; }) ? m : T.failed + m);
    }).then(function () { busy = false; document.body.classList.remove('rt-sb-busy'); });
  }
  $('#sb-guest').addEventListener('click', function () {
    var n = el.name.value.trim();
    if (!n) { say(T.nameNeeded); el.name.focus(); return; }
    saveWho({ kind: 'guest', id: guestId(), name: n });
    say(T.signedIn(n));
  });
  el.name.addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#sb-guest').click(); });
  $('#sb-wallet').addEventListener('click', connectWallet);
  if (el.navWallet) el.navWallet.addEventListener('click', function () { if (who && who.kind === 'wallet') return; connectWallet(); });
  $('#sb-signout').addEventListener('click', function () { saveWho(null); say(T.signedOut); });
  $('#sb-tap').addEventListener('click', function () { run(ACT.tap); });
  $('#sb-deposit').addEventListener('click', function () { run(ACT.deposit, [parseAmt(el.depAmt.value)]); });
  $('#sb-redeem').addEventListener('click', function () { run(ACT.redeem, [parseAmt(el.redAmt.value)], function () { el.redAmt.value = ''; }); });
  el.closeBtn.addEventListener('click', function () { run(ACT.close); });
  el.reset.addEventListener('click', function () { if (window.confirm(T.resetQ)) run(ACT.reset); });
  el.depAmt.addEventListener('input', renderPreviews);
  el.depAmt.addEventListener('blur', function () { var a = parseAmt(el.depAmt.value); el.depAmt.value = a ? num(a, a % 1 ? 2 : 0) : ''; renderPreviews(); });
  el.redAmt.addEventListener('input', renderPreviews);

  /* --------------------------------------------------------------- boot -- */
  who = loadWho();
  render(seed());
  el.mode.textContent = '';

  function start() {
    store.subscribe(render);
    el.mode.textContent = store.shared ? T.shared : T.local;
    el.mode.classList.toggle('is-shared', store.shared);
    el.reset.hidden = !store.owner;
    renderMe();
  }

  var use = window.claude && typeof window.claude.use === 'function' ? window.claude.use.bind(window.claude) : null;
  if (!use) { start(); return; }
  Promise.all([use('db'), use('user')]).then(function (r) {
    db = r[0]; var user = r[1];
    store.shared = !!db;
    if (!user) return;
    return Promise.all([user.id(), user.isOwner()]).then(function (u) {
      store.uid = u[0] || null;
      store.owner = !db || !!u[1];
      /* a guest on claude.ai is keyed by the account, so the position follows them */
      if (who && who.kind === 'guest' && store.uid && who.id !== 'g:' + store.uid) saveWho({ kind: 'guest', id: 'g:' + store.uid, name: who.name });
    });
  }).catch(function (e) { console.warn('RENTA sandbox: capabilities unavailable', e); }).then(start);
})();
