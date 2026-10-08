/* UnyHooks — the one place to edit links, the token and the network.
   Shared by every page; nothing else hard-codes these.

   Leave CONTRACT empty until the token is live: the pages then say
   "Announced at launch", the copy and explorer buttons stay off and the live
   market panel stays hidden. */

window.UNYHOOKS = {
  APP_URL:  'build.html',     // the builder; swap for the real app's URL if it moves
  SIGNIN_URL: 'app.html',
  DOCS_URL: 'docs.html',
  SITE_URL: 'index.html',
  X_HANDLE: 'UnyHooks',       // without the @
  // The site's and the contracts' source: the branch the live site is deployed from.
  SOURCE_URL: 'https://github.com/2555raw/launch/tree/claude/practical-thompson-2y8mnc/unyhooks-site',

  CONTRACT: '',               // the $UHOOKS address on Robinhood Chain
  BUY_URL:  '',               // where "Buy $UHOOKS" goes; empty uses the DexScreener pair page

  // The AI side of the builder chat. Empty: the page asks the server it was
  // loaded from (/api/chat, see server.js) and falls back to the built-in
  // reader if there is none. Set to false to never ask.
  AI_URL: '',

  // Robinhood Chain mainnet. Sources: Uniswap's v4 deployments page
  // (developers.uniswap.org/docs/protocols/v4/deployments) and
  // docs.robinhood.com/chain/contracts, each checked against the chain itself.
  NETWORK: {
    name:        'Robinhood Chain',
    chainId:     '4663',
    rpcUrl:      'https://rpc.mainnet.chain.robinhood.com',
    explorerUrl: 'https://robinhoodchain.blockscout.com',
    poolManager: '0x8366a39cc670b4001a1121b8f6a443a643e40951',
    stateView:   '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b',
    positionManager: '0x58daec3116aae6d93017baaea7749052e8a04fa7',   // Uniswap V4 positions (adding liquidity)
    permit2:     '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    universalRouter: '0x8876789976decbfcbbbe364623c63652db8c0904',   // swaps from the token pages
    quoter:      '0x8dc178efb8111bb0973dd9d722ebeff267c98f94',   // prices a swap before it is sent
    // The standard CREATE2 deployer (Arachnid's deterministic deployment
    // proxy). Hooks go through it so they can land on an address whose low
    // bits match their permissions.
    create2Deployer: '0x4e59b44847b379578588920cA78FbF26c0B4956C',
    dexscreenerChain: 'robinhood',
    uniswapChain: 'robinhood',      // the app's ?chain= value, read from app.uniswap.org's own chain list
    geckoterminalNetwork: 'robinhood'
  },

  // Quick picks when creating a pool. ETH is native (the zero address in a pool key).
  TOKENS: [
    { symbol: 'ETH',  address: '0x0000000000000000000000000000000000000000', decimals: 18 },
    { symbol: 'USDG', address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', decimals: 6 },
    { symbol: 'WETH', address: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73', decimals: 18 }
  ]
};
