/* Where the contracts are, once they are anywhere.

   Every address the site shows comes from this file and from nowhere else.
   While `chainId` is null the site says, everywhere, that nothing is
   deployed — it does not invent an address to fill the space. The day a
   deployment happens, two fields change here and every address on every page
   becomes real and links into Blockscout.

   That is the whole point of the indirection: "verifiable" is not a label you
   can apply to a string, it is a property of a contract that exists. Until
   one does, the honest cell is empty.

   Robinhood Chain is an Arbitrum Orbit L2 settling to Ethereum, gas paid in
   ETH. Both networks below are the real ones.
*/

/* Named for its file, not for the concept: wallet.js already has a CHAINS of
   its own — the networks a visitor's wallet might be on — and two top-level
   consts of the same name is a SyntaxError that silently takes this whole
   file out of the page. */
const DEPLOY_CHAINS = {
  4663: {
    name: 'Robinhood Chain',
    short: 'mainnet',
    explorer: 'https://robinhoodchain.blockscout.com',
    rpc: 'https://rpc.mainnet.chain.robinhood.com',
  },
  46630: {
    name: 'Robinhood Chain Testnet',
    short: 'testnet',
    explorer: 'https://explorer.testnet.chain.robinhood.com',
  },
};

const DEPLOYMENT = {
  // 4663 for mainnet, 46630 for the testnet, null while nothing is deployed
  chainId: null,

  // 'NVDA': '0x…', 'factory': '0x…'. Anything missing reads as not deployed.
  contracts: {},
};

/* ---------- reading it ---------- */

const chainOf = () => (DEPLOYMENT.chainId && DEPLOY_CHAINS[DEPLOYMENT.chainId]) || null;

/** An address is only usable if it is a real one: 20 bytes, hex, not zero. */
function addressOf(key) {
  const a = DEPLOYMENT.contracts[key];
  if (typeof a !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(a)) return null;
  if (/^0x0+$/.test(a)) return null;
  return a;
}

const isDeployed = key => !!chainOf() && !!addressOf(key);

/** The Blockscout page for a contract, or null when there is nothing to open. */
function explorerUrl(key) {
  const c = chainOf(), a = addressOf(key);
  return c && a ? `${c.explorer}/address/${a}` : null;
}

/** Shortened for a table: 0x1234…abcd. */
const shortAddress = a => a.slice(0, 6) + '…' + a.slice(-4);

/* The cell the site draws for a contract, in one place so no page can decide
   to be more optimistic than the data. */
function addressCell(key, { short = false } = {}) {
  const a = addressOf(key), url = explorerUrl(key), c = chainOf();
  if (!a || !url) {
    return '<code class="ct-none">not deployed</code>';
  }
  return `<a class="ct-addr" href="${url}" rel="noopener" target="_blank"` +
         ` title="Open on ${c.name} Blockscout">${short ? shortAddress(a) : a}` +
         `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"` +
         ` stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
         `<path d="M8 16L16 8M9 8h7v7"/></svg></a>`;
}

/** The one-line status the pages print above a table of addresses. */
function deploymentNote() {
  const c = chainOf();
  if (!c) {
    return 'Nothing is deployed yet, on any network, so there is no address to check. ' +
           'When there is, every row here becomes a link into Blockscout.';
  }
  return `Deployed on ${c.name} (chain ${DEPLOYMENT.chainId}). ` +
         `Each row opens the contract on Blockscout, where its source can be matched against this repository.`;
}
