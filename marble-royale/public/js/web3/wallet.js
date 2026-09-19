/* Wallets.

   Finds every EVM wallet in the page (MetaMask, Phantom's Ethereum side, and
   anything announcing itself through EIP-6963), connects to the one the
   person picks, reports the network, signs the sign-in sentence with
   personal_sign, and disconnects. There is also a demo wallet, which is a
   local identity the server hands out when it runs in demo mode: it lets the
   whole game be tried with nothing installed, and everything it touches is
   labelled demo, because it never reaches a chain.

   Nothing here builds a transaction, and nothing here ever sees a key. */

(function () {
  'use strict';

  const CHAINS = {
    1: 'Ethereum', 11155111: 'Sepolia', 8453: 'Base', 84532: 'Base Sepolia',
    42161: 'Arbitrum One', 421614: 'Arbitrum Sepolia', 10: 'Optimism', 137: 'Polygon',
    56: 'BNB Chain', 43114: 'Avalanche', 46630: 'Robinhood Chain testnet'
  };
  const chainName = (id) => CHAINS[id] || (id ? 'chain ' + id : '');

  /* EIP-6963: wallets announce themselves on the window; we keep every one. */
  const announced = new Map();
  window.addEventListener('eip6963:announceProvider', (e) => {
    const d = e.detail;
    if (d && d.info && d.provider) announced.set(d.info.uuid, d);
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  /** Every wallet the page can see, deduplicated, with an id, a label and an icon. */
  function list() {
    const out = [];
    const seen = new Set();
    for (const d of announced.values()) {
      if (seen.has(d.provider)) continue;
      seen.add(d.provider);
      out.push({ id: 'eip6963:' + d.info.uuid, label: d.info.name, icon: d.info.icon, provider: d.provider,
                 kind: /metamask/i.test(d.info.name) ? 'metamask' : (/phantom/i.test(d.info.name) ? 'phantom' : 'injected') });
    }
    const w = window;
    if (w.phantom && w.phantom.ethereum && !seen.has(w.phantom.ethereum)) {
      seen.add(w.phantom.ethereum);
      out.push({ id: 'phantom', label: 'Phantom', icon: '', provider: w.phantom.ethereum, kind: 'phantom' });
    }
    if (w.ethereum) {
      const ps = Array.isArray(w.ethereum.providers) ? w.ethereum.providers : [w.ethereum];
      for (const p of ps) {
        if (!p || !p.request || seen.has(p)) continue;
        seen.add(p);
        const label = p.isMetaMask ? 'MetaMask' : (p.isPhantom ? 'Phantom' : (p.isRabby ? 'Rabby' : (p.isCoinbaseWallet ? 'Coinbase Wallet' : 'Browser wallet')));
        out.push({ id: 'injected:' + label, label, icon: '', provider: p,
                   kind: p.isMetaMask ? 'metamask' : (p.isPhantom ? 'phantom' : 'injected') });
      }
    }
    /* MetaMask first, then Phantom, then the rest as found */
    const rank = { metamask: 0, phantom: 1, injected: 2 };
    out.sort((a, b) => rank[a.kind] - rank[b.kind]);
    return out;
  }

  let current = null;   // { entry, provider }
  const listeners = new Set();
  const emit = (ev) => { for (const fn of listeners) fn(ev); };

  async function connect(entry) {
    const accounts = await entry.provider.request({ method: 'eth_requestAccounts' });
    if (!accounts || !accounts[0]) throw new Error('no account');
    let chainId = null;
    try { chainId = parseInt(await entry.provider.request({ method: 'eth_chainId' }), 16); } catch {}
    current = { entry, provider: entry.provider };
    if (entry.provider.on) {
      entry.provider.on('accountsChanged', (accs) => emit({ type: 'accounts', accounts: accs }));
      entry.provider.on('chainChanged', (id) => emit({ type: 'chain', chainId: parseInt(id, 16) }));
      entry.provider.on('disconnect', () => emit({ type: 'disconnect' }));
    }
    return { address: accounts[0], chainId, network: chainName(chainId), kind: entry.kind, label: entry.label };
  }

  /* personal_sign wants the message as hex; the signature comes back as hex. */
  async function signMessage(message, address) {
    if (!current) throw new Error('no wallet');
    const bytes = new TextEncoder().encode(message);
    let hex = '0x';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return current.provider.request({ method: 'personal_sign', params: [hex, address] });
  }

  async function disconnect() {
    /* Injected wallets keep their own connection; forgetting it here is what
       disconnecting means on this side, and the session token goes with it. */
    if (current && current.provider.request) {
      try { await current.provider.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch {}
    }
    current = null;
  }

  /* On a phone the extension does not exist; the page reopens inside the
     wallet's own browser. */
  function deepLink(kind) {
    const here = location.host + location.pathname + location.search;
    if (kind === 'phantom') return 'https://phantom.app/ul/browse/' + encodeURIComponent(location.href) + '?ref=' + encodeURIComponent(location.origin);
    return 'https://metamask.app.link/dapp/' + here;
  }
  const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  const short = (a) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '');

  window.WALLET = {
    list, connect, signMessage, disconnect, deepLink, isMobile, chainName, short,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    get provider() { return current ? current.provider : null; }
  };
})();
