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
   * wired and will light up the moment an address is filled and verified. */
  assets: {
    green: {                                    // stable value
      family: 'Stables', blurb: 'the ones that try not to move',
      bid:   { name: 'USD Coin',        ticker: 'USDC',  glyph: 'grid',     address: '', decimals: 6 },
      ask:   { name: 'Tether USD',      ticker: 'USDT',  glyph: 'bars',     address: '', decimals: 6 },
      short: { name: 'Dai',             ticker: 'DAI',   glyph: 'orbit',    address: '', decimals: 18 },
      long:  { name: 'Euro Coin',       ticker: 'EURC',  glyph: 'chevron',  address: '', decimals: 6 },
    },
    blue: {                                     // ether and its derivatives
      family: 'Ether', blurb: 'the chain’s own money, and its echoes',
      bid:   { name: 'Wrapped Ether',   ticker: 'WETH',  glyph: 'delta',    address: '', decimals: 18 },
      ask:   { name: 'Coinbase Wrapped Staked ETH', ticker: 'cbETH', glyph: 'tiles', address: '', decimals: 18 },
      short: { name: 'Wrapped stETH',   ticker: 'wstETH', glyph: 'wave',    address: '', decimals: 18 },
      long:  { name: 'Rocket Pool ETH', ticker: 'rETH',  glyph: 'play',     address: '', decimals: 18 },
    },
    yellow: {                                   // bitcoin, wrapped
      family: 'Bitcoin', blurb: 'the old one, wearing a wrapper',
      bid:   { name: 'Coinbase Wrapped BTC', ticker: 'cbBTC', glyph: 'arc',  address: '', decimals: 8 },
      ask:   { name: 'tBTC',            ticker: 'tBTC',  glyph: 'loop',     address: '', decimals: 18 },
      short: { name: 'Wrapped BTC',     ticker: 'WBTC',  glyph: 'stack',    address: '', decimals: 8 },
      long:  { name: 'Coinbase Wrapped BTC (alt)', ticker: 'BTC', glyph: 'arrowbox', address: '', decimals: 8 },
    },
    red: {                                      // native to the chain
      family: 'Natives', blurb: 'the ones that only exist here',
      bid:   { name: 'Aerodrome',       ticker: 'AERO',  glyph: 'bolt',     address: '', decimals: 18 },
      ask:   { name: 'Degen',           ticker: 'DEGEN', glyph: 'spark',    address: '', decimals: 18 },
      short: { name: 'Chainlink',       ticker: 'LINK',  glyph: 'rail',     address: '', decimals: 18 },
      long:  { name: 'Uniswap',         ticker: 'UNI',   glyph: 'waves',    address: '', decimals: 18 },
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
