/* UnyHooks — the one place to edit links, the token and the network.
   Shared by index.html, docs.html and app.html; nothing else hard-codes these.

   Leave CONTRACT empty until the token is live: the pages then say
   "Announced at launch" and the copy and explorer buttons stay off.
   Network fields left empty show as "—" in the docs. */

window.UNYHOOKS = {
  APP_URL:  'app.html',       // swap for the real app once it is up, e.g. 'https://app.unyhooks.xyz'
  DOCS_URL: 'docs.html',
  SITE_URL: 'index.html',
  X_HANDLE: 'UnyHooks',       // without the @

  CONTRACT: '',               // the $UHOOKS address on Robinhood Chain

  NETWORK: {
    name:        'Robinhood Chain',
    chainId:     '',          // decimal, e.g. '12345'
    rpcUrl:      '',
    explorerUrl: '',          // e.g. 'https://explorer.example.com' (no trailing slash)
    poolManager: ''           // Uniswap V4 PoolManager address on the chain
  }
};
