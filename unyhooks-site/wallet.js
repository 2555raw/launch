/* UnyHooks — browser wallets, for the builder.

   Finds wallets through EIP-6963 announcements, with window.ethereum and
   window.phantom.ethereum as fallbacks, connects one, and moves it to
   Robinhood Chain (adding the network if the wallet does not know it).
   Exposes window.UnyWallet. */

(() => {
  'use strict';

  const NET = (window.UNYHOOKS || {}).NETWORK || {};

  const announced = new Map();   // rdns -> { name, icon, provider }
  window.addEventListener('eip6963:announceProvider', (e) => {
    const { info, provider } = e.detail || {};
    if (info && info.rdns && provider) announced.set(info.rdns, { name: info.name, icon: info.icon, provider });
  });
  const ask = () => window.dispatchEvent(new Event('eip6963:requestProvider'));
  ask();

  // Every wallet we can offer, most specific first, without duplicates.
  const list = () => {
    ask();
    const out = [...announced.entries()].map(([rdns, w]) => ({ id: rdns, ...w }));
    const seen = new Set(out.map((w) => w.provider));
    const add = (id, name, provider) => {
      if (provider && !seen.has(provider)) { seen.add(provider); out.push({ id, name, icon: '', provider }); }
    };
    add('app.phantom', 'Phantom', window.phantom && window.phantom.ethereum);
    const eth = window.ethereum;
    if (eth) {
      const many = Array.isArray(eth.providers) ? eth.providers : [eth];
      many.forEach((p, i) => add(`injected-${i}`, p.isMetaMask && !p.isPhantom ? 'MetaMask' : p.isPhantom ? 'Phantom' : 'Browser wallet', p));
    }
    return out;
  };

  const hexChain = () => '0x' + Number(NET.chainId).toString(16);

  // Asks the wallet to use Robinhood Chain; adds the network when it is unknown.
  const ensureChain = async (provider) => {
    const current = await provider.request({ method: 'eth_chainId' });
    if (parseInt(current, 16) === Number(NET.chainId)) return true;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChain() }] });
    } catch (err) {
      if (err && (err.code === 4902 || /unrecognized|not added|unknown chain/i.test(err.message || ''))) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hexChain(),
            chainName: NET.name,
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [NET.rpcUrl],
            blockExplorerUrls: [NET.explorerUrl]
          }]
        });
      } else {
        throw err;
      }
    }
    const after = await provider.request({ method: 'eth_chainId' });
    return parseInt(after, 16) === Number(NET.chainId);
  };

  const connect = async (provider) => {
    const [address] = await provider.request({ method: 'eth_requestAccounts' });
    if (!address) throw new Error('The wallet did not share an account.');
    return address;
  };

  const isRejection = (err) => !!err && (err.code === 4001 || err.code === 'ACTION_REJECTED' ||
    (err.info && err.info.error && err.info.error.code === 4001) || /user rejected|user denied|rejected the request|cancel/i.test(err.message || ''));

  window.UnyWallet = { list, connect, ensureChain, isRejection };
})();
