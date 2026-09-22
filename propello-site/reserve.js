/* ===========================================================================
   Propello — the one thing a linked wallet can actually do here today.

   No vault is deployed, so there is no deposit to make and nothing to
   approve. What there is, is a signature: you sign a note that names an
   amount, today's share price and the hash of the last close, and this page
   checks the signature itself — it recovers the address out of the signature
   with sig.js and compares it to the one your wallet claims. No server sees
   it, because there is no server; the check runs in the browser, and you can
   read the arithmetic that does it.

   The note names the price and the close hash, so a signature made against
   one month's numbers cannot be shown against another's.

   Where the notes are kept:
     · on claude.ai, in the artifact's shared store (`claude.use("db")`), so
       everyone looking at the page sees the same list;
     · everywhere else, in this browser's localStorage.
   Either way the list is rechecked on the spot: a row is only ticked once
   this page has recovered the address from the signature itself.
   =========================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('reserve');
  if (!root) return;

  var ZH = document.documentElement.lang === 'zh';
  var T = ZH ? {
    noteTitle: 'Propello — 预约',
    intro: function (a) { return '金库开放时，我愿意按下列价格投入 ' + a + ' EURG。'; },
    lAmount: '金额', lPrice: '份额价格', lShares: 'vPROP', lRoll: '上次结算',
    lAddress: '地址', lWhen: '签署时间', lNonce: '随机数',
    tail: '这不是交易。它不转移任何资金，也不构成任何承诺。',
    sign: '签署此说明', signing: '请在钱包中签名…', connect: '先连接钱包',
    connectFirst: '连接钱包后即可签署。', min: '最少 100 EURG。', max: '最多 1,000,000 EURG。',
    cancelled: '已取消签名。', failed: '签名失败：',
    okVerified: function (a) { return '已验证。签名恢复出的地址是 ' + a + '，与你的钱包一致。'; },
    okSolana: '已记录。此页面只能用以太坊签名重新推导地址，Solana 的 ed25519 签名不在其中。',
    mismatch: '签名恢复出的地址与你的钱包不符，没有记录。',
    yours: '你', checking: '检查中…', checked: '已验证', unchecked: 'ed25519',
    bad: '不符', remove: '撤回', removeMine: '撤回我的说明',
    shared: '共享列表', local: '仅此浏览器',
    empty: '还没有人签署。第一个就是你。',
    tot: function (n, a) { return n + ' 份说明 · 共 ' + a + ' EURG'; },
    noSig: '此浏览器无法运行签名检查。'
  } : {
    noteTitle: 'Propello — reservation',
    intro: function (a) { return 'I would put in ' + a + ' EURG at the price below, when the vault opens.'; },
    lAmount: 'Amount', lPrice: 'Share price', lShares: 'vPROP', lRoll: 'Last close',
    lAddress: 'Address', lWhen: 'Signed', lNonce: 'Nonce',
    tail: 'This is not a transaction. It moves no money and promises none.',
    sign: 'Sign the note', signing: 'Sign the note in your wallet…', connect: 'Connect a wallet first',
    connectFirst: 'Connect a wallet and the note is yours to sign.', min: 'Minimum 100 EURG.', max: 'Maximum 1,000,000 EURG.',
    cancelled: 'Signing cancelled.', failed: 'Could not sign: ',
    okVerified: function (a) { return 'Verified. The signature recovers to ' + a + ', which is your address.'; },
    okSolana: 'Recorded. This page can only re-derive an address from an Ethereum signature, and Solana signs with ed25519.',
    mismatch: 'The signature recovers to a different address, so nothing was recorded.',
    yours: 'you', checking: 'checking…', checked: 'verified', unchecked: 'ed25519',
    bad: 'no match', remove: 'withdraw', removeMine: 'Withdraw my note',
    shared: 'shared list', local: 'this browser only',
    empty: 'Nobody has signed yet. Be the first.',
    tot: function (n, a) { return n + (n === 1 ? ' note' : ' notes') + ' · ' + a + ' EURG'; },
    noSig: 'This browser cannot run the signature check.'
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var el = {
    amount: $('#rvamount'), note: $('#rvnote'), go: $('[data-rv-sign]', root),
    status: $('#rvstatus'), list: $('#rvlist'), tot: $('#rvtot'), store: $('#rvstore')
  };
  if (!el.amount || !el.note || !el.go || !el.list) return;

  var D = window.PROPELLO_DATA || {};
  var last = (D.closes && D.closes[D.closes.length - 1]) || {};
  var PRICE = D.price || 1;
  var SIG = window.PROPELLO_SIG || null;
  var W = function () { return window.PROPELLO_WALLET; };

  var MIN = 100, MAX = 1000000;
  var group = function (n) { return Number(n).toLocaleString('en-GB'); };
  function amountNow() {
    var n = parseInt(String(el.amount.value).replace(/[^0-9]/g, ''), 10);
    return isFinite(n) ? n : 0;
  }
  function shortAddr(a) { return a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a; }

  /* --------------------------------------------------------- the note ---- */
  /* Fixed-width labels, so the note reads as a table in the wallet's dialog
     as well as it does here. */
  function pad(s) { return s + new Array(Math.max(1, 13 - s.length)).join(' ') + ' '; }
  function noteFor(amount, address, when, nonce) {
    var shares = amount / PRICE;
    return [
      T.noteTitle, '',
      T.intro(group(amount)), '',
      pad(T.lAmount) + group(amount) + ' EURG',
      pad(T.lPrice) + '€' + PRICE.toFixed(6),
      pad(T.lShares) + shares.toFixed(2),
      pad(T.lRoll) + (last.month || '—') + ' · ' + (last.hash ? last.hash.slice(0, 10) + '…' + last.hash.slice(-8) : '—'),
      pad(T.lAddress) + (address || '—'),
      pad(T.lWhen) + when,
      pad(T.lNonce) + nonce, '',
      T.tail
    ].join('\n');
  }

  var draft = { when: null, nonce: null };
  function freshDraft() {
    var b = new Uint8Array(4);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(b);
    else for (var i = 0; i < 4; i++) b[i] = Math.floor(Math.random() * 256);
    draft.nonce = Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    draft.when = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  }
  freshDraft();

  function paintNote() {
    var w = W(), addr = w && w.state && w.state.account;
    el.note.textContent = noteFor(amountNow(), addr, draft.when, draft.nonce);
    el.go.textContent = addr ? T.sign : T.connect;
  }

  /* --------------------------------------------------------- the store --- */
  var LS_KEY = 'propello.reserve.v1';
  var db = null, unsub = null;

  function localAll() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEY));
      if (raw && raw.notes) return raw.notes;
    } catch (e) {}
    return {};
  }
  function localWrite(notes) { try { localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, notes: notes })); } catch (e) {} }

  function sortRows(rows) {
    return rows.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  }
  function localRows() {
    var n = localAll(), out = [];
    for (var k in n) if (Object.prototype.hasOwnProperty.call(n, k)) out.push(n[k]);
    return sortRows(out);
  }

  /* one note per address: signing again replaces your own, never piles up */
  function keyFor(address) { return String(address).toLowerCase().replace(/[^a-z0-9_.:@+-]/g, ''); }

  function saveLocal(rec) {
    var notes = localAll();
    notes[keyFor(rec.address)] = rec;
    localWrite(notes);
    paintList(localRows());
  }
  function save(rec) {
    if (db) {
      return db.collection('reservations').doc(keyFor(rec.address)).set(rec)
        /* a viewer who may not write the shared list still keeps their own note */
        .catch(function (e) { console.warn('Propello: the shared list refused the note', e); saveLocal(rec); });
    }
    saveLocal(rec);
    return Promise.resolve();
  }
  function drop(address) {
    if (db) return db.collection('reservations').doc(keyFor(address)).delete();
    var notes = localAll();
    delete notes[keyFor(address)];
    localWrite(notes);
    paintList(localRows());
    return Promise.resolve();
  }

  /* ------------------------------------------------ checking the list ---- */
  /* Every row is rechecked here, in this browser: the tick means this page
     recovered the address from the signature, not that a row claimed it. */
  var queue = [];
  function check(rec) {
    if (rec.chain === 'solana') return 'ed25519';
    if (!SIG) return 'unknown';
    try { return SIG.verify(rec.message, rec.sig, rec.address) ? 'ok' : 'bad'; }
    catch (e) { return 'bad'; }
  }
  function runQueue() {
    if (!queue.length) return;
    var job = queue.shift();
    if (!job.cell.isConnected) return runQueue();
    var v = check(job.rec);
    job.cell.className = 'rt-rv-check is-' + v;
    job.cell.textContent = v === 'ok' ? '✓ ' + T.checked : v === 'ed25519' ? T.unchecked : v === 'bad' ? '✗ ' + T.bad : '—';
    if (queue.length) setTimeout(runQueue, 0);        /* one at a time, so the page keeps breathing */
  }

  function paintList(rows) {
    var mine = W() && W().state && W().state.account;
    mine = mine ? mine.toLowerCase() : null;
    queue = [];

    if (!rows.length) {
      el.list.innerHTML = '<tr><td colspan="3" class="rt-c-muted">' + esc(T.empty) + '</td></tr>';
      el.tot.textContent = '';
      return;
    }

    var total = 0;
    el.list.innerHTML = rows.map(function (r, i) {
      total += Number(r.amount) || 0;
      var is = mine && String(r.address).toLowerCase() === mine;
      return '<tr' + (is ? ' class="is-mine"' : '') + '>' +
        '<td><span class="rt-num">' + esc(shortAddr(r.address)) + '</span>' +
          (is ? ' <span class="rt-rv-you">' + esc(T.yours) + '</span>' : '') + '</td>' +
        '<td class="rt-num">' + esc(group(r.amount)) + '</td>' +
        '<td><span class="rt-rv-check is-wait" data-check="' + i + '">' + esc(T.checking) + '</span>' +
          (is ? ' <button class="rt-rv-drop" type="button" data-rv-drop>' + esc(T.remove) + '</button>' : '') + '</td>' +
        '</tr>';
    }).join('');
    el.tot.textContent = T.tot(rows.length, group(total));

    rows.forEach(function (r, i) {
      var cell = el.list.querySelector('[data-check="' + i + '"]');
      if (cell) queue.push({ rec: r, cell: cell });
    });
    setTimeout(runQueue, 0);

    var d = el.list.querySelector('[data-rv-drop]');
    if (d) d.addEventListener('click', function () {
      var a = W() && W().state && W().state.account;
      if (a) drop(a);
    });
  }

  /* --------------------------------------------------------- signing ----- */
  function status(msg, kind) {
    el.status.textContent = msg || '';
    el.status.className = 'rt-rv-status' + (kind ? ' is-' + kind : '');
  }

  function bytesToHex(b) {
    return Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }

  function sign() {
    var w = W();
    if (!w || !w.state.account) {
      status(T.connectFirst);
      if (w) { if (window.PROPELLO_GATE) window.PROPELLO_GATE.open(w.connect); else w.connect(); }
      return;
    }
    var amount = amountNow();
    if (amount < MIN) { status(T.min, 'bad'); return; }
    if (amount > MAX) { status(T.max, 'bad'); return; }

    var address = w.state.account;
    freshDraft();                                  /* a fresh nonce and time per signature */
    var message = noteFor(amount, address, draft.when, draft.nonce);
    el.note.textContent = message;

    var rec = {
      address: address, amount: amount, price: PRICE,
      shares: Number((amount / PRICE).toFixed(2)),
      roll: last.month || null, rollHash: last.hash || null,
      at: draft.when, nonce: draft.nonce, message: message,
      chain: w.state.kind === 'solana' ? 'solana' : 'evm', sig: null
    };

    status(T.signing);
    el.go.disabled = true;
    var asked;
    if (rec.chain === 'solana') {
      if (typeof w.state.provider.signMessage !== 'function') { el.go.disabled = false; status(T.failed + 'signMessage', 'bad'); return; }
      asked = Promise.resolve(w.state.provider.signMessage(new TextEncoder().encode(message), 'utf8'))
        .then(function (r) { var s = (r && r.signature) || r; return '0x' + bytesToHex(s); });
    } else {
      var hex = '0x' + bytesToHex(new TextEncoder().encode(message));
      asked = w.state.provider.request({ method: 'personal_sign', params: [hex, address] });
    }

    asked.then(function (sig) {
      rec.sig = String(sig);
      if (rec.chain === 'evm') {
        if (!SIG) { status(T.noSig, 'bad'); return; }
        var got;
        try { got = SIG.recover(SIG.hashMessage(message), rec.sig); } catch (e) { got = null; }
        if (!got || got.toLowerCase() !== address.toLowerCase()) { status(T.mismatch, 'bad'); return; }
        rec.recovered = got;
        status(T.okVerified(shortAddr(got)), 'ok');
      } else {
        status(T.okSolana, 'ok');
      }
      return save(rec);
    }).catch(function (err) {
      if (err && err.code === 4001) status(T.cancelled);
      else status(T.failed + (err && (err.message || err)), 'bad');
    }).then(function () { el.go.disabled = false; });
  }

  /* ------------------------------------------------------------ wiring --- */
  el.amount.addEventListener('input', function () {
    var n = amountNow();
    var at = el.amount.selectionStart, before = el.amount.value.length;
    el.amount.value = n ? group(n) : '';
    if (document.activeElement === el.amount) {
      var moved = el.amount.value.length - before;
      try { el.amount.setSelectionRange(at + moved, at + moved); } catch (e) {}
    }
    paintNote();
  });
  Array.prototype.forEach.call(root.querySelectorAll('[data-rv-chip]'), function (b) {
    b.addEventListener('click', function () {
      el.amount.value = group(Number(b.getAttribute('data-rv-chip')));
      paintNote();
      status('');
    });
  });
  el.go.addEventListener('click', sign);

  /* the note carries the address, so it is redrawn whenever the link changes */
  setInterval(function () {
    var a = (W() && W().state && W().state.account) || null;
    if (a !== paintNote.last) { paintNote.last = a; paintNote(); paintList(db ? paintList.rows || [] : localRows()); }
  }, 900);

  paintNote();
  paintList(localRows());

  /* ------------------------------------------------------- shared store -- */
  var use = window.claude && typeof window.claude.use === 'function' ? window.claude.use.bind(window.claude) : null;
  if (el.store) el.store.textContent = T.local;
  if (!use) return;
  use('db').then(function (d) {
    if (!d) return;
    db = d;
    if (el.store) { el.store.textContent = T.shared; el.store.classList.add('is-shared'); }
    unsub = db.collection('reservations').orderBy('at', 'desc').limit(60).onSnapshot(function (snap) {
      var rows = snap.docs.map(function (s) { return s.data(); }).filter(function (r) { return r && r.address && r.sig; });
      paintList.rows = rows;
      paintList(rows);
    }, function (e) {
      console.warn('Propello: the shared list is unavailable', e);
      db = null;
      if (el.store) { el.store.textContent = T.local; el.store.classList.remove('is-shared'); }
      paintList(localRows());
    });
  }).catch(function (e) { console.warn('Propello: db unavailable', e); });
})();
