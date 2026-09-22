/* ===========================================================================
   RENTA — wallet connection. No library: EIP-6963 discovery, EIP-1193
   requests, ABI calls hand-encoded. Reads config.js.

   What it does:
     · finds injected wallets (MetaMask, Rabby, Coinbase, …) via EIP-6963,
       falling back to window.ethereum;
     · connects, and moves the wallet to the vault's chain (adding it if the
       wallet does not know it);
     · with a vault address configured, reads your vRENTA balance, the share
       price and what the vault holds, straight from the contract;
     · without one, says plainly that nothing is deployed on that chain.
   =========================================================================== */
(function () {
  'use strict';
  var C = window.RENTA_CONFIG || {};
  var T = { connect: 'Connect wallet', wallet: 'Wallet', network: 'Network', switchTo: 'switch to ', noVault: function (ch) { return 'No vault is deployed on ' + ch + ' yet. The contract source is in <code>contracts/</code>; set its address in <code>config.js</code> and this panel reads your balance from it.'; }, explorer: 'View on explorer', disconnect: 'Disconnect', yours: 'Your vRENTA', worth: 'Worth', price: 'Share price', holds: 'Vault holds', readFail: 'Could not read the vault: ', noWallet: 'No wallet found. Install MetaMask, Rabby or Coinbase Wallet and try again.', connected: 'Connected ', via: ' via ', cancelled: 'Connection cancelled.', couldNot: 'Could not connect: ', disconnected: 'Disconnected. The wallet itself keeps its own permissions.' };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------------------------------------------- providers -------- */
  var providers = [];
  window.addEventListener('eip6963:announceProvider', function (e) {
    if (!providers.some(function (p) { return p.info.uuid === e.detail.info.uuid; })) providers.push(e.detail);
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  function pickProvider() {
    if (providers.length) return providers[0];
    if (window.ethereum) return { info: { name: 'Injected wallet', rdns: 'injected' }, provider: window.ethereum };
    return null;
  }

  /* ---------------------------------------------------- abi helpers ------ */
  var pad = function (hex) { return hex.replace(/^0x/, '').padStart(64, '0'); };
  var SEL = { balanceOf: '0x70a08231', decimals: '0x313ce567', totalSupply: '0x18160ddd', totalAssets: '0x01e1d114', convertToAssets: '0x07a2d13a' };
  function call(provider, to, data) {
    return provider.request({ method: 'eth_call', params: [{ to: to, data: data }, 'latest'] });
  }
  var big = function (hex) { return BigInt(hex === '0x' ? '0x0' : hex); };
  function fmtUnits(v, dec, dp) {
    var s = v.toString().padStart(dec + 1, '0');
    var i = s.slice(0, s.length - dec), f = s.slice(s.length - dec, s.length - dec + dp);
    return Number(i).toLocaleString('en-GB') + (dp ? '.' + f.padEnd(dp, '0') : '');
  }

  /* ---------------------------------------------------- state & ui ------- */
  var state = { provider: null, account: null, chainId: null };
  var panel = $('#walletpanel');

  function short(a) { return a.slice(0, 6) + '…' + a.slice(-4); }
  function say(msg) { var t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('is-on'); clearTimeout(say.t); say.t = setTimeout(function () { t.classList.remove('is-on'); }, 3600); }

  function renderButtons() {
    $$('[data-connect]').forEach(function (b) {
      if (b.tagName !== 'BUTTON') return;
      b.textContent = state.account ? short(state.account) : T.connect;
      b.classList.toggle('is-connected', !!state.account);
    });
  }

  function renderPanel(extra) {
    if (!panel) return;
    if (!state.account) { panel.hidden = true; return; }
    var onChain = C.chain && state.chainId === C.chain.hex;
    var rows = [
      '<div class="rt-wp-row"><span>' + T.wallet + '</span><b class="rt-num">' + short(state.account) + '</b></div>',
      '<div class="rt-wp-row"><span>' + T.network + '</span><b>' + (onChain ? C.chain.name : 'chain ' + parseInt(state.chainId || '0x0', 16)) + (onChain ? '' : ' <button class="rt-wp-link" type="button" data-switch>' + T.switchTo + C.chain.name + '</button>') + '</b></div>'
    ];
    if (extra) rows = rows.concat(extra);
    else if (!C.vault) rows.push('<p class="rt-wp-note">' + T.noVault(C.chain ? C.chain.name : 'this chain') + '</p>');
    rows.push('<div class="rt-wp-actions">' +
      (C.chain && C.chain.explorer ? '<a class="rt-wp-link" href="' + C.chain.explorer + '/address/' + state.account + '" target="_blank" rel="noopener">' + T.explorer + '</a>' : '') +
      '<button class="rt-wp-link" type="button" data-disconnect>' + T.disconnect + '</button></div>');
    panel.innerHTML = rows.join('');
    panel.hidden = false;
    var sw = $('[data-switch]', panel); if (sw) sw.addEventListener('click', switchChain);
    $('[data-disconnect]', panel).addEventListener('click', disconnect);
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

  function readVault() {
    if (!C.vault || !state.provider || state.chainId !== C.chain.hex) return Promise.resolve(null);
    var p = state.provider, v = C.vault;
    return Promise.all([
      call(p, v, SEL.decimals), call(p, v, SEL.balanceOf + pad(state.account)),
      call(p, v, SEL.totalSupply), call(p, v, SEL.totalAssets)
    ]).then(function (r) {
      var dec = Number(big(r[0]));
      var one = (10n ** BigInt(dec));
      return call(p, v, SEL.convertToAssets + pad(one.toString(16))).then(function (px) {
        var bal = big(r[1]), price = big(px), supply = big(r[2]), assets = big(r[3]);
        var worth = bal * price / one;
        return [
          '<div class="rt-wp-row"><span>' + T.yours + '</span><b class="rt-num">' + fmtUnits(bal, dec, 2) + '</b></div>',
          '<div class="rt-wp-row"><span>' + T.worth + '</span><b class="rt-num rt-pos">€' + fmtUnits(worth, dec, 2) + '</b></div>',
          '<div class="rt-wp-row"><span>' + T.price + '</span><b class="rt-num">€' + fmtUnits(price, dec, 4) + '</b></div>',
          '<div class="rt-wp-row"><span>' + T.holds + '</span><b class="rt-num">€' + fmtUnits(assets, dec, 0) + ' / ' + fmtUnits(supply, dec, 0) + ' shares</b></div>'
        ];
      });
    }).catch(function (err) { console.warn('RENTA: vault read failed', err); return ['<p class="rt-wp-note">' + T.readFail + (err.message || err) + '</p>']; });
  }

  function connect() {
    var p = pickProvider();
    if (!p) { say(T.noWallet); return; }
    state.provider = p.provider;
    p.provider.request({ method: 'eth_requestAccounts' }).then(function (accounts) {
      state.account = accounts[0];
      return p.provider.request({ method: 'eth_chainId' });
    }).then(function (chainId) {
      state.chainId = chainId;
      renderButtons();
      if (C.chain && chainId !== C.chain.hex) return switchChain().then(function () { return p.provider.request({ method: 'eth_chainId' }); }).then(function (c) { state.chainId = c; }).catch(function () {});
    }).then(function () {
      return readVault();
    }).then(function (extra) {
      renderPanel(extra);
      say(T.connected + short(state.account) + (p.info.name ? T.via + p.info.name : ''));
      p.provider.on && p.provider.on('accountsChanged', function (a) { if (!a.length) return disconnect(); state.account = a[0]; renderButtons(); readVault().then(renderPanel); });
      p.provider.on && p.provider.on('chainChanged', function (c) { state.chainId = c; readVault().then(renderPanel); });
    }).catch(function (err) {
      if (err && err.code === 4001) say(T.cancelled); else say(T.couldNot + (err.message || err));
    });
  }

  function disconnect() {
    state.account = null; state.chainId = null;
    renderButtons(); renderPanel();
    say(T.disconnected);
  }

  /* the eligibility gate (gate.js) decides whether connect() may run */
  window.RENTA_WALLET = { connect: connect, disconnect: disconnect, state: state };
  $$('[data-connect]').forEach(function (b) {
    if (b.tagName !== 'BUTTON') return;
    b.addEventListener('click', function () {
      if (state.account) { if (panel) panel.hidden = !panel.hidden; return; }
      if (window.RENTA_GATE) window.RENTA_GATE.open(connect); else connect();
    });
  });
  document.addEventListener('click', function (e) {
    if (panel && !panel.hidden && !panel.contains(e.target) && !e.target.closest('[data-connect]')) panel.hidden = true;
  });
})();
