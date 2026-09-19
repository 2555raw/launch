/* Talking to the wallet.

   Three things happen here and nothing else: find a Solana wallet in the page,
   ask it who it is, and ask it to sign one sentence. No transaction is ever
   built, so there is nothing here that can spend anything - the worst a bug in
   this file can do is fail to sign in.

   The signature comes back as raw bytes and the server wants base58, which is
   forty lines of arithmetic rather than a library. */

(function () {
  'use strict';

  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  function b58encode(bytes) {
    const digits = [0];
    for (const byte of bytes) {
      let carry = byte;
      for (let i = 0; i < digits.length; i++) {
        carry += digits[i] << 8;
        digits[i] = carry % 58;
        carry = (carry / 58) | 0;
      }
      while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
    }
    let out = '';
    for (let k = 0; k < bytes.length && bytes[k] === 0; k++) out += '1';
    for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
    return out;
  }

  /* Wallets all inject themselves differently; these are the ones people
     actually use, in the order they are usually preferred. */
  function find() {
    const w = window;
    if (w.phantom && w.phantom.solana) return { name: 'Phantom', p: w.phantom.solana };
    if (w.solflare && w.solflare.isSolflare) return { name: 'Solflare', p: w.solflare };
    if (w.backpack && w.backpack.solana) return { name: 'Backpack', p: w.backpack.solana };
    if (w.magicEden && w.magicEden.solana) return { name: 'Magic Eden', p: w.magicEden.solana };
    if (w.solana) return { name: w.solana.isPhantom ? 'Phantom' : 'Wallet', p: w.solana };
    return null;
  }

  async function connect() {
    const found = find();
    if (!found) {
      const err = new Error('no wallet');
      err.code = 'NO_WALLET';
      throw err;
    }
    const res = await found.p.connect();
    const key = (res && res.publicKey) || found.p.publicKey;
    if (!key) throw new Error('no public key');
    return { address: key.toString(), name: found.name, provider: found.p };
  }

  async function signMessage(provider, message) {
    const bytes = new TextEncoder().encode(message);
    const res = await provider.signMessage(bytes, 'utf8');
    const sig = res && (res.signature || res);
    return b58encode(sig instanceof Uint8Array ? sig : new Uint8Array(sig));
  }

  /* On a phone the extension does not exist, so the way in is to reopen the page
     inside the wallet's own browser. */
  function deepLink() {
    const url = location.href.split('#')[0];
    return 'https://phantom.app/ul/browse/' + encodeURIComponent(url) + '?ref=' + encodeURIComponent(location.origin);
  }

  const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  window.WALLET = { find, connect, signMessage, b58encode, deepLink, isMobile };
})();
