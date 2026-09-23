/* Spinpad — configuration.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TWO THINGS, KEPT APART ON PURPOSE.
 *
 * The DRAW is a theme. The board has sixteen squares, each one a company, and
 * the spin decides which one your coin is named after. That theme is written
 * into the coin's contract at construction and cannot be changed afterwards.
 * It is a name on a token. It is not a claim about that company's share price,
 * there is no oracle, nothing tracks anything, and nobody from those companies
 * has anything to do with this.
 *
 * The PAIR is a real token. A company is not an ERC-20, so a pool cannot be
 * opened against "Tesla". Every pool is opened against `quote` below — one real
 * token on the chain, whose address you fill in and which the pad verifies
 * before it will touch it.
 *
 * A NOTE YOU SHOULD READ ONCE. Naming a token after a listed company and then
 * making it tradeable is a real-world risk, not a styling choice: it is other
 * people's trademarks, and regulators in most countries take an interest in
 * anything that looks like a bet on a share. This file is where you would
 * change the names if you would rather not carry that.
 *
 * ADDRESSES ARE EMPTY ON PURPOSE. They were not written from memory, because a
 * wrong one sends real liquidity somewhere it cannot be recovered from. Fill
 * them from a source you trust; the pad calls symbol() and decimals() on the
 * quote token and refuses to open a pool if the answers do not match.
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

  /* The router that opens the pool and takes the first liquidity.
   * Uniswap V2-compatible: addLiquidity / addLiquidityETH. A Solidly-style
   * router (Aerodrome) has a different signature and will not work unchanged —
   * the pad checks the interface before it calls it. */
  router: {
    address: '',                                // ← fill in, then verify
    kind: 'uniswap-v2',
    weth: '',                                   // ← the router's WETH(), fill in
  },

  /* Every pool is opened against this one token. It is the only address the pad
   * needs to move money, and it is checked against the chain on connect. */
  quote: {
    name: 'Wrapped Ether',
    ticker: 'WETH',
    address: '',                                // ← fill in, then verify
    decimals: 18,
  },

  /* The sixteen squares: colour picks the family, quadrant picks the name.
   *
   * `logo` is already pointing at assets/<ticker>.png for every square, so there
   * is nothing to edit: drop tsla.png into assets/ and Tesla's square wears it.
   * Until a file is there the square falls back to a drawn abstract mark — never
   * an imitation of a real logo — and it does that silently, so a missing file
   * costs nothing. Point it at a URL instead if you would rather not host them.
   * See assets/README.md.
   *
   * These names are themes. Nothing here tracks a share price. */
  assets: {
    green: {
      family: 'Silicon', blurb: 'the ones that make the chips',
      bid:   { name: 'Nvidia',   ticker: 'NVDA',  glyph: 'chevron',  logo: 'assets/nvda.png' },
      ask:   { name: 'AMD',      ticker: 'AMD',   glyph: 'bars',     logo: 'assets/amd.png' },
      short: { name: 'Broadcom', ticker: 'AVGO',  glyph: 'orbit',    logo: 'assets/avgo.png' },
      long:  { name: 'TSMC',     ticker: 'TSM',   glyph: 'grid',     logo: 'assets/tsm.png' },
    },
    yellow: {
      family: 'Shelves', blurb: 'the ones that move the boxes',
      bid:   { name: 'Amazon',   ticker: 'AMZN',  glyph: 'arc',      logo: 'assets/amzn.png' },
      ask:   { name: 'Shopify',  ticker: 'SHOP',  glyph: 'arrowbox', logo: 'assets/shop.png' },
      short: { name: 'Walmart',  ticker: 'WMT',   glyph: 'stack',    logo: 'assets/wmt.png' },
      long:  { name: 'Coupang',  ticker: 'CPNG',  glyph: 'loop',     logo: 'assets/cpng.png' },
    },
    blue: {
      family: 'Signal', blurb: 'the ones with your attention',
      bid:   { name: 'Meta',     ticker: 'META',  glyph: 'play',     logo: 'assets/meta.png' },
      ask:   { name: 'Netflix',  ticker: 'NFLX',  glyph: 'spark',    logo: 'assets/nflx.png' },
      short: { name: 'Spotify',  ticker: 'SPOT',  glyph: 'wave',     logo: 'assets/spot.png' },
      long:  { name: 'Alphabet', ticker: 'GOOGL', glyph: 'tiles',    logo: 'assets/googl.png' },
    },
    red: {
      family: 'Motion', blurb: 'the ones that go somewhere',
      bid:   { name: 'Tesla',    ticker: 'TSLA',  glyph: 'bolt',     logo: 'assets/tsla.png' },
      ask:   { name: 'Rivian',   ticker: 'RIVN',  glyph: 'rail',     logo: 'assets/rivn.png' },
      short: { name: 'Uber',     ticker: 'UBER',  glyph: 'waves',    logo: 'assets/uber.png' },
      long:  { name: 'Ford',     ticker: 'F',     glyph: 'delta',    logo: 'assets/f.png' },
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
