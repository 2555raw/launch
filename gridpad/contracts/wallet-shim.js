/* An EIP-1193 wallet, injected into the page, that signs against the local
 * node. Shared by the end-to-end suites so they exercise the same wallet the
 * pages will meet in a browser rather than two slightly different ones.
 */
const WALLET_SHIM = chainHex => `
window.__rpc = async (method, params = []) => {
  const r = await fetch('http://127.0.0.1:8545', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const j = await r.json();
  if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
  return j.result;
};
window.__switches = [];
window.__added = [];
window.ethereum = {
  isMetaMask: true,
  _acct: null,
  /* Kept in sessionStorage so it survives the navigations the run makes: the
   * shim is re-injected on every page load. */
  get _chain() { try { return sessionStorage.getItem('__chain') || '${chainHex}'; } catch (e) { return '${chainHex}'; } },
  set _chain(v) { try { sessionStorage.setItem('__chain', v); } catch (e) {} },
  on() {}, removeListener() {},
  async request({ method, params = [] }) {
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
      if (method === 'eth_accounts' && !this._acct) return [];
      const accts = await window.__rpc('eth_accounts');
      this._acct = accts[0];
      return [this._acct];
    }
    if (method === 'eth_chainId') return this._chain;
    /* A wallet that has never seen the chain answers 4902, which is what sends
     * the page down the add-then-switch path. This one has only ever seen the
     * chain the node is on. */
    if (method === 'wallet_switchEthereumChain') {
      const want = params[0].chainId;
      window.__switches.push(want);
      if (want !== this._chain && !window.__added.includes(want)) {
        const e = new Error('Unrecognized chain ID'); e.code = 4902; throw e;
      }
      return null;
    }
    if (method === 'wallet_addEthereumChain') {
      window.__added.push(params[0].chainId);
      window.__addedParams = params[0];
      return null;
    }
    if (method === 'eth_sendTransaction') {
      return window.__rpc('eth_sendTransaction', params);
    }
    return window.__rpc(method, params);
  },
};
`;

module.exports = { WALLET_SHIM };
