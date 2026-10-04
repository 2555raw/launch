/* UnyHooks — the one place to edit links, the token and the network.
   Shared by index.html, docs.html and app.html; nothing else hard-codes these.

   Leave CONTRACT empty until the token is live: the pages then say
   "Announced at launch" and the copy and explorer buttons stay off.
   Network fields left empty show as "—" in the docs. */

window.UNYHOOKS = {
  APP_URL:  'build.html',     // the builder; swap for the real app's URL if it moves, e.g. 'https://app.unyhooks.xyz'
  SIGNIN_URL: 'app.html',
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
