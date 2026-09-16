/* What each paid tier costs, in USDC. The wallet charges it and the money-in
   page names an incoming amount after it, so the two must agree; keeping the
   numbers here is what makes that true by construction rather than by luck. */
window.WARD_PLAN_PRICES = { gold: 19.99, platinum: 49.99 };

/* The networks Ward speaks to, kept in their own file because two pages read
   them: the wallet, and the page that watches what has been paid in. One copy
   means an RPC or a token address can never be right on one and stale on the
   other. */
window.WARD_CHAINS = {
  /* Robinhood's own Ethereum L2, on the Arbitrum Orbit stack, mainnet since
     July 2026. Chain id, RPC and explorer all taken from Robinhood's own
     documentation rather than from memory; the explorer in particular has a
     crop of lookalike domains, so it is the Blockscout one their docs name.
     No stablecoin entry, for the same reason Hyperliquid has none: nothing
     checkable from here names a canonical USDC on it yet. */
  4663: {
    name: 'Robinhood Chain', short: 'Robinhood', coin: 'ETH', color: '#04D287',
    rpc: 'https://rpc.mainnet.chain.robinhood.com',
    explorer: 'https://robinhoodchain.blockscout.com',
    blurb: 'Robinhood\'s own Ethereum layer 2',
    tokens: []
  },
  8453: {
    name: 'Base', short: 'Base', coin: 'ETH', color: '#2151F5',
    rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org',
    blurb: 'Fast, with fees in cents',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', color: '#2775CA' }
    ]
  },
  137: {
    name: 'Polygon', short: 'Polygon', coin: 'POL', color: '#8247E5',
    rpc: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com',
    blurb: 'Tiny fees, widely used for getting paid',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', color: '#2775CA' }
    ]
  },
  42161: {
    name: 'Arbitrum One', short: 'Arbitrum', coin: 'ETH', color: '#12AAFF',
    rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io',
    blurb: 'Cheap, and deep on liquidity',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', color: '#2775CA' }
    ]
  },
  10: {
    name: 'Optimism', short: 'Optimism', coin: 'ETH', color: '#FF0420',
    rpc: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io',
    blurb: 'Quick, low fees',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', color: '#2775CA' }
    ]
  },
  56: {
    name: 'BNB Smart Chain', short: 'BNB Chain', coin: 'BNB', color: '#F3BA2F',
    rpc: 'https://bsc-dataseed.binance.org', explorer: 'https://bscscan.com',
    blurb: 'Cheap, and where BNB lives',
    /* Native BNB only. This container cannot reach the chain, so no token
       contract here could be checked against it, and an unchecked token address
       is a way to send money somewhere nobody can reach. These two were
       confirmed against PancakeSwap's and SushiSwap's own token definitions —
       two unrelated projects that agree on the same address — rather than
       from memory. Note the decimals: on BNB Chain these are 18, not the 6
       they have on every other network here. Guessing that would have
       mis-stated every amount by a factor of a trillion. */
    tokens: [
      { symbol: 'USDC', name: 'Binance-Peg USD Coin', decimals: 18, address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', color: '#2775CA' }
    ]
  },
  999: {
    name: 'Hyperliquid', short: 'Hyperliquid', coin: 'HYPE', color: '#97FCE4',
    rpc: 'https://rpc.hyperliquid.xyz/evm', explorer: 'https://hyperevmscan.io',
    blurb: 'Where HYPE lives',
    /* Still empty, and for the same reason as before: no source I can check
       from here lists a USDC contract on HyperEVM, and an unchecked token
       address is a way to send money somewhere nobody can reach. The chain id
       below is checked against the node itself at runtime, which is the part
       that actually matters. */
    tokens: []
  },
  /* Solana is the one entry here that is not EVM. It has its own key type,
     its own address format and its own RPC, so the wallet keeps its handling
     in sol.js and marks it here rather than letting ethers anywhere near it.
     The mint addresses come from Solana Labs' own token registry, not from
     memory — an unchecked token address is a way to send money somewhere
     nobody can reach. */
  sol: {
    family: 'sol', decimals: 9,
    name: 'Solana', short: 'Solana', coin: 'SOL', color: '#14F195',
    rpc: 'https://api.mainnet-beta.solana.com', explorer: 'https://solscan.io',
    blurb: 'Fast and cheap, and not an EVM chain',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', color: '#2775CA' }
    ]
  },
  1: {
    name: 'Ethereum', short: 'Ethereum', coin: 'ETH', color: '#627EEA',
    rpc: 'https://ethereum-rpc.publicnode.com', explorer: 'https://etherscan.io',
    blurb: 'The main one, and the priciest to use',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', color: '#2775CA' }
    ]
  }
};
