/* ===========================================================================
   Propello — linking a wallet. No library: EIP-6963 discovery, EIP-1193
   requests, ABI calls hand-encoded. Reads config.js.

   What it does:
     · finds every injected wallet on two rails — EIP-6963 for MetaMask,
       Rabby, Coinbase and Phantom's Ethereum side, and the Solana provider
       for Phantom, Solflare and Backpack — and asks which one when more
       than one answers;
     · connects, and moves the wallet to the vault's chain, adding the chain
       if the wallet does not know it;
     · links: one `personal_sign` proves the address is yours. Nothing is sent
       anywhere — there is no server — so the signature stays in this browser
       and only decides what the page shows;
     · comes back linked after a reload, by asking `eth_accounts`, which never
       opens a prompt, so the connection survives without nagging;
     · shows the address, the network and the balance, and once a vault
       address is set in config.js, your vPROP straight from the contract.

   Nothing here can move a coin: no transaction is ever built.
   =========================================================================== */
(function () {
  'use strict';
  var C = window.PROPELLO_CONFIG || {};
  var ZH = document.documentElement.lang === 'zh';

  var T = ZH ? {
    connect: '连接钱包', linking: '连接中…', wallet: '钱包', network: '网络', balance: '余额',
    linked: '已验证', notLinked: '未验证', switchTo: '切换到 ',
    choose: '选择钱包', chooseNote: '检测到多个钱包。要连接哪一个？',
    noWallet: 'No wallet found. Install MetaMask, Rabby or Coinbase Wallet and try again.',
    noWalletTitle: '未找到钱包', install: '安装 MetaMask',
    noWalletNote: '此浏览器没有注入式钱包。装好后回到本页，按钮就会找到它。',
    sign: '签名以验证', signing: '请在钱包中签名…', signed: '地址已验证，仅保存在此浏览器。',
    signMsg: function (a, host) { return 'Propello\n\nLink this address to ' + host + '.\n\n' + a + '\n\nSigning proves the address is yours. It is not a transaction, it costs no gas, and it moves nothing.'; },
    signFail: '未能验证：', copy: '复制地址', copied: '地址已复制。',
    explorer: '在区块浏览器中查看', disconnect: '断开',
    yours: '你的 vPROP', worth: '价值', price: '份额价格', holds: '金库持有',
    readFail: '无法读取金库：',
    noVault: function (ch) { return ch + ' 上尚未部署金库，所以这里只显示你的地址。合约源码在 <code>contracts/</code>；把地址填进 <code>config.js</code>，此面板就会从合约读取你的余额。'; },
    connected: '已连接 ', via: '，通过 ', cancelled: '已取消连接。', couldNot: '无法连接：',
    disconnected: '已断开。钱包自身的授权仍然保留。',
    solana: 'Solana', address: '地址',
    solNote: '份额是 Base 上的 ERC-4626 代币，Solana 钱包无法持有。这个地址用于登录和签名，不用于持有 vPROP。',
    noSolSign: '此钱包不支持消息签名。'
  } : {
    connect: 'Connect wallet', linking: 'Connecting…', wallet: 'Wallet', network: 'Network', balance: 'Balance',
    linked: 'Verified', notLinked: 'Not verified', switchTo: 'switch to ',
    choose: 'Choose a wallet', chooseNote: 'More than one wallet is installed. Which one?',
    noWallet: 'No wallet found. Install MetaMask, Rabby or Coinbase Wallet and try again.',
    noWalletTitle: 'No wallet found', install: 'Install MetaMask',
    noWalletNote: 'This browser has no injected wallet. Install one, come back to this page, and the button will find it.',
    sign: 'Sign to verify', signing: 'Sign the message in your wallet…', signed: 'Address verified. The signature stays in this browser.',
    signMsg: function (a, host) { return 'Propello\n\nLink this address to ' + host + '.\n\n' + a + '\n\nSigning proves the address is yours. It is not a transaction, it costs no gas, and it moves nothing.'; },
    signFail: 'Could not verify: ', copy: 'Copy address', copied: 'Address copied.',
    explorer: 'View on explorer', disconnect: 'Disconnect',
    yours: 'Your vPROP', worth: 'Worth', price: 'Share price', holds: 'Vault holds',
    readFail: 'Could not read the vault: ',
    noVault: function (ch) { return 'No vault is deployed on ' + ch + ' yet, so this is just your address. The contract source is in <code>contracts/</code>; set its address in <code>config.js</code> and this panel reads your balance from it.'; },
    connected: 'Connected ', via: ' via ', cancelled: 'Connection cancelled.', couldNot: 'Could not connect: ',
    disconnected: 'Disconnected. The wallet itself keeps its own permissions.',
    solana: 'Solana', address: 'Address',
    solNote: 'The share is an ERC-4626 token on Base, which a Solana wallet cannot hold. This address signs you in; it does not hold vPROP.',
    noSolSign: 'This wallet cannot sign messages.'
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------------------------------------------------- what we remember -- */
  var KEY = 'propello.wallet.v1';
  function remembered() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function remember(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} }

  /* ---------------------------------------------------- providers -------- */
  var providers = [];
  window.addEventListener('eip6963:announceProvider', function (e) {
    if (!providers.some(function (p) { return p.info.uuid === e.detail.info.uuid; })) providers.push(e.detail);
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  function known() {
    var list = providers.slice();
    if (!list.length && window.ethereum) {
      list.push({ info: { name: window.ethereum.isMetaMask ? 'MetaMask' : 'Injected wallet', rdns: 'injected', uuid: 'injected' }, provider: window.ethereum });
    }
    return list;
  }
  function byRdns(rdns) {
    return all().filter(function (p) { return p.info.rdns === rdns; })[0] || null;
  }

  /* Solana wallets speak their own dialect: no EIP-6963, no chain id, and a
     connect() that can be asked not to prompt. Phantom is the reason this
     rail exists; Solflare and Backpack answer the same calls. */
  function solanaKnown() {
    var out = [], seen = {};
    function add(obj, name, rdns) {
      if (!obj || seen[rdns] || typeof obj.connect !== 'function') return;
      seen[rdns] = 1;
      out.push({ info: { name: name, rdns: rdns, uuid: rdns, chain: 'solana' }, provider: obj });
    }
    var ph = window.phantom && window.phantom.solana;
    add(ph, 'Phantom', 'app.phantom.solana');
    add(window.solflare && window.solflare.isSolflare ? window.solflare : null, 'Solflare', 'com.solflare.solana');
    add(window.backpack && window.backpack.isBackpack ? window.backpack : null, 'Backpack', 'app.backpack.solana');
    if (window.solana && !ph) add(window.solana, window.solana.isPhantom ? 'Phantom' : 'Solana wallet', 'solana.injected');
    return out;
  }
  /* Phantom answers on both rails, so it would otherwise be offered twice.
     The share is an ERC-4626 token on Base, so when a wallet can do both, the
     Ethereum side is the one worth offering; a Solana-only wallet still gets
     its own row. */
  function all() {
    var evm = known();
    var brand = function (p) { return String(p.info.name).toLowerCase().replace(/[^a-z]/g, ''); };
    var seen = {};
    evm.forEach(function (p) { seen[brand(p)] = 1; });
    return evm.concat(solanaKnown().filter(function (p) { return !seen[brand(p)]; }));
  }

  /* ---------------------------------------------------- abi helpers ------ */
  var pad = function (hex) { return hex.replace(/^0x/, '').padStart(64, '0'); };
  var SEL = { balanceOf: '0x70a08231', decimals: '0x313ce567', totalSupply: '0x18160ddd', totalAssets: '0x01e1d114', convertToAssets: '0x07a2d13a' };
  function call(provider, to, data) { return provider.request({ method: 'eth_call', params: [{ to: to, data: data }, 'latest'] }); }
  var big = function (hex) { return BigInt(hex === '0x' || !hex ? '0x0' : hex); };
  function fmtUnits(v, dec, dp) {
    var s = v.toString().padStart(dec + 1, '0');
    var i = s.slice(0, s.length - dec), f = s.slice(s.length - dec, s.length - dec + dp);
    return Number(i).toLocaleString('en-GB') + (dp ? '.' + f.padEnd(dp, '0') : '');
  }

  /* ---------------------------------------------------- state & ui ------- */
  var state = { kind: 'evm', provider: null, info: null, account: null, chainId: null, verified: false, balance: null };
  var panel = $('#walletpanel');
  var picking = false;

  function short(a) { return a.slice(0, 6) + '…' + a.slice(-4); }
  function say(msg) { var t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('is-on'); clearTimeout(say.t); say.t = setTimeout(function () { t.classList.remove('is-on'); }, 3600); }

  function renderButtons(busy) {
    $$('[data-connect]').forEach(function (b) {
      if (b.tagName !== 'BUTTON') return;
      b.textContent = busy ? T.linking : state.account ? short(state.account) : T.connect;
      b.classList.toggle('is-connected', !!state.account);
      b.disabled = !!busy;
    });
  }

  function row(label, value) { return '<div class="rt-wp-row"><span>' + label + '</span><b>' + value + '</b></div>'; }

  function render(extra) {
    if (!panel) return;
    if (picking) return;                       /* the chooser owns the panel */
    if (!state.account) { panel.hidden = true; panel.innerHTML = ''; return; }

    if (state.kind === 'solana') {
      var srows = [
        '<div class="rt-wp-head"><span class="rt-wp-who">' + esc(state.info && state.info.name || T.wallet) + '</span>' +
          '<span class="rt-wp-tag' + (state.verified ? ' is-ok' : '') + '">' + (state.verified ? T.linked : T.notLinked) + '</span></div>',
        row(T.address, '<span class="rt-num">' + short(state.account) + '</span> <button class="rt-wp-copy" type="button" data-copy title="' + T.copy + '">\u29C9</button>'),
        row(T.network, T.solana),
        '<p class="rt-wp-note">' + T.solNote + '</p>'
      ];
      if (!state.verified) srows.push('<button class="rt-btn rt-btn--accent rt-btn--sm rt-wp-sign" type="button" data-sign>' + T.sign + '</button>');
      srows.push('<div class="rt-wp-actions">' +
        '<a class="rt-wp-link" href="https://explorer.solana.com/address/' + encodeURIComponent(state.account) + '" target="_blank" rel="noopener">' + T.explorer + '</a>' +
        '<button class="rt-wp-link" type="button" data-disconnect>' + T.disconnect + '</button></div>');
      panel.innerHTML = srows.join('');
      panel.hidden = false;
      var sg2 = $('[data-sign]', panel); if (sg2) sg2.addEventListener('click', verify);
      var cp2 = $('[data-copy]', panel); if (cp2) cp2.addEventListener('click', copyAddress);
      $('[data-disconnect]', panel).addEventListener('click', disconnect);
      return;
    }

    var onChain = C.chain && state.chainId === C.chain.hex;
    var rows = [
      '<div class="rt-wp-head"><span class="rt-wp-who">' + esc(state.info && state.info.name || T.wallet) + '</span>' +
        '<span class="rt-wp-tag' + (state.verified ? ' is-ok' : '') + '">' + (state.verified ? T.linked : T.notLinked) + '</span></div>',
      row(T.wallet, '<span class="rt-num">' + short(state.account) + '</span> <button class="rt-wp-copy" type="button" data-copy title="' + T.copy + '">⧉</button>'),
      row(T.network, onChain ? esc(C.chain.name)
        : '<span class="rt-num">chain ' + parseInt(state.chainId || '0x0', 16) + '</span> <button class="rt-wp-link" type="button" data-switch>' + T.switchTo + esc(C.chain ? C.chain.name : '') + '</button>')
    ];
    if (state.balance !== null) rows.push(row(T.balance, '<span class="rt-num">' + state.balance + ' ' + esc(C.chain && C.chain.currency ? C.chain.currency.symbol : 'ETH') + '</span>'));

    if (extra && extra.length) rows = rows.concat(extra);
    else if (!C.vault) rows.push('<p class="rt-wp-note">' + T.noVault(C.chain ? esc(C.chain.name) : 'this chain') + '</p>');

    if (!state.verified) rows.push('<button class="rt-btn rt-btn--accent rt-btn--sm rt-wp-sign" type="button" data-sign>' + T.sign + '</button>');

    rows.push('<div class="rt-wp-actions">' +
      (C.chain && C.chain.explorer ? '<a class="rt-wp-link" href="' + C.chain.explorer + '/address/' + state.account + '" target="_blank" rel="noopener">' + T.explorer + '</a>' : '<span></span>') +
      '<button class="rt-wp-link" type="button" data-disconnect>' + T.disconnect + '</button></div>');

    panel.innerHTML = rows.join('');
    panel.hidden = false;
    var sw = $('[data-switch]', panel); if (sw) sw.addEventListener('click', switchChain);
    var sg = $('[data-sign]', panel); if (sg) sg.addEventListener('click', verify);
    var cp = $('[data-copy]', panel); if (cp) cp.addEventListener('click', copyAddress);
    $('[data-disconnect]', panel).addEventListener('click', disconnect);
  }

  function renderPicker(list, after) {
    if (!panel) return;
    picking = true;
    panel.innerHTML = '<div class="rt-wp-head"><span class="rt-wp-who">' + T.choose + '</span></div>' +
      '<p class="rt-wp-note">' + T.chooseNote + '</p>' +
      '<div class="rt-wp-list">' + list.map(function (p, i) {
        return '<button class="rt-wp-pick" type="button" data-pick="' + i + '">' +
          (p.info.icon ? '<img src="' + esc(p.info.icon) + '" alt="" width="22" height="22">' : '<i></i>') +
          '<span>' + esc(p.info.name) + '</span>' +
          '<em>' + (p.info.chain === 'solana' ? T.solana : (C.chain ? esc(C.chain.name) : 'EVM')) + '</em></button>';
      }).join('') + '</div>';
    panel.hidden = false;
    $$('[data-pick]', panel).forEach(function (b) {
      b.addEventListener('click', function () { picking = false; after(list[+b.dataset.pick]); });
    });
  }

  function renderNoWallet() {
    if (!panel) return;
    picking = false;
    panel.innerHTML = '<div class="rt-wp-head"><span class="rt-wp-who">' + T.noWalletTitle + '</span></div>' +
      '<p class="rt-wp-note">' + T.noWalletNote + '</p>' +
      '<div class="rt-wp-actions"><a class="rt-wp-link" href="https://metamask.io/download/" target="_blank" rel="noopener">' + T.install + '</a></div>';
    panel.hidden = false;
  }

  /* ---------------------------------------------------- actions ---------- */
  function switchChain() {
    if (!state.provider || !C.chain) return Promise.resolve();
    return state.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: C.chain.hex }] })
      .catch(function (err) {
        if (err && (err.code === 4902 || /unrecognized|not added/i.test(err.message || ''))) {
          return state.provider.request({ method: 'wallet_addEthereumChain', params: [{
            chainId: C.chain.hex, chainName: C.chain.name, rpcUrls: [C.chain.rpc],
            blockExplorerUrls: [C.chain.explorer], nativeCurrency: C.chain.currency }] });
        }
        throw err;
      });
  }

  function copyAddress() {
    if (!state.account || !navigator.clipboard) return;
    navigator.clipboard.writeText(state.account).then(function () { say(T.copied); }, function () {});
  }

  function readBalance() {
    if (state.kind !== 'evm' || !state.provider || !state.account) return Promise.resolve();
    return state.provider.request({ method: 'eth_getBalance', params: [state.account, 'latest'] })
      .then(function (wei) {
        var v = big(wei), whole = v / (10n ** 18n), frac = (v % (10n ** 18n)).toString().padStart(18, '0').slice(0, 4);
        state.balance = whole.toString() + '.' + frac;
      })
      .catch(function () { state.balance = null; });
  }

  function readVault() {
    if (state.kind !== 'evm' || !C.vault || !state.provider || state.chainId !== C.chain.hex) return Promise.resolve(null);
    var p = state.provider, v = C.vault;
    return Promise.all([
      call(p, v, SEL.decimals), call(p, v, SEL.balanceOf + pad(state.account)),
      call(p, v, SEL.totalSupply), call(p, v, SEL.totalAssets)
    ]).then(function (r) {
      var dec = Number(big(r[0])), one = (10n ** BigInt(dec));
      return call(p, v, SEL.convertToAssets + pad(one.toString(16))).then(function (px) {
        var bal = big(r[1]), price = big(px), supply = big(r[2]), assets = big(r[3]);
        return [
          row(T.yours, '<span class="rt-num">' + fmtUnits(bal, dec, 2) + '</span>'),
          row(T.worth, '<span class="rt-num rt-pos">€' + fmtUnits(bal * price / one, dec, 2) + '</span>'),
          row(T.price, '<span class="rt-num">€' + fmtUnits(price, dec, 4) + '</span>'),
          row(T.holds, '<span class="rt-num">€' + fmtUnits(assets, dec, 0) + ' / ' + fmtUnits(supply, dec, 0) + '</span>')
        ];
      });
    }).catch(function (err) {
      console.warn('Propello: vault read failed', err);
      return ['<p class="rt-wp-note">' + T.readFail + esc(err.message || err) + '</p>'];
    });
  }

  /* a Solana link has no chain id, no gas balance and no ERC-4626 to read */
  function refresh() {
    if (state.kind === 'solana') { render(); return Promise.resolve(); }
    return readBalance().then(readVault).then(render);
  }

  /* one signature, kept here, that says the address is really yours */
  function verify() {
    if (!state.provider || !state.account) return;
    var host = location.host || 'propello.site';
    var msg = T.signMsg(state.account, host);
    var bytes = new TextEncoder().encode(msg);
    say(T.signing);
    var asked;
    if (state.kind === 'solana') {
      if (typeof state.provider.signMessage !== 'function') { say(T.noSolSign); return; }
      asked = Promise.resolve(state.provider.signMessage(bytes, 'utf8')).then(function (r) {
        var sig = r && (r.signature || r);
        return Array.prototype.map.call(sig.slice ? sig.slice(0, 8) : sig, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      });
    } else {
      var hex = '0x' + Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      asked = state.provider.request({ method: 'personal_sign', params: [hex, state.account] });
    }
    asked
      .then(function (sig) {
        state.verified = true;
        var r = remembered();
        r.rdns = state.info && state.info.rdns; r.address = state.account; r.signedAt = Date.now();
        r.sig = String(sig).slice(0, 18) + '…';
        remember(r);
        say(T.signed);
        refresh();
      })
      .catch(function (err) {
        if (err && err.code === 4001) say(T.cancelled); else say(T.signFail + (err.message || err));
      });
  }

  function wire(p) {
    if (!p.provider.on || p.provider.__propello) return;
    p.provider.__propello = true;
    p.provider.on('accountsChanged', function (a) {
      if (!a || !a.length) return disconnect(true);
      state.account = a[0];
      state.verified = remembered().address === a[0];
      renderButtons(); refresh();
    });
    p.provider.on('chainChanged', function (c) { state.chainId = c; refresh(); });
  }

  function attach(p, accounts) {
    state.provider = p.provider; state.info = p.info; state.account = accounts[0];
    var r = remembered();
    state.verified = !!r.signedAt && r.address === accounts[0];
    wire(p);
    return p.provider.request({ method: 'eth_chainId' }).then(function (chainId) {
      state.chainId = chainId;
      renderButtons();
      if (C.chain && chainId !== C.chain.hex) {
        return switchChain()
          .then(function () { return p.provider.request({ method: 'eth_chainId' }); })
          .then(function (c) { state.chainId = c; })
          .catch(function () {});
      }
    }).then(refresh);
  }

  /* Solana: connect() hands back a public key, and asked politely with
     onlyIfTrusted it answers without opening anything. */
  function attachSolana(p, address) {
    state.kind = 'solana'; state.provider = p.provider; state.info = p.info;
    state.account = address; state.chainId = null; state.balance = null;
    var r = remembered();
    state.verified = !!r.signedAt && r.address === address;
    if (p.provider.on && !p.provider.__propello) {
      p.provider.__propello = true;
      p.provider.on('accountChanged', function (pk) {
        if (!pk) return disconnect(true);
        state.account = pk.toString ? pk.toString() : String(pk);
        state.verified = remembered().address === state.account;
        renderButtons(); render();
      });
      p.provider.on('disconnect', function () { disconnect(true); });
    }
    renderButtons(); render();
  }

  function connectSolana(p, quiet) {
    renderButtons(true);
    return Promise.resolve(p.provider.connect(quiet ? { onlyIfTrusted: true } : undefined))
      .then(function (res) {
        var pk = (res && res.publicKey) || p.provider.publicKey;
        if (!pk) throw new Error('no account');
        var address = pk.toString ? pk.toString() : String(pk);
        var r = remembered(); r.rdns = p.info.rdns; r.address = address; remember(r);
        attachSolana(p, address);
        if (!quiet) say(T.connected + short(address) + T.via + p.info.name);
      })
      .catch(function (err) {
        renderButtons();
        if (quiet) return;
        if (err && err.code === 4001) say(T.cancelled); else say(T.couldNot + (err.message || err));
      });
  }

  function connectWith(p) {
    if (p.info.chain === 'solana') return connectSolana(p);
    state.kind = 'evm';
    renderButtons(true);
    return p.provider.request({ method: 'eth_requestAccounts' })
      .then(function (accounts) {
        if (!accounts || !accounts.length) throw new Error('no accounts');
        var r = remembered(); r.rdns = p.info.rdns; remember(r);
        return attach(p, accounts);
      })
      .then(function () {
        say(T.connected + short(state.account) + (p.info.name ? T.via + p.info.name : ''));
      })
      .catch(function (err) {
        renderButtons();
        if (err && err.code === 4001) say(T.cancelled); else say(T.couldNot + (err.message || err));
      });
  }

  function connect() {
    var list = all();
    if (!list.length) { say(T.noWallet); renderNoWallet(); return; }
    if (list.length === 1) return connectWith(list[0]);
    var last = remembered().rdns && byRdns(remembered().rdns);
    if (last) return connectWith(last);
    renderPicker(list, connectWith);
  }

  function disconnect(quiet) {
    if (state.kind === 'solana' && state.provider && typeof state.provider.disconnect === 'function') {
      try { state.provider.disconnect(); } catch (e) {}
    }
    state.kind = 'evm';
    state.provider = null; state.info = null; state.account = null;
    state.chainId = null; state.verified = false; state.balance = null;
    remember(null);
    renderButtons(); render();
    if (!quiet) say(T.disconnected);
  }

  /* --------------------------------------------------- come back linked -- */
  function restore() {
    var r = remembered();
    if (!r.address) return;
    var p = (r.rdns && byRdns(r.rdns)) || all()[0];
    if (!p) return;
    if (p.info.chain === 'solana') {
      connectSolana(p, true).then(function () { if (panel) panel.hidden = true; });
      return;
    }
    /* eth_accounts never prompts: it only answers if the wallet still allows us */
    p.provider.request({ method: 'eth_accounts' }).then(function (accounts) {
      if (!accounts || !accounts.length) return;
      if (r.address && accounts.indexOf(r.address) === -1) return;   /* a different account now */
      attach(p, accounts).then(function () { if (panel) panel.hidden = true; });
    }).catch(function () {});
  }
  /* wallets announce themselves asynchronously, so look twice */
  setTimeout(restore, 120);
  setTimeout(restore, 800);

  window.PROPELLO_WALLET = { connect: connect, disconnect: disconnect, verify: verify, state: state };

  $$('[data-connect]').forEach(function (b) {
    if (b.tagName !== 'BUTTON') return;
    b.addEventListener('click', function () {
      if (state.account) { if (panel) { panel.hidden = !panel.hidden; if (!panel.hidden) render(); } return; }
      if (window.PROPELLO_GATE) window.PROPELLO_GATE.open(connect); else connect();
    });
  });
  document.addEventListener('click', function (e) {
    /* a click inside the panel rebuilds it, which detaches the very node that
       was clicked; without this the panel would close on its own buttons */
    if (!e.target || !document.contains(e.target)) return;
    if (panel && !panel.hidden && !panel.contains(e.target) && !e.target.closest('[data-connect]')) { panel.hidden = true; picking = false; }
  });
})();
