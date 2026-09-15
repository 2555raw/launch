/* What each paid tier costs, in USDC. The wallet charges it and the money-in
   page names an incoming amount after it, so the two must agree; keeping the
   numbers here is what makes that true by construction rather than by luck. */
window.WARD_PLAN_PRICES = { gold: 19.99, platinum: 49.99 };

/* The networks Ward speaks to, kept in their own file because two pages read
   them: the wallet, and the page that watches what has been paid in. One copy
   means an RPC or a token address can never be right on one and stale on the
   other. */
window.WARD_CHAINS = {
  8453: {
    name: 'Base', short: 'Base', coin: 'ETH', color: '#2151F5',
    rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org',
    blurb: 'Fast, with fees in cents',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', color: '#26A17B' }
    ]
  },
  137: {
    name: 'Polygon', short: 'Polygon', coin: 'POL', color: '#8247E5',
    rpc: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com',
    blurb: 'Tiny fees, widely used for getting paid',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', color: '#26A17B' }
    ]
  },
  42161: {
    name: 'Arbitrum One', short: 'Arbitrum', coin: 'ETH', color: '#12AAFF',
    rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io',
    blurb: 'Cheap, and deep on liquidity',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', color: '#26A17B' }
    ]
  },
  10: {
    name: 'Optimism', short: 'Optimism', coin: 'ETH', color: '#FF0420',
    rpc: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io',
    blurb: 'Quick, low fees',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', color: '#26A17B' }
    ]
  },
  1: {
    name: 'Ethereum', short: 'Ethereum', coin: 'ETH', color: '#627EEA',
    rpc: 'https://ethereum-rpc.publicnode.com', explorer: 'https://etherscan.io',
    blurb: 'The main one, and the priciest to use',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', color: '#2775CA' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', color: '#26A17B' }
    ]
  }
};
