// Nebari — site configuration. Everything the pages need to talk to the chain lives here.
//
// After deploying the contracts (see contracts/README.md) paste the factory and router
// addresses below. Until then the site runs in read-only mode and says so.
window.NEBARI_CONFIG = {
  brand: 'Neberi',

  network: {
    chainId: 4663,
    chainIdHex: '0x1237',
    name: 'Robinhood Chain',
    rpc: 'https://rpc.mainnet.chain.robinhood.com',
    explorer: 'https://robinhoodchain.blockscout.com',
    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },

  // Uniswap v4 PoolManager on Robinhood Chain mainnet. Verify against
  // https://developers.uniswap.org/docs/protocols/v4/deployments before deploying.
  poolManager: '0x8366a39cc670b4001a1121b8f6a443a643e40951',

  // Nebari contracts. Empty until deployed.
  factory: '0x508faebe7E2C038CF6300C091af6f8F7180D946e',
  router: '0x0937711378f2c74be71948ab243b127B1feF36Ca',
  deployBlock: 75668270,

  // Protocol share of every swap fee (basis points). Holders always get 5000; creator gets the rest.
  protocolBps: 1000,

  // Quick picks: assets you can pair against with one click. Their logos ship in assets/logos/
  // (<symbol>.png). Every address is checked
  // on-chain when the page loads (symbol must match) and hidden if it does not.
  // Addresses come from Robinhood's contract list; verify at docs.robinhood.com/chain/contracts.
  quickPicks: [
    { symbol: 'ETH',   name: 'Ether',                   address: '0x0000000000000000000000000000000000000000', decimals: 18, kind: 'crypto', domain: 'ethereum.org' },
    { symbol: 'USDG',  name: 'Global Dollar',           address: '0x5fc5360d0400a0fd4f2af552add042d716f1d168', decimals: 6,  kind: 'stable', domain: 'globaldollar.com' },
    { symbol: 'TSLA',  name: 'Tesla',                   address: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d', decimals: 18, kind: 'stock',  domain: 'tesla.com' },
    { symbol: 'NVDA',  name: 'NVIDIA',                  address: '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec', decimals: 18, kind: 'stock',  domain: 'nvidia.com' },
    { symbol: 'AAPL',  name: 'Apple',                   address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', decimals: 18, kind: 'stock',  domain: 'apple.com', logoBg: '#0b0b0f' },
    { symbol: 'MSFT',  name: 'Microsoft',               address: '0xe93237C50D904957Cf27E7B1133b510C669c2e74', decimals: 18, kind: 'stock',  domain: 'microsoft.com' },
    { symbol: 'AMZN',  name: 'Amazon',                  address: '0x12f190a9F9d7D37a250758b26824B97CE941bF54', decimals: 18, kind: 'stock',  domain: 'amazon.com', logoBg: '#0b0b0f' },
    { symbol: 'GOOGL', name: 'Alphabet',                address: '0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3', decimals: 18, kind: 'stock',  domain: 'abc.xyz' },
    { symbol: 'META',  name: 'Meta Platforms',          address: '0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35', decimals: 18, kind: 'stock',  domain: 'meta.com' },
    { symbol: 'SPY',   name: 'SPDR S&P 500 ETF',        address: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C', decimals: 18, kind: 'etf',    domain: 'ssga.com' },
  ],

  // Cookie notice: Accept remembers the choice; Decline leaves for this address.
  cookies: { declineRedirect: 'https://www.ponsfamily.com/launchpad' },

  links: {
    x: 'https://x.com/useNeberi',
    docsRobinhood: 'https://docs.robinhood.com/chain/',
    uniswapDeployments: 'https://developers.uniswap.org/docs/protocols/v4/deployments',
    robinhoodContracts: 'https://docs.robinhood.com/chain/contracts',
  },
};
