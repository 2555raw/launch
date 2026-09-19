/* Talking to the wallet.

   Three things happen here and nothing else: find an Ethereum wallet in the
   page, ask it which account to use, and ask it to sign one sentence with
   personal_sign. No transaction is ever built, so nothing in this file can
   spend anything - the worst a bug here can do is fail to sign in. */

(function () {
  'use strict';

  /* MetaMask, Rabby, Coinbase Wallet, Trust and the rest all inject
     window.ethereum; when several do, EIP-6963 lists them and the first one
     that answers is used. */
  function find() {
    const w = window;
    if (w.ethereum) {
      const list = Array.isArray(w.ethereum.providers) ? w.ethereum.providers : [w.ethereum];
      const p = list.find((x) => x && x.request) || w.ethereum;
      return { name: p.isMetaMask ? 'MetaMask' : (p.isRabby ? 'Rabby' : (p.isCoinbaseWallet ? 'Coinbase Wallet' : 'Wallet')), p };
    }
    return null;
  }

  async function connect() {
    const found = find();
    if (!found) {
      const err = new Error('no wallet');
      err.code = 'NO_WALLET';
      throw err;
    }
    const accounts = await found.p.request({ method: 'eth_requestAccounts' });
    if (!accounts || !accounts[0]) throw new Error('no account');
    return { address: accounts[0], name: found.name, provider: found.p };
  }

  /* personal_sign wants the message as hex; the signature comes back as hex
     and goes to the server as it is. */
  async function signMessage(provider, message, address) {
    const bytes = new TextEncoder().encode(message);
    let hex = '0x';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return provider.request({ method: 'personal_sign', params: [hex, address] });
  }

  /* On a phone the extension does not exist, so the way in is to reopen the page
     inside the wallet's own browser. */
  function deepLink() {
    const here = location.host + location.pathname + location.search;
    return 'https://metamask.app.link/dapp/' + here;
  }

  const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  window.WALLET = { find, connect, signMessage, deepLink, isMobile };
})();
