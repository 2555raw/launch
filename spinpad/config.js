/* Spinpad — chain configuration.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE THE FIRST LAUNCH.
 *
 * Every address below is deliberately empty. They were not filled in from
 * memory, because a wrong address here does not throw an error — it sends real
 * liquidity into a token nobody owns, and there is no undo on a chain.
 *
 * Fill each one from a source you trust (the token's own site, or Basescan's
 * verified contract page), then let the pad check them: on connect it calls
 * symbol(), decimals() and name() on every address against the live chain and
 * refuses to launch against anything that does not answer like the ERC-20 it
 * claims to be. The check is in `verifyTokens()` in app.js.
 *
 * Until an address is filled and verified, its square on the board is drawn
 * but cannot be launched against, and the pad says so.
 * ────────────────────────────────────────────────────────────────────────────
 */
window.SPINPAD_CONFIG = {
  chain: {
    id: 8453,                                   // Base mainnet
    hex: '0x2105',
    name: 'Base',
    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    // Only used if the wallet does not know the chain yet, via wallet_addEthereumChain.
    rpc: ['https://mainnet.base.org'],
    explorer: 'https://basescan.org',
  },

  /* The router that creates the pool and takes the first liquidity.
   * Uniswap V2-compatible interface: addLiquidity / addLiquidityETH.
   * A Solidly-style router (Aerodrome) has a different signature and will not
   * work here unchanged — the pad checks the interface before it calls it. */
  router: {
    address: '',                                // ← fill in, then verify
    kind: 'uniswap-v2',
    weth: '',                                   // ← the router's WETH(), fill in
  },

  /* The sixteen squares. colour = family, quadrant = which name inside it.
   * `address` empty means "not launchable yet"; everything else is already
   * wired and will light up the moment an address is filled and verified.
   *
   * `logo` is optional. Leave it empty and the square wears a drawn mark — the
   * sign the money already has where there is one (a dollar, a euro, an ether
   * diamond, a bitcoin B) and an abstract one otherwise. Put a URL there and it
   * is used instead, falling back to the drawn mark if the image fails. No URLs
   * ship here for the same reason no addresses do: they could not be checked
   * from where this was built. Take them from each project's own brand page. */
  assets: {
    green: {                                    // stable value
      family: 'Stables', blurb: 'the ones that try not to move',
      bid:   { name: 'USD Coin',        ticker: 'USDC',  glyph: 'dollar',     address: '', decimals: 6, logo: '' },
      ask:   { name: 'Tether USD',      ticker: 'USDT',  glyph: 'bars',     address: '', decimals: 6, logo: '' },
      short: { name: 'Dai',             ticker: 'DAI',   glyph: 'orbit',    address: '', decimals: 18, logo: '' },
      long:  { name: 'Euro Coin',       ticker: 'EURC',  glyph: 'euro',  address: '', decimals: 6, logo: '' },
    },
    blue: {                                     // ether and its derivatives
      family: 'Ether', blurb: 'the chain’s own money, and its echoes',
      bid:   { name: 'Wrapped Ether',   ticker: 'WETH',  glyph: 'ether',    address: '', decimals: 18, logo: '' },
      ask:   { name: 'Coinbase Wrapped Staked ETH', ticker: 'cbETH', glyph: 'etherRing', address: '', decimals: 18, logo: '' },
      short: { name: 'Wrapped stETH',   ticker: 'wstETH', glyph: 'etherArc',    address: '', decimals: 18, logo: '' },
      long:  { name: 'Rocket Pool ETH', ticker: 'rETH',  glyph: 'etherDot',     address: '', decimals: 18, logo: '' },
    },
    yellow: {                                   // bitcoin, wrapped four ways
      family: 'Bitcoin', blurb: 'the old one, wearing a wrapper',
      bid:   { name: 'Coinbase Wrapped BTC', ticker: 'cbBTC', glyph: 'bitcoin',  address: '', decimals: 8, logo: '' },
      ask:   { name: 'tBTC',            ticker: 'tBTC',  glyph: 'bitcoinO',     address: '', decimals: 18, logo: '' },
      short: { name: 'Wrapped BTC',     ticker: 'WBTC',  glyph: 'bitcoinB',    address: '', decimals: 8, logo: '' },
      long:  { name: 'Lombard Staked BTC', ticker: 'LBTC',  glyph: 'bitcoinO', address: '', decimals: 8, logo: '' },
    },
    red: {                                      // native to the chain
      family: 'Natives', blurb: 'the ones that only exist here',
      bid:   { name: 'Aerodrome',       ticker: 'AERO',  glyph: 'bolt',     address: '', decimals: 18, logo: '' },
      ask:   { name: 'Degen',           ticker: 'DEGEN', glyph: 'spark',    address: '', decimals: 18, logo: '' },
      short: { name: 'Chainlink',       ticker: 'LINK',  glyph: 'rail',     address: '', decimals: 18, logo: '' },
      long:  { name: 'Uniswap',         ticker: 'UNI',   glyph: 'waves',    address: '', decimals: 18, logo: '' },
    },
  },

  /* What the pad puts into the first pool, as a fraction of the coin's supply
   * and an amount of the drawn token. Both are confirmed in the wallet before
   * anything moves. */
  liquidity: {
    supplyShare: 0.8,          // 80% of the new coin goes into the pool
    slippageBps: 100,          // 1%
    deadlineMinutes: 20,
  },
};
